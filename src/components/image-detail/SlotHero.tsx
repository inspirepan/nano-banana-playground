import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'

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
    ? slot.attemptErrors
        .map((item) => t('imageDetail.queue.attemptError', { attempt: item.attempt, error: item.error }))
        .join('\n')
    : (slot?.error ?? (slot?.status === 'canceled' ? t('imageDetail.queue.canceledDetail') : null))
  const showKeepPageOpenNote = slot && ['queued', 'running', 'retrying'].includes(slot.status)
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
      {detail && (
        <div className="max-w-[56ch] whitespace-pre-wrap text-sm leading-[1.5] text-pretty text-(--color-text-2)">
          {detail}
        </div>
      )}
      {slot &&
        job &&
        (slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying') &&
        (job.slots.length === 1 ? (
          <button type="button" className="chip danger mt-2" onClick={() => onCancelSlot(slot.id)}>
            {t('common.cancel')}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="chip danger" onClick={() => onCancelSlot(slot.id)}>
              {t('imageDetail.queue.cancelCurrent')}
            </button>
            <button type="button" className="chip ghost" onClick={() => onCancelJob(job.id)}>
              {t('imageDetail.queue.cancelAll')}
            </button>
          </div>
        ))}
      {slot && job && (slot.status === 'failed' || slot.status === 'canceled') && (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" className="chip" onClick={onRetry} title={t('imageDetail.action.retryOriginal')}>
            <Icon name="refresh" size={12} strokeWidth={1.8} />
            {t('common.retry')}
          </button>
          <button type="button" className="chip ghost" onClick={() => onDismissJob(job.id)}>
            {t('imageDetail.action.closeTask')}
          </button>
        </div>
      )}
    </div>
  )
}
