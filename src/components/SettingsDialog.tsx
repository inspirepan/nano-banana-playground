import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { ApiKeysSettings, type KeyHook } from './ApiKeysDialog'
import { Icon, type IconName } from './Icon'
import { SANS_FONTS, type SansFontId } from '../config/fonts'
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../config/languages'
import { COLOR_THEMES, type ColorThemeId, type Theme } from '../config/theme'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import { useI18n } from '../i18n'
import { clearCurrentSiteData, getCurrentSiteDataUsage, type SiteDataUsage } from '../lib/siteData'

const BRIGHTNESS: { value: Theme; icon: IconName; labelKey: string }[] = [
  { value: 'light', icon: 'light_mode', labelKey: 'settings.theme.light' },
  { value: 'dark', icon: 'dark_mode', labelKey: 'settings.theme.dark' },
  { value: 'system', icon: 'contrast', labelKey: 'settings.theme.system' },
]

const SANS_FONT_CHOICES = SANS_FONTS

const GENERATION_CONCURRENCY_CHOICES = [
  { value: 1, label: '1', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 2, label: '2', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 3, label: '3', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 4, label: '4', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 999, labelKey: 'settings.generationConcurrency.unlimited' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

type Props = {
  open: boolean
  googleKey: KeyHook
  openaiKey: KeyHook
  theme: Theme
  colorTheme: ColorThemeId
  sansFont: SansFontId
  language: LanguagePreference
  generationConcurrency: number
  focusSection?: 'generationConcurrency' | null
  onThemeChange: (theme: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
  onSansFontChange: (id: SansFontId) => void
  onLanguageChange: (id: LanguagePreference) => void
  onGenerationConcurrencyChange: (value: number) => void
  onClose: () => void
}

export function SettingsDialog({
  open,
  googleKey,
  openaiKey,
  theme,
  colorTheme,
  sansFont,
  language,
  generationConcurrency,
  focusSection,
  onThemeChange,
  onColorThemeChange,
  onSansFontChange,
  onLanguageChange,
  onGenerationConcurrencyChange,
  onClose,
}: Props) {
  const { t, language: resolvedLanguage } = useI18n()
  const generationConcurrencyRef = useRef<HTMLDivElement>(null)
  const [clearDataConfirm, setClearDataConfirm] = useState(false)
  const [clearDataBusy, setClearDataBusy] = useState(false)
  const [clearDataError, setClearDataError] = useState<string | null>(null)
  const [siteDataUsage, setSiteDataUsage] = useState<SiteDataUsage | null>(null)
  const [siteDataUsageLoading, setSiteDataUsageLoading] = useState(false)
  const [siteDataUsageError, setSiteDataUsageError] = useState<string | null>(null)

  const refreshSiteDataUsage = useCallback(async () => {
    setSiteDataUsageLoading(true)
    setSiteDataUsageError(null)
    try {
      setSiteDataUsage(await getCurrentSiteDataUsage())
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

  useExternalSync(() => {
    if (!open || focusSection !== 'generationConcurrency') return
    const scrollTimer = window.setTimeout(() => {
      generationConcurrencyRef.current?.scrollIntoView({ block: 'center' })
    }, 0)
    return () => {
      window.clearTimeout(scrollTimer)
    }
  }, [focusSection, open])

  useExternalSync(() => {
    if (!open) return
    let cancelled = false
    void getCurrentSiteDataUsage()
      .then((usage) => {
        if (!cancelled) setSiteDataUsage(usage)
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

  const handleRefreshSiteDataUsageClick = () => {
    refreshSiteDataUsage().catch(() => undefined)
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
        className="relative flex max-h-[min(760px,calc(100dvh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-lg)] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{t('settings.title')}</h2>
            <p className="mt-0.5 text-sm text-(--color-text-3)">{t('settings.description')}</p>
          </div>
          <button type="button" onClick={handleClose} className="icon-btn" aria-label={t('common.close')}>
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-2">
          <div>
            <SettingsSection title={t('settings.apiKeys.title')} description={t('settings.apiKeys.description')}>
              <ApiKeysSettings googleKey={googleKey} openaiKey={openaiKey} variant="embedded" />
            </SettingsSection>

            <SettingsSection title={t('settings.appearance.title')} description={t('settings.appearance.description')}>
              <div className="space-y-3">
                <div>
                  <div className="label mb-1.5 px-1">{t('settings.language.label')}</div>
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

                <div>
                  <div className="label mb-1.5 px-1">{t('settings.theme.label')}</div>
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

                <div>
                  <div className="label mb-1.5 px-1">{t('settings.colorTheme.label')}</div>
                  <div className="grid grid-cols-9 gap-2 sm:w-[316px]">
                    {COLOR_THEMES.map((ct) => {
                      const swatch = ct.id === 'mono' ? (isDark ? '#f2f1ef' : '#1f1d1a') : ct.color
                      return (
                        <button
                          key={ct.id}
                          type="button"
                          title={ct.name}
                          aria-label={ct.name}
                          onClick={() => onColorThemeChange(ct.id)}
                          className="aspect-square rounded-[var(--radius-sm)] transition-all"
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
                  fonts={SANS_FONT_CHOICES}
                  value={sansFont}
                  sample={
                    <>
                      <span className="font-semibold">Image2</span> Render 3:1 · 4K
                    </>
                  }
                  onChange={onSansFontChange}
                />
              </div>
            </SettingsSection>

            <div
              ref={generationConcurrencyRef}
              className={open && focusSection === 'generationConcurrency' ? 'settings-focus-pulse' : undefined}
            >
              <SettingsSection
                title={t('settings.generationConcurrency.title')}
                description={t('settings.generationConcurrency.description')}
              >
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
                        {choice.suffixKey ? ` ${t(choice.suffixKey)}` : null}
                      </span>
                    </button>
                  ))}
                </div>
              </SettingsSection>
            </div>

            <SettingsSection title={t('settings.data.title')} description={t('settings.data.description')}>
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
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleRefreshSiteDataUsageClick()
                  }}
                  disabled={effectiveSiteDataUsageLoading || clearDataBusy}
                  className="chip shrink-0"
                >
                  <Icon name="refresh" size={12} />{' '}
                  {effectiveSiteDataUsageLoading ? t('settings.data.calculatingShort') : t('common.refresh')}
                </button>
              </div>
              {siteDataUsage?.browserEstimateBytes !== null && siteDataUsage?.browserEstimateBytes !== undefined && (
                <div className="mt-1 text-sm text-(--color-text-3)">
                  {t('settings.data.browserEstimate', { size: formatBytes(siteDataUsage.browserEstimateBytes) })}
                  {siteDataUsage.quotaBytes
                    ? t('settings.data.quota', { size: formatBytes(siteDataUsage.quotaBytes) })
                    : ''}
                </div>
              )}
              {siteDataUsageError && (
                <div className="mt-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                  {siteDataUsageError}
                </div>
              )}
              <p className="mt-4 text-sm leading-relaxed text-(--color-text-3)">
                {t('settings.data.clearDescription')}
              </p>
              {clearDataError && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-danger)' }}>
                  {clearDataError}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
            </SettingsSection>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
      <div className="label mb-1.5 px-1">{label}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="py-4 shadow-[inset_0_-1px_0_var(--ring-edge-soft)] last:shadow-none">
      <div className="mb-3 max-w-xl">
        <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-(--color-text)">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-(--color-text-3)">{description}</p>
      </div>
      {children}
    </section>
  )
}
