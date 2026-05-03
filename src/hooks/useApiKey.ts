import { useCallback, useMemo, useState } from 'react'

import type { Provider } from '../config/models'
import { getProviderConfig } from '../config/providers'
import { translate } from '../i18n'
import { getStorageItem, removeStorageItem, setStorageItem } from '../lib/storage'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

// Migrate the legacy single-key slot (pre multi-provider) into the google bucket.
function readStoredKey(provider: Provider): string {
  const config = getProviderConfig(provider)
  const current = getStorageItem('localStorage', config.apiKeyStorageKey)
  if (current) return current
  if (provider === 'google') {
    const legacy = getStorageItem('localStorage', 'nano-banana-api-key')
    if (legacy) {
      const migrated = setStorageItem('localStorage', config.apiKeyStorageKey, legacy)
      if (migrated && getStorageItem('localStorage', config.apiKeyStorageKey) === legacy) {
        removeStorageItem('localStorage', 'nano-banana-api-key')
      }
      return legacy
    }
  }
  return ''
}

function readStoredBaseUrl(provider: Provider): string {
  return getStorageItem('localStorage', getProviderConfig(provider).baseUrlStorageKey) ?? ''
}

export function useApiKey(provider: Provider) {
  const [[initialApiKey, initialStatus]] = useState<[string, ApiKeyStatus]>(() => {
    const key = readStoredKey(provider)
    return [key, key ? 'valid' : 'empty']
  })
  const [apiKey, setApiKeyRaw] = useState(initialApiKey)
  const [baseUrl, setBaseUrlRaw] = useState(() => readStoredBaseUrl(provider))
  const [status, setStatus] = useState<ApiKeyStatus>(initialStatus)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (key: string, nextBaseUrl?: string) => {
      setStatus('validating')
      setError(null)
      const effectiveBaseUrl = nextBaseUrl !== undefined ? nextBaseUrl.trim() : baseUrl
      const result = await validateApiKey(provider, key, effectiveBaseUrl)
      if (result.valid) {
        setApiKeyRaw(key)
        setStorageItem('localStorage', getProviderConfig(provider).apiKeyStorageKey, key)
        if (nextBaseUrl !== undefined) {
          setBaseUrlRaw(effectiveBaseUrl)
          const config = getProviderConfig(provider)
          if (effectiveBaseUrl) setStorageItem('localStorage', config.baseUrlStorageKey, effectiveBaseUrl)
          else removeStorageItem('localStorage', config.baseUrlStorageKey)
        }
        setStatus('valid')
      } else {
        setError(result.error ?? translate('configLib.useApiKey.validationFailed'))
        setStatus('invalid')
      }
    },
    [baseUrl, provider],
  )

  const reset = useCallback(() => {
    setApiKeyRaw('')
    removeStorageItem('localStorage', getProviderConfig(provider).apiKeyStorageKey)
    setError(null)
    setStatus('empty')
  }, [provider])

  const keepCurrent = useCallback(() => {
    if (!apiKey) return
    setError(null)
    setStatus('valid')
  }, [apiKey])

  const setBaseUrl = useCallback(
    (next: string) => {
      const trimmed = next.trim()
      setBaseUrlRaw(trimmed)
      const config = getProviderConfig(provider)
      if (trimmed) setStorageItem('localStorage', config.baseUrlStorageKey, trimmed)
      else removeStorageItem('localStorage', config.baseUrlStorageKey)
    },
    [provider],
  )

  const invalidate = useCallback(() => {
    setStatus('invalid')
  }, [])

  return useMemo(
    () => ({ apiKey, baseUrl, status, error, submit, reset, keepCurrent, setBaseUrl, invalidate }),
    [apiKey, baseUrl, error, invalidate, keepCurrent, reset, setBaseUrl, status, submit],
  )
}
