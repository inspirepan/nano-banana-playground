import { useState } from 'react'
import type { ApiKeyStatus } from '../hooks/useApiKey'

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
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-3">API Key</label>
        {status === 'invalid' && (
          <div className="text-xs text-error mb-2">密钥无效或已过期，请重新输入。</div>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="粘贴你的 Gemini API Key"
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface-container rounded-xl
                       border border-outline-variant
                       hover:border-outline
                       focus:border-primary focus:outline-none
                       transition-colors
                       placeholder:text-on-surface-variant/50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-on-primary
                       hover:bg-primary-hover transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            设置
          </button>
        </div>
        {error && <div className="text-xs text-error mt-2">{error}</div>}
      </div>
    )
  }

  // Validating
  if (status === 'validating') {
    return (
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-3">API Key</label>
        <div className="flex items-center gap-2 px-3 h-[38px] text-sm bg-surface-container rounded-xl">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
          <span className="text-on-surface-variant">验证中...</span>
        </div>
      </div>
    )
  }

  // Valid: show success state with masked key
  const masked = apiKey.slice(0, 4) + '...' + apiKey.slice(-4)
  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-3">API Key</label>
      <div className="flex items-center gap-2 px-3 h-[38px] text-sm bg-surface-container rounded-xl">
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
