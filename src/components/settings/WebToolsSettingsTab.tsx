import { useState } from 'react'

import {
  WEB_API_PROVIDER_CONFIGS,
  WEB_FETCH_PROVIDER_OPTIONS,
  WEB_SEARCH_PROVIDER_OPTIONS,
  type WebApiProvider,
  type WebFetchProvider,
  type WebProviderOption,
  type WebSearchProvider,
} from '../../config/webProviders'
import { useI18n } from '../../i18n'
import type { WebProviderApiKeys, WebProviderSettings } from '../../lib/webProviderStore'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

export type WebProviderNotice = {
  provider: WebApiProvider
  providerLabel: string
  previousSearchProvider: WebSearchProvider
  previousFetchProvider: WebFetchProvider
  switchedSearch: boolean
  switchedFetch: boolean
  canSwitchSearch: boolean
  canSwitchFetch: boolean
}

type WebToolsSettingsTabProps = {
  webProviderSettings: WebProviderSettings
  webProviderDrafts: WebProviderApiKeys
  webProviderNotice: WebProviderNotice | null
  onWebSearchProviderChange: (provider: WebSearchProvider) => void
  onWebFetchProviderChange: (provider: WebFetchProvider) => void
  onWebProviderDraftChange: (provider: WebApiProvider, value: string) => void
  onSaveWebProviderApiKey: (provider: WebApiProvider) => void
  onClearWebProviderApiKey: (provider: WebApiProvider) => void
  onUseWebProviderForSearch: () => void
  onUseWebProviderForFetch: () => void
  onUndoWebProviderSwitch: () => void
  onDismissWebProviderNotice: () => void
}

export function WebToolsSettingsTab({
  webProviderSettings,
  webProviderDrafts,
  webProviderNotice,
  onWebSearchProviderChange,
  onWebFetchProviderChange,
  onWebProviderDraftChange,
  onSaveWebProviderApiKey,
  onClearWebProviderApiKey,
  onUseWebProviderForSearch,
  onUseWebProviderForFetch,
  onUndoWebProviderSwitch,
  onDismissWebProviderNotice,
}: WebToolsSettingsTabProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="space-y-3">
        <WebProviderChipSelector
          label={t('settings.webTools.search.label')}
          options={WEB_SEARCH_PROVIDER_OPTIONS}
          value={webProviderSettings.searchProvider}
          apiKeys={webProviderSettings.apiKeys}
          onChange={onWebSearchProviderChange}
        />
        <WebProviderChipSelector
          label={t('settings.webTools.fetch.label')}
          options={WEB_FETCH_PROVIDER_OPTIONS}
          value={webProviderSettings.fetchProvider}
          apiKeys={webProviderSettings.apiKeys}
          onChange={onWebFetchProviderChange}
        />
      </div>

      {webProviderNotice && (
        <WebProviderSavedNotice
          notice={webProviderNotice}
          onUseSearch={onUseWebProviderForSearch}
          onUseFetch={onUseWebProviderForFetch}
          onUndo={onUndoWebProviderSwitch}
          onDismiss={onDismissWebProviderNotice}
        />
      )}

      <div>
        <div className="label mb-2">{t('settings.webTools.apiKeys.label')}</div>
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) pl-1 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          {WEB_API_PROVIDER_CONFIGS.map((provider, index) => (
            <WebApiKeyRow
              key={provider.id}
              provider={provider.id}
              label={provider.label}
              configured={webProviderSettings.apiKeys[provider.id].trim() !== ''}
              draft={webProviderDrafts[provider.id]}
              apiKeyUrl={provider.apiKeyUrl}
              last={index === WEB_API_PROVIDER_CONFIGS.length - 1}
              onDraftChange={onWebProviderDraftChange}
              onSave={onSaveWebProviderApiKey}
              onClear={onClearWebProviderApiKey}
            />
          ))}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-(--color-text-3)">{t('settings.webTools.note')}</p>
    </div>
  )
}

function WebProviderChipSelector<T extends WebSearchProvider | WebFetchProvider>({
  label,
  options,
  value,
  apiKeys,
  onChange,
}: {
  label: string
  options: WebProviderOption<T>[]
  value: T
  apiKeys: WebProviderApiKeys
  onChange: (id: T) => void
}) {
  const { t } = useI18n()
  const selectedOption = options.find((option) => option.id === value)

  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 pl-1">
        {options.map((option) => {
          const apiProvider = option.id !== 'none' && option.id !== 'default' ? (option.id as WebApiProvider) : null
          const configured = !apiProvider || apiKeys[apiProvider].trim() !== ''
          const active = value === option.id
          const labelText = t(option.labelKey)
          const disabledTooltip = t('settings.webTools.provider.requiresKey', { provider: labelText })
          const disabledAriaLabel = t('settings.webTools.provider.disabledAriaLabel', { provider: labelText })
          const button = (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              disabled={!configured}
              aria-pressed={active}
              aria-label={configured ? labelText : disabledAriaLabel}
              className="chip"
              style={{
                ...(active
                  ? {
                      background: 'var(--color-surface-2)',
                      color: 'var(--color-text)',
                      boxShadow: 'inset 0 0 0 1px var(--ring-edge-strong)',
                    }
                  : {}),
                ...(!configured ? { opacity: 0.48 } : {}),
              }}
            >
              {active && <Icon name="check" size={10} strokeWidth={2.5} className="text-(--color-text-2)" />}
              {labelText}
            </button>
          )

          if (configured) return button

          return (
            <Tooltip key={option.id} text={disabledTooltip} placement="top" className="inline-flex">
              {button}
            </Tooltip>
          )
        })}
      </div>
      {selectedOption && (
        <p className="mt-1.5 pl-1 text-sm text-(--color-text-3)">{t(selectedOption.descriptionKey)}</p>
      )}
    </div>
  )
}

