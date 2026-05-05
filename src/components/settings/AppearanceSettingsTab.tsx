import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../../config/languages'
import type { Theme } from '../../config/theme'
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
  language: LanguagePreference
  onThemeChange: (theme: Theme) => void
  onLanguageChange: (id: LanguagePreference) => void
}

export function AppearanceSettingsTab({
  theme,
  language,
  onThemeChange,
  onLanguageChange,
}: AppearanceSettingsTabProps) {
  const { t, language: resolvedLanguage } = useI18n()

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
    </div>
  )
}
