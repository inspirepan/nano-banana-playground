import { useCallback, useMemo, useState } from 'react'

import type { Provider } from '../config/models'
import { getProviderConfig } from '../config/providers'
import { translate } from '../i18n'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

// Migrate the legacy single-key slot (pre multi-provider) into the google bucket.
function readStoredKey(provider: Provider): string {
  const config = getProviderConfig(provider)
  const current = localStorage.getItem(config.apiKeyStorageKey)
  if (current) return current
  if (provider === 'google') {
    const legacy = localStorage.getItem('nano-banana-api-key')
    if (legacy) {
      localStorage.setItem(config.apiKeyStorageKey, legacy)
      localStorage.removeItem('nano-banana-api-key')
      return legacy
    }
  }
  return ''
}

function readStoredBaseUrl(provider: Provider): string {
  return localStorage.getItem(getProviderConfig(provider).baseUrlStorageKey) ?? ''
}

export function useApiKey(provider: Provider) {
  const stored = readStoredKey(provider)
  const [apiKey, setApiKeyRaw] = useState(stored)
  const [baseUrl, setBaseUrlRaw] = useState(() => readStoredBaseUrl(provider))
  const [status, setStatus] = useState<ApiKeyStatus>(stored ? 'valid' : 'empty')
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (key: string, nextBaseUrl?: string) => {
    setStatus('validating')
    setError(null)
    const effectiveBaseUrl = nextBaseUrl !== undefined ? nextBaseUrl.trim() : baseUrl
    const result = await validateApiKey(provider, key, effectiveBaseUrl)
    if (result.valid) {
      setApiKeyRaw(key)
      localStorage.setItem(getProviderConfig(provider).apiKeyStorageKey, key)
      if (nextBaseUrl !== undefined) {
        setBaseUrlRaw(effectiveBaseUrl)
        const config = getProviderConfig(provider)
        if (effectiveBaseUrl) localStorage.setItem(config.baseUrlStorageKey, effectiveBaseUrl)
        else localStorage.removeItem(config.baseUrlStorageKey)
      }
      setStatus('valid')
    } else {
      setError(result.error ?? translate('configLib.useApiKey.validationFailed'))
      setStatus('invalid')
    }
  }, [baseUrl, provider])

  const reset = useCallback(() => {
    setApiKeyRaw('')
    localStorage.removeItem(getProviderConfig(provider).apiKeyStorageKey)
    setError(null)
    setStatus('empty')
  }, [provider])

  const keepCurrent = useCallback(() => {
    if (!apiKey) return
    setError(null)
    setStatus('valid')
  }, [apiKey])

  const setBaseUrl = useCallback((next: string) => {
    const trimmed = next.trim()
    setBaseUrlRaw(trimmed)
    const config = getProviderConfig(provider)
    if (trimmed) localStorage.setItem(config.baseUrlStorageKey, trimmed)
    else localStorage.removeItem(config.baseUrlStorageKey)
  }, [provider])

  const invalidate = useCallback(() => {
    setStatus('invalid')
  }, [])

  return useMemo(
    () => ({ apiKey, baseUrl, status, error, submit, reset, keepCurrent, setBaseUrl, invalidate }),
    [apiKey, baseUrl, error, invalidate, keepCurrent, reset, setBaseUrl, status, submit],
  )
}
