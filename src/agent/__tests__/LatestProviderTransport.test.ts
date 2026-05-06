import { describe, expect, it } from 'vitest'

import type { Api, Model } from '@mariozechner/pi-ai'

import { normalizeAgentProviderPayload, providerReasoningForAgentThinkingLevel } from '../LatestProviderTransport'

const openAiCompatibleModel: Model<Api> = {
  id: 'example-reasoning-model',
  name: 'Example reasoning model',
  api: 'openai-completions',
  provider: 'example-provider',
  baseUrl: 'https://example.com/v1',
  reasoning: true,
  input: ['text', 'image'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 262144,
  maxTokens: 262144,
}

describe('providerReasoningForAgentThinkingLevel', () => {
  it('maps menu thinking levels to pi-ai reasoning levels without collapsing low and medium', () => {
    expect(providerReasoningForAgentThinkingLevel('off')).toBeUndefined()
    expect(providerReasoningForAgentThinkingLevel('minimal')).toBe('minimal')
    expect(providerReasoningForAgentThinkingLevel('low')).toBe('low')
    expect(providerReasoningForAgentThinkingLevel('medium')).toBe('medium')
    expect(providerReasoningForAgentThinkingLevel('high')).toBe('high')
    expect(providerReasoningForAgentThinkingLevel('xhigh')).toBe('xhigh')
  })
})

describe('normalizeAgentProviderPayload', () => {
  it('removes reasoning_effort when a model is configured as a thinking toggle', () => {
    expect(
      normalizeAgentProviderPayload(
        {
          model: 'example-reasoning-model',
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
        },
        openAiCompatibleModel,
        {},
        { sendsThinkingEffort: false },
      ),
    ).toEqual({
      model: 'example-reasoning-model',
      thinking: { type: 'enabled' },
    })
  })
})
