import { Agent, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, type RefObject } from 'react'

import { agentMessageRole, type AgentChatAttachment } from './agentChat'
import { type AgentImageRegistryEntry, type AgentImageTask, type AgentTurnCallbackState } from './imageTasks'
import { createLatestProviderTransport } from './LatestProviderTransport'
import { isSameQueuedUserMessage } from './messageIdentity'
import { metadataForAgentMessage } from './messageRecovery'
import {
  type AgentPendingQuestion,
  type AgentQueuedUserMessage,
  type AgentSessionRuntime,
  type ProviderCredentials,
} from './runtimeTypes'
import { appendAgentSessionMessage } from './sessionStore'
import type { AgentCompactionState, AgentSessionMessageMetadata, AgentSessionSummary } from './sessionTypes'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import {
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'

export type CreateRuntimeParams = {
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
}

export function useAgentRuntimeFactory({
  agentRuntimesRef,
  agentCredentialsRef,
  maybeRunRuntimeCompactionRef,
  maybeDispatchAgentImageCallbacksRef,
  getAgentBaseUrl,
  applyAgentRuntimeConfig,
  isCurrentRuntime,
  setCurrentAgentSessionId,
  upsertAgentSessionSummary,
  persistRuntimeSidecar,
  setRuntimeQueuedUserMessages,
  setRuntimeError,
  syncRuntimeSnapshot,
}: {
  agentRuntimesRef: RefObject<Map<string, AgentSessionRuntime>>
  agentCredentialsRef: RefObject<Record<AgentModelProvider, ProviderCredentials>>
  maybeRunRuntimeCompactionRef: RefObject<(runtime: AgentSessionRuntime) => void>
  maybeDispatchAgentImageCallbacksRef: RefObject<(runtime: AgentSessionRuntime) => void>
  getAgentBaseUrl: (provider: AgentModelProvider) => string
  applyAgentRuntimeConfig: (runtime: AgentSessionRuntime) => void
  isCurrentRuntime: (runtime: AgentSessionRuntime) => boolean
  setCurrentAgentSessionId: (sessionId: string | null) => void
  upsertAgentSessionSummary: (record: AgentSessionSummary) => void
  persistRuntimeSidecar: (runtime: AgentSessionRuntime) => Promise<void>
  setRuntimeQueuedUserMessages: (
    runtime: AgentSessionRuntime,
    updater: (prev: AgentQueuedUserMessage[]) => AgentQueuedUserMessage[],
  ) => AgentQueuedUserMessage[]
  setRuntimeError: (runtime: AgentSessionRuntime, message: string | null) => void
  syncRuntimeSnapshot: (runtime: AgentSessionRuntime) => void
}) {
  const createRuntime = useCallback(
    (params: CreateRuntimeParams): AgentSessionRuntime => {
      const config = resolveAgentModelConfig(params.modelId)
      const agent = new Agent({
        transport: createLatestProviderTransport(
          (provider) => agentCredentialsRef.current[provider].apiKey || undefined,
        ),
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
      agentCredentialsRef,
      agentRuntimesRef,
      applyAgentRuntimeConfig,
      getAgentBaseUrl,
      isCurrentRuntime,
      maybeDispatchAgentImageCallbacksRef,
      maybeRunRuntimeCompactionRef,
      persistRuntimeSidecar,
      setCurrentAgentSessionId,
      setRuntimeError,
      setRuntimeQueuedUserMessages,
      syncRuntimeSnapshot,
      upsertAgentSessionSummary,
    ],
  )

  return { createRuntime }
}
