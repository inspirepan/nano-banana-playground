import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../../config/languages'
import { COLOR_THEMES, type ColorThemeId, type Theme } from '../../config/theme'
import { useI18n } from '../../i18n'
import { type IconName } from '../Icon'
import { Segmented, type SegmentedOption } from './Segmented'
import { SettingsField } from './SettingsField'

const BRIGHTNESS: { value: Theme; icon: IconName; labelKey: string }[] = [
  { value: 'light', icon: 'light_mode', labelKey: 'settings.theme.light' },
  { value: 'dark', icon: 'dark_mode', labelKey: 'settings.theme.dark' },
  { value: 'system', icon: 'contrast', labelKey: 'settings.theme.system' },
]

type AppearanceSettingsTabProps = {
  theme: Theme
  colorTheme: ColorThemeId
  language: LanguagePreference
  onThemeChange: (theme: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
  onLanguageChange: (id: LanguagePreference) => void
}

export function AppearanceSettingsTab({
  theme,
  colorTheme,
  language,
  onThemeChange,
  onColorThemeChange,
  onLanguageChange,
}: AppearanceSettingsTabProps) {
  const { t, language: resolvedLanguage } = useI18n()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const languageOptions: SegmentedOption<LanguagePreference>[] = LANGUAGE_PREFERENCES.map((item) => ({
    value: item.id,
    label: item.label[resolvedLanguage],
  }))

  const themeOptions: SegmentedOption<Theme>[] = BRIGHTNESS.map((item) => ({
    value: item.value,
    label: t(item.labelKey),
    icon: item.icon,
  }))

  return (
    <div className="space-y-4 px-5 py-4">
      <SettingsField label={t('settings.language.label')}>
        <Segmented
          options={languageOptions}
          value={language}
          onChange={onLanguageChange}
          ariaLabel={t('settings.language.label')}
        />
      </SettingsField>

      <SettingsField label={t('settings.theme.label')}>
        <Segmented
          options={themeOptions}
          value={theme}
          onChange={onThemeChange}
          ariaLabel={t('settings.theme.label')}
        />
      </SettingsField>

      <SettingsField label={t('settings.colorTheme.label')}>
        <div className="flex gap-2">
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
                className="h-7 w-7 rounded-[var(--radius-sm)] transition-[box-shadow,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.92]"
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
      </SettingsField>
    </div>
  )
}
