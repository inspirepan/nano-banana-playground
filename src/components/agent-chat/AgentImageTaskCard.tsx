import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import { summarizeToolResult } from './utils'
import type { AgentImageTask, AgentMessageToolCall, AgentMessageToolResult } from '../../agent'
import { MODEL_CONFIGS } from '../../config/models'
import { useImageSrc } from '../../hooks/useImageSrc'
import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { StackItemThumb } from '../StackItemThumb'
import type { AgentImageTaskFocusHandler } from './types'

const PROMPT_BOX_COLLAPSED_MAX_HEIGHT = 72

function GenImageResultThumb({ id, flush = false }: { id: string; flush?: boolean }) {
  const { t } = useI18n()
  const { ref, src, failed } = useImageSrc(id, 'image/png', undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      className={`relative aspect-square w-full overflow-hidden bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${flush ? 'rounded-none' : 'rounded-[var(--radius-md)]'}`}
    >
      {src ? (
        <img src={src} alt={id} className="h-full w-full object-cover" />
      ) : failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-(--color-text-4)">
          <Icon name="image_off" size={12} />
          <span style={{ fontSize: 10 }}>{t('agentChat.imageTask.deleted')}</span>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-(--color-text-4)">
          <span className="spinner" style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  )
}

function parseAspectRatioCss(value: string | undefined): string {
  if (!value) return '1 / 1'
  const match = value.match(/^(\d+)\s*:\s*(\d+)$/)
  if (!match) return '1 / 1'
  return `${match[1]} / ${match[2]}`
}

// Largest WxH box that fits within `max` on both sides for the given ratio.
function fitWithinBox(aspectRatioCss: string, max: number): { width: number; height: number } {
  const [w, h] = aspectRatioCss.split('/').map((part) => Number(part.trim()))
  if (!w || !h) return { width: max, height: max }
  const ratio = w / h
  if (ratio >= 1) return { width: max, height: Math.round(max / ratio) }
  return { width: Math.round(max * ratio), height: max }
}

function SkeletonSlot({
  flush = false,
  aspectRatio,
  compact = false,
}: {
  flush?: boolean
  aspectRatio?: string
  compact?: boolean
}) {
  const { t } = useI18n()
  return (
    <div
      className={`relative w-full overflow-hidden shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${flush ? 'rounded-none' : 'rounded-[var(--radius-sm)]'}`}
      style={{
        aspectRatio: aspectRatio ?? '1 / 1',
        background: 'repeating-linear-gradient(-45deg, var(--color-surface-2) 0 6px, var(--color-surface-3) 6px 12px)',
      }}
      title={
        compact ? `${t('imageDetail.queue.status.generating')} · ${t('imageDetail.queue.keepPageOpen')}` : undefined
      }
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-(--color-text-3)">
        <span className="spinner" style={{ width: 12, height: 12 }} />
        {!compact && (
          <>
            <span className="text-sm leading-[1.4]">{t('imageDetail.queue.status.generating')}</span>
            <span className="text-center text-xs leading-[1.35] text-(--color-text-4)">
              {t('imageDetail.queue.keepPageOpen')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function Tag({ children, mono = false, bold = false }: { children: ReactNode; mono?: boolean; bold?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1.5 py-0.5 text-sm leading-none text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${mono ? 'mono' : ''} ${bold ? 'font-semibold text-(--color-text)' : ''}`}
    >
      {children}
    </span>
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
    setOverflowing(el.scrollHeight > PROMPT_BOX_COLLAPSED_MAX_HEIGHT + 4)
    if (isStreaming && !expanded) {
      el.scrollTop = el.scrollHeight
    }
  }, [expanded, isStreaming, text])

  return (
    <div className="mt-2">
      <div
        ref={ref}
        className="whitespace-pre-wrap rounded-[var(--radius-sm)] bg-(--color-surface) px-2 py-1.5 text-base leading-[1.5] text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
        style={expanded ? undefined : { maxHeight: PROMPT_BOX_COLLAPSED_MAX_HEIGHT, overflowY: 'hidden' }}
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
          className="mt-1 bg-transparent p-0 text-sm text-(--color-text-3) transition-colors hover:text-(--color-text)"
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
  stackItemNumberByImageId,
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
  stackItemNumberByImageId: Map<string, number>
  result?: AgentMessageToolResult
  isStreaming: boolean
  autoApproveImageTasks: boolean
  onApprove: (taskId: string) => void
  onCancel: (taskId: string) => void
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onFocus?: AgentImageTaskFocusHandler
}) {
  const { t } = useI18n()

  const isComposingPrompt = isStreaming && !task && !result
  const status: AgentImageTask['status'] = task?.status ?? (result?.isError ? 'failed' : 'pending_approval')
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'
  const isDimmed = status === 'rejected' || status === 'canceled'
  const isActiveGenerating = status === 'approved' || status === 'queued' || status === 'running'

  const reservedIds = task?.request.reservedImageIds ?? []
  const requestedFromArgs = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : undefined
  const requestedCountFromArgs = typeof call.arguments.n === 'number' ? call.arguments.n : 1
  const promptFromArgs = typeof call.arguments.prompt === 'string' ? call.arguments.prompt : ''
  const targetIds = reservedIds.length > 0 ? reservedIds : requestedFromArgs ? [requestedFromArgs] : []
  const targetIdLabel = targetIds.length > 0 ? targetIds.join(', ') : null

  const promptText = task?.request.prompt ?? promptFromArgs
  const referenceIds = task?.request.referenceImageIds ?? []
  const resultIds = task?.resultImageIds ?? []
  const batchCount = task?.request.batchCount ?? requestedCountFromArgs

  const modelName = task
    ? (MODEL_CONFIGS.find((item) => item.id === task.request.modelId)?.name ?? task.request.modelId)
    : null

  const taskDetail = task?.error
    ? task.error
    : task?.status === 'rejected'
      ? t('agentChat.imageTask.rejectedDetail')
      : task?.status === 'canceled'
        ? t('agentChat.imageTask.canceledDetail')
        : undefined
  const noTaskErrorText = !task && result?.isError ? summarizeToolResult(result) : undefined

  const showApprove = task?.status === 'pending_approval'
  const showCancel = task
    ? task.status === 'pending_approval' ||
      task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved'
    : false

  const canFocus = Boolean(
    onFocus &&
    task &&
    (task.request.stackId || task.generationJobId) &&
    (task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved' ||
      task.status === 'completed'),
  )
  const handleCardClick = canFocus && task ? () => onFocus?.(task, { behavior: 'open' }) : undefined
  const handleLocateClick = canFocus && task ? () => onFocus?.(task, { behavior: 'locate' }) : undefined
  const handleShellClick = canFocus
    ? (event: MouseEvent<HTMLDivElement>) => {
        if (event.target instanceof Element && event.target.closest('[data-stack-item-thumb]')) return
        handleCardClick?.()
      }
    : undefined

  // Param chip row, shared by all post-composing states. Renders nothing in
  // composing because we don't know the model/resolution yet.
  const paramTags =
    task && modelName ? (
      <>
        <Tag bold={isActiveGenerating}>{modelName}</Tag>
        <Tag>{task.request.resolution}</Tag>
        <Tag>{task.request.aspectRatio}</Tag>
        {batchCount > 1 && <Tag>{`×${batchCount}`}</Tag>}
      </>
    ) : null

  const targetIdNode = targetIdLabel ? (
    <span className="mono ml-auto min-w-0 truncate text-sm text-(--color-text-4)" title={targetIdLabel}>
      {targetIdLabel}
    </span>
  ) : null

  // Result / skeleton grid for non-completed, active states.
  const renderInProgressGrid = () => {
    if (!task) return null
    if (!isActiveGenerating && !isFailed) return null
    const filledCount = resultIds.length
    const slots = Math.max(filledCount, batchCount)
    if (slots <= 0) return null
    const aspectRatioCss = parseAspectRatioCss(task.request.aspectRatio)
    const items: ReactNode[] = []
    for (let index = 0; index < slots; index += 1) {
      const id = resultIds[index]
      if (id) {
        const item = stackItemByImageId.get(id)
        items.push(
          item ? (
            <StackItemThumb
              key={id}
              item={item}
              number={stackItemNumberByImageId.get(id)}
              outerRing
              hoverLift={false}
              className="aspect-square w-full"
              numberBadgeInset={6}
              onSelect={() => {
                if (canFocus) onFocus?.(task, { behavior: 'open' })
              }}
            />
          ) : (
            <GenImageResultThumb key={id} id={id} />
          ),
        )
      } else if (isActiveGenerating) {
        items.push(<SkeletonSlot key={`skeleton-${index}`} aspectRatio={aspectRatioCss} compact />)
      }
    }
    if (items.length === 0) return null
    // Single-slot placeholder is bounded by both width and height so tall
    // ratios (9:16) don't dominate the card. We compute the largest WxH that
    // fits inside an 80px box for the requested ratio, then size the grid
    // column to that exact width and let aspect-ratio drive the height.
    const isSingle = slots === 1
    const singleBox = isSingle ? fitWithinBox(aspectRatioCss, 80) : null
    return (
      <div
        className="mt-2.5 grid gap-1.5"
        style={{
          gridTemplateColumns: singleBox ? `${singleBox.width}px` : `repeat(${Math.min(slots, 3)}, minmax(0, 1fr))`,
        }}
      >
        {items}
      </div>
    )
  }

  // Edge-to-edge result grid for completed. The StackItemThumb top-right
  // metaBadge already carries model + resolution + aspect ratio, so the card
  // doesn't need a separate footer.
  const completedMetaBadge =
    task && modelName ? `${modelName} · ${task.request.resolution} · ${task.request.aspectRatio}` : undefined
  const renderCompletedGrid = () => {
    if (!isCompleted || resultIds.length === 0) return null
    const visibleIds = resultIds.filter((id) => stackItemByImageId.has(id))
    const allDeleted = visibleIds.length === 0
    if (allDeleted) {
      return (
        <div
          className="flex items-center justify-center gap-1.5 px-3.5 py-6 text-base"
          style={{ color: 'var(--color-danger)' }}
        >
          <Icon name="image_off" size={12} />
          <span>{t('agentChat.imageTask.deleted')}</span>
        </div>
      )
    }
    return (
      <div
        className="grid gap-px overflow-hidden bg-(--ring-edge-soft)"
        style={{ gridTemplateColumns: `repeat(${Math.min(visibleIds.length, 3)}, minmax(0, 1fr))` }}
      >
        {visibleIds.map((id) => {
          const item = stackItemByImageId.get(id)!
          return (
            <StackItemThumb
              key={id}
              item={item}
              number={stackItemNumberByImageId.get(id)}
              outerRing
              hoverLift={false}
              className="aspect-square w-full"
              roundedClassName="rounded-none"
              numberBadgeInset={6}
              metaBadge={completedMetaBadge}
              metaBadgeTitle={completedMetaBadge}
              onSelect={(item) => {
                if (task && canFocus) onFocus?.(task, { behavior: 'open', itemId: item.id })
              }}
            />
          )
        })}
      </div>
    )
  }

  // ─────────────────────────── Completed layout ───────────────────────────
  // Edge-to-edge images only. Image id, index and metaBadge are already shown
  // as overlays inside StackItemThumb, so the card needs no header or footer.
  if (isCompleted) {
    return (
      <div
        onClick={handleShellClick}
        className={`group relative m-1 max-w-[460px] overflow-hidden rounded-[var(--radius-lg)] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)] ${canFocus ? 'cursor-pointer' : ''}`}
      >
        {renderCompletedGrid()}
        {canFocus && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleLocateClick?.()
            }}
            className="media-action absolute bottom-1.5 right-1.5 z-30 min-h-[24px] px-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100"
            title={t('agentChat.imageTask.locateInGallery')}
            aria-label={t('agentChat.imageTask.locateInGallery')}
          >
            <Icon name="map_pin" size={12} />
          </button>
        )}
      </div>
    )
  }

  // ─────────────────────── Non-completed layout ───────────────────────────
  return (
    <div
      role={canFocus ? 'button' : undefined}
      tabIndex={canFocus ? 0 : undefined}
      onClick={handleShellClick}
      onKeyDown={
        canFocus
          ? (event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleCardClick?.()
              }
            }
          : undefined
      }
      className={`m-1 max-w-[460px] rounded-[var(--radius-lg)] bg-(--color-surface) px-3 py-2.5 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)] ${canFocus ? 'cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-surface-2)_50%,var(--color-surface))]' : ''} ${isDimmed ? 'opacity-60' : ''}`}
    >
      {/* Composing micro header (only state that gets a header) */}
      {isComposingPrompt && (
        <div className="flex min-w-0 items-center gap-2">
          <span className="spinner" style={{ width: 10, height: 10 }} />
          <span className="text-sm text-(--color-text-3)">{t('agentChat.taskStatus.prompting')}</span>
          {targetIdNode}
        </div>
      )}

      {/* Param chips + right-aligned target id */}
      {!isComposingPrompt && (paramTags || targetIdNode) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {paramTags}
          {isFailed && (
            <span className="inline-flex items-center" style={{ color: 'var(--color-danger)' }}>
              <Icon name="alert_circle" size={13} />
            </span>
          )}
          {targetIdNode}
        </div>
      )}

      {promptText && <AgentImagePromptBox text={promptText} isStreaming={isComposingPrompt} />}

      {referenceIds.length > 0 && (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-(--color-text-3)">
          <span className="text-(--color-text-3)">{t('agentChat.imageTask.reference')}</span>
          <span className="mono truncate text-(--color-text-4)" title={referenceIds.join(', ')}>
            {referenceIds.join(', ')}
          </span>
        </div>
      )}

      {renderInProgressGrid()}

      {taskDetail && (
        <div
          className="mt-2.5 text-base leading-[1.45]"
          style={{ color: isFailed ? 'var(--color-danger)' : 'var(--color-text-3)' }}
        >
          {taskDetail}
        </div>
      )}
      {noTaskErrorText && (
        <div className="mt-2.5 text-base leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {noTaskErrorText}
        </div>
      )}

      {(showApprove || showCancel) && task && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {showApprove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onApprove(task.id)
              }}
              className="chip text-base"
              data-active
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
              className="chip flex items-center gap-1.5 text-base"
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
              className="chip danger text-base"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
