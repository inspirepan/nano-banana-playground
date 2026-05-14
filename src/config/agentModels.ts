import type { ThinkingLevel as AgentCoreThinkingLevel } from '@mariozechner/pi-agent'
import {
  getModel,
  type Api,
  type Model,
  type ThinkingLevel as ProviderThinkingLevel,
  type Usage,
} from '@mariozechner/pi-ai'

import { getProviderConfig, type Provider } from './providers'
import { resolveBaseUrl } from '../lib/validateKey'

export type AgentModelProvider = Exclude<Provider, 'doubao'>
export type AgentThinkingLevel = 'off' | ProviderThinkingLevel
export type AgentThinkingRequestConfig = { level: AgentThinkingLevel; sendsThinkingEffort: boolean }
export type AgentThinkingOptionConfig = { value: AgentThinkingLevel; labelKey: string }

export const AGENT_THINKING_OPTIONS: AgentThinkingOptionConfig[] = [
  { value: 'minimal', labelKey: 'agentChat.thinking.minimal' },
  { value: 'low', labelKey: 'agentChat.thinking.low' },
  { value: 'medium', labelKey: 'agentChat.thinking.medium' },
  { value: 'high', labelKey: 'agentChat.thinking.high' },
  { value: 'xhigh', labelKey: 'agentChat.thinking.xhigh' },
]

const AGENT_THINKING_WITHOUT_MINIMAL_OPTIONS: AgentThinkingOptionConfig[] = AGENT_THINKING_OPTIONS.filter(
  (option) => option.value !== 'minimal',
)

const AGENT_THINKING_TOGGLE_OPTIONS: AgentThinkingOptionConfig[] = [
  { value: 'high', labelKey: 'agentChat.thinking.on' },
]

const AGENT_THINKING_EFFORT_CONFIG = {
  thinkingOptions: AGENT_THINKING_OPTIONS,
  sendsThinkingEffort: true,
} satisfies AgentModelThinkingConfig

const AGENT_THINKING_WITHOUT_MINIMAL_CONFIG = {
  thinkingOptions: AGENT_THINKING_WITHOUT_MINIMAL_OPTIONS,
  sendsThinkingEffort: true,
} satisfies AgentModelThinkingConfig

const AGENT_THINKING_TOGGLE_CONFIG = {
  thinkingOptions: AGENT_THINKING_TOGGLE_OPTIONS,
  sendsThinkingEffort: false,
} satisfies AgentModelThinkingConfig

export type AgentModelConfig = {
  id: string
  label: string
  shortLabel: string
  provider: AgentModelProvider
  providerLabel: string
  model: Model<Api>
  supportsThinking: boolean
  thinkingOptions: AgentThinkingOptionConfig[]
  sendsThinkingEffort: boolean
  supportsImages: boolean
  // Hidden from the main agent model menu; only surfaced in title-generation
  // settings. These are tiny/cheap models we don't want to drive full sessions.
  titleOnly?: boolean
}

type AgentModelThinkingConfig = {
  thinkingOptions: AgentThinkingOptionConfig[]
  sendsThinkingEffort: boolean
}

function asAgentModel(
  model: Model<Api>,
  thinkingConfig: AgentModelThinkingConfig = AGENT_THINKING_EFFORT_CONFIG,
): Pick<AgentModelConfig, 'model' | 'supportsThinking' | 'thinkingOptions' | 'sendsThinkingEffort' | 'supportsImages'> {
  return {
    model,
    supportsThinking: model.reasoning,
    thinkingOptions: thinkingConfig.thinkingOptions,
    sendsThinkingEffort: thinkingConfig.sendsThinkingEffort,
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
    input: 5,
    output: 30,
    cacheRead: 0.5,
    cacheWrite: 0,
  },
  contextWindow: 272000,
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
    input: 0.75,
    output: 4.5,
    cacheRead: 0.075,
    cacheWrite: 0,
  },
  contextWindow: 400000,
  maxTokens: 128000,
}

const GPT_5_4_NANO_MODEL: Model<Api> = {
  id: 'gpt-5.4-nano',
  name: 'GPT-5.4 nano',
  api: 'openai-responses',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  reasoning: false,
  input: ['text'],
  cost: {
    input: 0.2,
    output: 1.25,
    cacheRead: 0.02,
    cacheWrite: 0,
  },
  contextWindow: 400000,
  maxTokens: 32000,
}

