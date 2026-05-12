import { type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useMemo, useRef, useState } from 'react'

import { type AgentChatAttachment } from './agentChat'
import { type AgentImageTask } from './imageTasks'
import {
  type AgentPendingQuestion,
  type AgentQueuedUserMessage,
  type AgentSessionRuntime,
  type ProviderCredentials,
} from './runtimeTypes'
import { updateAgentSessionConfig } from './sessionStore'
import type { AgentSessionMessageMetadata, AgentSessionStatusMap, AgentSessionSummary } from './sessionTypes'
import { useAgentAttachments } from './useAgentAttachments'
import { useAgentCompaction } from './useAgentCompaction'
import { useAgentImageRegistry } from './useAgentImageRegistry'
import { useAgentImageTools } from './useAgentImageTools'
import { useAgentMessageSender } from './useAgentMessageSender'
import { useAgentQuestions } from './useAgentQuestions'
import { createInitialAgentToolHandlers, useAgentRuntimeConfig } from './useAgentRuntimeConfig'
import { useAgentRuntimeFactory } from './useAgentRuntimeFactory'
import { useAgentRuntimeStore } from './useAgentRuntimeStore'
import { useAgentSessionLifecycle } from './useAgentSessionLifecycle'
import { useAgentSkills } from './useAgentSkills'
import {
  AGENT_MENU_MODEL_CONFIGS,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import { getPreferredAgentModelId, getPreferredAgentThinkingLevel } from '../config/agentPreferences'
import type { ModelConfig } from '../config/models'
import { useExternalSync } from '../hooks/effects'
import type { useApiKey } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

export type { AgentPendingQuestion, AgentQueuedUserMessage } from './runtimeTypes'

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
    stackTitle?: string,
  ) => string
  cancelGenerationJob: (jobId: string) => void
  dismissGenerationJob: (jobId: string) => void
  requestSessionTitle: (params: {
    sessionId: string
    currentUserMessage: string
    previousUserMessages: string[]
    previousTitle?: string
  }) => Promise<string | null>
  patchGenerationJobsForStackTitle: (stackId: string, stackTitle: string) => void
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
  requestSessionTitle,
  patchGenerationJobsForStackTitle,
}: UseAgentPlaygroundParams) {
  const moonshotCnKeyHook = keyHooks['moonshot-cn']
  const moonshotAiKeyHook = keyHooks['moonshot-ai']
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
  const [agentSessionStatuses, setAgentSessionStatuses] = useState<AgentSessionStatusMap>({})
  const [currentAgentSessionId, setCurrentAgentSessionId] = useState<string | null>(null)
  const [agentSessionsLoading, setAgentSessionsLoading] = useState(true)
  const {
    agentSkills,
    setAgentSkillEnabled,
    deleteAgentSkill,
    getAgentSkillPackage,
    createUserAgentSkill,
    runSkillTool,
    runReadAgentFileTool,
    runReadSkillFileTool,
    runCreateSkillTool,
    runWebSearchTool,
    runWebFetchTool,
  } = useAgentSkills()

  const agentCredentialsRef = useRef<Record<AgentModelProvider, ProviderCredentials>>({
    google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
    openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
    anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
    'moonshot-cn': { apiKey: moonshotCnKeyHook.apiKey, baseUrl: moonshotCnKeyHook.baseUrl },
    'moonshot-ai': { apiKey: moonshotAiKeyHook.apiKey, baseUrl: moonshotAiKeyHook.baseUrl },
  })
  const agentToolHandlersRef = useRef(createInitialAgentToolHandlers())

  const maybeDispatchAgentImageCallbacksRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})

  const {
    agentRuntimesRef,
    currentAgentSessionIdRef,
    clearRuntimeSessionStatus,
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
    syncRuntimeSessionStatus,
  } = useAgentRuntimeStore({
    setAgentSessions,
    setAgentSessionStatuses,
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
  })

  const {
    generationJobsRefForAgent,
    reserveAgentImageIdsForRuntime,
    releasePendingAgentImageIds,
    resolveAgentImageById,
    resolveAgentReferenceImages,
  } = useAgentImageRegistry({ agentRuntimesRef, referenceImages, history, generationJobs })

  const providerCredentials = useMemo(
    () => ({
      google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
      openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
      anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
      'moonshot-cn': { apiKey: moonshotCnKeyHook.apiKey, baseUrl: moonshotCnKeyHook.baseUrl },
      'moonshot-ai': { apiKey: moonshotAiKeyHook.apiKey, baseUrl: moonshotAiKeyHook.baseUrl },
    }),
    [
      keyHooks.google.apiKey,
      keyHooks.google.baseUrl,
      keyHooks.openai.apiKey,
      keyHooks.openai.baseUrl,
      keyHooks.anthropic.apiKey,
      keyHooks.anthropic.baseUrl,
      moonshotCnKeyHook.apiKey,
      moonshotCnKeyHook.baseUrl,
      moonshotAiKeyHook.apiKey,
      moonshotAiKeyHook.baseUrl,
    ],
  )

  const { getAgentBaseUrl, setAgentModelIdForSession, setAgentThinkingLevel, applyAgentRuntimeConfig } =
    useAgentRuntimeConfig({
      agentCredentialsRef,
      agentToolHandlersRef,
      providerCredentials,
      getCurrentRuntime,
      upsertAgentSessionSummary,
      setAgentModelId,
      setAgentThinkingLevelState,
    })

  const { maybeRunRuntimeCompactionRef } = useAgentCompaction({
    agentRuntimesRef,
    agentCredentialsRef,
    maybeDispatchAgentImageCallbacksRef,
    persistRuntimeSidecar,
    setRuntimeError,
    syncRuntimeSnapshot,
  })

  const { createRuntime } = useAgentRuntimeFactory({
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
  })

  const { createNewAgentSession, switchAgentSession, removeAgentSession } = useAgentSessionLifecycle({
    initialSessionId,
    agentRuntimesRef,
    currentAgentSessionIdRef,
    autoApproveAgentImageTasks,
    setAgentSessions,
    setAgentSessionStatuses,
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
  })

  useExternalSync(() => {
    for (const runtime of agentRuntimesRef.current.values()) {
      applyAgentRuntimeConfig(runtime)
      syncRuntimeSnapshot(runtime)
    }
  }, [agentRuntimesRef, applyAgentRuntimeConfig, syncRuntimeSnapshot])

  const { addAgentAttachments, addAgentImageAttachment, removeAgentAttachment, clearAgentAttachmentError } =
    useAgentAttachments({
      getCurrentRuntime,
      isCurrentRuntime,
      scheduleRuntimeSidecarPersist,
      setAgentAttachments,
      setAgentAttachmentError,
    })

  const providerApiKeys = useMemo(
    () => ({
      google: keyHooks.google.apiKey,
      openai: keyHooks.openai.apiKey,
      anthropic: keyHooks.anthropic.apiKey,
      'moonshot-cn': moonshotCnKeyHook.apiKey,
      'moonshot-ai': moonshotAiKeyHook.apiKey,
    }),
    [
      keyHooks.google.apiKey,
      keyHooks.openai.apiKey,
      keyHooks.anthropic.apiKey,
      moonshotCnKeyHook.apiKey,
      moonshotAiKeyHook.apiKey,
    ],
  )

  const {
    sendAgentSystemEvent,
    maybeDispatchAgentImageCallbacks,
    runGenImageTool,
    runReadImageTool,
    approveAgentImageTask,
    approvePendingAgentImageTasks,
    cancelAgentImageTask,
  } = useAgentImageTools({
    agentRuntimesRef,
    agentCredentialsRef,
    maybeDispatchAgentImageCallbacksRef,
    generationJobsRefForAgent,
    generationJobs,
    providerApiKeys,
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
    syncRuntimeSessionStatus,
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
      readAgentFile: runReadAgentFileTool,
      readSkillFile: runReadSkillFileTool,
      createSkill: runCreateSkillTool,
      webSearch: runWebSearchTool,
      webFetch: runWebFetchTool,
    }
  }, [
    runAskUserQuestionTool,
    runCreateSkillTool,
    runGenImageTool,
    runReadImageTool,
    runReadAgentFileTool,
    runReadSkillFileTool,
    runSkillTool,
    runWebSearchTool,
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
    requestSessionTitle,
    patchGenerationJobsForStackTitle,
    upsertAgentSessionSummary,
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
      if (value) approvePendingAgentImageTasks()
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { autoApproveImageTasks: value }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [approvePendingAgentImageTasks, getCurrentRuntime, scheduleRuntimeSidecarPersist, upsertAgentSessionSummary],
  )

  return {
    agentModels: AGENT_MENU_MODEL_CONFIGS,
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
    agentSessionStatuses,
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
