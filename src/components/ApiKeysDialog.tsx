import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { BrandIcon, Icon } from './Icon'
import { Tooltip } from './Tooltip'
import type { Provider } from '../config/models'
import { PROVIDER_CONFIGS, getProviderConfig } from '../config/providers'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { useI18n } from '../i18n'
import { DEFAULT_BASE_URL, previewEndpoint } from '../lib/validateKey'

export type KeyHook = {
  apiKey: string
  baseUrl: string
  customBaseUrl: string
  useProxy: boolean
  status: ApiKeyStatus
  error: string | null
  submit: (key: string, customBaseUrl?: string, useProxy?: boolean) => void
  reset: () => void
  keepCurrent: () => void
  setBaseUrl: (baseUrl: string) => void
}

type Props = {
  open: boolean
  keyHooks: Record<Provider, KeyHook>
  onClose: () => void
}

export function ApiKeysDialog({ open, keyHooks, onClose }: Props) {
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
          <ApiKeysSettings keyHooks={keyHooks} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

type ApiKeysSettingsVariant = 'dialog' | 'embedded'

export function ApiKeysSettings({
  keyHooks,
  variant = 'dialog',
}: {
  keyHooks: Record<Provider, KeyHook>
  variant?: ApiKeysSettingsVariant
}) {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
        {PROVIDER_CONFIGS.map((provider, index) => (
          <KeyRow
            key={provider.id}
            provider={provider.id}
            hook={keyHooks[provider.id]}
            variant={variant}
            last={index === PROVIDER_CONFIGS.length - 1}
          />
        ))}
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
  const providerConfig = getProviderConfig(provider)
  const label = t(providerConfig.keyLabelKey)
  const placeholder = t(providerConfig.keyPlaceholderKey)
  const hint = t(providerConfig.keyHintKey)
  const apiKeyInputId = `${id}-api-key`
  const baseUrlInputId = `${id}-base-url`
  const { apiKey, customBaseUrl, useProxy, status, error, submit, reset, keepCurrent } = hook
  const [draft, setDraft] = useState('')
  const [baseUrlDraft, setBaseUrlDraft] = useState(customBaseUrl)
  const [baseUrlSyncKey, setBaseUrlSyncKey] = useState(customBaseUrl)
  if (customBaseUrl !== baseUrlSyncKey) {
    setBaseUrlSyncKey(customBaseUrl)
    setBaseUrlDraft(customBaseUrl)
  }
  const [justValidated, setJustValidated] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const prevStatusRef = useRef(status)
  const suppressValidFlashRef = useRef(false)
  const [useProxyDraft, setUseProxyDraft] = useState(useProxy)
  const [useProxySyncKey, setUseProxySyncKey] = useState(useProxy)
  if (useProxy !== useProxySyncKey) {
    setUseProxySyncKey(useProxy)
    setUseProxyDraft(useProxy)
  }

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
    submit(key, baseUrlDraft.trim(), useProxyDraft)
  }

  const handleEdit = () => {
    setDraft('')
    setBaseUrlDraft(customBaseUrl)
    setAdvancedOpen(false)
    setJustValidated(false)
    setUseProxyDraft(useProxy)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setDraft('')
    setBaseUrlDraft(customBaseUrl)
    setUseProxyDraft(useProxy)
    setAdvancedOpen(false)
    setIsEditing(false)
    setJustValidated(false)
    suppressValidFlashRef.current = true
    keepCurrent()
  }

  const handleReset = () => {
    reset()
    setDraft('')
    setBaseUrlDraft('')
    setAdvancedOpen(false)
    setIsEditing(false)
    setJustValidated(false)
  }

  const masked = apiKey ? `${apiKey.slice(0, 6)}******${apiKey.slice(-4)}` : ''
  const baseUrlPlaceholder = DEFAULT_BASE_URL[provider]
  const isValidating = status === 'validating'
  const expanded = isEditing || isValidating
  const hasExistingKey = apiKey.trim() !== ''

  const rowClass = `${variant === 'embedded' ? 'px-3 py-2.5' : 'px-3.5 py-3'} ${
    last ? '' : 'shadow-[inset_0_-1px_0_var(--ring-edge-soft)]'
  }`

  if (!expanded) {
    let summary: ReactNode
    if (status === 'valid') {
      summary = (
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Icon name="check_circle" size={12} className="shrink-0 text-(--color-success)" strokeWidth={1.9} />
          <span className="mono min-w-0 truncate text-(--color-text-2)">{masked}</span>
          {useProxy ? (
            <>
              <span className="shrink-0 text-(--color-text-4)">·</span>
              <span className="shrink-0 text-(--color-accent)">{t('apiKeys.proxy.activeSuffix')}</span>
            </>
          ) : customBaseUrl ? (
            <>
              <span className="shrink-0 text-(--color-text-4)">·</span>
              <span className="shrink-0 text-(--color-text-3)">{t('apiKeys.baseUrl.customSuffix')}</span>
            </>
          ) : null}
        </div>
      )
    } else if (status === 'invalid') {
      summary = (
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-(--color-danger)">
          <span className="inline-block size-1.5 shrink-0 rounded-full bg-(--color-danger)" />
          <span className="min-w-0 truncate">{t('apiKeys.status.invalidShort')}</span>
        </div>
      )
    } else {
      summary = <div className="truncate text-sm text-(--color-text-3)">{hint}</div>
    }

    const actionLabel =
      status === 'valid'
        ? t('apiKeys.action.edit')
        : status === 'invalid'
          ? t('apiKeys.action.reenter')
          : t('apiKeys.action.add')
    const actionAriaLabel =
      status === 'valid'
        ? t('apiKeys.action.editProvider', { label })
        : status === 'invalid'
          ? t('apiKeys.action.reenterProvider', { label })
          : t('apiKeys.action.addProvider', { label })

    return (
      <div className={rowClass}>
        <div className="flex min-w-0 items-center gap-3 px-1">
          <BrandIcon name={providerConfig.brandIcon} size={14} className="shrink-0 text-(--color-text-2)" />
          <div className="min-w-0 flex-1">
            <div className="text-base font-medium text-(--color-text)">{label}</div>
            <div className="mt-0.5 min-w-0">{summary}</div>
          </div>
          {justValidated ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-(--color-success)">
              <Icon name="check_circle" size={12} strokeWidth={2.1} />
              {t('apiKeys.status.validated')}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="action-soft -mr-1 shrink-0 text-sm"
              aria-label={actionAriaLabel}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    )
  }

  const hasDraftKey = draft.trim() !== ''
  const hasBaseUrlDraft = baseUrlDraft.trim() !== ''
  const hasBaseUrlChange = baseUrlDraft.trim() !== customBaseUrl
  const hasProxyChange = useProxyDraft !== useProxy
  const canSubmit = !isValidating && (hasDraftKey || (hasExistingKey && (hasBaseUrlChange || hasProxyChange)))
  const submitDisabledReason = isValidating
    ? t('apiKeys.action.disabled.validating')
    : hasExistingKey
      ? t('apiKeys.action.disabled.noChanges')
      : t('apiKeys.action.disabled.missingKey')
  const advancedId = `${id}-advanced`
  const submitButton = (
    <button
      type="button"
      onClick={handleSubmit}
      aria-label={t('apiKeys.action.saveAndValidate', { label })}
      disabled={!canSubmit}
      data-active="true"
      className="chip text-sm"
      style={{ height: 28, padding: '0 11px' }}
    >
      {isValidating ? (
        <>
          <span className="spinner" />
          <span>{t('apiKeys.status.validating')}</span>
        </>
      ) : (
        t('apiKeys.action.saveAndValidate', { label })
      )}
    </button>
  )

  return (
    <div className={rowClass}>
      <div className="flex min-w-0 items-baseline justify-between gap-3 px-1">
        <label className="flex min-w-0 items-center gap-2 text-base font-medium text-(--color-text)">
          <BrandIcon name={providerConfig.brandIcon} size={14} className="shrink-0 text-(--color-text-2)" />
          <span className="min-w-0 truncate">{label}</span>
        </label>
        <span className="shrink-0 text-sm text-(--color-text-3)">{hint}</span>
      </div>
      <div className="mt-3 space-y-2.5 px-1">
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
            autoFocus
            className="w-full rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 py-1.5 text-base
                       shadow-[inset_0_0_0_1px_var(--ring-edge)]
                       focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]
                       transition-[box-shadow,background]
                       placeholder:text-(--color-text-4)
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            className="flex h-7 w-full items-center justify-between rounded-[var(--radius-sm)] text-left text-sm font-medium text-(--color-text-3) transition-colors hover:bg-(--color-surface-2)"
          >
            <span className="inline-flex items-center gap-1.5">
              {t('apiKeys.advanced.toggle')}
              {!advancedOpen && hasBaseUrlDraft && (
                <span className="inline-block size-1.5 rounded-full bg-(--color-accent)" aria-hidden="true" />
              )}
            </span>
            <Icon name={advancedOpen ? 'chevron_down' : 'chevron_right'} size={12} />
          </button>
          {advancedOpen && (
            <div id={advancedId} className="mt-1.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3 py-0.5">
                <div>
                  <div className="text-sm font-medium text-(--color-text-2)">{t('apiKeys.proxy.label')}</div>
                  <div className="mt-0.5 text-sm leading-snug text-(--color-text-3)">{t('apiKeys.proxy.hint')}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useProxyDraft}
                  onClick={() => setUseProxyDraft((value) => !value)}
                  disabled={isValidating}
                  className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                    useProxyDraft
                      ? 'bg-(--color-accent) shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,#000_10%)]'
                      : 'bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none my-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      useProxyDraft ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <label className="text-sm font-medium text-(--color-text-3)" htmlFor={baseUrlInputId}>
                    {t('apiKeys.baseUrl.label')}
                  </label>
                  <span className="text-sm text-(--color-text-3)">{t('apiKeys.baseUrl.hint')}</span>
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
                  <div className="flex items-start gap-1 text-sm leading-[1.5] text-(--color-text-3)">
                    <span className="shrink-0">{t('apiKeys.baseUrl.previewLabel')}</span>
                    <span className="mono min-w-0 flex-1 break-all text-(--color-text-3)">
                      {previewEndpoint(provider, baseUrlDraft)}
                    </span>
                  </div>
                )}
              </div>
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
            {!isValidating && (
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
            {canSubmit ? (
              submitButton
            ) : (
              <Tooltip text={submitDisabledReason} placement="top" className="inline-flex">
                {submitButton}
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
