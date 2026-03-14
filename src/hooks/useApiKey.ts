import { useState } from 'react'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

export function useApiKey() {
  const stored = localStorage.getItem('nano-banana-api-key') || ''
  const [apiKey, setApiKeyRaw] = useState(stored)
  const [status, setStatus] = useState<ApiKeyStatus>(stored ? 'valid' : 'empty')

  const submit = async (key: string) => {
    setStatus('validating')
    const result = await validateApiKey(key)
    if (result.valid) {
      setApiKeyRaw(key)
      localStorage.setItem('nano-banana-api-key', key)
      setStatus('valid')
    } else {
      setStatus('invalid')
    }
  }

  const reset = () => {
    setApiKeyRaw('')
    localStorage.removeItem('nano-banana-api-key')
    setStatus('empty')
  }

  const invalidate = () => {
    setStatus('invalid')
  }

  return { apiKey, status, submit, reset, invalidate }
}
