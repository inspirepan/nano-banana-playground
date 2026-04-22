import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Provider } from '../config/models'
import type { ApiKeyStatus } from '../hooks/useApiKey'

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
    hint: '用于 Nano Banana 系列模型',
  },
  openai: {
    label: 'OpenAI API Key',
    placeholder: '粘贴你的 OpenAI API Key',
    hint: '用于 GPT Image 系列模型',
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
      <div className="absolute inset-0 bg-white/72 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="API Keys"
        className="relative w-full max-w-md rounded-[28px] border border-outline-variant bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-medium text-on-surface">API Keys</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12 transition-colors"
            aria-label="关闭"
          >
            <span className="material-symbols-rounded text-xl leading-none">close</span>
          </button>
        </div>
        <div className="px-6 pb-6 space-y-5">
          <KeyRow provider="google" hook={googleKey} />
          <KeyRow provider="openai" hook={openaiKey} />
          <p className="text-sm leading-relaxed text-on-surface-variant/70">
            密钥仅保存在当前浏览器的 localStorage 中，不会上传到任何服务器。
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

  const masked = apiKey ? `${apiKey.slice(0, 6)}••••${apiKey.slice(-4)}` : ''

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-base font-medium text-on-surface">{label}</label>
        <span className="text-sm text-on-surface-variant/60">{hint}</span>
      </div>

      {status === 'valid' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container">
          <span className="material-symbols-rounded text-base text-success leading-none">check_circle</span>
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-on-surface-variant">{masked}</span>
          <button
            type="button"
            onClick={reset}
            className="text-sm text-on-surface-variant/70 transition-colors hover:text-on-surface"
          >
            重置
          </button>
        </div>
      )}

      {status === 'validating' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
          <span className="text-sm text-on-surface-variant">验证中...</span>
        </div>
      )}

      {(status === 'empty' || status === 'invalid') && (
        <>
          {status === 'invalid' && (
            <div className="mb-2 text-sm text-error">密钥无效或已过期，请重新输入。</div>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              placeholder={placeholder}
              className="flex-1 min-w-0 rounded-xl bg-surface-container px-3 py-2.5 text-base
                         border border-transparent focus:border-primary focus:outline-none
                         transition-all
                         placeholder:text-base placeholder:text-on-surface-variant/40"
            />
            {draft.trim() && (
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-xl bg-primary px-3 py-2 text-base font-medium text-on-primary
                           hover:bg-primary-hover active:bg-primary/80 transition-colors shrink-0"
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