const GEMINI_3_1_FLASH_LITE_MODEL: Model<Api> = {
  id: 'gemini-3.1-flash-lite',
  name: 'Gemini 3.1 Flash Lite',
  api: 'google-generative-ai',
  provider: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  reasoning: false,
  input: ['text'],
  cost: {
    input: 0.25,
    output: 1.5,
    cacheRead: 0.025,
    cacheWrite: 1,
  },
  contextWindow: 1048576,
  maxTokens: 65536,
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

function withoutClaudeEagerToolInputStreaming(model: Model<'anthropic-messages'>): Model<'anthropic-messages'> {
  return {
    ...model,
    compat: {
      ...model.compat,
      supportsEagerToolInputStreaming: false,
    },
  }
}

export const AGENT_MODEL_CONFIGS: AgentModelConfig[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    shortLabel: 'Haiku 4.5',
    provider: 'anthropic',
    providerLabel: providerLabel('anthropic'),
    ...asAgentModel(
      withoutClaudeEagerToolInputStreaming(
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
  {
    id: 'gpt-5.5',
    label: 'GPT 5.5',
    shortLabel: '5.5',
    provider: 'openai',
    providerLabel: providerLabel('openai'),
    ...asAgentModel(GPT_5_5_MODEL, AGENT_THINKING_WITHOUT_MINIMAL_CONFIG),
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
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    shortLabel: '3 Flash',
    provider: 'google',
    providerLabel: providerLabel('google'),
    ...asAgentModel(getModel('google', 'gemini-3-flash-preview') as Model<Api>),
  },
  {
    id: 'moonshot-cn:kimi-k2.6',
    label: 'Kimi K2.6 CN',
    shortLabel: 'K2.6 CN',
    provider: 'moonshot-cn',
    providerLabel: providerLabel('moonshot-cn'),
    ...asAgentModel(kimiK26Model('moonshot-cn'), AGENT_THINKING_TOGGLE_CONFIG),
  },
  {
    id: 'moonshot-ai:kimi-k2.6',
    label: 'Kimi K2.6',
    shortLabel: 'K2.6',
    provider: 'moonshot-ai',
    providerLabel: providerLabel('moonshot-ai'),
    ...asAgentModel(kimiK26Model('moonshot-ai'), AGENT_THINKING_TOGGLE_CONFIG),
  },
  {
    id: 'gpt-5.4-nano',
    label: 'GPT 5.4 nano',
    shortLabel: '5.4 nano',
    provider: 'openai',
    providerLabel: providerLabel('openai'),
    ...asAgentModel(GPT_5_4_NANO_MODEL),
    titleOnly: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    shortLabel: '3.1 Flash Lite',
    provider: 'google',
    providerLabel: providerLabel('google'),
    ...asAgentModel(GEMINI_3_1_FLASH_LITE_MODEL),
    titleOnly: true,
  },
]

export const AGENT_MENU_MODEL_CONFIGS: AgentModelConfig[] = AGENT_MODEL_CONFIGS.filter((item) => !item.titleOnly)

// Auto-selection walks this list in order, so the cheapest/fastest title
// models are preferred when their API key is configured.
const TITLE_MODEL_IDS = [
  'gpt-5.4-nano',
  'gemini-3.1-flash-lite',
  'claude-haiku-4-5-20251001',
  'gpt-5.4-mini',
  'gemini-3-flash-preview',
] as const

export const TITLE_MODEL_CONFIGS: AgentModelConfig[] = TITLE_MODEL_IDS.flatMap((id) => {
  const found = AGENT_MODEL_CONFIGS.find((item) => item.id === id)
  return found ? [found] : []
})

export function agentThinkingLevelsForModel(model: Pick<AgentModelConfig, 'thinkingOptions'>): AgentThinkingLevel[] {
  return model.thinkingOptions.map((item) => item.value)
}

export function effectiveAgentThinkingLevelForModel(
  model: Pick<AgentModelConfig, 'thinkingOptions'>,
  level: AgentThinkingLevel,
): AgentThinkingLevel {
  if (model.thinkingOptions.some((item) => item.value === level)) return level
  return model.thinkingOptions.find((item) => item.value !== 'off')?.value ?? 'off'
}

export function agentThinkingLabelKeyForLevel(
  model: Pick<AgentModelConfig, 'thinkingOptions'>,
  level: AgentThinkingLevel,
): string {
  return model.thinkingOptions.find((item) => item.value === level)?.labelKey ?? `agentChat.thinking.${level}`
}

export function agentCoreThinkingLevelForModel(
  model: Pick<AgentModelConfig, 'thinkingOptions'>,
  level: AgentThinkingLevel,
): AgentCoreThinkingLevel {
  const effective = effectiveAgentThinkingLevelForModel(model, level)
  return effective === 'xhigh' ? 'high' : effective
}

export const DEFAULT_AGENT_MODEL =
  AGENT_MODEL_CONFIGS.find((item) => item.id === 'gpt-5.4-mini') ?? AGENT_MODEL_CONFIGS[0]

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

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function getAgentUsageCost(config: Pick<AgentModelConfig, 'model'>, usage: Usage): Usage['cost'] {
  const input = numberOrZero(usage.input)
  const output = numberOrZero(usage.output)
  const cacheRead = numberOrZero(usage.cacheRead)
  const cacheWrite = numberOrZero(usage.cacheWrite)
  const calculated = {
    input: (config.model.cost.input * input) / 1_000_000,
    output: (config.model.cost.output * output) / 1_000_000,
    cacheRead: (config.model.cost.cacheRead * cacheRead) / 1_000_000,
    cacheWrite: (config.model.cost.cacheWrite * cacheWrite) / 1_000_000,
    total: 0,
  }
  calculated.total = calculated.input + calculated.output + calculated.cacheRead + calculated.cacheWrite
  const rawCost = (usage as unknown as { cost?: Partial<Usage['cost']> }).cost
  const upstream = {
    input: numberOrZero(rawCost?.input),
    output: numberOrZero(rawCost?.output),
    cacheRead: numberOrZero(rawCost?.cacheRead),
    cacheWrite: numberOrZero(rawCost?.cacheWrite),
    total: numberOrZero(rawCost?.total),
  }

  return upstream.total > 0 || calculated.total === 0 ? upstream : calculated
}