function webProviderNoticeMessageKey(notice: WebProviderNotice): string {
  if (notice.switchedSearch && notice.switchedFetch) return 'settings.webTools.notice.savedSwitchedBoth'
  if (notice.switchedSearch) return 'settings.webTools.notice.savedSwitchedSearch'
  if (notice.switchedFetch) return 'settings.webTools.notice.savedSwitchedFetch'
  return 'settings.webTools.notice.saved'
}

function WebProviderSavedNotice({
  notice,
  onUseSearch,
  onUseFetch,
  onUndo,
  onDismiss,
}: {
  notice: WebProviderNotice
  onUseSearch: () => void
  onUseFetch: () => void
  onUndo: () => void
  onDismiss: () => void
}) {
  const { t } = useI18n()
  const switched = notice.switchedSearch || notice.switchedFetch

  return (
    <div
      role="status"
      aria-live="polite"
      className="ml-1 rounded-[var(--radius-md)] bg-(--color-accent-wash) px-3 py-2.5 text-sm text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon name="check" size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-(--color-accent)" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="leading-relaxed">
            {t(webProviderNoticeMessageKey(notice), { provider: notice.providerLabel })}
          </p>
          {(notice.canSwitchSearch || notice.canSwitchFetch || switched) && (
            <div className="flex flex-wrap gap-1.5">
              {notice.canSwitchSearch && (
                <button
                  type="button"
                  onClick={onUseSearch}
                  className="chip text-sm"
                  style={{ height: 26, padding: '0 8px' }}
                >
                  {t('settings.webTools.notice.useSearch')}
                </button>
              )}
              {notice.canSwitchFetch && (
                <button
                  type="button"
                  onClick={onUseFetch}
                  className="chip text-sm"
                  style={{ height: 26, padding: '0 8px' }}
                >
                  {t('settings.webTools.notice.useFetch')}
                </button>
              )}
              {switched && (
                <button
                  type="button"
                  onClick={onUndo}
                  className="chip ghost text-sm"
                  style={{ height: 26, padding: '0 8px' }}
                >
                  {t('settings.webTools.notice.undo')}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="icon-btn -mr-1 -mt-1 shrink-0"
          aria-label={t('common.close')}
        >
          <Icon name="close" size={12} />
        </button>
      </div>
    </div>
  )
}

function WebApiKeyRow({
  provider,
  label,
  configured,
  draft,
  apiKeyUrl,
  last,
  onDraftChange,
  onSave,
  onClear,
}: {
  provider: WebApiProvider
  label: string
  configured: boolean
  draft: string
  apiKeyUrl: string
  last: boolean
  onDraftChange: (provider: WebApiProvider, value: string) => void
  onSave: (provider: WebApiProvider) => void
  onClear: (provider: WebApiProvider) => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const canSave = draft.trim() !== ''

  const rowClass = `px-3 py-2.5 ${last ? '' : 'shadow-[inset_0_-1px_0_var(--ring-edge-soft)]'}`

  if (!expanded) {
    return (
      <div className={rowClass}>
        <div className="flex min-w-0 items-center gap-3 px-1">
          <div className="min-w-0 flex-1">
            <div className="text-base font-medium text-(--color-text)">{label}</div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-(--color-text-3)">
              <span
                className={`inline-block size-1.5 shrink-0 rounded-full ${configured ? 'bg-(--color-success)' : 'bg-(--color-text-4)'}`}
              />
              <span>
                {configured ? t('settings.webTools.key.configured') : t('settings.webTools.key.notConfigured')}
              </span>
              <span className="text-(--color-text-4)">·</span>
              <a href={apiKeyUrl} target="_blank" rel="noreferrer" className="text-(--color-accent) hover:underline">
                {t('settings.webTools.key.getKey')}
              </a>
            </div>
          </div>
          <button type="button" onClick={() => setExpanded(true)} className="action-soft -mr-1 shrink-0 text-sm">
            {configured ? t('apiKeys.action.edit') : t('apiKeys.action.add')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={rowClass}>
      <div className="flex min-w-0 items-baseline justify-between gap-3 px-1">
        <div className="text-base font-medium text-(--color-text)">{label}</div>
        <a
          href={apiKeyUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm text-(--color-accent) hover:underline"
        >
          {t('settings.webTools.key.getKey')}
        </a>
      </div>
      <div className="mt-3 space-y-2.5 px-1">
        <input
          type="password"
          value={draft}
          onChange={(event) => onDraftChange(provider, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSave) {
              onSave(provider)
              setExpanded(false)
            }
          }}
          placeholder={
            configured ? t('settings.webTools.key.replacePlaceholder') : t('settings.webTools.key.placeholder')
          }
          aria-label={t('settings.webTools.key.ariaLabel', { label })}
          autoFocus
          className="w-full min-w-0 rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 py-1.5 text-base shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-[box-shadow,background] placeholder:text-(--color-text-4) focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {configured && (
              <button
                type="button"
                onClick={() => {
                  onClear(provider)
                  setExpanded(false)
                }}
                className="chip danger text-sm"
                style={{ height: 28, padding: '0 9px' }}
              >
                {t('apiKeys.action.removeKey')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="chip ghost text-sm"
              style={{ height: 28, padding: '0 9px' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (canSave) {
                  onSave(provider)
                  setExpanded(false)
                }
              }}
              disabled={!canSave}
              data-active="true"
              className="chip text-sm"
              style={{ height: 28, padding: '0 11px' }}
            >
              {t('settings.webTools.key.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
