import { useI18n } from '../../../i18n'
import { getPrimaryModifierKeyLabel } from '../../../lib/keyboard'
import { Icon } from '../../Icon'

type Props = {
  className: string
  estimatedCost: number | null
  submitError: string | null
  submitting: boolean
  canSubmit: boolean
  batchCount: number
  showSubmitShortcut: boolean
  onSubmit: () => void
}

export function EditFooterCta({
  className,
  estimatedCost,
  submitError,
  submitting,
  canSubmit,
  batchCount,
  showSubmitShortcut,
  onSubmit,
}: Props) {
  const { t } = useI18n()
  const primaryModifierKey = getPrimaryModifierKeyLabel()

  return (
    <div className={className}>
      {estimatedCost !== null && (
        <div className="mb-2 text-right text-sm text-(--color-text-2) tabular-nums">≈ ${estimatedCost.toFixed(3)}</div>
      )}
      {submitError && <div className="mb-2 text-sm text-(--color-danger)">{submitError}</div>}
      <button type="button" onClick={onSubmit} disabled={!canSubmit} className="cta w-full">
        <Icon name="wand" size={13} strokeWidth={1.8} />
        <span>
          {submitting
            ? t('imageDetail.editPrompt.submitting')
            : t('imageDetail.editPrompt.submit', { count: batchCount })}
        </span>
        <span className="flex-1" />
        {showSubmitShortcut && (
          <span className="hidden gap-0.5 md:flex">
            <kbd>{primaryModifierKey}</kbd>
            <kbd>⏎</kbd>
          </span>
        )}
      </button>
    </div>
  )
}
