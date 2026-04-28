import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon'
import type { Provider } from '../config/models'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { DEFAULT_BASE_URL, previewEndpoint } from '../lib/validateKey'

export type KeyHook = {
  apiKey: string
  baseUrl: string
  status: ApiKeyStatus
  error: string | null
  submit: (key: string, baseUrl?: string) => void
  reset: () => void
  keepCurrent: () => void
  setBaseUrl: (baseUrl: string) => void
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
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
        className="relative w-full max-w-md rounded-[10px] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
          <h2 className="font-display text-[13.5px] font-semibold tracking-[-0.01em]">API Keys</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="关闭">
            <Icon name="close" size={13} />
          </button>
        </div>
        <div className="px-5 py-4">
          <ApiKeysSettings googleKey={googleKey} openaiKey={openaiKey} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

type ApiKeysSettingsVariant = 'dialog' | 'embedded'

export function ApiKeysSettings({
  googleKey,
  openaiKey,
  variant = 'dialog',
}: {
  googleKey: KeyHook
  openaiKey: KeyHook
  variant?: ApiKeysSettingsVariant
}) {
  return (
    <div className="space-y-4">
      <KeyRow provider="google" hook={googleKey} variant={variant} />
      <KeyRow provider="openai" hook={openaiKey} variant={variant} />
      <p className="text-[11.5px] leading-relaxed text-(--color-text-3)">
        密钥与 Base URL 仅保存在当前浏览器的 localStorage，不会上传任何服务器。
      </p>
    </div>
  )
}

function KeyRow({ provider, hook, variant }: { provider: Provider; hook: KeyHook; variant: ApiKeysSettingsVariant }) {
  const { label, placeholder, hint } = LABELS[provider]
  const { apiKey, baseUrl, status, error, submit, reset, keepCurrent } = hook
  const [draft, setDraft] = useState('')
  const [baseUrlDraft, setBaseUrlDraft] = useState(baseUrl)
  const [baseUrlSyncKey, setBaseUrlSyncKey] = useState(baseUrl)
  if (baseUrl !== baseUrlSyncKey) {
    setBaseUrlSyncKey(baseUrl)
    setBaseUrlDraft(baseUrl)
  }
  const [justValidated, setJustValidated] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const prevStatusRef = useRef(status)
  const suppressValidFlashRef = useRef(false)

  // Detect the valid transition to briefly flash a "验证成功" state on the primary button.
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'valid' && status === 'valid') {
      setDraft('')
      setIsEditing(false)
      if (suppressValidFlashRef.current) {
        suppressValidFlashRef.current = false
        setJustValidated(false)
        return
      }
      setJustValidated(true)
      const t = setTimeout(() => setJustValidated(false), 1000)
      return () => clearTimeout(t)
    }
  }, [status])

  const handleSubmit = () => {
    const key = draft.trim() || apiKey
    if (!key) return
    submit(key, baseUrlDraft.trim())
  }

  const handleEdit = () => {
    setDraft('')
    setBaseUrlDraft(baseUrl)
    setJustValidated(false)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setDraft('')
    setBaseUrlDraft(baseUrl)
    setIsEditing(false)
    setJustValidated(false)
    suppressValidFlashRef.current = true
    keepCurrent()
  }

  const handleReset = () => {
    reset()
    setDraft('')
    setIsEditing(false)
    setJustValidated(false)
  }

  const masked = apiKey ? `${apiKey.slice(0, 6)}******${apiKey.slice(-4)}` : ''
  const baseUrlPlaceholder = DEFAULT_BASE_URL[provider]

  const header = (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-[12.5px] font-medium text-(--color-text)">{label}</label>
      <span className="text-[11px] text-(--color-text-4)">{hint}</span>
    </div>
  )

  if (status === 'valid' && !isEditing) {
    if (variant === 'embedded') {
      return (
        <div>
          {header}
          <div className="rounded-[8px] bg-(--color-surface-2) px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
            <div className="flex min-w-0 items-center gap-2">
              <Icon name="check_circle" size={13} className="shrink-0 text-(--color-success)" strokeWidth={1.9} />
              <span className="mono min-w-0 flex-1 truncate text-[12px] text-(--color-text-2)">{masked}</span>
              {justValidated ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-(--color-success)">
                  <Icon name="check_circle" size={12} strokeWidth={2.1} />
                  验证成功
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="shrink-0 bg-transparent p-0 text-[12px] font-medium text-(--color-text-3) transition-colors hover:text-(--color-text)"
                >
                  修改
                </button>
              )}
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11.5px] text-(--color-text-3)">
              <span className="shrink-0 text-(--color-text-4)">Base URL</span>
              <span className="mono min-w-0 flex-1 truncate">
                {baseUrl || baseUrlPlaceholder}
                {!baseUrl && <span className="ml-1 text-(--color-text-4)">（默认）</span>}
              </span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div>
        {header}
        <div className="card px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" size={13} className="text-(--color-success)" strokeWidth={1.9} />
            <span className="mono min-w-0 flex-1 truncate text-[12px] text-(--color-text-2)">{masked}</span>
          </div>

          <div className="h-px bg-(--color-border)" />

          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-(--color-text-4)">Base URL</span>
            <span className="mono min-w-0 flex-1 truncate text-[11.5px] text-(--color-text-3)">
              {baseUrl || baseUrlPlaceholder}
              {!baseUrl && <span className="ml-1 text-(--color-text-4)">（默认）</span>}
            </span>
          </div>

          {justValidated ? (
            <button
              type="button"
              disabled
              className="cta w-full"
              style={{
                background: 'var(--color-success)',
                color: '#fff',
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-success) 55%, #000 10%)',
              }}
            >
              <Icon name="check_circle" size={13} strokeWidth={2.1} />
              <span>验证成功</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="w-full rounded-md bg-(--color-surface) text-[12.5px] font-medium text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge)] hover:bg-(--color-surface-2) hover:text-(--color-text) hover:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] transition-colors"
              style={{ height: 32 }}
            >
              修改
            </button>
          )}
        </div>
      </div>
    )
  }

  // empty / invalid / validating / editing: full form with explicit save and clear actions.
  const isValidating = status === 'validating'
  const hasExistingKey = apiKey.trim() !== ''
  const hasDraftKey = draft.trim() !== ''
  const hasBaseUrlDraft = baseUrlDraft.trim() !== ''
  const hasBaseUrlChange = baseUrlDraft.trim() !== baseUrl
  const canSubmit = !isValidating && (hasDraftKey || (hasExistingKey && hasBaseUrlChange))
  return (
    <div>
      {header}

      <div
        className={`${variant === 'embedded' ? 'rounded-[8px] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]' : 'card'} px-3 py-3 space-y-2.5`}
      >
        {status === 'invalid' && (
          <div className="text-[11.5px] leading-relaxed text-(--color-danger) break-words">
            {error ?? '密钥无效或已过期，请重新输入。'}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11.5px] font-medium text-(--color-text-2)">API Key</label>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder={hasExistingKey ? '粘贴新密钥；留空则继续使用当前密钥' : placeholder}
            disabled={isValidating}
            className="w-full rounded-[6px] bg-(--color-surface) px-2.5 py-1.5 text-[12.5px]
                       shadow-[inset_0_0_0_1px_var(--ring-edge)]
                       focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]
                       transition-[box-shadow,background]
                       placeholder:text-(--color-text-4)
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-[11.5px] font-medium text-(--color-text-2)">Base URL</label>
            <span className="text-[10.5px] text-(--color-text-4)">可选，留空使用原生 API</span>
          </div>
          <input
            type="url"
            value={baseUrlDraft}
            onChange={(e) => setBaseUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder={baseUrlPlaceholder}
            spellCheck={false}
            autoComplete="off"
            disabled={isValidating}
            className="mono w-full rounded-[6px] bg-(--color-surface) px-2.5 py-1.5 text-[11.5px]
                       shadow-[inset_0_0_0_1px_var(--ring-edge)]
                       focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]
                       transition-[box-shadow,background]
                       placeholder:text-(--color-text-4)
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <div
            className="mt-1 flex items-start gap-1 text-[10.5px] leading-[1.5] text-(--color-text-4)"
            aria-hidden={!hasBaseUrlDraft}
            style={{ visibility: hasBaseUrlDraft ? 'visible' : 'hidden' }}
          >
            <span className="shrink-0">实际调用</span>
            <span className="mono min-w-0 flex-1 break-all text-(--color-text-3)">
              {previewEndpoint(provider, baseUrlDraft)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="cta w-full"
          style={{
            ...(isValidating && {
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
              opacity: 0.9,
            }),
          }}
        >
          {isValidating ? (
            <>
              <span
                className="spinner"
                style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: 'currentColor' }}
              />
              <span>验证中…</span>
            </>
          ) : (
            `保存并验证 ${label}`
          )}
        </button>

        {hasExistingKey && !isValidating && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="chip danger"
              style={{ height: 28, padding: '0 9px', fontSize: 11.5 }}
            >
              移除密钥
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleCancelEdit}
              className="chip ghost"
              style={{ height: 28, padding: '0 9px', fontSize: 11.5 }}
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
