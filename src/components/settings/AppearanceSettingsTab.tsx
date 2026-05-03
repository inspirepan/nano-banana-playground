import type { ReactNode } from 'react'

import { SANS_FONTS, type SansFontId } from '../../config/fonts'
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../../config/languages'
import { COLOR_THEMES, type ColorThemeId, type Theme } from '../../config/theme'
import { useI18n } from '../../i18n'
import { Icon, type IconName } from '../Icon'

const BRIGHTNESS: { value: Theme; icon: IconName; labelKey: string }[] = [
  { value: 'light', icon: 'light_mode', labelKey: 'settings.theme.light' },
  { value: 'warm', icon: 'palette', labelKey: 'settings.theme.warm' },
  { value: 'dark', icon: 'dark_mode', labelKey: 'settings.theme.dark' },
  { value: 'system', icon: 'contrast', labelKey: 'settings.theme.system' },
]

type AppearanceSettingsTabProps = {
  theme: Theme
  colorTheme: ColorThemeId
  sansFont: SansFontId
  language: LanguagePreference
  onThemeChange: (theme: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
  onSansFontChange: (id: SansFontId) => void
  onLanguageChange: (id: LanguagePreference) => void
}

export function AppearanceSettingsTab({
  theme,
  colorTheme,
  sansFont,
  language,
  onThemeChange,
  onColorThemeChange,
  onSansFontChange,
  onLanguageChange,
}: AppearanceSettingsTabProps) {
  const { t, language: resolvedLanguage } = useI18n()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
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
              <button key={value} type="button" onClick={() => onThemeChange(value)} data-active={theme === value}>
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
            const swatch =
              ct.id === 'mono'
                ? isDark
                  ? '#f2f1ef'
                  : '#1f1d1a'
                : ct.id === 'default'
                  ? isDark
                    ? '#6875f5'
                    : '#1e4fa8'
                  : ct.color
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
