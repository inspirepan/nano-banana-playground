import { useState } from 'react'
import { validateApiKey } from '../lib/validateKey'

export type ApiKeyStatus = 'empty' | 'validating' | 'valid' | 'invalid'

type Props = {
  apiKey: string
  status: ApiKeyStatus
  onSubmit: (key: string) => void
  onReset: () => void
}

export function ApiKeyInput({ apiKey, status, onSubmit, onReset }: Props) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const key = draft.trim()
    if (!key) return
    setError(null)
    onSubmit(key)
  }

  // Input mode: no key set or invalid
  if (status === 'empty' || status === 'invalid') {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-on-surface-variant">API Key</label>
        {status === 'invalid' && (
          <div className="text-xs text-error">密钥无效或已过期，请重新输入。</div>
        )}
        <div className="flex gap-1.5">
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="粘贴你的 Gemini API Key"
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface-container rounded-lg border border-outline-variant
                       focus:border-primary focus:outline-none
                       placeholder:text-on-surface-variant/50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary
                       hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                       shrink-0"
          >
            设置
          </button>
        </div>
        {error && <div className="text-xs text-error">{error}</div>}
      </div>
    )
  }

  // Validating
  if (status === 'validating') {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-on-surface-variant">API Key</label>
        <div className="flex items-center gap-2 px-3 h-[38px] text-sm bg-surface-container rounded-lg border border-outline-variant">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
          <span className="text-on-surface-variant">验证中...</span>
        </div>
      </div>
    )
  }

  // Valid: show success state with masked key
  const masked = apiKey.slice(0, 4) + '...' + apiKey.slice(-4)
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-on-surface-variant">API Key</label>
      <div className="flex items-center gap-2 px-3 h-[38px] text-sm bg-surface-container rounded-lg border border-outline-variant">
        <svg className="w-4 h-4 text-[#34a853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-on-surface-variant font-mono text-xs flex-1 truncate">{masked}</span>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
        >
          重置
        </button>
      </div>
    </div>
  )
}

// Hook to manage API key validation lifecycle
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
