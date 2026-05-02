import { useLayoutEffect, useRef, useState } from 'react'

import { summarizeToolResult, taskStatusLabel } from './utils'
import type { AgentImageTask, AgentMessageToolCall, AgentMessageToolResult } from '../../agent'
import { MODEL_CONFIGS } from '../../config/models'
import { useImageSrc } from '../../hooks/useImageSrc'
import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { StackItemThumb } from '../StackItemThumb'

const PROMPT_BOX_MAX_HEIGHT = 148

function GenImageResultThumb({ id, flush = false }: { id: string; flush?: boolean }) {
  const { ref, src } = useImageSrc(id, 'image/png', undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      className={`relative aspect-square w-full overflow-hidden bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${flush ? 'rounded-none' : 'rounded-[var(--radius-md)]'}`}
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

function AgentImagePromptBox({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflowing(el.scrollHeight > PROMPT_BOX_MAX_HEIGHT + 4)
    if (isStreaming && !expanded) {
      el.scrollTop = el.scrollHeight
    }
  }, [expanded, isStreaming, text])

  return (
    <div className="mt-2.5">
      <div
        ref={ref}
        className="whitespace-pre-wrap rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 py-2 text-sm leading-[1.62] text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
        style={expanded ? undefined : { maxHeight: PROMPT_BOX_MAX_HEIGHT, overflowY: 'auto' }}
      >
        {text}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((prev) => !prev)
          }}
          className="mt-1.5 bg-transparent p-0 text-sm text-(--color-text-3) transition-colors hover:text-(--color-text)"
        >
          {expanded ? t('agentChat.truncated.collapse') : t('agentChat.truncated.expand')}
        </button>
      )}
    </div>
  )
}

export function AgentImageTaskCard({
  call,
  task,
  stackItemByImageId,
  result,
  isStreaming,
  autoApproveImageTasks,
  onApprove,
  onCancel,
  onToggleAutoApproveImageTasks,
  onFocus,
}: {
  call: AgentMessageToolCall
  task: AgentImageTask | undefined
  stackItemByImageId: Map<string, StackItem>
  result?: AgentMessageToolResult
  isStreaming: boolean
  autoApproveImageTasks: boolean
  onApprove: (taskId: string) => void
  onCancel: (taskId: string) => void
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onFocus?: (task: AgentImageTask) => void
}) {
  const { t } = useI18n()
  const isComposingPrompt = isStreaming && !task && !result
  const status: AgentImageTask['status'] = task?.status ?? (result?.isError ? 'failed' : 'pending_approval')
  const danger = status === 'failed' || status === 'rejected' || status === 'canceled'
  const active = isComposingPrompt || status === 'queued' || status === 'running'
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
  const taskDetail = task?.error
    ? task.error
    : task?.status === 'rejected'
      ? t('agentChat.imageTask.rejectedDetail')
      : task?.status === 'canceled'
        ? t('agentChat.imageTask.canceledDetail')
        : undefined
  const showApprove = task ? task.status === 'pending_approval' : false
  const showCancel = task
    ? task.status === 'pending_approval' ||
      task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved'
    : false
  const statusColor = danger ? 'var(--color-danger)' : active ? 'var(--color-accent)' : 'var(--color-text-3)'
  const statusText = isComposingPrompt ? t('agentChat.taskStatus.prompting') : taskStatusLabel(status)
  const resultMetaBadge =
    task && modelName ? `${modelName} · ${task.request.resolution} · ${task.request.aspectRatio}` : undefined
  const resultsEdgeToEdge = task?.status === 'completed'
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
      className={`m-1 max-w-[560px] rounded-[var(--radius-lg)] bg-(--color-surface) px-3.5 py-3 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)] ${canFocus ? 'cursor-pointer transition-[background-color,box-shadow] duration-150 hover:bg-[color-mix(in_srgb,var(--color-surface-2)_50%,var(--color-surface))] hover:shadow-[0_0_0_1px_var(--ring-edge-strong),var(--shadow-lift)]' : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-sm font-semibold text-(--color-text)">{t('agentChat.imageTask.title')}</span>
        <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: statusColor }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
          {statusText}
        </span>
        {active && <span className="spinner" style={{ width: 10, height: 10 }} />}
        {headerIds.length > 0 && (
          <span className="mono ml-auto min-w-0 truncate text-sm text-(--color-text-4)" title={headerIds.join(', ')}>
            {headerIds.join(', ')}
          </span>
        )}
      </div>

      {promptText && task?.status !== 'completed' && (
        <AgentImagePromptBox text={promptText} isStreaming={isComposingPrompt} />
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
          className={
            resultsEdgeToEdge
              ? '-mx-3.5 -mb-3 mt-3 grid gap-px overflow-hidden rounded-b-[var(--radius-lg)] bg-(--ring-edge-soft) shadow-[inset_0_1px_0_var(--ring-edge-soft)]'
              : 'mt-3 grid gap-1.5'
          }
          style={{
            gridTemplateColumns: resultsEdgeToEdge
              ? `repeat(${Math.min(resultIds.length, 3)}, minmax(0, 1fr))`
              : 'repeat(auto-fill, minmax(72px, 1fr))',
          }}
        >
          {resultIds.map((id, index) => {
            const item = stackItemByImageId.get(id)
            return item ? (
              <StackItemThumb
                key={id}
                item={item}
                number={index + 1}
                outerRing
                hoverLift={false}
                className="aspect-square w-full"
                roundedClassName={resultsEdgeToEdge ? 'rounded-none' : undefined}
                numberBadgeInset={6}
                metaBadge={resultMetaBadge}
                metaBadgeTitle={resultMetaBadge}
                onSelect={() => {
                  if (task && canFocus) onFocus?.(task)
                }}
              />
            ) : (
              <GenImageResultThumb key={id} id={id} flush={resultsEdgeToEdge} />
            )
          })}
        </div>
      )}

      {taskDetail && (
        <div className="mt-2.5 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {taskDetail}
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
          {showApprove && !autoApproveImageTasks && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleAutoApproveImageTasks(true)
                onApprove(task.id)
              }}
              className="chip flex items-center gap-1.5 text-sm"
              style={{ height: 28, padding: '0 12px' }}
              title={t('agentChat.imageTask.alwaysAutoApprove')}
            >
              <Icon name="circle_play" size={12} />
              <span>{t('agentChat.imageTask.alwaysAutoApprove')}</span>
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
