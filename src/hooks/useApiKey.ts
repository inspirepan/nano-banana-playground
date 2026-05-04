import { useCallback, useMemo, useState } from 'react'

import type { Provider } from '../config/models'
import { translate } from '../i18n'
import {
  clearProviderApiKey,
  readProviderApiKey,
  readProviderBaseUrl,
  readProviderUseProxy,
  saveProviderBaseUrl,
  writeProviderApiKey,
  writeProviderBaseUrl,
  writeProviderUseProxy,
} from '../lib/credentialStore'
import { getProxyBaseUrl, validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

export function useApiKey(provider: Provider) {
  const [[initialApiKey, initialStatus]] = useState<[string, ApiKeyStatus]>(() => {
    const key = readProviderApiKey(provider)
    return [key, key ? 'valid' : 'empty']
  })
  const [apiKey, setApiKeyRaw] = useState(initialApiKey)
  const [customBaseUrl, setCustomBaseUrlRaw] = useState(() => readProviderBaseUrl(provider))
  const [useProxy, setUseProxyRaw] = useState(() => readProviderUseProxy(provider))
  const [status, setStatus] = useState<ApiKeyStatus>(initialStatus)
  const [error, setError] = useState<string | null>(null)

  // Effective base URL used by API calls: proxy path when proxy is on, custom URL otherwise.
  const baseUrl = useProxy ? getProxyBaseUrl(provider, customBaseUrl) : customBaseUrl

  const submit = useCallback(
    async (key: string, nextCustomBaseUrl?: string, nextUseProxy?: boolean) => {
      setStatus('validating')
      setError(null)
      const effectiveCustomUrl = nextCustomBaseUrl !== undefined ? nextCustomBaseUrl.trim() : customBaseUrl
      const effectiveUseProxy = nextUseProxy ?? useProxy
      const effectiveBaseUrl = effectiveUseProxy ? getProxyBaseUrl(provider, effectiveCustomUrl) : effectiveCustomUrl
      const result = await validateApiKey(provider, key, effectiveBaseUrl)
      if (result.valid) {
        setApiKeyRaw(key)
        writeProviderApiKey(provider, key)
        if (nextCustomBaseUrl !== undefined) {
          setCustomBaseUrlRaw(effectiveCustomUrl)
          saveProviderBaseUrl(provider, effectiveCustomUrl)
        }
        if (nextUseProxy !== undefined) {
          setUseProxyRaw(effectiveUseProxy)
          writeProviderUseProxy(provider, effectiveUseProxy)
        }
        setStatus('valid')
      } else {
        setError(result.error ?? translate('configLib.useApiKey.validationFailed'))
        setStatus('invalid')
      }
    },
    [customBaseUrl, provider, useProxy],
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
      setCustomBaseUrlRaw(trimmed)
      saveProviderBaseUrl(provider, trimmed)
    },
    [provider],
  )

  const invalidate = useCallback(() => {
    setStatus('invalid')
  }, [])

  const importCredentials = useCallback(
    (
      nextApiKey: string | null | undefined,
      nextCustomBaseUrl: string | null | undefined,
      nextUseProxy: boolean | null,
    ) => {
      if (nextApiKey !== undefined && nextApiKey !== null) {
        const trimmedKey = nextApiKey.trim()
        setApiKeyRaw(trimmedKey)
        if (trimmedKey) {
          writeProviderApiKey(provider, trimmedKey)
          setStatus('valid')
        } else {
          clearProviderApiKey(provider)
          setStatus('empty')
        }
      }

      if (nextCustomBaseUrl !== undefined && nextCustomBaseUrl !== null) {
        const trimmedBaseUrl = nextCustomBaseUrl.trim()
        setCustomBaseUrlRaw(trimmedBaseUrl)
        writeProviderBaseUrl(provider, trimmedBaseUrl)
      }

      if (nextUseProxy !== null) {
        setUseProxyRaw(nextUseProxy)
        writeProviderUseProxy(provider, nextUseProxy)
      }
      setError(null)
    },
    [provider],
  )

  return useMemo(
    () => ({
      apiKey,
      baseUrl,
      customBaseUrl,
      useProxy,
      status,
      error,
      submit,
      reset,
      keepCurrent,
      setBaseUrl,
      invalidate,
      importCredentials,
    }),
    [
      apiKey,
      baseUrl,
      customBaseUrl,
      useProxy,
      error,
      importCredentials,
      invalidate,
      keepCurrent,
      reset,
      setBaseUrl,
      status,
      submit,
    ],
  )
}
