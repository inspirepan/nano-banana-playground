import type { Provider } from '../config/models'

// Default API base URLs shown as placeholder text. Both are the canonical
// entry points used when the user leaves the field blank.
export const DEFAULT_BASE_URL: Record<Provider, string> = {
  google: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com/v1',
}

// Trailing `/v1`, `/v1beta`, `/v1alpha`, `/v2beta` etc.
const TRAILING_API_VERSION = /\/v\d+(?:alpha|beta)?\/*$/i

// Normalize a user-entered base URL into the form our callers expect:
//   - google: host root (versioned paths are appended per-endpoint)
//   - openai: must end in `/v1` (all endpoints are relative to /v1)
// Whatever the user types (`xxx.com`, `xxx.com/v1`, `xxx.com/v1beta/`) is
// reconciled to the canonical shape. Suffix `#` suppresses normalization so
// non-standard gateways can be addressed explicitly.
export function resolveBaseUrl(provider: Provider, baseUrl?: string): string {
  const trimmed = (baseUrl ?? '').trim()
  if (trimmed.endsWith('#')) {
    return trimmed.slice(0, -1).replace(/\/+$/, '')
  }
  const effective = (trimmed || DEFAULT_BASE_URL[provider]).replace(/\/+$/, '')
  const stripped = effective.replace(TRAILING_API_VERSION, '')
  if (provider === 'google') return stripped
  return `${stripped}/v1`
}

// Representative endpoint shown in the dialog so the user can verify their
// base URL before saving (surfaces accidental `/v1` duplication, etc.).
export function previewEndpoint(provider: Provider, baseUrl?: string): string {
  const base = resolveBaseUrl(provider, baseUrl)
  if (provider === 'google') return `${base}/v1beta/models/{model}:generateContent`
  return `${base}/images/generations`
}

export async function validateApiKey(
  provider: Provider,
  apiKey: string,
  baseUrl?: string,
): Promise<{ valid: boolean; error?: string }> {
  const base = resolveBaseUrl(provider, baseUrl)
  try {
    if (provider === 'google') {
      const res = await fetch(`${base}/v1beta/models/gemini-3.1-flash-lite-preview:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      })
      const data = await res.json()
      if (!res.ok) return { valid: false, error: data.error?.message || `HTTP ${res.status}` }
      return { valid: true }
    }

    // OpenAI: a cheap idempotent GET that only requires a valid key.
    const res = await fetch(`${base}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return { valid: false, error: data?.error?.message || `HTTP ${res.status}` }
    }
    return { valid: true }
  } catch (e) {
    // fetch throws on CORS / DNS / offline / mixed-content. Most commonly
    // this means the gateway didn't return Access-Control-Allow-Origin for
    // this origin, which is indistinguishable from a network error at the
    // browser layer.
    const msg = e instanceof Error ? e.message : String(e)
    return { valid: false, error: `网络或 CORS 错误：${msg}。若 curl 能通但浏览器失败，通常是网关未允许跨域。` }
  }
}

const KEY_INVALID_PATTERNS = [
  'api key not valid',
  'api_key_invalid',
  'invalid api key',
  'incorrect api key',
  'permission denied',
  'unauthorized',
  '401',
  '403',
]

export function isKeyError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase()
  return KEY_INVALID_PATTERNS.some((p) => lower.includes(p))
}
