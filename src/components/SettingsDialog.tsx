import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { ApiKeysSettings, type KeyHook } from './ApiKeysDialog'
import { Icon, type IconName } from './Icon'
import { SANS_FONTS, type SansFontId } from '../config/fonts'
import { COLOR_THEMES, type ColorThemeId, type Theme } from '../config/theme'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import { clearCurrentSiteData, getCurrentSiteDataUsage, type SiteDataUsage } from '../lib/siteData'

const BRIGHTNESS: { value: Theme; icon: IconName; label: string }[] = [
  { value: 'light', icon: 'light_mode', label: '浅色' },
  { value: 'dark', icon: 'dark_mode', label: '深色' },
  { value: 'system', icon: 'contrast', label: '系统' },
]

const SANS_FONT_CHOICES = SANS_FONTS

const GENERATION_CONCURRENCY_CHOICES = [
  { value: 1, label: '1', suffix: '张' },
  { value: 2, label: '2', suffix: '张' },
  { value: 3, label: '3', suffix: '张' },
  { value: 4, label: '4', suffix: '张' },
  { value: 999, label: '不限' },
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
  generationConcurrency: number
  focusSection?: 'generationConcurrency' | null
  onThemeChange: (theme: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
  onSansFontChange: (id: SansFontId) => void
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
  generationConcurrency,
  focusSection,
  onThemeChange,
  onColorThemeChange,
  onSansFontChange,
  onGenerationConcurrencyChange,
  onClose,
}: Props) {
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
      setSiteDataUsageError(error instanceof Error ? error.message : '无法读取当前数据大小。')
    } finally {
      setSiteDataUsageLoading(false)
    }
  }, [])

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
        if (!cancelled) setSiteDataUsageError(error instanceof Error ? error.message : '无法读取当前数据大小。')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleClearSiteData = async () => {
    if (clearDataBusy) return
    setClearDataBusy(true)
    setClearDataError(null)
    try {
      await clearCurrentSiteData()
      window.location.replace(`${window.location.origin}${window.location.pathname}`)
    } catch (error) {
      setClearDataError(error instanceof Error ? error.message : '清空失败，请刷新后重试。')
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
        aria-label="设置"
        className="relative flex max-h-[min(760px,calc(100dvh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-[10px] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">设置</h2>
            <p className="mt-0.5 text-sm text-(--color-text-3)">管理密钥、外观和生成队列行为</p>
          </div>
          <button type="button" onClick={handleClose} className="icon-btn" aria-label="关闭">
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-2">
          <div>
            <SettingsSection title="接口密钥" description="配置浏览器本地保存的 Gemini 和 OpenAI 访问密钥。">
              <ApiKeysSettings googleKey={googleKey} openaiKey={openaiKey} variant="embedded" />
            </SettingsSection>

            <SettingsSection title="外观" description="选择明暗模式和界面主色。">
              <div className="space-y-3">
                <div>
                  <div className="label mb-1.5 px-1">模式</div>
                  <div
                    className="segmented"
                    style={{
                      ['--seg-count' as string]: BRIGHTNESS.length,
                      ['--seg-index' as string]: BRIGHTNESS.findIndex((item) => item.value === theme),
                    }}
                  >
                    {BRIGHTNESS.map(({ value, icon, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onThemeChange(value)}
                        data-active={theme === value}
                      >
                        <Icon name={icon} size={12} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="label mb-1.5 px-1">主色</div>
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
                          className="aspect-square rounded-[6px] transition-all"
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
                  label="正文字体"
                  fonts={SANS_FONT_CHOICES}
                  value={sansFont}
                  sample={
                    <>
                      <span className="font-semibold">Image2</span> 3:1 4K
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
                title="同时生成的最大并发数"
                description="控制一次最多同时生成几张图。数字越大，排队更少，但更容易遇到接口限流。"
              >
                <div
                  className="segmented sm:w-[292px]"
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
                        <span className="text-base">{choice.label}</span>
                        {choice.suffix ? ` ${choice.suffix}` : null}
                      </span>
                    </button>
                  ))}
                </div>
              </SettingsSection>
            </div>

            <SettingsSection title="数据" description="清空当前站点保存在此浏览器里的所有数据。">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="label mb-1">当前占用</div>
                  <div className="text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
                    {siteDataUsage
                      ? formatBytes(siteDataUsage.totalBytes)
                      : effectiveSiteDataUsageLoading
                        ? '计算中…'
                        : '未知'}
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
                  <Icon name="refresh" size={12} /> {effectiveSiteDataUsageLoading ? '计算中' : '刷新'}
                </button>
              </div>
              {siteDataUsage?.browserEstimateBytes !== null && siteDataUsage?.browserEstimateBytes !== undefined && (
                <div className="mt-1 text-sm text-(--color-text-4)">
                  浏览器估算 {formatBytes(siteDataUsage.browserEstimateBytes)}
                  {siteDataUsage.quotaBytes ? ` / 可用 ${formatBytes(siteDataUsage.quotaBytes)}` : ''}
                </div>
              )}
              {siteDataUsageError && (
                <div className="mt-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                  {siteDataUsageError}
                </div>
              )}
              <p className="mt-4 text-sm leading-relaxed text-(--color-text-3)">
                会删除 API Key、外观设置、生成历史、参考图、缓存、当前 URL 编辑态，以及旧版 IndexedDB
                数据。清空后页面会重新加载。
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
                      <Icon name="trash" size={12} /> {clearDataBusy ? '清空中…' : '确认清空'}
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
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClearDataConfirm(true)}
                    disabled={clearDataBusy}
                    className="chip danger"
                  >
                    <Icon name="trash" size={12} /> 清空数据
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
            className="rounded-[6px] bg-(--color-surface) px-3 py-2 text-left transition-colors hover:bg-(--color-surface-2)"
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
