import { setDefaultBaseUrls } from '@google/genai'

import { type AgentModelProvider } from '../config/agentModels'
import type { Language } from '../config/languages'
import { MODEL_CONFIGS } from '../config/models'
import { resolveBaseUrl } from '../lib/validateKey'

const TRAILING_GEMINI_API_VERSION = /\/v\d+(?:alpha|beta)?\/*$/i

export function syncGeminiAgentBaseUrl(provider: AgentModelProvider, baseUrl: string): void {
  if (provider !== 'google') return
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    setDefaultBaseUrls({ geminiUrl: undefined })
    return
  }
  const sdkBaseUrl = resolveBaseUrl('google', trimmed).replace(TRAILING_GEMINI_API_VERSION, '')
  setDefaultBaseUrls({ geminiUrl: sdkBaseUrl })
}

export function isAgentModelProvider(provider: string): provider is AgentModelProvider {
  return provider === 'google' || provider === 'openai' || provider === 'anthropic' || provider === 'deepseek'
}

export function buildLanguageDirective(language: Language): string {
  const instruction =
    language === 'en' ? 'Reply to the user in English.' : 'Reply to the user in Simplified Chinese (简体中文).'
  return `<system>${instruction}</system>`
}

export function buildPreferredImageModelDirective(id: string): string | null {
  const model = MODEL_CONFIGS.find((item) => item.id === id)
  if (!model) return null
  return `<system>The user prefers "${model.name}" (model id: ${model.id}) for image generation. Use this model for GenImage tool calls unless the user explicitly asks for a different one.</system>`
}

export function buildPreferredImageModelClearedDirective(): string {
  return '<system>The user no longer has a preferred image generation model. Pick the most appropriate model for each GenImage call based on the request.</system>'
}
