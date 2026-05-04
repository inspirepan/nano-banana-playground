import type { GenerationJob, GenerationSlot } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import { countSlots, formatTime, jobStatusLabel } from '../../lib/queueJobDisplay'
import type { PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'
import { ImageCard } from '../ImageCard'
import { ImageGrid, GridCell } from '../ImageGrid'

function StatusCard({ slot, onCancel }: { slot: GenerationSlot; onCancel: (slotId: string) => void }) {
  const { t } = useI18n()
  if (slot.status === 'failed') return <FailedCard slot={slot} />
  if (slot.status === 'canceled') return <CanceledCard index={slot.index} />

  const retrying = slot.status === 'retrying'
  const running = slot.status === 'running'
  const label = retrying
    ? t('imageDetail.queue.status.retrying')
    : running
      ? t('imageDetail.queue.status.generating')
      : t('imageDetail.queue.status.queued')
  const hint = retrying
    ? t('imageDetail.queue.attempt', { attempt: slot.attempt, max: slot.maxAttempts })
    : running
      ? t('imageDetail.queue.requestingModel')
      : t('imageDetail.queue.autoStart')

  return (
    <div
      className="w-full h-full rounded-[var(--radius-md)] overflow-hidden relative"
      style={{
        boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
        background: 'var(--color-surface-2)',
      }}
    >
      <button
        type="button"
        onClick={() => onCancel(slot.id)}
        className="absolute right-2 top-2 z-10 rounded-[var(--radius-sm)] px-2 py-1 text-base font-medium transition-colors"
        style={{
          color: 'var(--color-text-2)',
          background: 'color-mix(in srgb, var(--color-surface) 86%, transparent)',
          boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
        }}
      >
        {t('common.cancel')}
      </button>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-(--color-text-3)">
        {slot.status === 'queued' ? (
          <div className="h-2 w-2 rounded-full" style={{ background: 'var(--color-text-4)' }} />
        ) : (
          <span className="spinner" />
        )}
        <div className="text-sm text-(--color-text-3)">
          {label} #{slot.index + 1}
        </div>
        <div className="text-sm text-(--color-text-3)">{hint}</div>
        {retrying && slot.error && (
          <div className="max-h-[44px] overflow-y-auto break-words text-sm leading-[1.45] text-(--color-text-2)">
            {slot.error}
          </div>
        )}
      </div>
    </div>
  )
}

function FailedCard({ slot }: { slot: GenerationSlot }) {
  const { t } = useI18n()
  const attemptErrors = slot.attemptErrors?.length
    ? slot.attemptErrors
    : slot.error
      ? [{ attempt: slot.attempt, error: slot.error }]
      : []

  return (
    <div
      className="w-full h-full rounded-[var(--radius-md)] overflow-hidden relative"
      style={{
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 24%, transparent)',
        background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
      }}
    >
      <div className="absolute inset-0 flex flex-col gap-2 px-3 py-2.5 text-left">
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="w-4 h-4 rounded-full flex shrink-0 items-center justify-center text-base font-semibold leading-none"
            style={{
              background: 'color-mix(in srgb, var(--color-danger) 14%, transparent)',
              color: 'var(--color-danger)',
            }}
          >
            ×
          </div>
          <div className="text-base" style={{ color: 'var(--color-danger)' }}>
            {t('imageDetail.queue.failedIndexed', { index: slot.index + 1 })}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto text-sm leading-[1.55] break-words text-(--color-text-2) whitespace-pre-wrap">
          {attemptErrors.length > 0
            ? attemptErrors
                .map((item) => t('imageDetail.queue.attemptError', { attempt: item.attempt, error: item.error }))
                .join('\n')
            : t('imageDetail.queue.status.failed')}
        </div>
      </div>
    </div>
  )
}

function CanceledCard({ index }: { index: number }) {
  const { t } = useI18n()

  return (
    <div
      className="w-full h-full rounded-[var(--radius-md)] overflow-hidden relative"
      style={{
        boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
        background: 'var(--color-surface-2)',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-(--color-text-3)">
        <Icon name="close" size={14} strokeWidth={1.8} />
        <div className="text-base">{t('imageDetail.queue.status.canceledIndexed', { index: index + 1 })}</div>
        <div className="max-h-[44px] max-w-[80%] overflow-y-auto text-center text-sm leading-[1.45] text-(--color-text-3)">
          {t('imageDetail.queue.canceledDetail')}
        </div>
      </div>
    </div>
  )
}

export function QueueJobSection({
  job,
  onCancelJob,
  onDismissJob,
  onCancelSlot,
  onAddToRef,
  onEdit,
  onRegenerate,
  onRemove,
  onOpen,
  maxRowHeight,
}: {
  job: GenerationJob
  onCancelJob: (jobId: string) => void
  onDismissJob: (jobId: string) => void
  onCancelSlot: (slotId: string) => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onEdit?: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onRemove: (id: string) => void
  onOpen: (image: PlaygroundImageMeta) => void
  maxRowHeight?: number
}) {
  const { t } = useI18n()
  const counts = countSlots(job.slots)
  const active = counts.active > 0
  const dismissible = !active && (counts.failed > 0 || counts.canceled > 0)
  const statusColor = active ? 'var(--color-accent)' : counts.failed > 0 ? 'var(--color-danger)' : 'var(--color-text-3)'

  return (
    <div>
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-sm text-(--color-text-3)">{formatTime(job.createdAt, t)}</span>
          <span className="text-(--color-text-4)">·</span>
          <span className="whitespace-nowrap text-base font-medium text-(--color-text-2)">
            {job.request.model.name}
          </span>
          <span className="text-(--color-text-4)">·</span>
          <span className="whitespace-nowrap text-sm text-(--color-text-3) tabular-nums">
            {job.request.resolution} · {job.request.aspectRatio} · {job.slots.length}
          </span>
          <span className="text-(--color-text-4)">·</span>
          <span className="whitespace-nowrap text-base" style={{ color: statusColor }}>
            {jobStatusLabel(counts, t)}
          </span>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onCancelJob(job.id)}
            className="chip danger text-sm"
            style={{ height: 24, padding: '0 8px' }}
          >
            {t('imageDetail.queue.cancelAll')}
          </button>
        )}
        {dismissible && (
          <button
            type="button"
            onClick={() => onDismissJob(job.id)}
            className="chip ghost text-sm"
            style={{ height: 24, padding: '0 8px' }}
          >
            {t('common.close')}
          </button>
        )}
      </div>
      <ImageGrid maxRowHeight={maxRowHeight}>
        {job.slots.map((slot) => (
          <GridCell key={slot.id} aspectRatio={job.request.aspectRatio}>
            {slot.status === 'succeeded' && slot.image ? (
              <ImageCard
                image={slot.image}
                inlineData={slot.image.data}
                index={job.slots.length > 1 ? slot.index : undefined}
                actionMode="queue"
                onAddToRef={onAddToRef}
                onEdit={onEdit}
                onRegenerate={onRegenerate}
                onRemove={onRemove}
                onOpen={onOpen}
              />
            ) : (
              <StatusCard slot={slot} onCancel={onCancelSlot} />
            )}
          </GridCell>
        ))}
      </ImageGrid>
    </div>
  )
}
