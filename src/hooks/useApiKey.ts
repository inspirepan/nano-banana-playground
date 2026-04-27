import { useState } from 'react'

import type { Provider } from '../config/models'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

const KEY_STORAGE: Record<Provider, string> = {
  google: 'nbp-api-key:google',
  openai: 'nbp-api-key:openai',
}

const BASE_URL_STORAGE: Record<Provider, string> = {
  google: 'nbp-base-url:google',
  openai: 'nbp-base-url:openai',
}

// Migrate the legacy single-key slot (pre multi-provider) into the google bucket.
function readStoredKey(provider: Provider): string {
  const current = localStorage.getItem(KEY_STORAGE[provider])
  if (current) return current
  if (provider === 'google') {
    const legacy = localStorage.getItem('nano-banana-api-key')
    if (legacy) {
      localStorage.setItem(KEY_STORAGE.google, legacy)
      localStorage.removeItem('nano-banana-api-key')
      return legacy
    }
  }
  return ''
}

function readStoredBaseUrl(provider: Provider): string {
  return localStorage.getItem(BASE_URL_STORAGE[provider]) ?? ''
}

export function useApiKey(provider: Provider) {
  const stored = readStoredKey(provider)
  const [apiKey, setApiKeyRaw] = useState(stored)
  const [baseUrl, setBaseUrlRaw] = useState(() => readStoredBaseUrl(provider))
  const [status, setStatus] = useState<ApiKeyStatus>(stored ? 'valid' : 'empty')
  const [error, setError] = useState<string | null>(null)

  const submit = async (key: string, nextBaseUrl?: string) => {
    setStatus('validating')
    setError(null)
    const effectiveBaseUrl = nextBaseUrl !== undefined ? nextBaseUrl.trim() : baseUrl
    const result = await validateApiKey(provider, key, effectiveBaseUrl)
    if (result.valid) {
      setApiKeyRaw(key)
      localStorage.setItem(KEY_STORAGE[provider], key)
      if (nextBaseUrl !== undefined) {
        setBaseUrlRaw(effectiveBaseUrl)
        if (effectiveBaseUrl) localStorage.setItem(BASE_URL_STORAGE[provider], effectiveBaseUrl)
        else localStorage.removeItem(BASE_URL_STORAGE[provider])
      }
      setStatus('valid')
    } else {
      setError(result.error ?? '校验失败')
      setStatus('invalid')
    }
  }

  const reset = () => {
    setApiKeyRaw('')
    localStorage.removeItem(KEY_STORAGE[provider])
    setError(null)
    setStatus('empty')
  }

  const keepCurrent = () => {
    if (!apiKey) return
    setError(null)
    setStatus('valid')
  }

  const setBaseUrl = (next: string) => {
    const trimmed = next.trim()
    setBaseUrlRaw(trimmed)
    if (trimmed) localStorage.setItem(BASE_URL_STORAGE[provider], trimmed)
    else localStorage.removeItem(BASE_URL_STORAGE[provider])
  }

  const invalidate = () => {
    setStatus('invalid')
  }

  return { apiKey, baseUrl, status, error, submit, reset, keepCurrent, setBaseUrl, invalidate }
}
