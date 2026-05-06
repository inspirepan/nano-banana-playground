import { setDefaultBaseUrls } from '@google/genai'

import { type AgentModelProvider } from '../config/agentModels'
import type { Language } from '../config/languages'
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
  return (
    provider === 'google' ||
    provider === 'openai' ||
    provider === 'anthropic' ||
    provider === 'moonshot-cn' ||
    provider === 'moonshot-ai'
  )
}

export function buildLanguageDirective(language: Language): string {
  const instruction =
    language === 'en' ? 'Reply to the user in English.' : 'Reply to the user in Simplified Chinese (简体中文).'
  return `<system>${instruction}</system>`
}

function getLocalISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildCurrentDateDirective(): string {
  return `<system>Today's date is ${getLocalISODate()}.</system>`
}
