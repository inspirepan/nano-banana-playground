import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { ApiKeysSettings, type KeyHook } from './ApiKeysDialog'
import { Icon, type IconName } from './Icon'
import { COLOR_THEMES, type ColorThemeId, type Theme } from '../config/theme'

const BRIGHTNESS: { value: Theme; icon: IconName; label: string }[] = [
  { value: 'light', icon: 'light_mode', label: '浅色' },
  { value: 'dark', icon: 'dark_mode', label: '深色' },
  { value: 'system', icon: 'contrast', label: '系统' },
]

type Props = {
  open: boolean
  googleKey: KeyHook
  openaiKey: KeyHook
  theme: Theme
  colorTheme: ColorThemeId
  generationConcurrency: number
  onThemeChange: (theme: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
  onGenerationConcurrencyChange: (value: number) => void
  onClose: () => void
}

export function SettingsDialog({
  open,
  googleKey,
  openaiKey,
  theme,
  colorTheme,
  generationConcurrency,
  onThemeChange,
  onColorThemeChange,
  onGenerationConcurrencyChange,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        className="relative flex max-h-[min(760px,calc(100dvh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-[10px] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),0_10px_28px_-12px_rgba(30,27,20,0.18),0_2px_6px_rgba(30,27,20,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--color-border) px-5 py-4">
          <div>
            <h2 className="font-display text-[14px] font-semibold tracking-[-0.01em]">设置</h2>
            <p className="mt-0.5 text-[11.5px] text-(--color-text-3)">管理密钥、外观和生成队列行为</p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="关闭">
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <SettingsSection title="Provider" description="配置浏览器本地保存的 Gemini 和 OpenAI 访问密钥。">
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
                  <div className="grid grid-cols-7 gap-2 sm:w-[244px]">
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
                                : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="同时生成的最大并发数"
              description="控制一次最多同时生成几张图。数字越大，排队更少，但更容易遇到接口限流。"
            >
              <div
                className="segmented sm:w-[220px]"
                style={{
                  ['--seg-count' as string]: 4,
                  ['--seg-index' as string]: generationConcurrency - 1,
                }}
              >
                {[1, 2, 3, 4].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onGenerationConcurrencyChange(value)}
                    data-active={generationConcurrency === value}
                  >
                    <span>
                      <span className="mono text-[11px]">{value}</span> 张
                    </span>
                  </button>
                ))}
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
    <section className="card p-4">
      <div className="mb-3">
        <h3 className="font-display text-[13px] font-semibold tracking-[-0.01em] text-(--color-text)">{title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-(--color-text-3)">{description}</p>
      </div>
      {children}
    </section>
  )
}
