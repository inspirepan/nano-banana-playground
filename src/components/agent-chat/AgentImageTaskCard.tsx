import { TruncatedText } from './TruncatedText'
import { summarizeToolResult, taskStatusLabel } from './utils'
import type { AgentImageTask, AgentMessageToolCall, AgentMessageToolResult } from '../../agent'
import { MODEL_CONFIGS } from '../../config/models'
import { useImageSrc } from '../../hooks/useImageSrc'
import { useI18n } from '../../i18n'

function GenImageResultThumb({ id }: { id: string }) {
  const { ref, src } = useImageSrc(id, 'image/png', undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
    >
      {src ? (
        <img src={src} alt={id} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-(--color-text-4)">
          <span className="spinner" style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  )
}

export function AgentImageTaskCard({
  call,
  task,
  result,
  onApprove,
  onCancel,
  onFocus,
}: {
  call: AgentMessageToolCall
  task: AgentImageTask | undefined
  result?: AgentMessageToolResult
  onApprove: (taskId: string) => void
  onCancel: (taskId: string) => void
  onFocus?: (task: AgentImageTask) => void
}) {
  const { t } = useI18n()
  const status: AgentImageTask['status'] = task?.status ?? (result?.isError ? 'failed' : 'pending_approval')
  const danger = status === 'failed' || status === 'rejected' || status === 'canceled'
  const active = status === 'queued' || status === 'running'
  const reservedIds = task?.request.reservedImageIds ?? []
  const modelName = task
    ? (MODEL_CONFIGS.find((item) => item.id === task.request.modelId)?.name ?? task.request.modelId)
    : null
  const requestedFromArgs = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : undefined
  const requestedCountFromArgs = typeof call.arguments.n === 'number' ? call.arguments.n : 1
  const promptFromArgs = typeof call.arguments.prompt === 'string' ? call.arguments.prompt : ''
  const headerIds = reservedIds.length > 0 ? reservedIds : requestedFromArgs ? [requestedFromArgs] : []
  const promptText = task?.request.prompt ?? promptFromArgs
  const referenceIds = task?.request.referenceImageIds ?? []
  const resultIds = task?.resultImageIds ?? []
  const showApprove = task ? task.status === 'pending_approval' : false
  const showCancel = task
    ? task.status === 'pending_approval' ||
      task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved'
    : false
  const statusColor = danger ? 'var(--color-danger)' : active ? 'var(--color-accent)' : 'var(--color-text-3)'
  const canFocus = Boolean(
    onFocus &&
    task &&
    (task.request.stackId || task.generationJobId) &&
    (task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved' ||
      task.status === 'completed'),
  )
  const handleCardClick = canFocus && task ? () => onFocus?.(task) : undefined

  return (
    <div
      role={canFocus ? 'button' : undefined}
      tabIndex={canFocus ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={
        canFocus
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleCardClick?.()
              }
            }
          : undefined
      }
      className={`rounded-[var(--radius-md)] bg-(--color-surface) px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${canFocus ? 'cursor-pointer transition-colors duration-150 hover:bg-(--color-surface-2)' : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-sm font-semibold text-(--color-text)">{t('agentChat.imageTask.title')}</span>
        <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: statusColor }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
          {taskStatusLabel(status)}
        </span>
        {active && <span className="spinner" style={{ width: 10, height: 10 }} />}
        {headerIds.length > 0 && (
          <span className="mono ml-auto min-w-0 truncate text-sm text-(--color-text-4)" title={headerIds.join(', ')}>
            {headerIds.join(', ')}
          </span>
        )}
      </div>

      {promptText && task?.status !== 'completed' && (
        <TruncatedText
          text={promptText}
          className="mt-2.5 whitespace-pre-wrap text-sm leading-[1.62] text-(--color-text-2)"
          fadeColor="var(--color-surface)"
          maxHeight={140}
        />
      )}

      {task?.status !== 'completed' && (task || requestedFromArgs) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {modelName && (
            <span className="min-w-0">
              <span className="text-(--color-text-3)">{t('agentChat.imageTask.model')}</span>
              <span className="text-(--color-text)">{modelName}</span>
            </span>
          )}
          {task && (
            <>
              <span>
                <span className="text-(--color-text-3)">{t('agentChat.imageTask.size')}</span>
                <span className="text-(--color-text) tabular-nums">
                  {task.request.resolution} · {task.request.aspectRatio}
                </span>
              </span>
              <span>
                <span className="text-(--color-text-3)">{t('agentChat.imageTask.count')}</span>
                <span className="text-(--color-text) tabular-nums">
                  {t('agentChat.imageTask.countValue', { count: task.request.batchCount })}
                </span>
              </span>
            </>
          )}
          {!task && (
            <>
              {requestedFromArgs && (
                <span className="min-w-0 truncate" title={requestedFromArgs}>
                  <span className="text-(--color-text-3)">{t('agentChat.imageTask.target')}</span>
                  <span className="mono text-(--color-text)">{requestedFromArgs}</span>
                </span>
              )}
              <span>
                <span className="text-(--color-text-3)">{t('agentChat.imageTask.count')}</span>
                <span className="text-(--color-text)">
                  {t('agentChat.imageTask.countValue', { count: requestedCountFromArgs })}
                </span>
              </span>
            </>
          )}
          {referenceIds.length > 0 && (
            <span className="min-w-0 truncate" title={referenceIds.join(', ')}>
              <span className="text-(--color-text-3)">{t('agentChat.imageTask.reference')}</span>
              <span className="mono text-(--color-text)">{referenceIds.join(', ')}</span>
            </span>
          )}
        </div>
      )}

      {resultIds.length > 0 && (
        <div
          className="mt-3 grid gap-1.5"
          style={{
            gridTemplateColumns:
              task?.status === 'completed'
                ? `repeat(${Math.min(resultIds.length, 3)}, minmax(0, 1fr))`
                : 'repeat(auto-fill, minmax(72px, 1fr))',
          }}
        >
          {resultIds.map((id) => (
            <GenImageResultThumb key={id} id={id} />
          ))}
        </div>
      )}

      {task?.error && (
        <div className="mt-2.5 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {task.error}
        </div>
      )}
      {!task && result?.isError && (
        <div className="mt-2.5 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {summarizeToolResult(result)}
        </div>
      )}

      {(showApprove || showCancel) && task && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {showApprove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onApprove(task.id)
              }}
              className="chip text-sm"
              data-active
              style={{ height: 28, padding: '0 12px' }}
            >
              {t('common.generate')}
            </button>
          )}
          {showCancel && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onCancel(task.id)
              }}
              className="chip danger text-sm"
              style={{ height: 28, padding: '0 12px' }}
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
