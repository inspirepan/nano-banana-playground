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
  type ReadAgentFileToolArgs,
  type PreparedAskUserQuestionToolArgs,
  type ReadImageToolArgs,
  type ReadSkillFileToolArgs,
  type SkillToolArgs,
  type WebFetchToolArgs,
  type WebSearchToolArgs,
} from './tools'
import { offloadAgentToolResult } from './tools/toolResultOffload'
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
  readAgentFile: (sessionId: string, toolCallId: string, args: ReadAgentFileToolArgs) => Promise<AgentToolResult>
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
  webSearch: (
    sessionId: string,
    toolCallId: string,
    args: WebSearchToolArgs,
    signal?: AbortSignal,
  ) => Promise<AgentToolResult>
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
    readAgentFile: async () => {
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
    webSearch: async () => {
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
  const moonshotCnApiKey = providerCredentials['moonshot-cn'].apiKey
  const moonshotCnBaseUrl = providerCredentials['moonshot-cn'].baseUrl
  const moonshotAiApiKey = providerCredentials['moonshot-ai'].apiKey
  const moonshotAiBaseUrl = providerCredentials['moonshot-ai'].baseUrl

  useExternalSync(() => {
    agentCredentialsRef.current = {
      google: { apiKey: googleApiKey, baseUrl: googleBaseUrl },
      openai: { apiKey: openaiApiKey, baseUrl: openaiBaseUrl },
      anthropic: { apiKey: anthropicApiKey, baseUrl: anthropicBaseUrl },
      'moonshot-cn': { apiKey: moonshotCnApiKey, baseUrl: moonshotCnBaseUrl },
      'moonshot-ai': { apiKey: moonshotAiApiKey, baseUrl: moonshotAiBaseUrl },
    }
  }, [
    agentCredentialsRef,
    anthropicApiKey,
    anthropicBaseUrl,
    googleApiKey,
    googleBaseUrl,
    moonshotAiApiKey,
    moonshotAiBaseUrl,
    moonshotCnApiKey,
    moonshotCnBaseUrl,
    openaiApiKey,
    openaiBaseUrl,
  ])

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
      const runWithOffload = async (toolCallId: string, toolName: string, run: () => Promise<AgentToolResult>) => {
        const result = await run()
        if (toolName === 'ReadAgentFile' || toolName === 'ReadImage' || toolName === 'ReadSkillFile') return result
        return offloadAgentToolResult(result, { sessionId: runtime.sessionId, toolCallId, toolName })
      }
      runtime.agent.state.tools = createAgentTools({
        imageModels: MODEL_CONFIGS,
        genImage: (toolCallId, args, signal) =>
          runWithOffload(toolCallId, 'GenImage', () =>
            agentToolHandlersRef.current.genImage(runtime.sessionId, toolCallId, args, signal),
          ),
        readAgentFile: (toolCallId, args) =>
          agentToolHandlersRef.current.readAgentFile(runtime.sessionId, toolCallId, args),
        readImage: (toolCallId, args) => agentToolHandlersRef.current.readImage(runtime.sessionId, toolCallId, args),
        askUserQuestion: (toolCallId, args, signal) =>
          runWithOffload(toolCallId, 'AskUserQuestion', () =>
            agentToolHandlersRef.current.askUserQuestion(runtime.sessionId, toolCallId, args, signal),
          ),
        loadSkill: (toolCallId, args) =>
          runWithOffload(toolCallId, 'Skill', () =>
            agentToolHandlersRef.current.loadSkill(runtime.sessionId, toolCallId, args),
          ),
        readSkillFile: (toolCallId, args) =>
          runWithOffload(toolCallId, 'ReadSkillFile', () =>
            agentToolHandlersRef.current.readSkillFile(runtime.sessionId, toolCallId, args),
          ),
        createSkill: (toolCallId, args) =>
          runWithOffload(toolCallId, 'CreateSkill', () =>
            agentToolHandlersRef.current.createSkill(runtime.sessionId, toolCallId, args),
          ),
        webSearch: (toolCallId, args, signal) =>
          runWithOffload(toolCallId, 'WebSearch', () =>
            agentToolHandlersRef.current.webSearch(runtime.sessionId, toolCallId, args, signal),
          ),
        webFetch: (toolCallId, args, signal) =>
          runWithOffload(toolCallId, 'WebFetch', () =>
            agentToolHandlersRef.current.webFetch(runtime.sessionId, toolCallId, args, signal),
          ),
      })
    },
    [agentToolHandlersRef, getAgentBaseUrl],
  )

  return { getAgentBaseUrl, setAgentModelIdForSession, setAgentThinkingLevel, applyAgentRuntimeConfig }
}
