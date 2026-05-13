import type { Provider } from '../config/models'
import { PROVIDER_CONFIGS, getProviderConfig } from '../config/providers'
import { translate } from '../i18n'

// Default API base URLs shown as placeholder text. Both are the canonical
// entry points used when the user leaves the field blank.
export const DEFAULT_BASE_URL = Object.fromEntries(
  PROVIDER_CONFIGS.map((provider) => [provider.id, provider.defaultBaseUrl]),
) as Record<Provider, string>

// Trailing `/v1`, `/v1beta`, `/v1alpha`, `/v2beta` etc.
const TRAILING_API_VERSION = /\/v\d+(?:alpha|beta)?\/*$/i

function isOpenAICompatibleProvider(provider: Provider): boolean {
  return provider === 'openai' || provider === 'moonshot-cn' || provider === 'moonshot-ai'
}

function resolveDoubaoBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim() || getProviderConfig('doubao').defaultBaseUrl
  if (trimmed.startsWith('/')) return trimmed.replace(/\/+$/, '')
  const raw = (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).replace(/\/+$/, '')
  // Live preview calls this on every keystroke; a partial URL must not throw.
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return raw
  }
  if (parsed.pathname.startsWith('/api/llm/')) return raw
  if (parsed.hostname === 'ark.cn-beijing.volces.com' && (parsed.pathname === '' || parsed.pathname === '/')) {
    return `${raw}/api/v3`
  }
  return raw
}

// Normalize a user-entered base URL into the form our callers expect:
//   - google: host root (versioned paths are appended per-endpoint)
//   - OpenAI-compatible providers: must end in `/v1` (all endpoints are relative to /v1)
//   - anthropic: host root (SDK appends its endpoint paths)
// Whatever the user types (`xxx.com`, `xxx.com/v1`, `xxx.com/v1beta/`) is
// reconciled to the canonical shape. Suffix `#` suppresses normalization so
// non-standard gateways can be addressed explicitly.
export function resolveBaseUrl(provider: Provider, baseUrl?: string): string {
  const trimmed = (baseUrl ?? '').trim()
  if (trimmed.endsWith('#')) {
    return trimmed.slice(0, -1).replace(/\/+$/, '')
  }
  if (provider === 'doubao') return resolveDoubaoBaseUrl(trimmed)
  const stripped = stripTrailingApiVersion(trimmed || getProviderConfig(provider).defaultBaseUrl)
  if (provider === 'google') return stripped
  if (isOpenAICompatibleProvider(provider)) return `${stripped}/v1`
  return stripped
}

// Representative endpoint shown in the dialog so the user can verify their
// base URL before saving (surfaces accidental `/v1` duplication, etc.).
export function previewEndpoint(provider: Provider, baseUrl?: string): string {
  const base = resolveBaseUrl(provider, baseUrl)
  if (provider === 'google') return `${base}/v1beta/models/{model}:generateContent`
  if (provider === 'anthropic') return `${base}/v1/messages`
  if (provider === 'doubao') return `${base}/images/generations`
  if (provider === 'moonshot-cn' || provider === 'moonshot-ai') return `${base}/chat/completions`
  return `${base}/images/generations`
}

export type ValidateKeyResult = { valid: true } | { valid: false; error: string; kind: 'http' | 'network' }

export async function validateApiKey(provider: Provider, apiKey: string, baseUrl?: string): Promise<ValidateKeyResult> {
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
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      })
      const data = await res.json()
      if (!res.ok) return { valid: false, error: data.error?.message || `HTTP ${res.status}`, kind: 'http' }
      return { valid: true }
    }

    if (provider === 'anthropic') {
      const res = await fetch(`${base}/v1/models`, {
        method: 'GET',
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        return { valid: false, error: data?.error?.message || `HTTP ${res.status}`, kind: 'http' }
      }
      return { valid: true }
    }

    if (provider === 'doubao') {
      const res = await fetch(`${base}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        return { valid: false, error: data?.error?.message || `HTTP ${res.status}`, kind: 'http' }
      }
      return { valid: true }
    }

    // Moonshot's /models is open across origins, but /chat/completions can
    // get blocked once the OpenAI-compatible SDK adds its x-stainless-*
    // fingerprint headers and uses streaming. Mirror the SDK's full request
    // shape so the validation triggers the same preflight + response checks
    // the agent will hit. If anything is rejected, fetch throws and the
    // proxy auto-fallback kicks in.
    if (provider === 'moonshot-cn' || provider === 'moonshot-ai') {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'x-stainless-lang': 'js',
          'x-stainless-package-version': '6.26.0',
          'x-stainless-os': 'Unknown',
          'x-stainless-arch': 'unknown',
          'x-stainless-runtime': 'browser:chrome',
          'x-stainless-runtime-version': '147.0.0',
          'x-stainless-retry-count': '0',
        },
        body: JSON.stringify({
          model: 'kimi-k2.6',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
          stream: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        return { valid: false, error: data?.error?.message || `HTTP ${res.status}`, kind: 'http' }
      }
      // Drain the stream so the connection is closed cleanly.
      try {
        await res.body?.cancel()
      } catch {
        // ignore
      }
      return { valid: true }
    }

    // OpenAI-compatible providers: a cheap idempotent GET that only requires a valid key.
    const res = await fetch(`${base}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return { valid: false, error: data?.error?.message || `HTTP ${res.status}`, kind: 'http' }
    }
    return { valid: true }
  } catch (e) {
    // fetch throws on CORS / DNS / offline / mixed-content. Most commonly
    // this means the gateway didn't return Access-Control-Allow-Origin for
    // this origin, which is indistinguishable from a network error at the
    // browser layer.
    const msg = e instanceof Error ? e.message : String(e)
    return {
      valid: false,
      error: translate('configLib.validateKey.networkCorsError', { message: msg }),
      kind: 'network',
    }
  }
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function stripTrailingApiVersion(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(TRAILING_API_VERSION, '')
}

// The trailing # keeps custom gateway paths exact after resolveBaseUrl().
export function getProxyBaseUrl(provider: Provider, customBaseUrl?: string): string {
  const trimmed = customBaseUrl?.trim() ?? ''
  const preserveExactBase = trimmed.endsWith('#')
  const targetBase = preserveExactBase
    ? trimmed.slice(0, -1).replace(/\/+$/, '')
    : provider === 'doubao'
      ? trimmed
        ? resolveDoubaoBaseUrl(trimmed)
        : ''
      : stripTrailingApiVersion(trimmed)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  if (!targetBase) return `${origin}/api/llm/${provider}`
  return `${origin}/api/llm/${encodeBase64Url(targetBase)}${preserveExactBase ? '#' : ''}`
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
