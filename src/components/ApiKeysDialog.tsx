import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Provider } from '../config/models'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { Icon } from './Icon'

type KeyHook = {
  apiKey: string
  status: ApiKeyStatus
  submit: (key: string) => void
  reset: () => void
}

type Props = {
  open: boolean
  googleKey: KeyHook
  openaiKey: KeyHook
  onClose: () => void
}

const LABELS: Record<Provider, { label: string; placeholder: string; hint: string }> = {
  google: {
    label: 'Gemini API Key',
    placeholder: '粘贴你的 Gemini API Key',
    hint: '用于 Nano Banana 系列',
  },
  openai: {
    label: 'OpenAI API Key',
    placeholder: '粘贴你的 OpenAI API Key',
    hint: '用于 GPT Image 系列',
  },
}

export function ApiKeysDialog({ open, googleKey, openaiKey, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="API Keys"
        className="relative w-full max-w-md rounded-[10px] border border-(--color-border) bg-(--color-surface) shadow-[0_10px_28px_-12px_rgba(30,27,20,0.18),0_2px_6px_rgba(30,27,20,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-(--color-border)">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">API Keys</h2>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="关闭"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <KeyRow provider="google" hook={googleKey} />
          <KeyRow provider="openai" hook={openaiKey} />
          <p className="text-[11.5px] leading-relaxed text-(--color-text-3)">
            密钥仅保存在当前浏览器的 localStorage，不会上传任何服务器。
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function KeyRow({ provider, hook }: { provider: Provider; hook: KeyHook }) {
  const { label, placeholder, hint } = LABELS[provider]
  const { apiKey, status, submit, reset } = hook
  const [draft, setDraft] = useState('')

  const handleSubmit = () => {
    const key = draft.trim()
    if (!key) return
    submit(key)
    setDraft('')
  }

  const masked = apiKey ? `${apiKey.slice(0, 6)}******${apiKey.slice(-4)}` : ''

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[12.5px] font-medium text-(--color-text)">{label}</label>
        <span className="text-[11px] text-(--color-text-4)">{hint}</span>
      </div>

      {status === 'valid' && (
        <div className="card flex items-center gap-2 px-3 py-2">
          <Icon name="check_circle" size={13} className="text-(--color-success)" strokeWidth={1.9} />
          <span className="mono min-w-0 flex-1 truncate text-[12px] text-(--color-text-2)">{masked}</span>
          <button
            type="button"
            onClick={reset}
            className="text-[11.5px] text-(--color-text-3) hover:text-(--color-text) transition-colors"
          >
            重置
          </button>
        </div>
      )}

      {status === 'validating' && (
        <div className="card flex items-center gap-2 px-3 py-2">
          <span className="spinner" />
          <span className="text-[12px] text-(--color-text-2)">验证中…</span>
        </div>
      )}

      {(status === 'empty' || status === 'invalid') && (
        <>
          {status === 'invalid' && (
            <div className="mb-1.5 text-[11.5px] text-(--color-danger)">密钥无效或已过期，请重新输入。</div>
          )}
          <div className="flex gap-1.5">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              placeholder={placeholder}
              className="flex-1 min-w-0 rounded-[6px] border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px]
                         focus:border-(--color-accent) focus:shadow-[0_0_0_3px_var(--color-accent-wash)]
                         transition-all
                         placeholder:text-(--color-text-4)"
            />
            {draft.trim() && (
              <button
                type="button"
                onClick={handleSubmit}
                className="cta shrink-0"
                style={{ height: 30, padding: '0 12px' }}
              >
                设置
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
