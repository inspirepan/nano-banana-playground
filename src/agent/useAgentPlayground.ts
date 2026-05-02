import { Agent, ProviderTransport, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useRef, useState } from 'react'

import { compressedAttachmentToAgentAttachment, type AgentChatAttachment } from './agentChat'
import {
  buildCompactionSummaryMessage,
  compact,
  DEFAULT_COMPACTION_SETTINGS,
  estimateContextTokens,
  shouldCompact,
} from './compaction'
import { compressImageForAgentInput } from './imageCompression'
import {
  AGENT_PROMPT_DEFAULT_LINE_LIMIT,
  formatPromptLines,
  isTerminalAgentImageTaskStatus,
  promptLineCount,
  type AgentImageRegistryEntry,
  type AgentImageTask,
  type AgentTurnCallbackState,
} from './imageTasks'
import {
  activateAgentResponseMetadata,
  agentTaskStatusFromGenerationJob,
  buildAgentTaskCallbackText,
  errorFromGenerationJob,
  getAgentError,
  getAgentStreamingMessage,
  injectAbandonedToolResults,
  metadataForAgentMessage,
  queueAgentResponseMetadata,
  restoreAgentImageTasks,
  toolTextResult,
} from './messageRecovery'
import { activeOptionsForModel, findModelConfig, normalizeAspectRatio, normalizeResolution } from './modelLookup'
import {
  buildLanguageDirective,
  buildPreferredImageModelClearedDirective,
  buildPreferredImageModelDirective,
  isAgentModelProvider,
  syncGeminiAgentBaseUrl,
} from './runtimeConfig'
import {
  AGENT_TASK_PROTOCOL_MESSAGES,
  type AgentPendingQuestion,
  type AgentQuestionResolver,
  type AgentSessionRuntime,
  type ProviderCredentials,
} from './runtimeTypes'
import {
  appendAgentSessionMessage,
  createAgentSessionRecord,
  deleteAgentSession,
  listAgentSessions,
  loadAgentSession,
  saveAgentSessionSidecar,
  updateAgentSessionConfig,
} from './sessionStore'
import type { AgentCompactionState, AgentSessionMessageMetadata, AgentSessionSummary } from './sessionTypes'
import { buildAvailableSkillsSystemMessage } from './skills/listing'
import { getAgentSkillSummaries } from './skills/registry'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import {
  createAgentTools,
  formatAskUserQuestionResult,
  type AgentToolResult,
  type AskUserQuestionAnswer,
  type AskUserQuestionToolArgs,
  type CreateSkillToolArgs,
  type GenImageToolArgs,
  type ReadImageToolArgs,
  type ReadSkillFileToolArgs,
  type SkillToolArgs,
  type WebFetchToolArgs,
} from './tools'
import { useAgentAttachments } from './useAgentAttachments'
import { useAgentImageRegistry } from './useAgentImageRegistry'
import { useAgentSkills } from './useAgentSkills'
import {
  AGENT_MODEL_CONFIGS,
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import {
  getPreferredAgentModelId,
  getPreferredAgentThinkingLevel,
  setPreferredAgentModelId,
  setPreferredAgentThinkingLevel,
} from '../config/agentPreferences'
import { MODEL_CONFIGS, defaultOptionsFor, type ModelConfig } from '../config/models'
import { getPreferredImageModelId } from '../config/preferredImageModel'
import { getProviderConfig } from '../config/providers'
import { useExternalSync, useMountEffect } from '../hooks/effects'
import type { useApiKey } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import { getActiveLanguage, translate } from '../i18n'
import { stackIdForGenerationRequest } from '../lib/stackId'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { isKeyError } from '../lib/validateKey'

export type { AgentPendingQuestion } from './runtimeTypes'

type ApiKeyHook = ReturnType<typeof useApiKey>

export type UseAgentPlaygroundParams = {
  initialSessionId: string | null
  keyHooks: Record<AgentModelProvider, ApiKeyHook>
  referenceImages: PlaygroundImage[]
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  getProviderCredentials: (provider: ModelConfig['provider']) => ProviderCredentials
  invalidateGenerationKey: (provider: AgentModelProvider) => void
  enqueueGenerationJob: (
    request: GenerationJob['request'],
    batchCount: number,
    stackId: string,
    parentImageId?: string,
  ) => string
  cancelGenerationJob: (jobId: string) => void
  dismissGenerationJob: (jobId: string) => void
}

export function useAgentPlayground({
  initialSessionId,
  keyHooks,
  referenceImages,
  history,
  generationJobs,
  getProviderCredentials,
  invalidateGenerationKey,
  enqueueGenerationJob,
  cancelGenerationJob,
  dismissGenerationJob,
}: UseAgentPlaygroundParams) {
  const [agentModelId, setAgentModelId] = useState(getPreferredAgentModelId)
  const agentModel = resolveAgentModelConfig(agentModelId)
  const [agentThinkingLevel, setAgentThinkingLevelState] = useState<AgentThinkingLevel>(getPreferredAgentThinkingLevel)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentMessageMetadata, setAgentMessageMetadata] = useState(
    () => new WeakMap<AgentMessage, AgentSessionMessageMetadata>(),
  )
  const [agentStreamingMessage, setAgentStreamingMessage] = useState<AgentMessage | null>(null)
  const [agentIsStreaming, setAgentIsStreaming] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentDraft, setAgentDraft] = useState('')
  const [agentAttachments, setAgentAttachments] = useState<AgentChatAttachment[]>([])
  const [agentAttachmentError, setAgentAttachmentError] = useState<string | null>(null)
  const [autoApproveAgentImageTasks, setAutoApproveAgentImageTasksState] = useState(false)
  const [agentImageTasks, setAgentImageTasksState] = useState<AgentImageTask[]>([])
  const [agentPendingQuestions, setAgentPendingQuestionsState] = useState<AgentPendingQuestion[]>([])
  const [agentSessions, setAgentSessions] = useState<AgentSessionSummary[]>([])
  const [currentAgentSessionId, setCurrentAgentSessionId] = useState<string | null>(null)
  const [agentSessionsLoading, setAgentSessionsLoading] = useState(true)
  const {
    agentSkills,
    setAgentSkillEnabled,
    deleteAgentSkill,
    getAgentSkillPackage,
    createUserAgentSkill,
    runSkillTool,
    runReadSkillFileTool,
    runCreateSkillTool,
    runWebFetchTool,
  } = useAgentSkills()

  const agentRuntimesRef = useRef<Map<string, AgentSessionRuntime>>(new Map())
  const currentAgentSessionIdRef = useRef<string | null>(null)
  const {
    generationJobsRefForAgent,
    reserveAgentImageIdsForRuntime,
    releasePendingAgentImageIds,
    resolveAgentImageById,
    resolveAgentReferenceImages,
  } = useAgentImageRegistry({ agentRuntimesRef, referenceImages, history, generationJobs })
  const agentCredentialsRef = useRef<Record<AgentModelProvider, ProviderCredentials>>({
    google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
    openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
    anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
    deepseek: { apiKey: keyHooks.deepseek.apiKey, baseUrl: keyHooks.deepseek.baseUrl },
  })
  const agentToolHandlersRef = useRef<{
    genImage: (
      sessionId: string,
      toolCallId: string,
      args: GenImageToolArgs,
      signal?: AbortSignal,
    ) => Promise<AgentToolResult>
    readImage: (sessionId: string, toolCallId: string, args: ReadImageToolArgs) => Promise<AgentToolResult>
    askUserQuestion: (
      sessionId: string,
      toolCallId: string,
      args: AskUserQuestionToolArgs,
      signal?: AbortSignal,
    ) => Promise<AgentToolResult>
    loadSkill: (sessionId: string, toolCallId: string, args: SkillToolArgs) => Promise<AgentToolResult>
    readSkillFile: (sessionId: string, toolCallId: string, args: ReadSkillFileToolArgs) => Promise<AgentToolResult>
    createSkill: (sessionId: string, toolCallId: string, args: CreateSkillToolArgs) => Promise<AgentToolResult>
    webFetch: (
      sessionId: string,
      toolCallId: string,
      args: WebFetchToolArgs,
      signal?: AbortSignal,
    ) => Promise<AgentToolResult>
  }>({
    genImage: async (_sessionId: string, _toolCallId: string, _args: GenImageToolArgs, _signal?: AbortSignal) => {
      throw new Error('Agent tools are not ready yet.')
    },
    readImage: async (_sessionId: string, _toolCallId: string, _args: ReadImageToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    askUserQuestion: (_sessionId: string, _toolCallId: string, _args: AskUserQuestionToolArgs, _signal?: AbortSignal) =>
      Promise.reject(new Error('Agent tools are not ready yet.')),
    loadSkill: async (_sessionId: string, _toolCallId: string, _args: SkillToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    readSkillFile: async (_sessionId: string, _toolCallId: string, _args: ReadSkillFileToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    createSkill: async (_sessionId: string, _toolCallId: string, _args: CreateSkillToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    webFetch: async (_sessionId: string, _toolCallId: string, _args: WebFetchToolArgs, _signal?: AbortSignal) => {
      throw new Error('Agent tools are not ready yet.')
    },
  })

  useExternalSync(() => {
    agentCredentialsRef.current = {
      google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
      openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
      anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
      deepseek: { apiKey: keyHooks.deepseek.apiKey, baseUrl: keyHooks.deepseek.baseUrl },
    }
  }, [
    keyHooks.anthropic.apiKey,
    keyHooks.anthropic.baseUrl,
    keyHooks.deepseek.apiKey,
    keyHooks.deepseek.baseUrl,
    keyHooks.google.apiKey,
    keyHooks.google.baseUrl,
    keyHooks.openai.apiKey,
    keyHooks.openai.baseUrl,
  ])

  const upsertAgentSessionSummary = useCallback((record: AgentSessionSummary) => {
    setAgentSessions((prev) =>
      record.messageCount > 0
        ? [record, ...prev.filter((item) => item.id !== record.id)].sort((a, b) => b.updatedAt - a.updatedAt)
        : prev.filter((item) => item.id !== record.id),
    )
  }, [])

  const getCurrentRuntime = useCallback((): AgentSessionRuntime | null => {
    const sessionId = currentAgentSessionIdRef.current
    return sessionId ? (agentRuntimesRef.current.get(sessionId) ?? null) : null
  }, [])

  const isCurrentRuntime = useCallback((runtime: AgentSessionRuntime) => {
    return runtime.sessionId === currentAgentSessionIdRef.current
  }, [])

  const projectRuntimeToUi = useCallback((runtime: AgentSessionRuntime) => {
    currentAgentSessionIdRef.current = runtime.sessionId
    setCurrentAgentSessionId(runtime.persisted ? runtime.sessionId : null)
    setAgentModelId(runtime.modelId)
    setAgentThinkingLevelState(runtime.thinkingLevel)
    setAutoApproveAgentImageTasksState(runtime.autoApproveImageTasks)
    setAgentMessages(runtime.messages)
    setAgentMessageMetadata(runtime.messageMetadata)
    setAgentStreamingMessage(runtime.streamingMessage)
    setAgentIsStreaming(runtime.isStreaming)
    setAgentError(runtime.error)
    setAgentDraft(runtime.draft)
    setAgentAttachments(runtime.attachments)
    setAgentAttachmentError(runtime.attachmentError)
    setAgentImageTasksState(runtime.imageTasks)
    setAgentPendingQuestionsState(runtime.pendingQuestions)
  }, [])

  const setRuntimeError = useCallback(
    (runtime: AgentSessionRuntime, message: string | null) => {
      runtime.error = message
      if (isCurrentRuntime(runtime)) setAgentError(message)
    },
    [isCurrentRuntime],
  )

  const maybeRunRuntimeCompactionRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})
  const maybeDispatchAgentImageCallbacksRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})

  const persistRuntimeSidecar = useCallback((runtime: AgentSessionRuntime) => {
    if (!runtime.ready || !runtime.persisted) return Promise.resolve()
    const payload = {
      sessionId: runtime.sessionId,
      draft: runtime.draft,
      attachments: runtime.attachments,
      imageTasks: runtime.imageTasks,
      imageRegistry: Array.from(runtime.imageRegistry.values()),
      turnCallbacks: Array.from(runtime.turnCallbacks.values()),
      currentAgentTurnId: runtime.currentAgentTurnId,
      pendingQuestions: runtime.pendingQuestions,
      lastCompaction: runtime.lastCompaction,
    }
    const write = runtime.sidecarPersistQueue.then(() => saveAgentSessionSidecar(payload))
    runtime.sidecarPersistQueue = write.catch(() => undefined)
    return write.catch(() => undefined)
  }, [])

  const scheduleRuntimeSidecarPersist = useCallback(
    (runtime: AgentSessionRuntime) => {
      if (!runtime.ready) return
      window.clearTimeout(runtime.sidecarDebounce)
      runtime.sidecarDebounce = window.setTimeout(() => {
        void persistRuntimeSidecar(runtime)
      }, 400)
    },
    [persistRuntimeSidecar],
  )

  const flushRuntime = useCallback(
    async (runtime: AgentSessionRuntime | null) => {
      if (!runtime) return
      window.clearTimeout(runtime.sidecarDebounce)
      await runtime.persistQueue
      await persistRuntimeSidecar(runtime)
      await runtime.sidecarPersistQueue
    },
    [persistRuntimeSidecar],
  )

  const setRuntimeImageTasks = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentImageTask[]) => AgentImageTask[]) => {
      const next = updater(runtime.imageTasks)
      runtime.imageTasks = next
      if (isCurrentRuntime(runtime)) setAgentImageTasksState(next)
      scheduleRuntimeSidecarPersist(runtime)
      return next
    },
    [isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const setRuntimePendingQuestions = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentPendingQuestion[]) => AgentPendingQuestion[]) => {
      const next = updater(runtime.pendingQuestions)
      runtime.pendingQuestions = next
      if (isCurrentRuntime(runtime)) setAgentPendingQuestionsState(next)
      scheduleRuntimeSidecarPersist(runtime)
      return next
    },
    [isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const clearRuntimeQuestionResolvers = useCallback(
    (runtime: AgentSessionRuntime, reason: string) => {
      if (runtime.questionResolvers.size === 0) return
      for (const [, resolver] of runtime.questionResolvers) {
        try {
          resolver.resolve(
            toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
              status: 'cancelled',
              reason,
            }),
          )
        } catch {
          // Ignore — caller may have moved on.
        }
      }
      runtime.questionResolvers.clear()
      setRuntimePendingQuestions(runtime, () => [])
    },
    [setRuntimePendingQuestions],
  )

  const getAgentBaseUrl = useCallback(
    (provider: AgentModelProvider) => agentCredentialsRef.current[provider].baseUrl,
    [],
  )

  const setAgentModelIdForSession = useCallback(
    (modelId: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.modelId = modelId
      setAgentModelId(modelId)
      setPreferredAgentModelId(modelId)
      const config = resolveAgentModelConfig(modelId)
      runtime.agent.state.model = agentModelWithBaseUrl(config, getAgentBaseUrl(config.provider))
      runtime.agent.state.thinkingLevel = config.supportsThinking ? runtime.thinkingLevel : 'off'
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { modelId }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [getAgentBaseUrl, getCurrentRuntime, upsertAgentSessionSummary],
  )

  const setAgentThinkingLevel = useCallback(
    (level: AgentThinkingLevel) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.thinkingLevel = level
      setAgentThinkingLevelState(level)
      setPreferredAgentThinkingLevel(level)
      const config = resolveAgentModelConfig(runtime.modelId)
      runtime.agent.state.thinkingLevel = config.supportsThinking ? level : 'off'
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { thinkingLevel: level }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [getCurrentRuntime, upsertAgentSessionSummary],
  )

  const syncRuntimeSnapshot = useCallback(
    (runtime: AgentSessionRuntime) => {
      runtime.messages = runtime.agent.state.messages.slice()
      runtime.streamingMessage = getAgentStreamingMessage(runtime.agent)
      if (runtime.streamingMessage) metadataForAgentMessage(runtime, runtime.streamingMessage)
      runtime.isStreaming = runtime.agent.state.isStreaming || runtime.isCompacting
      runtime.error = getAgentError(runtime.agent)
      if (!isCurrentRuntime(runtime)) return
      setAgentMessages(runtime.messages)
      setAgentMessageMetadata(runtime.messageMetadata)
      setAgentStreamingMessage(runtime.streamingMessage)
      setAgentIsStreaming(runtime.isStreaming)
      setAgentError(runtime.error)
    },
    [isCurrentRuntime],
  )

  const applyAgentRuntimeConfig = useCallback(
    (runtime: AgentSessionRuntime) => {
      const config = resolveAgentModelConfig(runtime.modelId)
      const baseUrl = getAgentBaseUrl(config.provider)
      syncGeminiAgentBaseUrl(config.provider, baseUrl)
      runtime.agent.state.systemPrompt = AGENT_SYSTEM_PROMPT
      runtime.agent.state.model = agentModelWithBaseUrl(config, baseUrl)
      runtime.agent.state.thinkingLevel = config.supportsThinking ? runtime.thinkingLevel : 'off'
      runtime.agent.state.tools = createAgentTools({
        imageModels: MODEL_CONFIGS,
        genImage: (toolCallId, args, signal) =>
          agentToolHandlersRef.current.genImage(runtime.sessionId, toolCallId, args, signal),
        readImage: (toolCallId, args) => agentToolHandlersRef.current.readImage(runtime.sessionId, toolCallId, args),
        askUserQuestion: (toolCallId, args, signal) =>
          agentToolHandlersRef.current.askUserQuestion(runtime.sessionId, toolCallId, args, signal),
        loadSkill: (toolCallId, args) => agentToolHandlersRef.current.loadSkill(runtime.sessionId, toolCallId, args),
        readSkillFile: (toolCallId, args) =>
          agentToolHandlersRef.current.readSkillFile(runtime.sessionId, toolCallId, args),
        createSkill: (toolCallId, args) =>
          agentToolHandlersRef.current.createSkill(runtime.sessionId, toolCallId, args),
        webFetch: (toolCallId, args, signal) =>
          agentToolHandlersRef.current.webFetch(runtime.sessionId, toolCallId, args, signal),
      })
    },
    [getAgentBaseUrl],
  )

  const runRuntimeCompaction = useCallback(
    async (runtime: AgentSessionRuntime) => {
      if (runtime.isCompacting || runtime.agent.state.isStreaming) return
      if (!runtime.ready) return
      if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return

      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) return

      const model = agentModelWithBaseUrl(config, credentials.baseUrl)
      const contextWindow = model.contextWindow ?? 0
      if (contextWindow <= 0) return

      // Trust assistant usage only when its timestamp is later than the last
      // compaction — otherwise the message still carries pre-compaction
      // usage.totalTokens and would falsely re-trigger compaction every turn.
      const minUsageTimestamp = runtime.lastCompaction?.createdAt ?? 0
      const settings = DEFAULT_COMPACTION_SETTINGS
      const preflightMessages = runtime.agent.state.messages
      if (preflightMessages.length === 0) return
      const preflightTokens = estimateContextTokens(preflightMessages, { minUsageTimestamp }).tokens
      if (!shouldCompact(preflightTokens, contextWindow, settings)) return

      // Acquire the compaction lock BEFORE awaiting persistence so that
      // sendAgentMessage / image callbacks / system events that all guard on
      // `isCompacting` cannot start a new prompt during the await window.
      runtime.isCompacting = true
      const abortController = new AbortController()
      runtime.compactionAbort = abortController
      // Use syncRuntimeSnapshot (not just setAgentIsStreaming) so runtime.isStreaming
      // also reflects the lock — otherwise the next sendAgentMessage would read the
      // stale runtime field and take the in-flight queueMessage path instead of prompt.
      syncRuntimeSnapshot(runtime)

      let compactionErrorMessage: string | null = null
      try {
        await runtime.persistQueue.catch(() => undefined)

        // Re-confirm runtime is still alive and idle. The await above can yield
        // long enough for the session to be deleted, swapped, or for some path
        // we did not lock to push the agent into a new turn.
        if (!runtime.ready) return
        if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return
        if (runtime.agent.state.isStreaming) return

        const messages = runtime.agent.state.messages.slice()
        if (messages.length === 0) return
        // If nothing changed during the await, the preflight estimate is still valid;
        // otherwise recompute on the latest snapshot.
        const sameAsPreflight =
          messages.length === preflightMessages.length &&
          messages[messages.length - 1] === preflightMessages[preflightMessages.length - 1]
        const contextTokens = sameAsPreflight
          ? preflightTokens
          : estimateContextTokens(messages, { minUsageTimestamp }).tokens
        if (!shouldCompact(contextTokens, contextWindow, settings)) return

        const previousSummary = runtime.lastCompaction?.summary
        const ignoreLeadingCount = previousSummary && messages.length > 0 ? 1 : 0

        const result = await compact({
          messages,
          settings,
          model,
          apiKey: credentials.apiKey,
          previousSummary,
          ignoreLeadingCount,
          tokensBefore: contextTokens,
          signal: abortController.signal,
        })
        if (!result) return
        if (!runtime.ready) return
        if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return

        // If user has appended new messages while we were summarizing, snap firstKeptIndex
        // forward proportionally so we don't drop those new messages.
        const liveMessages = runtime.agent.state.messages
        const drift = liveMessages.length - messages.length
        if (drift < 0) return // messages got truncated externally; bail
        const liveFirstKeptIndex = Math.min(result.firstKeptIndex, liveMessages.length)
        if (liveFirstKeptIndex <= 0) return

        const firstKeptMessage = liveMessages[liveFirstKeptIndex]
        if (!firstKeptMessage) return
        let firstKeptEntryId: string | undefined
        for (let i = liveFirstKeptIndex; i < liveMessages.length; i++) {
          const candidate = liveMessages[i]
          const id = runtime.messageEntryIds.get(candidate)
          if (id) {
            firstKeptEntryId = id
            break
          }
        }
        if (!firstKeptEntryId) return // nothing reliably persisted; skip this round

        const summaryMessage = buildCompactionSummaryMessage(result.summary)
        const keptMessages = liveMessages.slice(liveFirstKeptIndex)
        const nextMessages = [summaryMessage, ...keptMessages]

        runtime.agent.replaceMessages(nextMessages)
        runtime.lastCompaction = {
          summary: result.summary,
          firstKeptEntryId,
          tokensBefore: result.tokensBefore,
          createdAt: Date.now(),
        }

        // syncRuntimeSnapshot will copy agent.state.messages into runtime.messages
        // and push it to React state — no need to assign runtime.messages manually.
        syncRuntimeSnapshot(runtime)
        await persistRuntimeSidecar(runtime)
      } catch (error) {
        if (abortController.signal.aborted) return
        // Compaction failure should not break the user's session — log via runtime error
        // surface but keep messages intact. Stash the message and apply it AFTER
        // syncRuntimeSnapshot in finally so the snapshot does not overwrite it
        // with agent.state.error (which is unrelated to the summarization call).
        compactionErrorMessage = error instanceof Error ? error.message : String(error)
      } finally {
        runtime.isCompacting = false
        runtime.compactionAbort = null
        // Re-sync so runtime.isStreaming returns to agent.state.isStreaming.
        // setAgentIsStreaming alone would only update React state, leaving
        // runtime.isStreaming stuck at true and breaking the next sendAgentMessage.
        syncRuntimeSnapshot(runtime)
        if (compactionErrorMessage !== null) setRuntimeError(runtime, compactionErrorMessage)
        // Image task callbacks that arrived during compaction are skipped at
        // dispatch time; drain once now so the agent receives any deferred
        // "image finished" system events even if no further job updates fire.
        // Skip if the runtime was deleted or replaced — otherwise we could
        // dispatch onto a torn-down session.
        if (runtime.ready && agentRuntimesRef.current.get(runtime.sessionId) === runtime) {
          maybeDispatchAgentImageCallbacksRef.current(runtime)
        }
      }
    },
    [persistRuntimeSidecar, setRuntimeError, syncRuntimeSnapshot],
  )

  useExternalSync(() => {
    maybeRunRuntimeCompactionRef.current = (runtime) => {
      void runRuntimeCompaction(runtime)
    }
  }, [runRuntimeCompaction])

  const createRuntime = useCallback(
    (params: {
      sessionId: string
      persisted: boolean
      modelId: string
      thinkingLevel: AgentThinkingLevel
      autoApproveImageTasks: boolean
      leafEntryId: string | null
      messages: AgentMessage[]
      messageEntryIds: string[]
      messageMetadata: AgentSessionMessageMetadata[]
      lastCompaction?: AgentCompactionState
      draft: string
      attachments: AgentChatAttachment[]
      imageTasks: AgentImageTask[]
      imageRegistry: AgentImageRegistryEntry[]
      turnCallbacks: AgentTurnCallbackState[]
      currentAgentTurnId: string | null
      pendingQuestions: AgentPendingQuestion[]
    }): AgentSessionRuntime => {
      const config = resolveAgentModelConfig(params.modelId)
      const agent = new Agent({
        transport: new ProviderTransport({
          getApiKey: (provider) => {
            if (isAgentModelProvider(provider)) {
              return agentCredentialsRef.current[provider].apiKey || undefined
            }
            return undefined
          },
        }),
        initialState: {
          systemPrompt: AGENT_SYSTEM_PROMPT,
          model: agentModelWithBaseUrl(config, getAgentBaseUrl(config.provider)),
          thinkingLevel: config.supportsThinking ? params.thinkingLevel : 'off',
          tools: [],
          messages: params.messages,
        },
      })
      const messageEntryIds = new WeakMap<AgentMessage, string>()
      const messageMetadata = new WeakMap<AgentMessage, AgentSessionMessageMetadata>()
      const limit = Math.min(params.messages.length, params.messageEntryIds.length)
      for (let i = 0; i < limit; i++) {
        const message = params.messages[i]
        const entryId = params.messageEntryIds[i]
        if (message && typeof entryId === 'string' && entryId) messageEntryIds.set(message, entryId)
        const metadata = params.messageMetadata[i]
        if (message && metadata) messageMetadata.set(message, metadata)
      }

      const runtime: AgentSessionRuntime = {
        sessionId: params.sessionId,
        persisted: params.persisted,
        agent,
        ready: false,
        modelId: params.modelId,
        thinkingLevel: params.thinkingLevel,
        autoApproveImageTasks: params.autoApproveImageTasks,
        messages: params.messages,
        streamingMessage: null,
        isStreaming: false,
        error: null,
        draft: params.draft,
        attachments: params.attachments,
        attachmentError: null,
        imageTasks: params.imageTasks,
        imageRegistry: new Map(params.imageRegistry.map((entry) => [entry.id, entry])),
        turnCallbacks: new Map(params.turnCallbacks.map((callback) => [callback.agentTurnId, callback])),
        currentAgentTurnId: params.currentAgentTurnId,
        leafEntryId: params.leafEntryId,
        pendingQuestions: params.pendingQuestions,
        questionResolvers: new Map(),
        persistQueue: Promise.resolve(),
        sidecarPersistQueue: Promise.resolve(),
        sidecarDebounce: 0,
        promptPreparing: false,
        messageEntryIds,
        messageMetadata,
        activeResponseMetadata: undefined,
        queuedResponseMetadata: [],
        lastCompaction: params.lastCompaction,
        isCompacting: false,
        compactionAbort: null,
        lastInjectedPreferredImageModelId: undefined,
      }
      agent.subscribe((event) => {
        if (event.type === 'message_end') {
          metadataForAgentMessage(runtime, event.message)
        }
        syncRuntimeSnapshot(runtime)
        if (event.type === 'message_end') {
          const persistedMessage = event.message
          const metadata = runtime.messageMetadata.get(persistedMessage)
          runtime.persistQueue = runtime.persistQueue
            .then(async () => {
              const result = await appendAgentSessionMessage({
                sessionId: runtime.sessionId,
                parentId: runtime.leafEntryId,
                message: persistedMessage,
                metadata,
                ...(runtime.persisted
                  ? {}
                  : {
                      createSession: {
                        id: runtime.sessionId,
                        modelId: runtime.modelId,
                        thinkingLevel: runtime.thinkingLevel,
                        autoApproveImageTasks: runtime.autoApproveImageTasks,
                      },
                    }),
              })
              runtime.leafEntryId = result.entryId
              runtime.messageEntryIds.set(persistedMessage, result.entryId)
              if (!runtime.persisted) {
                runtime.persisted = true
                if (isCurrentRuntime(runtime)) setCurrentAgentSessionId(runtime.sessionId)
                void persistRuntimeSidecar(runtime)
              }
              upsertAgentSessionSummary(result.record)
            })
            .catch((error: unknown) => {
              setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
            })
          return
        }
        if (event.type === 'agent_end') {
          runtime.activeResponseMetadata = runtime.queuedResponseMetadata.shift()
          maybeRunRuntimeCompactionRef.current(runtime)
        }
      })
      agentRuntimesRef.current.set(runtime.sessionId, runtime)
      applyAgentRuntimeConfig(runtime)
      syncRuntimeSnapshot(runtime)
      runtime.ready = true
      return runtime
    },
    [
      applyAgentRuntimeConfig,
      getAgentBaseUrl,
      isCurrentRuntime,
      persistRuntimeSidecar,
      setRuntimeError,
      syncRuntimeSnapshot,
      upsertAgentSessionSummary,
    ],
  )

  const loadAgentSessionIntoRuntime = useCallback(
    (session: Awaited<ReturnType<typeof loadAgentSession>>) => {
      if (!session) return
      const existing = agentRuntimesRef.current.get(session.record.id)
      if (existing) {
        projectRuntimeToUi(existing)
        return
      }
      const restoredTasks = restoreAgentImageTasks(session.sidecar.imageTasks)
      const releasedReservedIds = new Set<string>()
      for (let index = 0; index < session.sidecar.imageTasks.length; index++) {
        const original = session.sidecar.imageTasks[index]
        const restored = restoredTasks[index]
        if (original.status === restored.status) continue
        const fulfilledIds = new Set(restored.resultImageIds)
        for (const id of restored.request.reservedImageIds) {
          if (!fulfilledIds.has(id)) releasedReservedIds.add(id)
        }
      }
      const restoredRegistry = session.sidecar.imageRegistry.filter((entry) => !releasedReservedIds.has(entry.id))

      const restoredQuestions = session.sidecar.pendingQuestions ?? []
      const restoredQuestionIds = new Set(restoredQuestions.map((item) => item.toolCallId))

      const lastCompaction = session.sidecar.lastCompaction
      const persistedMessages = session.messages
      const persistedEntryIds = session.messageEntryIds
      const persistedMetadata = session.messageMetadata
      let runtimeMessages = persistedMessages
      let runtimeEntryIds = persistedEntryIds
      let runtimeMetadata = persistedMetadata
      if (lastCompaction) {
        const summaryMessage = buildCompactionSummaryMessage(lastCompaction.summary, lastCompaction.createdAt)
        runtimeMessages = [summaryMessage, ...persistedMessages]
        runtimeEntryIds = ['', ...persistedEntryIds]
        runtimeMetadata = [{}, ...persistedMetadata]
      }
      const finalMessages = injectAbandonedToolResults(runtimeMessages, restoredQuestionIds)
      // injectAbandonedToolResults preserves originals in order and only inserts
      // synthetic toolResult placeholders, so we can walk in lockstep instead of
      // calling indexOf per message (which was O(N²) on large transcripts).
      const finalEntryIds: string[] = []
      const finalMetadata: AgentSessionMessageMetadata[] = []
      let originalCursor = 0
      for (const message of finalMessages) {
        if (originalCursor < runtimeMessages.length && runtimeMessages[originalCursor] === message) {
          finalEntryIds.push(runtimeEntryIds[originalCursor] ?? '')
          finalMetadata.push(runtimeMetadata[originalCursor] ?? {})
          originalCursor++
        } else {
          finalEntryIds.push('')
          finalMetadata.push({})
        }
      }

      const runtime = createRuntime({
        sessionId: session.record.id,
        persisted: true,
        modelId: session.record.modelId,
        thinkingLevel: session.record.thinkingLevel,
        autoApproveImageTasks: session.record.autoApproveImageTasks,
        leafEntryId: session.record.leafEntryId,
        messages: finalMessages,
        messageEntryIds: finalEntryIds,
        messageMetadata: finalMetadata,
        lastCompaction,
        draft: session.sidecar.draft,
        attachments: session.sidecar.attachments,
        imageTasks: restoredTasks,
        imageRegistry: restoredRegistry,
        turnCallbacks: session.sidecar.turnCallbacks,
        currentAgentTurnId: session.sidecar.currentAgentTurnId,
        pendingQuestions: restoredQuestions,
      })
      runtime.agent.state.error = undefined
      runtime.agent.state.streamMessage = null
      runtime.agent.state.pendingToolCalls = new Set()
      runtime.agent.replaceMessages(runtime.messages)
      syncRuntimeSnapshot(runtime)
      projectRuntimeToUi(runtime)
    },
    [createRuntime, projectRuntimeToUi, syncRuntimeSnapshot],
  )

  const createNewAgentSession = useCallback(async () => {
    const previousRuntime = getCurrentRuntime()
    await flushRuntime(previousRuntime)
    if (
      previousRuntime &&
      !previousRuntime.persisted &&
      !previousRuntime.isStreaming &&
      previousRuntime.messages.length === 0
    ) {
      agentRuntimesRef.current.delete(previousRuntime.sessionId)
    }
    const record = createAgentSessionRecord({
      modelId: getPreferredAgentModelId(),
      thinkingLevel: getPreferredAgentThinkingLevel(),
      autoApproveImageTasks: autoApproveAgentImageTasks,
    })
    const runtime = createRuntime({
      sessionId: record.id,
      persisted: false,
      modelId: record.modelId,
      thinkingLevel: record.thinkingLevel,
      autoApproveImageTasks: record.autoApproveImageTasks,
      leafEntryId: null,
      messages: [],
      messageEntryIds: [],
      messageMetadata: [],
      draft: '',
      attachments: [],
      imageTasks: [],
      imageRegistry: [],
      turnCallbacks: [],
      currentAgentTurnId: null,
      pendingQuestions: [],
      lastCompaction: undefined,
    })
    projectRuntimeToUi(runtime)
  }, [autoApproveAgentImageTasks, createRuntime, flushRuntime, getCurrentRuntime, projectRuntimeToUi])

  const switchAgentSession = useCallback(
    (sessionId: string) => {
      if (sessionId === currentAgentSessionIdRef.current) return
      void (async () => {
        const previousRuntime = getCurrentRuntime()
        await flushRuntime(previousRuntime)
        if (previousRuntime && !previousRuntime.persisted && previousRuntime.messages.length === 0) {
          agentRuntimesRef.current.delete(previousRuntime.sessionId)
        }
        const runtime = agentRuntimesRef.current.get(sessionId)
        if (runtime) {
          projectRuntimeToUi(runtime)
          return
        }
        loadAgentSessionIntoRuntime(await loadAgentSession(sessionId))
      })().catch((error: unknown) => {
        setAgentError(error instanceof Error ? error.message : String(error))
      })
    },
    [flushRuntime, getCurrentRuntime, loadAgentSessionIntoRuntime, projectRuntimeToUi],
  )

  const removeAgentSession = useCallback(
    (sessionId: string) => {
      void (async () => {
        const runtime = agentRuntimesRef.current.get(sessionId)
        if (runtime) {
          runtime.ready = false
          clearRuntimeQuestionResolvers(runtime, 'session_deleted')
          runtime.compactionAbort?.abort()
          runtime.agent.abort()
          for (const task of runtime.imageTasks) {
            if (task.generationJobId && !isTerminalAgentImageTaskStatus(task.status))
              cancelGenerationJob(task.generationJobId)
          }
          agentRuntimesRef.current.delete(sessionId)
        }
        await deleteAgentSession(sessionId)
        const nextSessions = (await listAgentSessions()).filter((session) => session.id !== sessionId)
        setAgentSessions(nextSessions)
        if (sessionId !== currentAgentSessionIdRef.current) return
        const next = nextSessions[0]
        if (next) {
          loadAgentSessionIntoRuntime(await loadAgentSession(next.id))
        } else {
          currentAgentSessionIdRef.current = null
          setCurrentAgentSessionId(null)
          await createNewAgentSession()
        }
      })().catch((error: unknown) => {
        setAgentError(error instanceof Error ? error.message : String(error))
      })
    },
    [cancelGenerationJob, clearRuntimeQuestionResolvers, createNewAgentSession, loadAgentSessionIntoRuntime],
  )

  useMountEffect(() => {
    void (async () => {
      setAgentSessionsLoading(true)
      const sessions = await listAgentSessions()
      setAgentSessions(sessions)
      const initialSession = initialSessionId
        ? (sessions.find((session) => session.id === initialSessionId) ?? null)
        : null
      if (initialSession || sessions[0]) {
        loadAgentSessionIntoRuntime(await loadAgentSession((initialSession ?? sessions[0]).id))
      } else {
        await createNewAgentSession()
      }
      setAgentSessionsLoading(false)
    })().catch((error: unknown) => {
      setAgentSessionsLoading(false)
      setAgentError(error instanceof Error ? error.message : String(error))
    })
  })

  useExternalSync(() => {
    for (const runtime of agentRuntimesRef.current.values()) {
      applyAgentRuntimeConfig(runtime)
      syncRuntimeSnapshot(runtime)
    }
  }, [applyAgentRuntimeConfig, syncRuntimeSnapshot])

  const { addAgentAttachments, addAgentImageAttachment, removeAgentAttachment, clearAgentAttachmentError } =
    useAgentAttachments({
      getCurrentRuntime,
      isCurrentRuntime,
      scheduleRuntimeSidecarPersist,
      setAgentAttachments,
      setAgentAttachmentError,
    })

  const sendAgentSystemEvent = useCallback(
    async (runtime: AgentSessionRuntime, text: string): Promise<boolean> => {
      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) {
        setRuntimeError(runtime, translate('configLib.agent.callbackMissingKey', { provider: config.providerLabel }))
        return false
      }

      applyAgentRuntimeConfig(runtime)
      runtime.currentAgentTurnId = crypto.randomUUID()
      if (runtime.agent.state.isStreaming || runtime.isCompacting) {
        queueAgentResponseMetadata(runtime, config.id)
        await runtime.agent.queueMessage({ role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() })
      } else {
        activateAgentResponseMetadata(runtime, config.id)
        await runtime.agent.prompt(text)
      }
      syncRuntimeSnapshot(runtime)
      return true
    },
    [applyAgentRuntimeConfig, setRuntimeError, syncRuntimeSnapshot],
  )

  const maybeDispatchAgentImageCallbacks = useCallback(
    (runtime: AgentSessionRuntime, tasks = runtime.imageTasks) => {
      if (runtime.agent.state.isStreaming || runtime.isCompacting) return
      for (const callbackState of runtime.turnCallbacks.values()) {
        if (callbackState.callbackQueued || callbackState.taskIds.length === 0) continue
        const turnTasks = callbackState.taskIds
          .map((taskId) => tasks.find((task) => task.id === taskId))
          .filter((task): task is AgentImageTask => Boolean(task))
        if (turnTasks.length !== callbackState.taskIds.length) continue
        if (!turnTasks.every((task) => isTerminalAgentImageTaskStatus(task.status))) continue

        const text = buildAgentTaskCallbackText(turnTasks)
        callbackState.callbackQueued = true
        scheduleRuntimeSidecarPersist(runtime)
        void sendAgentSystemEvent(runtime, text)
          .then((sent) => {
            if (!sent) callbackState.callbackQueued = false
          })
          .catch((error: unknown) => {
            callbackState.callbackQueued = false
            const message = error instanceof Error ? error.message : String(error)
            setRuntimeError(runtime, message)
          })
      }
    },
    [scheduleRuntimeSidecarPersist, sendAgentSystemEvent, setRuntimeError],
  )

  useExternalSync(() => {
    maybeDispatchAgentImageCallbacksRef.current = maybeDispatchAgentImageCallbacks
  }, [maybeDispatchAgentImageCallbacks])

  const startAgentImageTask = useCallback(
    async (runtime: AgentSessionRuntime, task: AgentImageTask): Promise<{ ok: boolean; message: string }> => {
      setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) =>
          item.id === task.id && item.status === 'pending_approval' ? { ...item, status: 'approved' } : item,
        ),
      )

      const modelConfig = findModelConfig(task.request.modelId)
      if (!modelConfig) {
        const message = translate('configLib.agent.unknownGenImageModel', { model: task.request.modelId })
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      const credentials = getProviderCredentials(modelConfig.provider)
      if (!credentials.apiKey) {
        const message = translate('configLib.agent.modelMissingKey', {
          model: modelConfig.name,
          provider: getProviderConfig(modelConfig.provider).shortLabel,
        })
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      let referenceImages: PlaygroundImage[]
      try {
        referenceImages = await resolveAgentReferenceImages(runtime, task.request.referenceImageIds)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      if (!runtime.ready || agentRuntimesRef.current.get(runtime.sessionId) !== runtime) {
        return { ok: false, message: translate('configLib.agent.sessionDeleted') }
      }

      const currentTask = runtime.imageTasks.find((item) => item.id === task.id)
      if (!currentTask || isTerminalAgentImageTaskStatus(currentTask.status)) {
        return { ok: false, message: translate('configLib.agent.taskCanceled') }
      }

      const stackId =
        task.request.stackId ??
        stackIdForGenerationRequest({
          model: modelConfig,
          prompt: task.request.prompt,
          referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          batchCount: task.request.batchCount,
        })
      const batchId = enqueueGenerationJob(
        {
          apiKey: credentials.apiKey,
          baseUrl: credentials.baseUrl,
          model: modelConfig,
          prompt: task.request.prompt,
          referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          outputImageIds: task.request.reservedImageIds,
          outputImageIdSource: 'agent',
        },
        task.request.batchCount,
        stackId,
        task.request.parentImageId,
      )
      setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: 'queued',
                generationJobId: batchId,
                error: undefined,
                request: { ...item.request, stackId },
              }
            : item,
        ),
      )
      return { ok: true, message: translate('configLib.agent.taskStarted') }
    },
    [
      enqueueGenerationJob,
      getProviderCredentials,
      maybeDispatchAgentImageCallbacks,
      resolveAgentReferenceImages,
      setRuntimeImageTasks,
    ],
  )

  const approveAgentImageTask = useCallback(
    (taskId: string) => {
      const runtime = getCurrentRuntime()
      const task = runtime?.imageTasks.find((item) => item.id === taskId)
      if (!runtime || !task || task.status !== 'pending_approval') return
      void startAgentImageTask(runtime, task)
    },
    [getCurrentRuntime, startAgentImageTask],
  )

  const cancelAgentImageTask = useCallback(
    (taskId: string) => {
      const runtime = getCurrentRuntime()
      const task = runtime?.imageTasks.find((item) => item.id === taskId)
      if (!runtime || !task) return
      if (task.status === 'pending_approval') {
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === taskId ? { ...item, status: 'rejected' } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return
      }
      if (task.generationJobId) cancelGenerationJob(task.generationJobId)
      const job = task.generationJobId
        ? generationJobsRefForAgent.current.find((item) => item.id === task.generationJobId)
        : undefined
      const resultImageIds = job?.slots.flatMap((slot) => (slot.image ? [slot.image.id] : [])) ?? task.resultImageIds
      const fulfilledIds = new Set(resultImageIds)
      for (const id of task.request.reservedImageIds) {
        if (!fulfilledIds.has(id)) runtime.imageRegistry.delete(id)
      }
      const next = setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: 'canceled', resultImageIds } : item)),
      )
      maybeDispatchAgentImageCallbacks(runtime, next)
    },
    [cancelGenerationJob, generationJobsRefForAgent, getCurrentRuntime, maybeDispatchAgentImageCallbacks, setRuntimeImageTasks],
  )

  const runGenImageTool = useCallback(
    async (
      sessionId: string,
      toolCallId: string,
      args: GenImageToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) throw new Error('Agent session is no longer available.')
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const promptText = args.prompt.trim()
      if (!promptText) throw new Error('GenImage.prompt is required.')
      const modelConfig = findModelConfig(args.model)
      if (!modelConfig) {
        throw new Error(
          `Unknown GenImage model: ${args.model}. Available models: ${MODEL_CONFIGS.map((item) => item.id).join(', ')}`,
        )
      }
      const requestedCount = Number.isFinite(args.n) ? Math.floor(args.n) : 1
      const batchCount = Math.min(Math.max(1, requestedCount), modelConfig.maxBatchCount)
      const resolution = normalizeResolution(modelConfig, args.resolution)
      const aspect = normalizeAspectRatio(modelConfig, args.ratio)
      const referenceImageIds = args.reference_image_ids.filter((id) => id.trim()).map((id) => id.trim())
      const referenceImages = await resolveAgentReferenceImages(runtime, referenceImageIds)
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const editSource = referenceImages.find((image) => image.source.type === 'generated')
      const reserved = await reserveAgentImageIdsForRuntime(runtime, args.image_id, batchCount)
      try {
        const activeOptions = activeOptionsForModel(modelConfig, defaultOptionsFor(modelConfig))
        const task: AgentImageTask = {
          id: crypto.randomUUID(),
          toolCallId,
          agentTurnId: runtime.currentAgentTurnId ?? crypto.randomUUID(),
          createdAt: Date.now(),
          status: 'pending_approval',
          request: {
            prompt: promptText,
            requestedImageId: reserved.requestedImageId,
            reservedImageIds: reserved.reservedImageIds,
            modelId: modelConfig.id,
            resolution,
            aspectRatio: aspect,
            batchCount,
            referenceImageIds,
            options: activeOptions,
            stackId:
              editSource?.source.type === 'generated'
                ? (editSource.source.stackId ?? editSource.source.batchId)
                : undefined,
            parentImageId: editSource?.source.type === 'generated' ? editSource.id : undefined,
          },
          resultImageIds: [],
          renamedImageIds: reserved.renamed,
        }

        const callbackState = runtime.turnCallbacks.get(task.agentTurnId) ?? {
          agentTurnId: task.agentTurnId,
          taskIds: [],
          callbackQueued: false,
        }
        callbackState.taskIds.push(task.id)
        runtime.turnCallbacks.set(task.agentTurnId, callbackState)

        for (const id of reserved.reservedImageIds) {
          runtime.imageRegistry.set(id, {
            id,
            source: 'generated',
            status: 'reserved',
            createdAt: task.createdAt,
          })
        }
        setRuntimeImageTasks(runtime, (prev) => [task, ...prev])

        const startResult = runtime.autoApproveImageTasks ? await startAgentImageTask(runtime, task) : null
        const status = runtime.autoApproveImageTasks ? (startResult?.ok ? 'queued' : 'failed') : 'pending_approval'
        const message = runtime.autoApproveImageTasks
          ? startResult?.ok
            ? AGENT_TASK_PROTOCOL_MESSAGES.autoStarted
            : AGENT_TASK_PROTOCOL_MESSAGES.failedToStart
          : reserved.renamed
            ? AGENT_TASK_PROTOCOL_MESSAGES.pendingWithReserved(reserved.reservedImageIds)
            : AGENT_TASK_PROTOCOL_MESSAGES.pending
        const payload = {
          status,
          task_id: task.id,
          requested_image_id: reserved.requestedImageId,
          reserved_image_ids: reserved.reservedImageIds,
          renamed: reserved.renamed,
          message,
        }
        return toolTextResult(JSON.stringify(payload, null, 2), payload)
      } finally {
        releasePendingAgentImageIds(reserved.reservedImageIds)
      }
    },
    [
      releasePendingAgentImageIds,
      reserveAgentImageIdsForRuntime,
      resolveAgentReferenceImages,
      setRuntimeImageTasks,
      startAgentImageTask,
    ],
  )

  const runReadImageTool = useCallback(
    async (sessionId: string, _toolCallId: string, args: ReadImageToolArgs): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) throw new Error('Agent session is no longer available.')
      const imageId = args.image_id.trim()
      const missing = '<tool_use_error>Image does not exist.</tool_use_error>'
      if (!imageId) return toolTextResult(missing, { status: 'error', image_id: imageId })

      const result = await resolveAgentImageById(runtime, imageId)
      if (!result) return toolTextResult(missing, { status: 'error', image_id: imageId })
      if (result.status !== 'ready') {
        const payload = {
          image_id: imageId,
          status: 'not_ready',
          source: result.source,
          message: 'Image is not ready.',
        }
        return toolTextResult(JSON.stringify(payload, null, 2), payload)
      }

      const offset = args.offset !== undefined && Number.isFinite(args.offset) ? args.offset : 0
      const limit =
        args.limit !== undefined && Number.isFinite(args.limit) ? args.limit : AGENT_PROMPT_DEFAULT_LINE_LIMIT
      const generated = result.image.source.type === 'generated' ? result.image.source : null
      if (offset > 0) {
        if (!generated) {
          const text = '<tool_use_error>Image prompt is only available for generated images.</tool_use_error>'
          return toolTextResult(text, { status: 'error', image_id: imageId })
        }
        const header = `[prompt] image_id=${imageId} references=${generated.referenceImageIds.join(',')} total_lines=${promptLineCount(generated.prompt)}`
        const text = `${header}\n${formatPromptLines(generated.prompt, offset, limit)}`
        return toolTextResult(text, { status: 'ready', image_id: imageId, mode: 'prompt' })
      }

      const modelForImage = generated ? findModelConfig(generated.modelId) : null
      const promptOutputText = generated
        ? formatPromptLines(generated.prompt, 1, AGENT_PROMPT_DEFAULT_LINE_LIMIT)
        : undefined
      const imageForAgent = await compressImageForAgentInput({
        data: result.image.data,
        mimeType: result.image.mimeType,
      })
      const payload = {
        image_id: imageId,
        status: 'ready',
        source: result.source,
        mime_type: result.image.mimeType,
        generated: generated
          ? {
              model_id: generated.modelId,
              model_name: modelForImage?.name ?? generated.modelId,
              prompt_preview: generated.prompt.slice(0, 100),
              prompt_length: generated.prompt.length,
              prompt_total_lines: promptLineCount(generated.prompt),
              prompt_truncated: promptOutputText?.includes('more lines truncated') ?? false,
              prompt_output_text: promptOutputText,
              reference_image_ids: generated.referenceImageIds,
              resolution: generated.resolution,
              ratio: generated.aspectRatio,
              created_at: result.image.timestamp,
            }
          : undefined,
        message: 'Image is ready.',
      }
      return {
        content: [
          { type: 'text', text: JSON.stringify(payload, null, 2) },
          { type: 'image', data: imageForAgent.data, mimeType: imageForAgent.mimeType },
        ],
        details: payload,
      }
    },
    [resolveAgentImageById],
  )

  const runAskUserQuestionTool = useCallback(
    (
      sessionId: string,
      toolCallId: string,
      args: AskUserQuestionToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) return Promise.reject(new Error('Agent session is no longer available.'))
      const questions = args.questions
      if (questions.length === 0) {
        return Promise.resolve(
          toolTextResult('<tool_use_error>AskUserQuestion requires at least one question.</tool_use_error>', {
            status: 'error',
          }),
        )
      }

      const pending: AgentPendingQuestion = {
        toolCallId,
        agentTurnId: runtime.currentAgentTurnId ?? toolCallId,
        questions,
        createdAt: Date.now(),
      }
      setRuntimePendingQuestions(runtime, (prev) => [...prev.filter((item) => item.toolCallId !== toolCallId), pending])

      return new Promise<AgentToolResult>((resolve, reject) => {
        const cleanup = () => {
          runtime.questionResolvers.delete(toolCallId)
          setRuntimePendingQuestions(runtime, (prev) => prev.filter((item) => item.toolCallId !== toolCallId))
        }

        const resolver: AgentQuestionResolver = {
          questions,
          resolve: (result) => {
            cleanup()
            resolve(result)
          },
          reject: (reason) => {
            cleanup()
            reject(reason instanceof Error ? reason : new Error(String(reason)))
          },
        }
        runtime.questionResolvers.set(toolCallId, resolver)

        if (signal) {
          if (signal.aborted) {
            resolver.reject(new Error('AskUserQuestion was aborted.'))
            return
          }
          signal.addEventListener(
            'abort',
            () => {
              const stillPending = runtime.questionResolvers.get(toolCallId)
              if (!stillPending) return
              stillPending.resolve(
                toolTextResult(formatAskUserQuestionResult(questions, [], { cancelled: true }), {
                  status: 'cancelled',
                  reason: 'aborted',
                }),
              )
            },
            { once: true },
          )
        }
      })
    },
    [setRuntimePendingQuestions],
  )

  const finishRestoredAgentQuestion = useCallback(
    (
      runtime: AgentSessionRuntime,
      toolCallId: string,
      answers: AskUserQuestionAnswer[],
      options: { cancelled: boolean },
    ) => {
      const pending = runtime.pendingQuestions.find((item) => item.toolCallId === toolCallId)
      if (!pending) return
      const text = formatAskUserQuestionResult(pending.questions, answers, { cancelled: options.cancelled })
      const toolResultMessage = {
        role: 'toolResult',
        toolCallId,
        toolName: 'AskUserQuestion',
        content: [{ type: 'text', text }],
        isError: false,
        timestamp: Date.now(),
      } as unknown as AgentMessage

      setRuntimePendingQuestions(runtime, (prev) => prev.filter((item) => item.toolCallId !== toolCallId))

      runtime.agent.appendMessage(toolResultMessage)
      syncRuntimeSnapshot(runtime)

      runtime.persistQueue = runtime.persistQueue
        .then(async () => {
          const result = await appendAgentSessionMessage({
            sessionId: runtime.sessionId,
            parentId: runtime.leafEntryId,
            message: toolResultMessage,
          })
          runtime.leafEntryId = result.entryId
          upsertAgentSessionSummary(result.record)
        })
        .catch((error: unknown) => {
          setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
        })

      if (options.cancelled) return
      const eventText = `<system>\ntool AskUserQuestion call ${toolCallId} has been answered.\n</system>`
      void sendAgentSystemEvent(runtime, eventText)
    },
    [sendAgentSystemEvent, setRuntimeError, setRuntimePendingQuestions, syncRuntimeSnapshot, upsertAgentSessionSummary],
  )

  const submitAgentQuestionAnswers = useCallback(
    (toolCallId: string, answers: AskUserQuestionAnswer[]) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const resolver = runtime.questionResolvers.get(toolCallId)
      if (resolver) {
        const text = formatAskUserQuestionResult(resolver.questions, answers)
        resolver.resolve(toolTextResult(text, { status: 'submitted', answers }))
        return
      }
      finishRestoredAgentQuestion(runtime, toolCallId, answers, { cancelled: false })
    },
    [finishRestoredAgentQuestion, getCurrentRuntime],
  )

  const cancelAgentQuestion = useCallback(
    (toolCallId: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const resolver = runtime.questionResolvers.get(toolCallId)
      if (resolver) {
        resolver.resolve(
          toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
            status: 'cancelled',
            reason: 'user_dismissed',
          }),
        )
        return
      }
      finishRestoredAgentQuestion(runtime, toolCallId, [], { cancelled: true })
    },
    [finishRestoredAgentQuestion, getCurrentRuntime],
  )

  useExternalSync(() => {
    agentToolHandlersRef.current = {
      genImage: runGenImageTool,
      readImage: runReadImageTool,
      askUserQuestion: runAskUserQuestionTool,
      loadSkill: runSkillTool,
      readSkillFile: runReadSkillFileTool,
      createSkill: runCreateSkillTool,
      webFetch: runWebFetchTool,
    }
  }, [
    runAskUserQuestionTool,
    runCreateSkillTool,
    runGenImageTool,
    runReadImageTool,
    runReadSkillFileTool,
    runSkillTool,
    runWebFetchTool,
  ])

  useExternalSync(() => {
    void keyHooks.anthropic.apiKey
    void keyHooks.deepseek.apiKey
    void keyHooks.google.apiKey
    void keyHooks.openai.apiKey
    for (const runtime of agentRuntimesRef.current.values()) maybeDispatchAgentImageCallbacks(runtime)
  }, [
    keyHooks.anthropic.apiKey,
    keyHooks.deepseek.apiKey,
    keyHooks.google.apiKey,
    keyHooks.openai.apiKey,
    maybeDispatchAgentImageCallbacks,
  ])

  useExternalSync(() => {
    for (const runtime of agentRuntimesRef.current.values()) {
      let changed = false
      const next = runtime.imageTasks.map((task) => {
        if (!task.generationJobId || isTerminalAgentImageTaskStatus(task.status)) return task
        const job = generationJobs.find((item) => item.id === task.generationJobId)
        if (!job) return task
        const resultImageIds = job.slots.flatMap((slot) => (slot.image ? [slot.image.id] : []))
        const nextStatus = agentTaskStatusFromGenerationJob(job)
        const nextError = errorFromGenerationJob(job)
        if (nextStatus === 'completed') dismissGenerationJob(job.id)
        for (const slot of job.slots) {
          if (slot.image) {
            runtime.imageRegistry.set(slot.image.id, {
              id: slot.image.id,
              image: slot.image,
              source: 'generated',
              status: 'ready',
              createdAt: slot.image.timestamp,
            })
          }
        }
        if (
          nextStatus === task.status &&
          nextError === task.error &&
          resultImageIds.length === task.resultImageIds.length &&
          resultImageIds.every((id, index) => id === task.resultImageIds[index])
        ) {
          return task
        }
        changed = true
        const updated = { ...task, status: nextStatus, resultImageIds, error: nextError }
        if (isTerminalAgentImageTaskStatus(nextStatus)) {
          const fulfilledIds = new Set(resultImageIds)
          for (const id of task.request.reservedImageIds) {
            if (!fulfilledIds.has(id)) runtime.imageRegistry.delete(id)
          }
        }
        return updated
      })
      if (!changed) continue
      runtime.imageTasks = next
      if (isCurrentRuntime(runtime)) setAgentImageTasksState(next)
      scheduleRuntimeSidecarPersist(runtime)
      maybeDispatchAgentImageCallbacks(runtime, next)
    }
  }, [
    dismissGenerationJob,
    generationJobs,
    isCurrentRuntime,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
  ])

  const sendAgentMessage = useCallback(() => {
    const runtime = getCurrentRuntime()
    const trimmed = runtime?.draft.trim() ?? ''
    if (!runtime || runtime.promptPreparing || runtime.isCompacting) return
    if (!trimmed && runtime.attachments.length === 0) return

    const config = resolveAgentModelConfig(runtime.modelId)
    const credentials = agentCredentialsRef.current[config.provider]
    if (!credentials.apiKey) {
      setRuntimeError(
        runtime,
        translate('configLib.agent.modelMissingKey', { model: config.label, provider: config.providerLabel }),
      )
      return
    }
    if (!config.supportsImages && runtime.attachments.length > 0) {
      setRuntimeError(runtime, translate('configLib.agent.modelImageUnsupported', { model: config.label }))
      return
    }

    applyAgentRuntimeConfig(runtime)
    const attachmentsToSend = runtime.attachments
    const attachmentIds = attachmentsToSend.map((attachment) => attachment.id)
    const attachmentNote =
      attachmentIds.length > 0 ? `\n\n<system>Available attachment image IDs: ${attachmentIds.join(', ')}</system>` : ''
    const isFirstUserMessage = runtime.agent.state.messages.length === 0
    const currentPreferredId = getPreferredImageModelId()
    const preferredChanged = runtime.lastInjectedPreferredImageModelId !== currentPreferredId
    let systemPrefix = ''
    if (isFirstUserMessage) {
      systemPrefix += `${buildLanguageDirective(getActiveLanguage())}\n\n`
    }
    if (preferredChanged) {
      let directive: string | null = null
      if (currentPreferredId) {
        directive = buildPreferredImageModelDirective(currentPreferredId)
      } else if (runtime.lastInjectedPreferredImageModelId !== undefined) {
        directive = buildPreferredImageModelClearedDirective()
      }
      if (directive) systemPrefix += `${directive}\n\n`
      runtime.lastInjectedPreferredImageModelId = currentPreferredId
    }
    if (isFirstUserMessage) {
      const skillListing = buildAvailableSkillsSystemMessage(getAgentSkillSummaries())
      if (skillListing) systemPrefix += `${skillListing}\n\n`
    }
    const promptText = `${systemPrefix}${trimmed || '请分析这些图片。'}${attachmentNote}`
    for (const attachment of attachmentsToSend) {
      if (runtime.imageRegistry.get(attachment.id)?.status === 'ready') continue
      runtime.imageRegistry.set(attachment.id, {
        id: attachment.id,
        image: attachment,
        source: 'agent_attachment',
        status: 'ready',
        createdAt: Date.now(),
      })
    }

    const pendingQuestionsToCancel = runtime.pendingQuestions.slice()
    const hasInFlightResolver = pendingQuestionsToCancel.some((question) =>
      runtime.questionResolvers.has(question.toolCallId),
    )
    const inFlight = runtime.isStreaming || hasInFlightResolver

    runtime.draft = ''
    runtime.attachments = []
    runtime.attachmentError = null
    runtime.promptPreparing = true
    if (!inFlight) {
      runtime.currentAgentTurnId = crypto.randomUUID()
      activateAgentResponseMetadata(runtime, config.id)
      runtime.isStreaming = true
    }
    if (isCurrentRuntime(runtime)) {
      setAgentDraft('')
      setAgentAttachments([])
      setAgentAttachmentError(null)
      setAgentIsStreaming(runtime.isStreaming)
    }
    syncRuntimeSnapshot(runtime)
    scheduleRuntimeSidecarPersist(runtime)

    const cancelRuntimeQuestion = (question: AgentPendingQuestion) => {
      const resolver = runtime.questionResolvers.get(question.toolCallId)
      if (resolver) {
        resolver.resolve(
          toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
            status: 'cancelled',
            reason: 'user_dismissed',
          }),
        )
        return
      }
      finishRestoredAgentQuestion(runtime, question.toolCallId, [], { cancelled: true })
    }

    void (async () => {
      try {
        const images = await Promise.all(attachmentsToSend.map(compressedAttachmentToAgentAttachment))
        if (inFlight) {
          const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [
            { type: 'text', text: promptText },
          ]
          for (const image of images) {
            if (image.type === 'image') content.push({ type: 'image', data: image.content, mimeType: image.mimeType })
          }
          queueAgentResponseMetadata(runtime, config.id)
          await runtime.agent.queueMessage({
            role: 'user',
            content,
            attachments: images.length > 0 ? images : undefined,
            timestamp: Date.now(),
          })
          for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(question)
          return
        }

        for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(question)
        activateAgentResponseMetadata(runtime, config.id)
        const promptPromise = runtime.agent.prompt(promptText, images)
        runtime.promptPreparing = false
        promptPromise
          .then(() => {
            const errorMessage = getAgentError(runtime.agent)
            if (errorMessage && isKeyError(errorMessage)) invalidateGenerationKey(config.provider)
          })
          .catch((error: unknown) => {
            setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
          })
          .finally(() => {
            syncRuntimeSnapshot(runtime)
            maybeDispatchAgentImageCallbacks(runtime)
          })
      } catch (error) {
        setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
      } finally {
        runtime.promptPreparing = false
        syncRuntimeSnapshot(runtime)
        maybeDispatchAgentImageCallbacks(runtime)
      }
    })()
  }, [
    applyAgentRuntimeConfig,
    finishRestoredAgentQuestion,
    getCurrentRuntime,
    invalidateGenerationKey,
    isCurrentRuntime,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
    setRuntimeError,
    syncRuntimeSnapshot,
  ])

  const stopAgentMessage = useCallback(() => {
    getCurrentRuntime()?.agent.abort()
  }, [getCurrentRuntime])

  const clearAgentChat = useCallback(() => {
    void createNewAgentSession()
  }, [createNewAgentSession])

  const setCurrentAgentDraft = useCallback(
    (value: string) => {
      const runtime = getCurrentRuntime()
      if (runtime) {
        runtime.draft = value
        scheduleRuntimeSidecarPersist(runtime)
      }
      setAgentDraft(value)
    },
    [getCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const setAutoApproveAgentImageTasks = useCallback(
    (value: boolean) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.autoApproveImageTasks = value
      setAutoApproveAgentImageTasksState(value)
      scheduleRuntimeSidecarPersist(runtime)
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { autoApproveImageTasks: value }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [getCurrentRuntime, scheduleRuntimeSidecarPersist, upsertAgentSessionSummary],
  )

  return {
    agentModels: AGENT_MODEL_CONFIGS,
    agentModel,
    agentThinkingLevel,
    agentMessages,
    agentMessageMetadata,
    agentStreamingMessage,
    agentIsStreaming,
    agentError,
    agentDraft,
    agentAttachments,
    agentAttachmentError,
    agentSessions,
    currentAgentSessionId,
    agentSessionsLoading,
    autoApproveAgentImageTasks,
    agentImageTasks,
    agentPendingQuestions,
    agentSkills,
    setAgentModelId: setAgentModelIdForSession,
    setAgentThinkingLevel,
    createAgentSession: createNewAgentSession,
    switchAgentSession,
    deleteAgentSession: removeAgentSession,
    setAutoApproveAgentImageTasks,
    setAgentSkillEnabled,
    deleteAgentSkill,
    getAgentSkillPackage,
    createUserAgentSkill,
    setAgentDraft: setCurrentAgentDraft,
    addAgentAttachments,
    addAgentImageAttachment,
    removeAgentAttachment,
    clearAgentAttachmentError,
    sendAgentMessage,
    stopAgentMessage,
    clearAgentChat,
    approveAgentImageTask,
    cancelAgentImageTask,
    submitAgentQuestionAnswers,
    cancelAgentQuestion,
  }
}
