import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useRef } from 'react'

import type { AgentChatAttachment } from './agentChat'
import type { AgentImageTask } from './imageTasks'
import { isSameQueuedUserMessage } from './messageIdentity'
import { getAgentError, getAgentStreamingMessage, metadataForAgentMessage } from './messageRecovery'
import type { AgentPendingQuestion, AgentQueuedUserMessage, AgentSessionRuntime } from './runtimeTypes'
import { saveAgentSessionSidecar } from './sessionStore'
import type { AgentSessionMessageMetadata, AgentSessionSummary } from './sessionTypes'
import { createAskUserQuestionResult } from './tools'
import { type AgentThinkingLevel } from '../config/agentModels'

export type UseAgentRuntimeStoreParams = {
  setAgentSessions: React.Dispatch<React.SetStateAction<AgentSessionSummary[]>>
  setCurrentAgentSessionId: (sessionId: string | null) => void
  setAgentModelId: (modelId: string) => void
  setAgentThinkingLevelState: (level: AgentThinkingLevel) => void
  setAutoApproveAgentImageTasksState: (value: boolean) => void
  setAgentMessages: (messages: AgentMessage[]) => void
  setAgentMessageMetadata: (metadata: WeakMap<AgentMessage, AgentSessionMessageMetadata>) => void
  setAgentStreamingMessage: (message: AgentMessage | null) => void
  setAgentQueuedMessages: (messages: AgentQueuedUserMessage[]) => void
  setAgentIsStreaming: (isStreaming: boolean) => void
  setAgentError: (error: string | null) => void
  setAgentDraft: (draft: string) => void
  setAgentAttachments: (attachments: AgentChatAttachment[]) => void
  setAgentAttachmentError: (message: string | null) => void
  setAgentImageTasksState: (tasks: AgentImageTask[]) => void
  setAgentPendingQuestionsState: (questions: AgentPendingQuestion[]) => void
}

export function useAgentRuntimeStore(params: UseAgentRuntimeStoreParams) {
  const {
    setAgentSessions,
    setCurrentAgentSessionId,
    setAgentModelId,
    setAgentThinkingLevelState,
    setAutoApproveAgentImageTasksState,
    setAgentMessages,
    setAgentMessageMetadata,
    setAgentStreamingMessage,
    setAgentQueuedMessages,
    setAgentIsStreaming,
    setAgentError,
    setAgentDraft,
    setAgentAttachments,
    setAgentAttachmentError,
    setAgentImageTasksState,
    setAgentPendingQuestionsState,
  } = params

  const agentRuntimesRef = useRef<Map<string, AgentSessionRuntime>>(new Map())
  const currentAgentSessionIdRef = useRef<string | null>(null)

  const upsertAgentSessionSummary = useCallback(
    (record: AgentSessionSummary) => {
      setAgentSessions((prev) =>
        record.messageCount > 0
          ? [record, ...prev.filter((item) => item.id !== record.id)].sort((a, b) => b.updatedAt - a.updatedAt)
          : prev.filter((item) => item.id !== record.id),
      )
    },
    [setAgentSessions],
  )

  const getCurrentRuntime = useCallback((): AgentSessionRuntime | null => {
    const sessionId = currentAgentSessionIdRef.current
    return sessionId ? (agentRuntimesRef.current.get(sessionId) ?? null) : null
  }, [])

  const isCurrentRuntime = useCallback((runtime: AgentSessionRuntime) => {
    return runtime.sessionId === currentAgentSessionIdRef.current
  }, [])

  const projectRuntimeToUi = useCallback(
    (runtime: AgentSessionRuntime) => {
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
    },
    [
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentDraft,
      setAgentError,
      setAgentImageTasksState,
      setAgentIsStreaming,
      setAgentMessageMetadata,
      setAgentMessages,
      setAgentModelId,
      setAgentPendingQuestionsState,
      setAgentQueuedMessages,
      setAgentStreamingMessage,
      setAgentThinkingLevelState,
      setAutoApproveAgentImageTasksState,
      setCurrentAgentSessionId,
    ],
  )

  const setRuntimeError = useCallback(
    (runtime: AgentSessionRuntime, message: string | null) => {
      runtime.error = message
      if (isCurrentRuntime(runtime)) setAgentError(message)
    },
    [isCurrentRuntime, setAgentError],
  )

  const setRuntimeQueuedUserMessages = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentQueuedUserMessage[]) => AgentQueuedUserMessage[]) => {
      const next = updater(runtime.queuedUserMessages)
      runtime.queuedUserMessages = next
      if (isCurrentRuntime(runtime)) setAgentQueuedMessages(next)
      return next
    },
    [isCurrentRuntime, setAgentQueuedMessages],
  )

  const persistRuntimeSidecar = useCallback(
    (runtime: AgentSessionRuntime) => {
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
      const write = runtime.sidecarPersistQueue.then(async () => {
        const record = await saveAgentSessionSidecar(payload)
        if (record) upsertAgentSessionSummary(record)
      })
      runtime.sidecarPersistQueue = write.catch(() => undefined)
      return write.catch(() => undefined)
    },
    [upsertAgentSessionSummary],
  )

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
    [isCurrentRuntime, scheduleRuntimeSidecarPersist, setAgentImageTasksState],
  )

  const setRuntimePendingQuestions = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentPendingQuestion[]) => AgentPendingQuestion[]) => {
      const next = updater(runtime.pendingQuestions)
      runtime.pendingQuestions = next
      if (isCurrentRuntime(runtime)) setAgentPendingQuestionsState(next)
      scheduleRuntimeSidecarPersist(runtime)
      return next
    },
    [isCurrentRuntime, scheduleRuntimeSidecarPersist, setAgentPendingQuestionsState],
  )

  const clearRuntimeQuestionResolvers = useCallback(
    (runtime: AgentSessionRuntime, reason: string) => {
      if (runtime.questionResolvers.size === 0) return
      for (const [, resolver] of runtime.questionResolvers) {
        try {
          resolver.resolve(createAskUserQuestionResult(resolver.questions, [], { cancelled: true, reason }))
        } catch {
          // Ignore — caller may have moved on.
        }
      }
      runtime.questionResolvers.clear()
      setRuntimePendingQuestions(runtime, () => [])
    },
    [setRuntimePendingQuestions],
  )

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
      runtime.isStreaming = runtime.promptPreparing || runtime.agent.state.isStreaming || runtime.isCompacting
      runtime.error = getAgentError(runtime.agent)
      if (!isCurrentRuntime(runtime)) return
      setAgentMessages(runtime.messages)
      setAgentMessageMetadata(runtime.messageMetadata)
      setAgentStreamingMessage(runtime.streamingMessage)
      setAgentQueuedMessages(runtime.queuedUserMessages)
      setAgentIsStreaming(runtime.isStreaming)
      setAgentError(runtime.error)
    },
    [
      isCurrentRuntime,
      setAgentError,
      setAgentIsStreaming,
      setAgentMessageMetadata,
      setAgentMessages,
      setAgentQueuedMessages,
      setAgentStreamingMessage,
    ],
  )

  return {
    agentRuntimesRef,
    currentAgentSessionIdRef,
    upsertAgentSessionSummary,
    getCurrentRuntime,
    isCurrentRuntime,
    projectRuntimeToUi,
    setRuntimeError,
    setRuntimeQueuedUserMessages,
    persistRuntimeSidecar,
    scheduleRuntimeSidecarPersist,
    flushRuntime,
    setRuntimeImageTasks,
    setRuntimePendingQuestions,
    clearRuntimeQuestionResolvers,
    syncRuntimeSnapshot,
  }
}
