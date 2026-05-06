import { agentLoop } from '@mariozechner/pi-ai-agent-loop'
import {
  streamSimple,
  type Api,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type ThinkingLevel as ProviderThinkingLevel,
} from '@mariozechner/pi-ai'
import type { AgentRunConfig, AgentTransport } from '@mariozechner/pi-agent'

import { isAgentModelProvider } from './runtimeConfig'
import type { AgentModelProvider, AgentThinkingLevel, AgentThinkingRequestConfig } from '../config/agentModels'

type ProviderApiKeyGetter = (provider: string) => Promise<string | undefined> | string | undefined
type AgentThinkingConfigGetter = () => AgentThinkingRequestConfig

type OpenAIResponsesPayload = {
  input?: unknown
  instructions?: unknown
  [key: string]: unknown
}

export class LatestProviderTransport {
  private readonly getApiKey: ProviderApiKeyGetter
  private readonly getThinkingConfig?: AgentThinkingConfigGetter

  constructor(getApiKey: ProviderApiKeyGetter, getThinkingConfig?: AgentThinkingConfigGetter) {
    this.getApiKey = getApiKey
    this.getThinkingConfig = getThinkingConfig
  }

  async *run(
    messages: Parameters<AgentTransport['run']>[0],
    userMessage: Parameters<AgentTransport['run']>[1],
    config: AgentRunConfig,
    signal?: AbortSignal,
  ) {
    const apiKey = await this.getApiKey(config.model.provider)
    if (!apiKey) throw new Error(`No API key found for provider: ${config.model.provider}`)

    const context = {
      systemPrompt: config.systemPrompt,
      messages,
      tools: config.tools,
    }
    const latestStream = (model: unknown, streamContext: unknown, options?: unknown) => {
      const streamOptions = options as SimpleStreamOptions | undefined
      const thinkingConfig = this.getThinkingConfig?.()
      const reasoning = thinkingConfig
        ? providerReasoningForAgentThinkingLevel(thinkingConfig.level)
        : streamOptions?.reasoning
      return streamSimple(model as Model<Api>, streamContext as Context, {
        ...streamOptions,
        reasoning,
        apiKey,
        onPayload: async (payload, payloadModel) => {
          const normalized = normalizeAgentProviderPayload(payload, payloadModel, streamContext, {
            sendsThinkingEffort: thinkingConfig?.sendsThinkingEffort ?? true,
          })
          const nextPayload = await streamOptions?.onPayload?.(normalized ?? payload, payloadModel)
          return nextPayload ?? normalized
        },
      })
    }

    for await (const event of agentLoop(
      userMessage as never,
      context as never,
      {
        model: config.model as never,
        reasoning: config.reasoning,
        apiKey,
        getQueuedMessages: config.getQueuedMessages as never,
      },
      signal,
      latestStream as never,
    )) {
      yield event
    }
  }
}

export function createLatestProviderTransport(
  getCredentials: (provider: AgentModelProvider) => string | undefined,
  getThinkingConfig?: AgentThinkingConfigGetter,
): AgentTransport {
  return new LatestProviderTransport((provider) => {
    if (!isAgentModelProvider(provider)) return undefined
    return getCredentials(provider)
  }, getThinkingConfig) as unknown as AgentTransport
}

export function providerReasoningForAgentThinkingLevel(level: AgentThinkingLevel): ProviderThinkingLevel | undefined {
  switch (level) {
    case 'off':
      return undefined
    case 'minimal':
      return 'minimal'
    case 'low':
      return 'low'
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'xhigh':
      return 'xhigh'
  }
}

export function normalizeAgentProviderPayload(
  payload: unknown,
  model: Model<Api>,
  context: unknown,
  options: { sendsThinkingEffort?: boolean } = {},
): unknown {
  if (!isRecord(payload)) return undefined
  if (options.sendsThinkingEffort === false) return normalizePayloadWithoutReasoningEffort(payload)
  if (model.api !== 'openai-responses' || !isContextWithSystemPrompt(context)) return undefined
  const normalized: OpenAIResponsesPayload = { ...payload }
  normalized.instructions = context.systemPrompt

  if (Array.isArray(normalized.input) && isInstructionMessage(normalized.input[0])) {
    normalized.input = normalized.input.slice(1)
  }

  return normalized
}

function normalizePayloadWithoutReasoningEffort(payload: Record<string, unknown>): unknown {
  if (!isRecord(payload.thinking)) return undefined
  const normalized = { ...payload }
  delete normalized.reasoning_effort
  return normalized
}

function isContextWithSystemPrompt(value: unknown): value is { systemPrompt: string } {
  return isRecord(value) && typeof value.systemPrompt === 'string' && value.systemPrompt.length > 0
}

function isInstructionMessage(value: unknown): value is { role: 'developer' | 'system' } {
  if (!isRecord(value)) return false
  return value.role === 'developer' || value.role === 'system'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
