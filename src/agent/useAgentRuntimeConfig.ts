import { useCallback, type RefObject } from 'react'

import { syncGeminiAgentBaseUrl } from './runtimeConfig'
import type { AgentSessionRuntime, ProviderCredentials } from './runtimeTypes'
import { updateAgentSessionConfig } from './sessionStore'
import type { AgentSessionSummary } from './sessionTypes'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import {
  createAgentTools,
  type AgentToolResult,
  type CreateSkillToolArgs,
  type GenImageToolArgs,
  type PreparedAskUserQuestionToolArgs,
  type ReadImageToolArgs,
  type ReadSkillFileToolArgs,
  type SkillToolArgs,
  type WebFetchToolArgs,
} from './tools'
import {
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import { setPreferredAgentModelId, setPreferredAgentThinkingLevel } from '../config/agentPreferences'
import { MODEL_CONFIGS } from '../config/models'
import { useExternalSync } from '../hooks/effects'

export type AgentToolHandlers = {
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
    args: PreparedAskUserQuestionToolArgs,
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
}

export function createInitialAgentToolHandlers(): AgentToolHandlers {
  return {
    genImage: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
    readImage: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
    askUserQuestion: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
    loadSkill: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
    readSkillFile: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
    createSkill: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
    webFetch: async () => {
      throw new Error('Agent tools are not ready yet.')
    },
  }
}

export function useAgentRuntimeConfig({
  agentCredentialsRef,
  agentToolHandlersRef,
  providerCredentials,
  getCurrentRuntime,
  upsertAgentSessionSummary,
  setAgentModelId,
  setAgentThinkingLevelState,
}: {
  agentCredentialsRef: RefObject<Record<AgentModelProvider, ProviderCredentials>>
  agentToolHandlersRef: RefObject<AgentToolHandlers>
  providerCredentials: Record<AgentModelProvider, ProviderCredentials>
  getCurrentRuntime: () => AgentSessionRuntime | null
  upsertAgentSessionSummary: (record: AgentSessionSummary) => void
  setAgentModelId: (modelId: string) => void
  setAgentThinkingLevelState: (level: AgentThinkingLevel) => void
}) {
  const googleApiKey = providerCredentials.google.apiKey
  const googleBaseUrl = providerCredentials.google.baseUrl
  const openaiApiKey = providerCredentials.openai.apiKey
  const openaiBaseUrl = providerCredentials.openai.baseUrl
  const anthropicApiKey = providerCredentials.anthropic.apiKey
  const anthropicBaseUrl = providerCredentials.anthropic.baseUrl

  useExternalSync(() => {
    agentCredentialsRef.current = {
      google: { apiKey: googleApiKey, baseUrl: googleBaseUrl },
      openai: { apiKey: openaiApiKey, baseUrl: openaiBaseUrl },
      anthropic: { apiKey: anthropicApiKey, baseUrl: anthropicBaseUrl },
    }
  }, [agentCredentialsRef, anthropicApiKey, anthropicBaseUrl, googleApiKey, googleBaseUrl, openaiApiKey, openaiBaseUrl])

  const getAgentBaseUrl = useCallback(
    (provider: AgentModelProvider) => agentCredentialsRef.current[provider].baseUrl,
    [agentCredentialsRef],
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
    [getAgentBaseUrl, getCurrentRuntime, setAgentModelId, upsertAgentSessionSummary],
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
    [getCurrentRuntime, setAgentThinkingLevelState, upsertAgentSessionSummary],
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
    [agentToolHandlersRef, getAgentBaseUrl],
  )

  return { getAgentBaseUrl, setAgentModelIdForSession, setAgentThinkingLevel, applyAgentRuntimeConfig }
}
