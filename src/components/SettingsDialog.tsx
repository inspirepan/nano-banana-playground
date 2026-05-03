import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { AgentSkillSettings } from './AgentSkillSettings'
import { ApiKeysSettings, type KeyHook } from './ApiKeysDialog'
import { Icon, type IconName } from './Icon'
import type { AgentSkill, AgentSkillCreateInput, AgentSkillSummary } from '../agent'
import { SANS_FONTS, type SansFontId } from '../config/fonts'
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../config/languages'
import type { Provider } from '../config/models'
import { COLOR_THEMES, type ColorThemeId, type Theme } from '../config/theme'
import {
  WEB_API_PROVIDER_CONFIGS,
  WEB_FETCH_PROVIDER_OPTIONS,
  WEB_SEARCH_PROVIDER_OPTIONS,
  type WebApiProvider,
  type WebFetchProvider,
  type WebSearchProvider,
} from '../config/webProviders'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import { useI18n } from '../i18n'
import {
  clearCurrentSiteData,
  getCurrentSiteDataUsage,
  getStorageBreakdown,
  type SiteDataUsage,
  type StorageBreakdown,
} from '../lib/siteData'
import {
  clearWebProviderApiKey,
  readWebProviderSettings,
  writeWebFetchProviderPreference,
  writeWebProviderApiKey,
  writeWebSearchProviderPreference,
  type WebProviderApiKeys,
} from '../lib/webProviderStore'

type SettingsTab = 'appearance' | 'api' | 'web' | 'generation' | 'data'

const SETTINGS_TABS: { id: SettingsTab; labelKey: string; icon: IconName }[] = [
  { id: 'api', labelKey: 'settings.tabs.api', icon: 'key' },
  { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: 'palette' },
  { id: 'web', labelKey: 'settings.tabs.web', icon: 'search' },
  { id: 'generation', labelKey: 'settings.tabs.generation', icon: 'sparkles' },
  { id: 'data', labelKey: 'settings.tabs.data', icon: 'settings' },
]

const BRIGHTNESS: { value: Theme; icon: IconName; labelKey: string }[] = [
  { value: 'light', icon: 'light_mode', labelKey: 'settings.theme.light' },
  { value: 'warm', icon: 'palette', labelKey: 'settings.theme.warm' },
  { value: 'dark', icon: 'dark_mode', labelKey: 'settings.theme.dark' },
  { value: 'system', icon: 'contrast', labelKey: 'settings.theme.system' },
]

const GENERATION_CONCURRENCY_CHOICES = [
  { value: 1, label: '1', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 2, label: '2', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 3, label: '3', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 4, label: '4', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 999, labelKey: 'settings.generationConcurrency.unlimited' },
]

