import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

import type { KeyHook } from './ApiKeysDialog'
import { Icon, type IconName } from './Icon'
import type { AgentSkill, AgentSkillCreateInput, AgentSkillSummary } from '../agent'
import { ApiSettingsTab } from './settings/ApiSettingsTab'
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab'
import { DataSettingsTab } from './settings/DataSettingsTab'
import { GenerationSettingsTab } from './settings/GenerationSettingsTab'
import { SettingsBackupTab } from './settings/SettingsBackupTab'
import { SkillsSettingsTab } from './settings/SkillsSettingsTab'
import { WebToolsSettingsTab, type WebProviderNotice } from './settings/WebToolsSettingsTab'
import type { LanguagePreference } from '../config/languages'
import type { Provider } from '../config/models'
import type { Theme } from '../config/theme'
import {
  WEB_API_PROVIDER_CONFIGS,
  getWebApiProviderConfig,
  isWebFetchApiProvider,
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

type SettingsTab = 'appearance' | 'api' | 'web' | 'generation' | 'skills' | 'backup' | 'data'

const SETTINGS_TABS: { id: SettingsTab; labelKey: string; icon: IconName }[] = [
  { id: 'api', labelKey: 'settings.tabs.api', icon: 'key' },
  { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: 'palette' },
  { id: 'web', labelKey: 'settings.tabs.web', icon: 'search' },
  { id: 'generation', labelKey: 'settings.tabs.generation', icon: 'sparkles' },
  { id: 'skills', labelKey: 'settings.tabs.skills', icon: 'wand' },
  { id: 'backup', labelKey: 'settings.tabs.backup', icon: 'download' },
  { id: 'data', labelKey: 'settings.tabs.data', icon: 'settings' },
]

type SettingsFocusSection = 'apiKeys' | 'generationConcurrency'

function getInitialSettingsTab(focusSection: SettingsFocusSection | null | undefined): SettingsTab {
  if (focusSection === 'apiKeys') return 'api'
  if (focusSection === 'generationConcurrency') return 'generation'
  return 'appearance'
}

function emptyWebProviderDrafts(): WebProviderApiKeys {
  return WEB_API_PROVIDER_CONFIGS.reduce((drafts, provider) => {
    drafts[provider.id] = ''
    return drafts
  }, {} as WebProviderApiKeys)
}

function hasConfiguredWebApiKey(apiKeys: WebProviderApiKeys, provider: WebSearchProvider | WebFetchProvider): boolean {
  return provider !== 'none' && provider !== 'default' && apiKeys[provider].trim() !== ''
}

type Props = {
  open: boolean
  keyHooks: Record<Provider, KeyHook>
  theme: Theme
  language: LanguagePreference
  generationConcurrency: number
  agentSkills: AgentSkillSummary[]
  focusSection?: SettingsFocusSection | null
  onThemeChange: (theme: Theme) => void
  onLanguageChange: (id: LanguagePreference) => void
  onGenerationConcurrencyChange: (value: number) => void
  onAgentPanelWidePreferenceChange: (wide: boolean) => void
  onAgentWideTipDismissedPreferenceChange: (dismissed: boolean) => void
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
  language,
  generationConcurrency,
  agentSkills,
  focusSection,
  onThemeChange,
  onLanguageChange,
  onGenerationConcurrencyChange,
  onAgentPanelWidePreferenceChange,
  onAgentWideTipDismissedPreferenceChange,
  onAgentSkillEnabledChange,
  onDeleteAgentSkill,
  onGetAgentSkillPackage,
  onCreateAgentSkill,
  onClose,
}: Props) {
  const { t } = useI18n()
  const [selectedTab, setSelectedTab] = useState<SettingsTab>(() => getInitialSettingsTab(focusSection))
  const [clearDataConfirm, setClearDataConfirm] = useState(false)
  const [clearDataBusy, setClearDataBusy] = useState(false)
  const [clearDataError, setClearDataError] = useState<string | null>(null)
  const [siteDataUsage, setSiteDataUsage] = useState<SiteDataUsage | null>(null)
  const [siteDataUsageLoading, setSiteDataUsageLoading] = useState(false)
  const [siteDataUsageError, setSiteDataUsageError] = useState<string | null>(null)
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown | null>(null)
  const [webProviderSettings, setWebProviderSettings] = useState(readWebProviderSettings)
  const [webProviderDrafts, setWebProviderDrafts] = useState<WebProviderApiKeys>(emptyWebProviderDrafts)
  const [webProviderNotice, setWebProviderNotice] = useState<WebProviderNotice | null>(null)

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

  // Auto-navigate when a settings entry point targets a specific tab.
  useExternalSync(() => {
    if (!open) return
    setSelectedTab(getInitialSettingsTab(focusSection))
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
    setWebProviderNotice(null)
    setWebProviderSettings((current) => ({ ...current, searchProvider: provider }))
  }

  const handleWebFetchProviderChange = (provider: WebFetchProvider) => {
    writeWebFetchProviderPreference(provider)
    setWebProviderNotice(null)
    setWebProviderSettings((current) => ({ ...current, fetchProvider: provider }))
  }

  const handleWebProviderDraftChange = (provider: WebApiProvider, value: string) => {
    setWebProviderDrafts((current) => ({ ...current, [provider]: value }))
  }

  const handleSaveWebProviderApiKey = (provider: WebApiProvider) => {
    const apiKey = webProviderDrafts[provider].trim()
    if (!apiKey) return
    const providerConfig = getWebApiProviderConfig(provider)
    const currentSettings = webProviderSettings
    const nextApiKeys = { ...currentSettings.apiKeys, [provider]: apiKey }
    const shouldSwitchSearch =
      providerConfig.supportsSearch &&
      currentSettings.searchProvider !== provider &&
      !hasConfiguredWebApiKey(currentSettings.apiKeys, currentSettings.searchProvider)
    const shouldSwitchFetch =
      isWebFetchApiProvider(provider) &&
      currentSettings.fetchProvider !== provider &&
      !hasConfiguredWebApiKey(currentSettings.apiKeys, currentSettings.fetchProvider)
    const nextSearchProvider = shouldSwitchSearch ? provider : currentSettings.searchProvider
    const nextFetchProvider = shouldSwitchFetch ? provider : currentSettings.fetchProvider

    writeWebProviderApiKey(provider, apiKey)
    if (shouldSwitchSearch) writeWebSearchProviderPreference(provider)
    if (shouldSwitchFetch) writeWebFetchProviderPreference(provider)
    setWebProviderDrafts((current) => ({ ...current, [provider]: '' }))
    setWebProviderNotice({
      provider,
      providerLabel: providerConfig.shortLabel,
      previousSearchProvider: currentSettings.searchProvider,
      previousFetchProvider: currentSettings.fetchProvider,
      switchedSearch: shouldSwitchSearch,
      switchedFetch: shouldSwitchFetch,
      canSwitchSearch: providerConfig.supportsSearch && nextSearchProvider !== provider,
      canSwitchFetch: isWebFetchApiProvider(provider) && nextFetchProvider !== provider,
    })
    setWebProviderSettings({
      searchProvider: nextSearchProvider,
      fetchProvider: nextFetchProvider,
      apiKeys: nextApiKeys,
    })
  }

  const handleClearWebProviderApiKey = (provider: WebApiProvider) => {
    clearWebProviderApiKey(provider)
    setWebProviderDrafts((current) => ({ ...current, [provider]: '' }))
    setWebProviderNotice(null)
    setWebProviderSettings((current) => ({
      searchProvider: current.searchProvider === provider ? 'none' : current.searchProvider,
      fetchProvider: current.fetchProvider === provider ? 'default' : current.fetchProvider,
      apiKeys: { ...current.apiKeys, [provider]: '' },
    }))
    if (webProviderSettings.searchProvider === provider) writeWebSearchProviderPreference('none')
    if (webProviderSettings.fetchProvider === provider) writeWebFetchProviderPreference('default')
  }

  const handleImportWebProviderApiKey = (provider: WebApiProvider, apiKey: string) => {
    writeWebProviderApiKey(provider, apiKey)
    setWebProviderSettings((current) => ({
      ...current,
      apiKeys: { ...current.apiKeys, [provider]: apiKey },
    }))
  }

  const handleUndoWebProviderSwitch = () => {
    if (!webProviderNotice) return
    writeWebSearchProviderPreference(webProviderNotice.previousSearchProvider)
    writeWebFetchProviderPreference(webProviderNotice.previousFetchProvider)
    setWebProviderSettings((current) => ({
      ...current,
      searchProvider: webProviderNotice.previousSearchProvider,
      fetchProvider: webProviderNotice.previousFetchProvider,
    }))
    setWebProviderNotice(null)
  }

  const handleUseWebProviderForSearch = () => {
    if (!webProviderNotice) return
    const previousSearchProvider = webProviderSettings.searchProvider
    writeWebSearchProviderPreference(webProviderNotice.provider)
    setWebProviderSettings((current) => ({ ...current, searchProvider: webProviderNotice.provider }))
    setWebProviderNotice((current) =>
      current
        ? {
            ...current,
            previousSearchProvider,
            switchedSearch: true,
            canSwitchSearch: false,
          }
        : null,
    )
  }

  const handleUseWebProviderForFetch = () => {
    if (!webProviderNotice || !isWebFetchApiProvider(webProviderNotice.provider)) return
    const provider = webProviderNotice.provider
    const previousFetchProvider = webProviderSettings.fetchProvider
    writeWebFetchProviderPreference(provider)
    setWebProviderSettings((current) => ({ ...current, fetchProvider: provider }))
    setWebProviderNotice((current) =>
      current
        ? {
            ...current,
            previousFetchProvider,
            switchedFetch: true,
            canSwitchFetch: false,
          }
        : null,
    )
  }

  if (!open) return null

  const effectiveSiteDataUsageLoading = siteDataUsageLoading || (open && !siteDataUsage && !siteDataUsageError)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="modal-backdrop-pop absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        className="modal-pop relative flex h-[min(720px,calc(100dvh-32px))] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-lg)] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
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
                color: selectedTab === tab.id ? 'var(--color-text)' : 'var(--color-text-3)',
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
            <AppearanceSettingsTab
              theme={theme}
              language={language}
              onThemeChange={onThemeChange}
              onLanguageChange={onLanguageChange}
            />
          )}

          {selectedTab === 'api' && <ApiSettingsTab keyHooks={keyHooks} />}

          {selectedTab === 'web' && (
            <WebToolsSettingsTab
              webProviderSettings={webProviderSettings}
              webProviderDrafts={webProviderDrafts}
              webProviderNotice={webProviderNotice}
              onWebSearchProviderChange={handleWebSearchProviderChange}
              onWebFetchProviderChange={handleWebFetchProviderChange}
              onWebProviderDraftChange={handleWebProviderDraftChange}
              onSaveWebProviderApiKey={handleSaveWebProviderApiKey}
              onClearWebProviderApiKey={handleClearWebProviderApiKey}
              onUseWebProviderForSearch={handleUseWebProviderForSearch}
              onUseWebProviderForFetch={handleUseWebProviderForFetch}
              onUndoWebProviderSwitch={handleUndoWebProviderSwitch}
              onDismissWebProviderNotice={() => setWebProviderNotice(null)}
            />
          )}

          {selectedTab === 'generation' && (
            <GenerationSettingsTab
              generationConcurrency={generationConcurrency}
              onGenerationConcurrencyChange={onGenerationConcurrencyChange}
            />
          )}

          {selectedTab === 'skills' && (
            <SkillsSettingsTab
              agentSkills={agentSkills}
              onAgentSkillEnabledChange={onAgentSkillEnabledChange}
              onDeleteAgentSkill={onDeleteAgentSkill}
              onGetAgentSkillPackage={onGetAgentSkillPackage}
              onCreateAgentSkill={onCreateAgentSkill}
            />
          )}

          {selectedTab === 'backup' && (
            <SettingsBackupTab
              keyHooks={keyHooks}
              onThemeChange={onThemeChange}
              onLanguageChange={onLanguageChange}
              onGenerationConcurrencyChange={onGenerationConcurrencyChange}
              onAgentPanelWidePreferenceChange={onAgentPanelWidePreferenceChange}
              onAgentWideTipDismissedPreferenceChange={onAgentWideTipDismissedPreferenceChange}
              onWebSearchProviderChange={handleWebSearchProviderChange}
              onWebFetchProviderChange={handleWebFetchProviderChange}
              onImportWebProviderApiKey={handleImportWebProviderApiKey}
              onAgentSkillEnabledChange={onAgentSkillEnabledChange}
              onCreateAgentSkill={onCreateAgentSkill}
            />
          )}

          {selectedTab === 'data' && (
            <DataSettingsTab
              siteDataUsage={siteDataUsage}
              siteDataUsageLoading={effectiveSiteDataUsageLoading}
              siteDataUsageError={siteDataUsageError}
              storageBreakdown={storageBreakdown}
              clearDataConfirm={clearDataConfirm}
              clearDataBusy={clearDataBusy}
              clearDataError={clearDataError}
              onRefreshSiteDataUsage={refreshSiteDataUsage}
              onClearSiteData={handleClearSiteData}
              onConfirmClearData={() => setClearDataConfirm(true)}
              onCancelClearData={() => {
                setClearDataConfirm(false)
                setClearDataError(null)
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
