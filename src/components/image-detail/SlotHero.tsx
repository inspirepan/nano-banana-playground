import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

export function SlotHero({
  item,
  onCancelSlot,
  onCancelJob,
  onDismissJob,
  onRetry,
}: {
  item: StackItem | null
  onCancelSlot: (slotId: string) => void
  onCancelJob: (jobId: string) => void
  onDismissJob: (jobId: string) => void
  onRetry: () => void
}) {
  const { t } = useI18n()
  const slot = item?.type === 'slot' ? item.slot : null
  const job = item?.type === 'slot' ? item.job : null
  const label =
    slot?.status === 'failed'
      ? t('imageDetail.queue.status.failed')
      : slot?.status === 'canceled'
        ? t('imageDetail.queue.status.canceled')
        : slot?.status === 'retrying'
          ? t('imageDetail.queue.status.retrying')
          : slot?.status === 'running'
            ? t('imageDetail.queue.status.generating')
            : t('imageDetail.queue.status.queued')
  const detail = slot?.attemptErrors?.length
    ? t('imageDetail.queue.latestError', {
        error: slot.attemptErrors[slot.attemptErrors.length - 1].error || t('common.unknown'),
      })
    : slot?.status === 'failed' && slot.error
      ? t('imageDetail.queue.latestError', { error: slot.error })
      : slot?.status === 'failed'
        ? t('imageDetail.queue.latestError', { error: t('common.unknown') })
        : (slot?.error ?? (slot?.status === 'canceled' ? t('imageDetail.queue.canceledDetail') : null))
  const showKeepPageOpenNote = slot && ['queued', 'running', 'retrying'].includes(slot.status)
  const detailColorClass = slot?.status === 'failed' ? 'text-(--color-danger)' : 'text-(--color-text-2)'
  const detailBoxClass =
    slot?.status === 'failed'
      ? 'w-full max-w-[56ch] rounded-[var(--radius-md)] bg-(--color-surface) px-3 py-2 text-left shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
      : 'max-w-[56ch]'
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-(--color-text-3)">
      {slot?.status === 'failed' || slot?.status === 'canceled' ? (
        <Icon name="close" size={16} strokeWidth={1.8} />
      ) : (
        <span className="spinner" />
      )}
      <div className="text-sm text-(--color-text-2)">{label}</div>
      {showKeepPageOpenNote && (
        <div className="text-sm text-(--color-text-3)">{t('imageDetail.queue.keepPageOpen')}</div>
      )}
      {detail && <div className={`copy-soft whitespace-pre-wrap ${detailColorClass} ${detailBoxClass}`}>{detail}</div>}
      {slot &&
        job &&
        (slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying') &&
        (job.slots.length === 1 ? (
          <button type="button" className="media-action danger mt-2 px-2" onClick={() => onCancelSlot(slot.id)}>
            {t('common.cancel')}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="media-action danger px-2" onClick={() => onCancelSlot(slot.id)}>
              {t('imageDetail.queue.cancelCurrent')}
            </button>
            <button type="button" className="media-action light px-2" onClick={() => onCancelJob(job.id)}>
              {t('imageDetail.queue.cancelAll')}
            </button>
          </div>
        ))}
      {slot && job && (slot.status === 'failed' || slot.status === 'canceled') && (
        <div className="mt-2 flex items-center gap-2">
          <Tooltip text={t('imageDetail.action.retryOriginal')} placement="top" className="inline-flex">
            <button type="button" className="media-action light px-2" onClick={onRetry}>
              <Icon name="refresh" size={11} strokeWidth={1.8} />
              {t('common.retry')}
            </button>
          </Tooltip>
          <button type="button" className="media-action light px-2" onClick={() => onDismissJob(job.id)}>
            {t('imageDetail.action.closeTask')}
          </button>
        </div>
      )}
    </div>
  )
}
