import type { ComposerSubmitMode } from '../../config/composerSubmitMode'
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../../config/languages'
import type { Theme } from '../../config/theme'
import { useComposerSubmitMode } from '../../hooks/useComposerSubmitMode'
import { useStripDownloadMetadata } from '../../hooks/useStripDownloadMetadata'
import { useI18n } from '../../i18n'
import { isApplePlatform } from '../../lib/keyboard'
import { type IconName } from '../Icon'
import { CardChoice, type CardChoiceOption } from './CardChoice'
import { Segmented, type SegmentedOption } from './Segmented'
import { SettingsField } from './SettingsField'
import { SettingsSection } from './SettingsSection'

const BRIGHTNESS: { value: Theme; icon: IconName; labelKey: string }[] = [
  { value: 'light', icon: 'light_mode', labelKey: 'settings.theme.light' },
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

const COMPOSER_SUBMIT_MODE_CHOICES: { value: ComposerSubmitMode; labelKey: string; descriptionKey: string }[] = [
  {
    value: 'cmdEnter',
    labelKey: 'settings.composerSubmitMode.cmdEnter.label',
    descriptionKey: 'settings.composerSubmitMode.cmdEnter.description',
  },
  {
    value: 'enter',
    labelKey: 'settings.composerSubmitMode.enter.label',
    descriptionKey: 'settings.composerSubmitMode.enter.description',
  },
]

type GeneralSettingsTabProps = {
  theme: Theme
  language: LanguagePreference
  generationConcurrency: number
  onThemeChange: (theme: Theme) => void
  onLanguageChange: (id: LanguagePreference) => void
  onGenerationConcurrencyChange: (value: number) => void
}

export function GeneralSettingsTab({
  theme,
  language,
  generationConcurrency,
  onThemeChange,
  onLanguageChange,
  onGenerationConcurrencyChange,
}: GeneralSettingsTabProps) {
  const { t, language: resolvedLanguage } = useI18n()
  const { composerSubmitMode, setComposerSubmitMode } = useComposerSubmitMode()
  const { stripDownloadMetadata, setStripDownloadMetadata } = useStripDownloadMetadata()
  const submitShortcut = `${isApplePlatform() ? 'Command' : 'Ctrl'}+Enter`

  const languageOptions: SegmentedOption<LanguagePreference>[] = LANGUAGE_PREFERENCES.map((item) => ({
    value: item.id,
    label: item.label[resolvedLanguage],
  }))

  const themeOptions: SegmentedOption<Theme>[] = BRIGHTNESS.map((item) => ({
    value: item.value,
    label: t(item.labelKey),
    icon: item.icon,
  }))

  const concurrencyOptions: SegmentedOption<number>[] = GENERATION_CONCURRENCY_CHOICES.map((choice) => {
    const head = choice.labelKey ? t(choice.labelKey) : choice.label
    const suffix = choice.suffixKey ? t(choice.suffixKey) : ''
    return {
      value: choice.value,
      label: suffix ? `${head} ${suffix}` : head,
    }
  })

  const submitOptions: CardChoiceOption<ComposerSubmitMode>[] = COMPOSER_SUBMIT_MODE_CHOICES.map((choice) => ({
    value: choice.value,
    title: t(choice.labelKey, { shortcut: submitShortcut }),
    description: t(choice.descriptionKey),
  }))

  const handleStripMetadataChange = () => {
    setStripDownloadMetadata(!stripDownloadMetadata)
  }

  return (
    <div className="space-y-5 px-5 py-4">
      <SettingsSection label={t('settings.appearance.title')} hint={t('settings.appearance.description')}>
        <div className="space-y-4">
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
      </SettingsSection>

      <SettingsSection label={t('settings.generation.title')} hint={t('settings.generation.description')} divider>
        <div className="space-y-4">
          <SettingsField
            label={t('settings.generationConcurrency.title')}
            hint={t('settings.generationConcurrency.description')}
          >
            <Segmented
              options={concurrencyOptions}
              value={generationConcurrency}
              onChange={onGenerationConcurrencyChange}
              ariaLabel={t('settings.generationConcurrency.title')}
            />
          </SettingsField>

          <SettingsField
            label={t('settings.composerSubmitMode.title')}
            hint={t('settings.composerSubmitMode.description', { shortcut: submitShortcut })}
          >
            <CardChoice
              options={submitOptions}
              value={composerSubmitMode}
              onChange={setComposerSubmitMode}
              ariaLabel={t('settings.composerSubmitMode.title')}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection label={t('settings.download.title')} hint={t('settings.download.description')} divider>
        <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] bg-(--color-surface-2) p-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          <div className="min-w-0">
            <div className="text-sm font-medium text-(--color-text)">{t('settings.download.stripMetadata.label')}</div>
            <div className="mt-1 max-w-[60ch] text-sm leading-relaxed text-(--color-text-3)">
              {t('settings.download.stripMetadata.hint')}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={stripDownloadMetadata}
            aria-label={t('settings.download.stripMetadata.label')}
            onClick={handleStripMetadataChange}
            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-150 ${
              stripDownloadMetadata
                ? 'bg-(--color-accent) shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,#000_10%)]'
                : 'bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge)]'
            }`}
          >
            <span
              className={`pointer-events-none my-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                stripDownloadMetadata ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </SettingsSection>
    </div>
  )
}
