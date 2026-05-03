import { useCallback, useMemo, useState } from 'react'

import type { Provider } from '../config/models'
import { translate } from '../i18n'
import {
  clearProviderApiKey,
  readProviderApiKey,
  readProviderBaseUrl,
  saveProviderBaseUrl,
  writeProviderApiKey,
} from '../lib/credentialStore'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

export function useApiKey(provider: Provider) {
  const [[initialApiKey, initialStatus]] = useState<[string, ApiKeyStatus]>(() => {
    const key = readProviderApiKey(provider)
    return [key, key ? 'valid' : 'empty']
  })
  const [apiKey, setApiKeyRaw] = useState(initialApiKey)
  const [baseUrl, setBaseUrlRaw] = useState(() => readProviderBaseUrl(provider))
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
        writeProviderApiKey(provider, key)
        if (nextBaseUrl !== undefined) {
          setBaseUrlRaw(effectiveBaseUrl)
          saveProviderBaseUrl(provider, effectiveBaseUrl)
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
    clearProviderApiKey(provider)
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
      saveProviderBaseUrl(provider, trimmed)
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
