import type { ComposerSubmitMode } from '../../config/composerSubmitMode'
import { useComposerSubmitMode } from '../../hooks/useComposerSubmitMode'
import { useI18n } from '../../i18n'

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

  return (
    <div className="space-y-5 px-5 py-4">
      <div>
        <div className="label mb-1.5">{t('settings.generationConcurrency.title')}</div>
        <p className="mb-2.5 text-sm leading-relaxed text-(--color-text-3)">
          {t('settings.generationConcurrency.description')}
        </p>
        <div className="pl-1">
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

      <div>
        <div className="label mb-1.5">{t('settings.composerSubmitMode.title')}</div>
        <p className="mb-2.5 text-sm leading-relaxed text-(--color-text-3)">
          {t('settings.composerSubmitMode.description')}
        </p>
        <div className="grid gap-2 pl-1 sm:grid-cols-2">
          {COMPOSER_SUBMIT_MODE_CHOICES.map((choice) => {
            const active = composerSubmitMode === choice.value
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => setComposerSubmitMode(choice.value)}
                data-active={active || undefined}
                className="flex flex-col items-start gap-1 rounded-[var(--radius-sm)] bg-(--color-surface) px-3 py-2 text-left transition-colors hover:bg-(--color-surface-2)"
                style={{
                  boxShadow: active ? 'inset 0 0 0 1.5px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge-soft)',
                }}
              >
                <span className="text-sm font-medium text-(--color-text)">{t(choice.labelKey)}</span>
                <span className="text-sm text-(--color-text-3)">{t(choice.descriptionKey)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
