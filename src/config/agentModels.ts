import type { ThinkingLevel as AgentCoreThinkingLevel } from '@mariozechner/pi-agent'
import { getModel, type Api, type Model } from '@mariozechner/pi-ai'

import { getProviderConfig, type Provider } from './providers'
import { translate } from '../i18n'
import { resolveBaseUrl } from '../lib/validateKey'

export type AgentModelProvider = Provider
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

function providerLabel(provider: Provider): string {
  return getProviderConfig(provider).shortLabel
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

function kimiK26Model(provider: Extract<Provider, 'moonshot-cn' | 'moonshot-ai'>): Model<Api> {
  return {
    id: 'kimi-k2.6',
    name: 'Kimi K2.6',
    api: 'openai-completions',
    provider,
    baseUrl: provider === 'moonshot-cn' ? 'https://api.moonshot.cn/v1' : 'https://api.moonshot.ai/v1',
    reasoning: true,
    input: ['text', 'image'],
    cost: {
      input: 0.95,
      output: 4,
      cacheRead: 0.16,
      cacheWrite: 0,
    },
    contextWindow: 262144,
    maxTokens: 262144,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      maxTokensField: 'max_tokens',
      thinkingFormat: 'deepseek',
      requiresReasoningContentOnAssistantMessages: false,
      supportsLongCacheRetention: false,
    },
  }
}

function withClaudeEagerToolInputStreaming(model: Model<'anthropic-messages'>): Model<'anthropic-messages'> {
  return {
    ...model,
    compat: {
      ...model.compat,
      supportsEagerToolInputStreaming: true,
    },
  }
}

export const AGENT_MODEL_CONFIGS: AgentModelConfig[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    shortLabel: '3 Flash',
    provider: 'google',
    providerLabel: providerLabel('google'),
    ...asAgentModel(getModel('google', 'gemini-3-flash-preview') as Model<Api>),
  },
  {
    id: 'gpt-5.5',
    label: 'GPT 5.5',
    shortLabel: '5.5',
    provider: 'openai',
    providerLabel: providerLabel('openai'),
    ...asAgentModel(GPT_5_5_MODEL),
  },
  {
    id: 'gpt-5.4-mini',
    label: 'GPT 5.4 mini',
    shortLabel: '5.4 mini',
    provider: 'openai',
    providerLabel: providerLabel('openai'),
    ...asAgentModel(GPT_5_4_MINI_MODEL),
  },
  {
    id: 'moonshot-cn:kimi-k2.6',
    label: 'Kimi K2.6 CN',
    shortLabel: 'K2.6 CN',
    provider: 'moonshot-cn',
    providerLabel: providerLabel('moonshot-cn'),
    ...asAgentModel(kimiK26Model('moonshot-cn')),
  },
  {
    id: 'moonshot-ai:kimi-k2.6',
    label: 'Kimi K2.6 AI',
    shortLabel: 'K2.6 AI',
    provider: 'moonshot-ai',
    providerLabel: providerLabel('moonshot-ai'),
    ...asAgentModel(kimiK26Model('moonshot-ai')),
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    shortLabel: 'Haiku 4.5',
    provider: 'anthropic',
    providerLabel: providerLabel('anthropic'),
    ...asAgentModel(
      withClaudeEagerToolInputStreaming(
        getModel('anthropic', 'claude-haiku-4-5-20251001') as Model<'anthropic-messages'>,
      ),
    ),
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    shortLabel: 'Sonnet 4.6',
    provider: 'anthropic',
    providerLabel: providerLabel('anthropic'),
    ...asAgentModel(
      withClaudeEagerToolInputStreaming(getModel('anthropic', 'claude-sonnet-4-6') as Model<'anthropic-messages'>),
    ),
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    shortLabel: 'Opus 4.7',
    provider: 'anthropic',
    providerLabel: providerLabel('anthropic'),
    ...asAgentModel(
      withClaudeEagerToolInputStreaming(getModel('anthropic', 'claude-opus-4-7') as Model<'anthropic-messages'>),
    ),
  },
]

export const DEFAULT_AGENT_MODEL =
  AGENT_MODEL_CONFIGS.find((item) => item.id === 'gpt-5.4-mini') ?? AGENT_MODEL_CONFIGS[0]

export const AGENT_THINKING_OPTIONS: Array<{ value: AgentThinkingLevel; label: string }> = [
  {
    value: 'off',
    get label() {
      return translate('configLib.agentModels.thinking.off')
    },
  },
  {
    value: 'minimal',
    get label() {
      return translate('configLib.agentModels.thinking.minimal')
    },
  },
  {
    value: 'low',
    get label() {
      return translate('configLib.agentModels.thinking.low')
    },
  },
  {
    value: 'medium',
    get label() {
      return translate('configLib.agentModels.thinking.medium')
    },
  },
  {
    value: 'high',
    get label() {
      return translate('configLib.agentModels.thinking.high')
    },
  },
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
