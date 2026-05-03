import { useI18n } from '../../i18n'

const GENERATION_CONCURRENCY_CHOICES = [
  { value: 1, label: '1', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 2, label: '2', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 3, label: '3', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 4, label: '4', suffixKey: 'settings.generationConcurrency.imageSuffix' },
  { value: 999, labelKey: 'settings.generationConcurrency.unlimited' },
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

  return (
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
    </div>
  )
}
