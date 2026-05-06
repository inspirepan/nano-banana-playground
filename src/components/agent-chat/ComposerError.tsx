import { useI18n } from '../../i18n'
import { Icon } from '../Icon'
import { formatAgentError } from './errorText'

export function ComposerError({
  error,
  attachmentError,
  onClearAttachmentError,
}: {
  error: string | null
  attachmentError: string | null
  onClearAttachmentError: () => void
}) {
  const { t } = useI18n()
  const displayError = error ? formatAgentError(error, t) : null

  if (!error && !attachmentError) return null

  return (
    <div
      className="mb-2 rounded-[var(--radius-md)] px-3 py-2 text-sm leading-[1.45]"
      style={{ color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
    >
      <div className="flex items-start gap-2">
        <Icon name="alert_circle" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
        <div className="min-w-0 flex-1 whitespace-pre-wrap">{attachmentError ?? displayError}</div>
        {attachmentError && (
          <button
            type="button"
            onClick={onClearAttachmentError}
            className="text-sm opacity-75 transition-opacity hover:opacity-100"
          >
            {t('common.close')}
          </button>
        )}
      </div>
    </div>
  )
}
