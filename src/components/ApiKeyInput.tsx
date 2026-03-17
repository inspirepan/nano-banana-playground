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

  const maskedApiKey = `${apiKey.slice(0, 6)}••••${apiKey.slice(-4)}`

  // Input mode: no key set or invalid
  if (status === 'empty' || status === 'invalid') {
    return (
      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-3">API Key</label>
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
            className="flex-1 min-w-0 px-3 py-3 text-sm bg-surface-container md:bg-surface-container-high rounded-xl
                       border border-transparent focus:border-primary focus:outline-none
                       transition-all
                       placeholder:text-sm placeholder:text-on-surface-variant/40"
          />
          {draft.trim() && (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-2 text-sm font-medium rounded-xl bg-primary text-on-primary
                         hover:bg-primary-hover active:bg-primary/80 transition-colors shrink-0"
            >
              设置
            </button>
          )}
        </div>
        {error && <div className="text-xs text-error mt-2">{error}</div>}
      </div>
    )
  }

  // Validating
  if (status === 'validating') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-on-surface-variant">API Key</span>
        <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
        <span className="text-xs text-on-surface-variant">验证中...</span>
      </div>
    )
  }

  // Valid: single-line compact
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-on-surface-variant">API Key</span>
      <span className="font-mono text-xs text-on-surface-variant/70">{maskedApiKey}</span>
      <span className="material-symbols-rounded text-base text-success leading-none">check</span>
      <button
        type="button"
        onClick={onReset}
        className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors"
      >
        重置
      </button>
    </div>
  )
}
