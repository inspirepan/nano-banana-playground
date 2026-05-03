import { useCallback, type RefObject } from 'react'

import { buildCompactionSummaryMessage } from './compaction'
import { isTerminalAgentImageTaskStatus } from './imageTasks'
import { injectAbandonedToolResults, restoreAgentImageTasks } from './messageRecovery'
import type { AgentSessionRuntime } from './runtimeTypes'
import { createAgentSessionRecord, deleteAgentSession, listAgentSessions, loadAgentSession } from './sessionStore'
import type { AgentSessionMessageMetadata, AgentSessionSummary } from './sessionTypes'
import type { CreateRuntimeParams } from './useAgentRuntimeFactory'
import { getPreferredAgentModelId, getPreferredAgentThinkingLevel } from '../config/agentPreferences'
import { useMountEffect } from '../hooks/effects'

export function useAgentSessionLifecycle({
  initialSessionId,
  agentRuntimesRef,
  currentAgentSessionIdRef,
  autoApproveAgentImageTasks,
  setAgentSessions,
  setAgentSessionsLoading,
  setCurrentAgentSessionId,
  setAgentError,
  createRuntime,
  projectRuntimeToUi,
  syncRuntimeSnapshot,
  flushRuntime,
  getCurrentRuntime,
  clearRuntimeQuestionResolvers,
  clearRuntimeSessionStatus,
  cancelGenerationJob,
  dismissGenerationJob,
}: {
  initialSessionId: string | null
  agentRuntimesRef: RefObject<Map<string, AgentSessionRuntime>>
  currentAgentSessionIdRef: RefObject<string | null>
  autoApproveAgentImageTasks: boolean
  setAgentSessions: React.Dispatch<React.SetStateAction<AgentSessionSummary[]>>
  setAgentSessionsLoading: (loading: boolean) => void
  setCurrentAgentSessionId: (sessionId: string | null) => void
  setAgentError: (error: string | null) => void
  createRuntime: (params: CreateRuntimeParams) => AgentSessionRuntime
  projectRuntimeToUi: (runtime: AgentSessionRuntime) => void
  syncRuntimeSnapshot: (runtime: AgentSessionRuntime) => void
  flushRuntime: (runtime: AgentSessionRuntime | null) => Promise<void>
  getCurrentRuntime: () => AgentSessionRuntime | null
  clearRuntimeQuestionResolvers: (runtime: AgentSessionRuntime, reason: string) => void
  clearRuntimeSessionStatus: (sessionId: string) => void
  cancelGenerationJob: (jobId: string) => void
  dismissGenerationJob: (jobId: string) => void
}) {
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
    [agentRuntimesRef, createRuntime, projectRuntimeToUi, syncRuntimeSnapshot],
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
      clearRuntimeSessionStatus(previousRuntime.sessionId)
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
  }, [
    agentRuntimesRef,
    autoApproveAgentImageTasks,
    clearRuntimeSessionStatus,
    createRuntime,
    flushRuntime,
    getCurrentRuntime,
    projectRuntimeToUi,
  ])

  const switchAgentSession = useCallback(
    (sessionId: string) => {
      if (sessionId === currentAgentSessionIdRef.current) return
      void (async () => {
        const previousRuntime = getCurrentRuntime()
        await flushRuntime(previousRuntime)
        if (previousRuntime && !previousRuntime.persisted && previousRuntime.messages.length === 0) {
          agentRuntimesRef.current.delete(previousRuntime.sessionId)
          clearRuntimeSessionStatus(previousRuntime.sessionId)
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
    [
      agentRuntimesRef,
      currentAgentSessionIdRef,
      clearRuntimeSessionStatus,
      flushRuntime,
      getCurrentRuntime,
      loadAgentSessionIntoRuntime,
      projectRuntimeToUi,
      setAgentError,
    ],
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
        clearRuntimeSessionStatus(sessionId)
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
      agentRuntimesRef,
      cancelGenerationJob,
      clearRuntimeQuestionResolvers,
      clearRuntimeSessionStatus,
      createNewAgentSession,
      currentAgentSessionIdRef,
      dismissGenerationJob,
      loadAgentSessionIntoRuntime,
      setAgentError,
      setAgentSessions,
      setCurrentAgentSessionId,
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

  return {
    loadAgentSessionIntoRuntime,
    createNewAgentSession,
    switchAgentSession,
    removeAgentSession,
  }
}
