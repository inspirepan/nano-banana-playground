import type { ComposerSubmitMode } from '../../config/composerSubmitMode'
import { useComposerSubmitMode } from '../../hooks/useComposerSubmitMode'
import { useI18n } from '../../i18n'
import { isApplePlatform } from '../../lib/keyboard'
import { CardChoice, type CardChoiceOption } from './CardChoice'
import { Segmented, type SegmentedOption } from './Segmented'
import { SettingsField } from './SettingsField'

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

type GenerationSettingsTabProps = {
  generationConcurrency: number
  onGenerationConcurrencyChange: (value: number) => void
}

export function GenerationSettingsTab({
  generationConcurrency,
  onGenerationConcurrencyChange,
}: GenerationSettingsTabProps) {
  const { t } = useI18n()
  const { composerSubmitMode, setComposerSubmitMode } = useComposerSubmitMode()
  const submitShortcut = `${isApplePlatform() ? 'Command' : 'Ctrl'}+Enter`

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

  return (
    <div className="space-y-5 px-5 py-4">
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
  )
}
