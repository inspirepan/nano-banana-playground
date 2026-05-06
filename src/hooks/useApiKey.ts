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
  const [autoProxyEnabled, setAutoProxyEnabled] = useState(false)

  // Effective base URL used by API calls: proxy path when proxy is on, custom URL otherwise.
  const baseUrl = useProxy ? getProxyBaseUrl(provider, customBaseUrl) : customBaseUrl

  const submit = useCallback(
    async (key: string, nextCustomBaseUrl?: string, nextUseProxy?: boolean) => {
      setStatus('validating')
      setError(null)
      setAutoProxyEnabled(false)
      // Strip anything outside printable ASCII so a paste containing
      // zero-width or non-Latin-1 chars doesn't poison Authorization headers
      // (fetch throws "non ISO-8859-1 code point" before any network call).
      const cleanKey = key.replace(/[^\x21-\x7E]/g, '')
      const effectiveCustomUrl = nextCustomBaseUrl !== undefined ? nextCustomBaseUrl.trim() : customBaseUrl
      const initialUseProxy = nextUseProxy ?? useProxy
      const directBaseUrl = initialUseProxy ? getProxyBaseUrl(provider, effectiveCustomUrl) : effectiveCustomUrl
      let result = await validateApiKey(provider, cleanKey, directBaseUrl)

      // Auto-fallback: when the call goes out direct (proxy is off) and fails
      // with a network/CORS error, retry through the site proxy. Some
      // providers (Moonshot, Doubao) don't return the right
      // Access-Control-Allow-Origin headers for browser requests. If the user
      // explicitly enabled proxy already, there's nothing to fall back to.
      let didAutoEnableProxy = false
      let finalUseProxy = initialUseProxy
      if (!result.valid && result.kind === 'network' && !initialUseProxy) {
        const proxyBaseUrl = getProxyBaseUrl(provider, effectiveCustomUrl)
        const proxyResult = await validateApiKey(provider, cleanKey, proxyBaseUrl)
        if (proxyResult.valid) {
          result = proxyResult
          finalUseProxy = true
          didAutoEnableProxy = true
        }
      }

      if (result.valid) {
        setApiKeyRaw(cleanKey)
        writeProviderApiKey(provider, cleanKey)
        if (nextCustomBaseUrl !== undefined) {
          setCustomBaseUrlRaw(effectiveCustomUrl)
          saveProviderBaseUrl(provider, effectiveCustomUrl)
        }
        if (nextUseProxy !== undefined || didAutoEnableProxy) {
          setUseProxyRaw(finalUseProxy)
          writeProviderUseProxy(provider, finalUseProxy)
        }
        setAutoProxyEnabled(didAutoEnableProxy)
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

  const dismissAutoProxyNotice = useCallback(() => setAutoProxyEnabled(false), [])

  return useMemo(
    () => ({
      apiKey,
      baseUrl,
      customBaseUrl,
      useProxy,
      status,
      error,
      autoProxyEnabled,
      submit,
      reset,
      keepCurrent,
      setBaseUrl,
      invalidate,
      importCredentials,
      dismissAutoProxyNotice,
    }),
    [
      apiKey,
      autoProxyEnabled,
      baseUrl,
      customBaseUrl,
      useProxy,
      dismissAutoProxyNotice,
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
