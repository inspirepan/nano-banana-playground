import { Agent, ProviderTransport, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useRef, useState } from 'react'

import { agentMessageRole, type AgentChatAttachment } from './agentChat'
import { buildCompactionSummaryMessage } from './compaction'
import {
  isTerminalAgentImageTaskStatus,
  type AgentImageRegistryEntry,
  type AgentImageTask,
  type AgentTurnCallbackState,
} from './imageTasks'
import {
  getAgentError,
  getAgentStreamingMessage,
  injectAbandonedToolResults,
  metadataForAgentMessage,
  restoreAgentImageTasks,
  toolTextResult,
} from './messageRecovery'
import { isAgentModelProvider } from './runtimeConfig'
import {
  type AgentPendingQuestion,
  type AgentQueuedUserMessage,
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
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import { formatAskUserQuestionResult } from './tools'
import { useAgentAttachments } from './useAgentAttachments'
import { useAgentCompaction } from './useAgentCompaction'
import { useAgentImageRegistry } from './useAgentImageRegistry'
import { useAgentImageTools } from './useAgentImageTools'
import { useAgentMessageSender } from './useAgentMessageSender'
import { useAgentQuestions } from './useAgentQuestions'
import { createInitialAgentToolHandlers, useAgentRuntimeConfig } from './useAgentRuntimeConfig'
import { useAgentSkills } from './useAgentSkills'
import {
  AGENT_MODEL_CONFIGS,
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import { getPreferredAgentModelId, getPreferredAgentThinkingLevel } from '../config/agentPreferences'
import type { ModelConfig } from '../config/models'
import { useExternalSync, useMountEffect } from '../hooks/effects'
import type { useApiKey } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

export type { AgentPendingQuestion, AgentQueuedUserMessage } from './runtimeTypes'

type ApiKeyHook = ReturnType<typeof useApiKey>

function agentMessageTimestamp(message: AgentMessage): number | null {
  if (typeof message !== 'object' || message === null) return null
  const value = (message as unknown as Record<string, unknown>).timestamp
  return typeof value === 'number' ? value : null
}

function isSameQueuedUserMessage(message: AgentMessage, queuedMessage: AgentMessage): boolean {
  if (message === queuedMessage) return true
  if (agentMessageRole(message) !== 'user' || agentMessageRole(queuedMessage) !== 'user') return false

  const timestamp = agentMessageTimestamp(message)
  const queuedTimestamp = agentMessageTimestamp(queuedMessage)
  if (timestamp !== null && queuedTimestamp !== null && timestamp === queuedTimestamp) return true

  return false
}

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
  const [agentQueuedMessages, setAgentQueuedMessages] = useState<AgentQueuedUserMessage[]>([])
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
  })
  const agentToolHandlersRef = useRef(createInitialAgentToolHandlers())

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
    setAgentQueuedMessages(runtime.queuedUserMessages)
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

  const setRuntimeQueuedUserMessages = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentQueuedUserMessage[]) => AgentQueuedUserMessage[]) => {
      const next = updater(runtime.queuedUserMessages)
      runtime.queuedUserMessages = next
      if (isCurrentRuntime(runtime)) setAgentQueuedMessages(next)
      return next
    },
    [isCurrentRuntime],
  )

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

  const { getAgentBaseUrl, setAgentModelIdForSession, setAgentThinkingLevel, applyAgentRuntimeConfig } =
    useAgentRuntimeConfig({
      agentCredentialsRef,
      agentToolHandlersRef,
      providerCredentials: {
        google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
        openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
        anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
      },
      getCurrentRuntime,
      upsertAgentSessionSummary,
      setAgentModelId,
      setAgentThinkingLevelState,
    })

  const syncRuntimeSnapshot = useCallback(
    (runtime: AgentSessionRuntime) => {
      runtime.messages = runtime.agent.state.messages.slice()
      runtime.streamingMessage = getAgentStreamingMessage(runtime.agent)
      if (runtime.streamingMessage) metadataForAgentMessage(runtime, runtime.streamingMessage)
      if (runtime.queuedUserMessages.length > 0) {
        const remainingQueuedMessages = runtime.queuedUserMessages.filter(
          (queued) => !runtime.messages.some((message) => isSameQueuedUserMessage(message, queued.message)),
        )
        if (remainingQueuedMessages.length !== runtime.queuedUserMessages.length) {
          runtime.queuedUserMessages = remainingQueuedMessages
        }
      }
      runtime.isStreaming = runtime.agent.state.isStreaming || runtime.isCompacting
      runtime.error = getAgentError(runtime.agent)
      if (!isCurrentRuntime(runtime)) return
      setAgentMessages(runtime.messages)
      setAgentMessageMetadata(runtime.messageMetadata)
      setAgentStreamingMessage(runtime.streamingMessage)
      setAgentQueuedMessages(runtime.queuedUserMessages)
      setAgentIsStreaming(runtime.isStreaming)
      setAgentError(runtime.error)
    },
    [isCurrentRuntime],
  )

  const { maybeRunRuntimeCompactionRef } = useAgentCompaction({
    agentRuntimesRef,
    agentCredentialsRef,
    maybeDispatchAgentImageCallbacksRef,
    persistRuntimeSidecar,
    setRuntimeError,
    syncRuntimeSnapshot,
  })

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
        queuedUserMessages: [],
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
          if (runtime.queuedUserMessages.length > 0 && agentMessageRole(event.message) === 'user') {
            setRuntimeQueuedUserMessages(runtime, (prev) =>
              prev.filter((queued) => !isSameQueuedUserMessage(event.message, queued.message)),
            )
          }
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
          void runtime.agent.waitForIdle().then(() => {
            if (!runtime.ready || agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return
            maybeRunRuntimeCompactionRef.current(runtime)
            maybeDispatchAgentImageCallbacksRef.current(runtime)
          })
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
      maybeRunRuntimeCompactionRef,
      persistRuntimeSidecar,
      setRuntimeQueuedUserMessages,
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
            if (!task.generationJobId) continue
            if (!isTerminalAgentImageTaskStatus(task.status)) cancelGenerationJob(task.generationJobId)
            dismissGenerationJob(task.generationJobId)
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
    [
      cancelGenerationJob,
      clearRuntimeQuestionResolvers,
      createNewAgentSession,
      dismissGenerationJob,
      loadAgentSessionIntoRuntime,
    ],
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

  const {
    sendAgentSystemEvent,
    maybeDispatchAgentImageCallbacks,
    runGenImageTool,
    runReadImageTool,
    approveAgentImageTask,
    cancelAgentImageTask,
  } = useAgentImageTools({
    agentRuntimesRef,
    agentCredentialsRef,
    maybeDispatchAgentImageCallbacksRef,
    generationJobsRefForAgent,
    generationJobs,
    providerApiKeys: {
      google: keyHooks.google.apiKey,
      openai: keyHooks.openai.apiKey,
      anthropic: keyHooks.anthropic.apiKey,
    },
    getCurrentRuntime,
    getProviderCredentials,
    enqueueGenerationJob,
    cancelGenerationJob,
    dismissGenerationJob,
    resolveAgentReferenceImages,
    resolveAgentImageById,
    reserveAgentImageIdsForRuntime,
    releasePendingAgentImageIds,
    applyAgentRuntimeConfig,
    setRuntimeError,
    setRuntimeImageTasks,
    scheduleRuntimeSidecarPersist,
    syncRuntimeSnapshot,
    isCurrentRuntime,
    setAgentImageTasksState,
  })

  const { runAskUserQuestionTool, submitAgentQuestionAnswers, cancelAgentQuestion, cancelRuntimeQuestion } =
    useAgentQuestions({
      agentRuntimesRef,
      getCurrentRuntime,
      setRuntimePendingQuestions,
      sendAgentSystemEvent,
      setRuntimeError,
      syncRuntimeSnapshot,
      upsertAgentSessionSummary,
    })

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

  const { sendAgentMessage, stopAgentMessage, setCurrentAgentDraft } = useAgentMessageSender({
    agentCredentialsRef,
    getCurrentRuntime,
    isCurrentRuntime,
    applyAgentRuntimeConfig,
    cancelRuntimeQuestion,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
    setRuntimeQueuedUserMessages,
    setRuntimeError,
    syncRuntimeSnapshot,
    invalidateGenerationKey,
    setAgentDraft,
    setAgentAttachments,
    setAgentAttachmentError,
    setAgentIsStreaming,
  })

  const clearAgentChat = useCallback(() => {
    void createNewAgentSession()
  }, [createNewAgentSession])

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
    agentQueuedMessages,
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
