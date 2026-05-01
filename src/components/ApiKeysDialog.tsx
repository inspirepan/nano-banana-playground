import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon'
import type { Provider } from '../config/models'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { useI18n } from '../i18n'
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

const LABELS: Record<Provider, { labelKey: string; placeholderKey: string; hintKey: string }> = {
  google: {
    labelKey: 'apiKeys.provider.google.label',
    placeholderKey: 'apiKeys.provider.google.placeholder',
    hintKey: 'apiKeys.provider.google.hint',
  },
  openai: {
    labelKey: 'apiKeys.provider.openai.label',
    placeholderKey: 'apiKeys.provider.openai.placeholder',
    hintKey: 'apiKeys.provider.openai.hint',
  },
}

export function ApiKeysDialog({ open, googleKey, openaiKey, onClose }: Props) {
  const { t } = useI18n()

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') onClose()
    },
    undefined,
    open,
  )

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('apiKeys.title')}
        className="relative w-full max-w-md rounded-[var(--radius-lg)] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{t('apiKeys.title')}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label={t('common.close')}>
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
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
        <KeyRow provider="google" hook={googleKey} variant={variant} />
        <KeyRow provider="openai" hook={openaiKey} variant={variant} last />
      </div>
      <p className="text-sm leading-relaxed text-(--color-text-3)">{t('apiKeys.storageNote')}</p>
    </div>
  )
}

function KeyRow({
  provider,
  hook,
  variant,
  last = false,
}: {
  provider: Provider
  hook: KeyHook
  variant: ApiKeysSettingsVariant
  last?: boolean
}) {
  const { t } = useI18n()
  const id = useId()
  const { labelKey, placeholderKey, hintKey } = LABELS[provider]
  const label = t(labelKey)
  const placeholder = t(placeholderKey)
  const hint = t(hintKey)
  const apiKeyInputId = `${id}-api-key`
  const baseUrlInputId = `${id}-base-url`
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

  // Detect the valid transition to briefly flash a success state on the primary button.
  useExternalSync(() => {
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

  const rowClass = `${variant === 'embedded' ? 'px-3 py-3' : 'px-3.5 py-3.5'} ${
    last ? '' : 'shadow-[inset_0_-1px_0_var(--ring-edge-soft)]'
  }`
  const header = (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <label className="text-base font-medium text-(--color-text)">{label}</label>
      <span className="shrink-0 text-sm text-(--color-text-4)">{hint}</span>
    </div>
  )

  if (status === 'valid' && !isEditing) {
    return (
      <div className={rowClass}>
        {header}
        <div className="mt-2 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <Icon name="check_circle" size={13} className="shrink-0 text-(--color-success)" strokeWidth={1.9} />
              <span className="mono min-w-0 flex-1 truncate text-base text-(--color-text-2)">{masked}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm text-(--color-text-3)">
              <span className="shrink-0 text-(--color-text-4)">{t('apiKeys.baseUrl.label')}</span>
              <span className="mono min-w-0 flex-1 truncate">
                {baseUrl || baseUrlPlaceholder}
                {!baseUrl && <span className="ml-1 text-(--color-text-4)">{t('apiKeys.baseUrl.defaultSuffix')}</span>}
              </span>
            </div>
          </div>
          {justValidated ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-base font-medium text-(--color-success)">
              <Icon name="check_circle" size={13} strokeWidth={2.1} />
              {t('apiKeys.status.validated')}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="action-soft -mr-1 shrink-0 text-base"
              aria-label={t('apiKeys.action.editProvider', { label })}
            >
              {t('apiKeys.action.edit')}
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
    <div className={rowClass}>
      {header}
      <div className="mt-3 space-y-2.5">
        {status === 'invalid' && (
          <div className="text-sm leading-relaxed text-(--color-danger) break-words">
            {error ?? t('apiKeys.error.invalidOrExpired')}
          </div>
        )}

        <div>
          <label className="mb-1 block text-base font-medium text-(--color-text-2)" htmlFor={apiKeyInputId}>
            {t('apiKeys.apiKey.label')}
          </label>
          <input
            id={apiKeyInputId}
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder={hasExistingKey ? t('apiKeys.apiKey.placeholder.replaceExisting') : placeholder}
            aria-label={t('apiKeys.apiKey.ariaLabel', { label })}
            disabled={isValidating}
            className="w-full rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 py-1.5 text-base
                       shadow-[inset_0_0_0_1px_var(--ring-edge)]
                       focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]
                       transition-[box-shadow,background]
                       placeholder:text-(--color-text-4)
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-base font-medium text-(--color-text-2)" htmlFor={baseUrlInputId}>
              {t('apiKeys.baseUrl.label')}
            </label>
            <span className="text-sm text-(--color-text-4)">{t('apiKeys.baseUrl.hint')}</span>
          </div>
          <input
            id={baseUrlInputId}
            type="url"
            value={baseUrlDraft}
            onChange={(e) => setBaseUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder={baseUrlPlaceholder}
            aria-label={t('apiKeys.baseUrl.ariaLabel', { label })}
            spellCheck={false}
            autoComplete="off"
            disabled={isValidating}
            className="mono w-full rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 py-1.5 text-base
                       shadow-[inset_0_0_0_1px_var(--ring-edge)]
                       focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]
                       transition-[box-shadow,background]
                       placeholder:text-(--color-text-4)
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {hasBaseUrlDraft && (
            <div className="mt-1 flex items-start gap-1 text-sm leading-[1.5] text-(--color-text-4)">
              <span className="shrink-0">{t('apiKeys.baseUrl.previewLabel')}</span>
              <span className="mono min-w-0 flex-1 break-all text-(--color-text-3)">
                {previewEndpoint(provider, baseUrlDraft)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            {hasExistingKey && !isValidating && (
              <button
                type="button"
                onClick={handleReset}
                aria-label={t('apiKeys.action.removeProviderKey', { label })}
                className="chip danger text-sm"
                style={{ height: 28, padding: '0 9px' }}
              >
                {t('apiKeys.action.removeKey')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasExistingKey && !isValidating && (
              <button
                type="button"
                onClick={handleCancelEdit}
                aria-label={t('apiKeys.action.cancelEditingProvider', { label })}
                className="chip ghost text-sm"
                style={{ height: 28, padding: '0 9px' }}
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              aria-label={t('apiKeys.action.saveAndValidate', { label })}
              disabled={!canSubmit}
              className="chip accent-active"
              style={{
                height: 30,
                padding: '0 11px',
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
                  <span>{t('apiKeys.status.validating')}</span>
                </>
              ) : (
                t('apiKeys.action.saveAndValidate', { label })
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