function emptyWebProviderDrafts(): WebProviderApiKeys {
  return WEB_API_PROVIDER_CONFIGS.reduce((drafts, provider) => {
    drafts[provider.id] = ''
    return drafts
  }, {} as WebProviderApiKeys)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

type Props = {
  open: boolean
  keyHooks: Record<Provider, KeyHook>
  theme: Theme
  colorTheme: ColorThemeId
  sansFont: SansFontId
  language: LanguagePreference
  generationConcurrency: number
  agentSkills: AgentSkillSummary[]
  focusSection?: 'generationConcurrency' | null
  onThemeChange: (theme: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
  onSansFontChange: (id: SansFontId) => void
  onLanguageChange: (id: LanguagePreference) => void
  onGenerationConcurrencyChange: (value: number) => void
  onAgentSkillEnabledChange: (name: string, enabled: boolean) => void
  onDeleteAgentSkill: (name: string) => void
  onGetAgentSkillPackage: (name: string) => AgentSkill | null
  onCreateAgentSkill: (input: AgentSkillCreateInput) => void
  onClose: () => void
}

export function SettingsDialog({
  open,
  keyHooks,
  theme,
  colorTheme,
  sansFont,
  language,
  generationConcurrency,
  agentSkills,
  focusSection,
  onThemeChange,
  onColorThemeChange,
  onSansFontChange,
  onLanguageChange,
  onGenerationConcurrencyChange,
  onAgentSkillEnabledChange,
  onDeleteAgentSkill,
  onGetAgentSkillPackage,
  onCreateAgentSkill,
  onClose,
}: Props) {
  const { t, language: resolvedLanguage } = useI18n()
  const [selectedTab, setSelectedTab] = useState<SettingsTab>('appearance')
  const [clearDataConfirm, setClearDataConfirm] = useState(false)
  const [clearDataBusy, setClearDataBusy] = useState(false)
  const [clearDataError, setClearDataError] = useState<string | null>(null)
  const [siteDataUsage, setSiteDataUsage] = useState<SiteDataUsage | null>(null)
  const [siteDataUsageLoading, setSiteDataUsageLoading] = useState(false)
  const [siteDataUsageError, setSiteDataUsageError] = useState<string | null>(null)
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown | null>(null)
  const [webProviderSettings, setWebProviderSettings] = useState(readWebProviderSettings)
  const [webProviderDrafts, setWebProviderDrafts] = useState<WebProviderApiKeys>(emptyWebProviderDrafts)

  const refreshSiteDataUsage = useCallback(async () => {
    setSiteDataUsageLoading(true)
    setSiteDataUsageError(null)
    try {
      const [usage, breakdown] = await Promise.all([getCurrentSiteDataUsage(), getStorageBreakdown()])
      setSiteDataUsage(usage)
      setStorageBreakdown(breakdown)
    } catch (error) {
      setSiteDataUsageError(error instanceof Error ? error.message : t('settings.error.readSiteDataUsage'))
    } finally {
      setSiteDataUsageLoading(false)
    }
  }, [t])

  const handleClose = useCallback(() => {
    setClearDataConfirm(false)
    setClearDataBusy(false)
    setClearDataError(null)
    onClose()
  }, [onClose])

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') handleClose()
    },
    undefined,
    open,
  )

  // Auto-navigate to generation tab when focusSection is set
  useExternalSync(() => {
    if (!open) return
    if (focusSection === 'generationConcurrency') setSelectedTab('generation')
  }, [open, focusSection])

  // Load site data usage + breakdown when dialog opens
  useExternalSync(() => {
    if (!open) return
    let cancelled = false
    void Promise.all([getCurrentSiteDataUsage(), getStorageBreakdown()])
      .then(([usage, breakdown]) => {
        if (!cancelled) {
          setSiteDataUsage(usage)
          setStorageBreakdown(breakdown)
        }
      })
      .catch((error) => {
        if (!cancelled)
          setSiteDataUsageError(error instanceof Error ? error.message : t('settings.error.readSiteDataUsage'))
      })
    return () => {
      cancelled = true
    }
  }, [open, t])

  const handleClearSiteData = async () => {
    if (clearDataBusy) return
    setClearDataBusy(true)
    setClearDataError(null)
    try {
      await clearCurrentSiteData()
      window.location.replace(`${window.location.origin}${window.location.pathname}`)
    } catch (error) {
      setClearDataError(error instanceof Error ? error.message : t('settings.error.clearSiteData'))
      setClearDataBusy(false)
    }
  }

  const handleWebSearchProviderChange = (provider: WebSearchProvider) => {
    writeWebSearchProviderPreference(provider)
    setWebProviderSettings((current) => ({ ...current, searchProvider: provider }))
  }

  const handleWebFetchProviderChange = (provider: WebFetchProvider) => {
    writeWebFetchProviderPreference(provider)
    setWebProviderSettings((current) => ({ ...current, fetchProvider: provider }))
  }

  const handleWebProviderDraftChange = (provider: WebApiProvider, value: string) => {
    setWebProviderDrafts((current) => ({ ...current, [provider]: value }))
  }

  const handleSaveWebProviderApiKey = (provider: WebApiProvider) => {
    const apiKey = webProviderDrafts[provider].trim()
    if (!apiKey) return
    writeWebProviderApiKey(provider, apiKey)
    setWebProviderDrafts((current) => ({ ...current, [provider]: '' }))
    setWebProviderSettings((current) => ({
      ...current,
      apiKeys: { ...current.apiKeys, [provider]: apiKey },
    }))
  }

  const handleClearWebProviderApiKey = (provider: WebApiProvider) => {
    clearWebProviderApiKey(provider)
    setWebProviderDrafts((current) => ({ ...current, [provider]: '' }))
    setWebProviderSettings((current) => ({
      searchProvider: current.searchProvider === provider ? 'none' : current.searchProvider,
      fetchProvider: current.fetchProvider === provider ? 'default' : current.fetchProvider,
      apiKeys: { ...current.apiKeys, [provider]: '' },
    }))
    if (webProviderSettings.searchProvider === provider) writeWebSearchProviderPreference('none')
    if (webProviderSettings.fetchProvider === provider) writeWebFetchProviderPreference('default')
  }

  if (!open) return null

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const effectiveSiteDataUsageLoading = siteDataUsageLoading || (open && !siteDataUsage && !siteDataUsageError)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        className="relative flex h-[min(720px,calc(100dvh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-lg)] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3.5 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em]">{t('settings.title')}</h2>
          <button type="button" onClick={handleClose} className="icon-btn" aria-label={t('common.close')}>
            <Icon name="close" size={13} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          className="flex shrink-0 gap-0 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]"
          style={{ scrollbarWidth: 'none' }}
        >
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={selectedTab === tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className="flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                color:
                  selectedTab === tab.id ? 'var(--color-text)' : 'var(--color-text-3)',
                boxShadow: selectedTab === tab.id ? 'inset 0 -2px 0 var(--color-accent)' : undefined,
              }}
            >
              <Icon name={tab.icon} size={12} />
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedTab === 'appearance' && (
            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="label mb-1.5">{t('settings.language.label')}</div>
                <div className="pl-2">
                <div
                  className="segmented"
                  style={{
                    ['--seg-count' as string]: LANGUAGE_PREFERENCES.length,
                    ['--seg-index' as string]: LANGUAGE_PREFERENCES.findIndex((item) => item.id === language),
                  }}
                >
                  {LANGUAGE_PREFERENCES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onLanguageChange(item.id)}
                      data-active={language === item.id}
                    >
                      <span>{item.label[resolvedLanguage]}</span>
                    </button>
                  ))}
                </div>
                </div>
              </div>

              <div>
                <div className="label mb-1.5">{t('settings.theme.label')}</div>
                <div className="pl-2">
                <div
                  className="segmented"
                  style={{
                    ['--seg-count' as string]: BRIGHTNESS.length,
                    ['--seg-index' as string]: BRIGHTNESS.findIndex((item) => item.value === theme),
                  }}
                >
                  {BRIGHTNESS.map(({ value, icon, labelKey }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onThemeChange(value)}
                      data-active={theme === value}
                    >
                      <Icon name={icon} size={12} />
                      <span>{t(labelKey)}</span>
                    </button>
                  ))}
                </div>
                </div>
              </div>

              <div>
                <div className="label mb-1.5">{t('settings.colorTheme.label')}</div>
                <div className="flex gap-2 pl-2">
                  {COLOR_THEMES.map((ct) => {
                    const swatch = ct.id === 'mono' ? (isDark ? '#f2f1ef' : '#1f1d1a') : ct.color
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        title={ct.name}
                        aria-label={ct.name}
                        onClick={() => onColorThemeChange(ct.id)}
                        className="h-7 w-7 rounded-[var(--radius-sm)] transition-all"
                        style={{
                          background: swatch,
                          boxShadow:
                            colorTheme === ct.id
                              ? `inset 0 0 0 2px var(--color-surface), 0 0 0 2px ${swatch}`
                              : 'inset 0 0 0 1px var(--ring-edge)',
                        }}
                      />
                    )
                  })}
                </div>
              </div>

              <FontChoiceGroup
                label={t('settings.font.label')}
                fonts={SANS_FONTS}
                value={sansFont}
                sample={
                  <>
                    <span className="font-semibold">Image2</span> Render 3:1 · 4K
                  </>
                }
                onChange={onSansFontChange}
              />
            </div>
          )}

          {selectedTab === 'api' && (
            <div className="px-5 py-4">
              <ApiKeysSettings keyHooks={keyHooks} variant="embedded" />
            </div>
          )}

          {selectedTab === 'web' && (
            <div className="space-y-4 px-5 py-4">
              {/* Provider selectors — flat chip rows */}
              <div className="space-y-3">
                <WebProviderChipSelector
                  label={t('settings.webTools.search.label')}
                  options={WEB_SEARCH_PROVIDER_OPTIONS}
                  value={webProviderSettings.searchProvider}
                  apiKeys={webProviderSettings.apiKeys}
                  onChange={handleWebSearchProviderChange}
                />
                <WebProviderChipSelector
                  label={t('settings.webTools.fetch.label')}
                  options={WEB_FETCH_PROVIDER_OPTIONS}
                  value={webProviderSettings.fetchProvider}
                  apiKeys={webProviderSettings.apiKeys}
                  onChange={handleWebFetchProviderChange}
                />
              </div>

              {/* API key rows */}
              <div>
                <div className="label mb-2">API Keys</div>
                <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) pl-2 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
                  {WEB_API_PROVIDER_CONFIGS.map((provider, index) => (
                    <WebApiKeyRow
                      key={provider.id}
                      provider={provider.id}
                      label={provider.label}
                      configured={webProviderSettings.apiKeys[provider.id].trim() !== ''}
                      draft={webProviderDrafts[provider.id]}
                      apiKeyUrl={provider.apiKeyUrl}
                      last={index === WEB_API_PROVIDER_CONFIGS.length - 1}
                      onDraftChange={handleWebProviderDraftChange}
                      onSave={handleSaveWebProviderApiKey}
                      onClear={handleClearWebProviderApiKey}
                    />
                  ))}
                </div>
              </div>

              <p className="text-sm leading-relaxed text-(--color-text-3)">{t('settings.webTools.note')}</p>
            </div>
          )}

          {selectedTab === 'generation' && (
            <div className="space-y-5 px-5 py-4">
              <div>
                <div className="label mb-1.5">{t('settings.generationConcurrency.title')}</div>
                <p className="mb-2.5 text-sm leading-relaxed text-(--color-text-3)">
                  {t('settings.generationConcurrency.description')}
                </p>
                <div className="pl-2">
                  <div
                    className="segmented w-fit"
                    style={{
                      ['--seg-count' as string]: GENERATION_CONCURRENCY_CHOICES.length,
                      ['--seg-index' as string]: Math.max(
                        0,
                        GENERATION_CONCURRENCY_CHOICES.findIndex((choice) => choice.value === generationConcurrency),
                      ),
                    }}
                  >
                    {GENERATION_CONCURRENCY_CHOICES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => onGenerationConcurrencyChange(choice.value)}
                        data-active={generationConcurrency === choice.value}
                      >
                        <span>
                          <span className="text-base">{choice.labelKey ? t(choice.labelKey) : choice.label}</span>
                          {choice.suffixKey && t(choice.suffixKey) ? ` ${t(choice.suffixKey)}` : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
                <div className="label mb-1.5">{t('settings.agentSkills.title')}</div>
                <p className="mb-3 text-sm leading-relaxed text-(--color-text-3)">
                  {t('settings.agentSkills.description')}
                </p>
                <div className="pl-2">
                <AgentSkillSettings
                  skills={agentSkills}
                  onEnabledChange={onAgentSkillEnabledChange}
                  onDelete={onDeleteAgentSkill}
                  onGetPackage={onGetAgentSkillPackage}
                  onCreate={onCreateAgentSkill}
                />
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'data' && (
            <div className="space-y-4 px-5 py-4">
              {/* Usage header */}
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="label mb-1">{t('settings.data.currentUsage')}</div>
                  <div className="text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
                    {siteDataUsage
                      ? formatBytes(siteDataUsage.totalBytes)
                      : effectiveSiteDataUsageLoading
                        ? t('settings.data.calculating')
                        : t('common.unknown')}
                  </div>
                  {siteDataUsage?.browserEstimateBytes != null && (
                    <div className="mt-0.5 text-sm text-(--color-text-3)">
                      {t('settings.data.browserEstimate', {
                        size: formatBytes(siteDataUsage.browserEstimateBytes),
                      })}
                      {siteDataUsage.quotaBytes
                        ? t('settings.data.quota', { size: formatBytes(siteDataUsage.quotaBytes) })
                        : ''}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => refreshSiteDataUsage().catch(() => undefined)}
                  disabled={effectiveSiteDataUsageLoading || clearDataBusy}
                  className="chip shrink-0"
                >
                  <Icon name="refresh" size={12} />{' '}
                  {effectiveSiteDataUsageLoading ? t('settings.data.calculatingShort') : t('common.refresh')}
                </button>
              </div>

              {siteDataUsageError && (
                <div className="text-sm" style={{ color: 'var(--color-danger)' }}>
                  {siteDataUsageError}
                </div>
              )}

              {/* Per-category breakdown */}
              {storageBreakdown && (
                <StorageBreakdownTable
                  items={storageBreakdown.items}
                  total={siteDataUsage?.totalBytes ?? 0}
                />
              )}

              {/* Clear data */}
              <div className="space-y-2 pt-4 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
                <p className="text-sm leading-relaxed text-(--color-text-3)">{t('settings.data.clearDescription')}</p>
                {clearDataError && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-danger)' }}>
                    {clearDataError}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {clearDataConfirm ? (
                    <>
                      <button
                        type="button"
                        onClick={handleClearSiteData}
                        disabled={clearDataBusy}
                        className="chip danger"
                      >
                        <Icon name="trash" size={12} />{' '}
                        {clearDataBusy ? t('settings.data.clearing') : t('settings.data.confirmClear')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setClearDataConfirm(false)
                          setClearDataError(null)
                        }}
                        disabled={clearDataBusy}
                        className="chip"
                      >
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClearDataConfirm(true)}
                      disabled={clearDataBusy}
                      className="chip danger"
                    >
                      <Icon name="trash" size={12} /> {t('settings.data.clear')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function StorageBreakdownTable({
  items,
}: {
  items: import('../lib/siteData').StorageBreakdownItem[]
  total: number
}) {
  const { t } = useI18n()
  const nonZero = items.filter((item) => item.bytes > 0)
  if (nonZero.length === 0) return null

  return (
    <ul className="space-y-1.5 px-1">
      {nonZero.map((item) => (
        <li key={item.id} className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-(--color-text-2)">{t(item.labelKey)}</span>
          <span className="shrink-0 text-sm tabular-nums text-(--color-text-3)">{formatBytes(item.bytes)}</span>
        </li>
      ))}
    </ul>
  )
}

function FontChoiceGroup<T extends string>({
  label,
  fonts,
  value,
  sample,
  onChange,
}: {
  label: string
  fonts: { id: T; name: string; cssFamily: string }[]
  value: T
  sample: ReactNode
  onChange: (id: T) => void
}) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-2 pl-2 sm:grid-cols-3">
        {fonts.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => onChange(font.id)}
            className="rounded-[var(--radius-sm)] bg-(--color-surface) px-3 py-2 text-left transition-colors hover:bg-(--color-surface-2)"
            style={{
              boxShadow:
                value === font.id ? 'inset 0 0 0 1.5px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge-soft)',
            }}
          >
            <div className="text-sm font-medium text-(--color-text)" style={{ fontFamily: font.cssFamily }}>
              {font.name}
            </div>
            <div className="mt-1 truncate text-sm text-(--color-text-3)" style={{ fontFamily: font.cssFamily }}>
              {sample}
            </div>
          </button>
        ))}
      </div>
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
  options: { id: T; labelKey: string; descriptionKey: string }[]
  value: T
  apiKeys: WebProviderApiKeys
  onChange: (id: T) => void
}) {
  const { t } = useI18n()
  const selectedOption = options.find((o) => o.id === value)

  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 pl-2">
        {options.map((option) => {
          const isApiProvider = option.id !== 'none' && option.id !== 'default'
          const configured = !isApiProvider || !!apiKeys[option.id as WebApiProvider]?.trim()
          const active = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              disabled={!configured}
              data-active={active}
              className="chip"
            >
              {active && <Icon name="check" size={10} strokeWidth={2.5} />}
              {t(option.labelKey)}
            </button>
          )
        })}
      </div>
      {selectedOption && (
        <p className="mt-1.5 pl-2 text-sm text-(--color-text-3)">{t(selectedOption.descriptionKey)}</p>
      )}
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
              <span>{configured ? t('settings.webTools.key.configured') : t('settings.webTools.key.notConfigured')}</span>
              <span className="text-(--color-text-4)">·</span>
              <a href={apiKeyUrl} target="_blank" rel="noreferrer" className="text-(--color-accent) hover:underline">
                {t('settings.webTools.key.getKey')}
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="action-soft -mr-1 shrink-0 text-sm"
          >
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
