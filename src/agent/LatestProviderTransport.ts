import { agentLoop } from '@mariozechner/pi-ai-agent-loop'
import { streamSimple, type Api, type Context, type Model, type SimpleStreamOptions } from '@mariozechner/pi-ai'
import type { AgentRunConfig, AgentTransport } from '@mariozechner/pi-agent'

import { isAgentModelProvider } from './runtimeConfig'
import type { AgentModelProvider } from '../config/agentModels'

type ProviderApiKeyGetter = (provider: string) => Promise<string | undefined> | string | undefined

type OpenAIResponsesPayload = {
  input?: unknown
  instructions?: unknown
  [key: string]: unknown
}

export class LatestProviderTransport {
  private readonly getApiKey: ProviderApiKeyGetter

  constructor(getApiKey: ProviderApiKeyGetter) {
    this.getApiKey = getApiKey
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
      return streamSimple(model as Model<Api>, streamContext as Context, {
        ...streamOptions,
        apiKey,
        onPayload: async (payload, payloadModel) => {
          const normalized = normalizePayload(payload, payloadModel, streamContext)
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
): AgentTransport {
  return new LatestProviderTransport((provider) => {
    if (!isAgentModelProvider(provider)) return undefined
    return getCredentials(provider)
  }) as unknown as AgentTransport
}

function normalizePayload(payload: unknown, model: Model<Api>, context: unknown): unknown {
  if (model.api !== 'openai-responses' || !isContextWithSystemPrompt(context) || !isRecord(payload)) return undefined
  const normalized: OpenAIResponsesPayload = { ...payload }
  normalized.instructions = context.systemPrompt

  if (Array.isArray(normalized.input) && isInstructionMessage(normalized.input[0])) {
    normalized.input = normalized.input.slice(1)
  }

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
