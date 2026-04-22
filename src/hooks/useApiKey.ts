import { useState } from 'react'
import type { Provider } from '../config/models'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

const STORAGE_KEY: Record<Provider, string> = {
  google: 'nbp-api-key:google',
  openai: 'nbp-api-key:openai',
}

// Migrate the legacy single-key slot (pre multi-provider) into the google bucket.
function readStoredKey(provider: Provider): string {
  const current = localStorage.getItem(STORAGE_KEY[provider])
  if (current) return current
  if (provider === 'google') {
    const legacy = localStorage.getItem('nano-banana-api-key')
    if (legacy) {
      localStorage.setItem(STORAGE_KEY.google, legacy)
      localStorage.removeItem('nano-banana-api-key')
      return legacy
    }
  }
  return ''
}

export function useApiKey(provider: Provider) {
  const stored = readStoredKey(provider)
  const [apiKey, setApiKeyRaw] = useState(stored)
  const [status, setStatus] = useState<ApiKeyStatus>(stored ? 'valid' : 'empty')

  const submit = async (key: string) => {
    setStatus('validating')
    const result = await validateApiKey(provider, key)
    if (result.valid) {
      setApiKeyRaw(key)
      localStorage.setItem(STORAGE_KEY[provider], key)
      setStatus('valid')
    } else {
      setStatus('invalid')
    }
  }

  const reset = () => {
    setApiKeyRaw('')
    localStorage.removeItem(STORAGE_KEY[provider])
    setStatus('empty')
  }

  const invalidate = () => {
    setStatus('invalid')
  }

  return { apiKey, status, submit, reset, invalidate }
}
