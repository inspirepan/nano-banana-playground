import type { ThinkingLevel as AgentCoreThinkingLevel } from '@mariozechner/pi-agent'
import { getModel, type Api, type Model } from '@mariozechner/pi-ai'

import { resolveBaseUrl } from '../lib/validateKey'

export type AgentModelProvider = 'google' | 'openai'
export type AgentThinkingLevel = Extract<AgentCoreThinkingLevel, 'off' | 'minimal' | 'low' | 'medium' | 'high'>

export type AgentModelConfig = {
  id: string
  label: string
  shortLabel: string
  provider: AgentModelProvider
  providerLabel: string
  model: Model<Api>
  supportsThinking: boolean
  supportsImages: boolean
}

function asAgentModel(model: Model<Api>): Pick<AgentModelConfig, 'model' | 'supportsThinking' | 'supportsImages'> {
  return {
    model,
    supportsThinking: model.reasoning,
    supportsImages: model.input.includes('image'),
  }
}

const GPT_5_5_MODEL: Model<Api> = {
  id: 'gpt-5.5',
  name: 'GPT-5.5',
  api: 'openai-responses',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  reasoning: true,
  input: ['text', 'image'],
  cost: {
    input: 1.25,
    output: 10,
    cacheRead: 0.125,
    cacheWrite: 0,
  },
  contextWindow: 400000,
  maxTokens: 128000,
}

const GPT_5_4_MINI_MODEL: Model<Api> = {
  id: 'gpt-5.4-mini',
  name: 'GPT-5.4 mini',
  api: 'openai-responses',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  reasoning: true,
  input: ['text', 'image'],
  cost: {
    input: 0.25,
    output: 2,
    cacheRead: 0.025,
    cacheWrite: 0,
  },
  contextWindow: 400000,
  maxTokens: 128000,
}

export const AGENT_MODEL_CONFIGS: AgentModelConfig[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    shortLabel: 'Gemini 3 Flash',
    provider: 'google',
    providerLabel: 'Gemini',
    ...asAgentModel(getModel('google', 'gemini-3-flash-preview') as Model<Api>),
  },
  {
    id: 'gpt-5.5',
    label: 'GPT 5.5',
    shortLabel: 'GPT 5.5',
    provider: 'openai',
    providerLabel: 'OpenAI',
    ...asAgentModel(GPT_5_5_MODEL),
  },
  {
    id: 'gpt-5.4-mini',
    label: 'GPT 5.4 mini',
    shortLabel: 'GPT 5.4 mini',
    provider: 'openai',
    providerLabel: 'OpenAI',
    ...asAgentModel(GPT_5_4_MINI_MODEL),
  },
]

export const DEFAULT_AGENT_MODEL =
  AGENT_MODEL_CONFIGS.find((item) => item.id === 'gpt-5.4-mini') ?? AGENT_MODEL_CONFIGS[0]

export const AGENT_THINKING_OPTIONS: Array<{ value: AgentThinkingLevel; label: string }> = [
  { value: 'off', label: '关闭' },
  { value: 'minimal', label: '低' },
  { value: 'low', label: '中' },
  { value: 'medium', label: '高' },
  { value: 'high', label: '超高' },
]

export function resolveAgentModelConfig(id: string): AgentModelConfig {
  return AGENT_MODEL_CONFIGS.find((item) => item.id === id) ?? DEFAULT_AGENT_MODEL
}

export function agentModelWithBaseUrl(config: AgentModelConfig, baseUrl: string): Model<Api> {
  const trimmed = baseUrl.trim()
  if (!trimmed) return config.model
  if (trimmed.endsWith('#')) return { ...config.model, baseUrl: trimmed.slice(0, -1).replace(/\/+$/, '') }
  const normalized = resolveBaseUrl(config.provider, trimmed)
  return { ...config.model, baseUrl: config.provider === 'google' ? `${normalized}/v1beta` : normalized }
}
