import { useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import { summarizeToolResult, taskStatusLabel } from './utils'
import type { AgentImageTask, AgentMessageToolCall, AgentMessageToolResult } from '../../agent'
import { MODEL_CONFIGS } from '../../config/models'
import { useExternalSync } from '../../hooks/effects'
import { useImageSrc } from '../../hooks/useImageSrc'
import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'
import { compactImageIdLabel } from '../../lib/imageIdLabel'
import { Icon } from '../Icon'
import { StackItemThumb } from '../StackItemThumb'
import type { AgentImageTaskFocusHandler } from './types'

const PROMPT_BOX_COLLAPSED_LINE_COUNT = 3
const ERROR_SUMMARY_MAX_LENGTH = 180

type PromptBoxMeasurement = {
  overflowing: boolean
  hiddenLineCount: number
  collapsedTextMaxHeight: number
}

const DEFAULT_PROMPT_BOX_MEASUREMENT: PromptBoxMeasurement = {
  overflowing: false,
  hiddenLineCount: 0,
  collapsedTextMaxHeight: 72,
}

function normalizeErrorText(text: string): string {
  return text.trim()
}

function summarizeImageTaskError(text: string): string {
  const normalized = normalizeErrorText(text).replace(/\s+/g, ' ')
  if (!normalized) return normalized

  const detailMarkers = [
    'For more information on this error',
    'To monitor your current usage',
    'Quota exceeded for metric',
    'Please retry in',
  ]
  const markerIndex = detailMarkers.reduce<number | null>((best, marker) => {
    const index = normalized.toLowerCase().indexOf(marker.toLowerCase())
    if (index <= 0) return best
    return best === null || index < best ? index : best
  }, null)
  const summary = (markerIndex === null ? normalized : normalized.slice(0, markerIndex)).replace(/[\s*]+$/, '')
  const clippedSummary = summary || normalized

  if (clippedSummary.length <= ERROR_SUMMARY_MAX_LENGTH) return clippedSummary
  return `${clippedSummary.slice(0, ERROR_SUMMARY_MAX_LENGTH).trimEnd()}...`
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function useElapsedTime(startedAt: number | null, enabled: boolean): string | null {
  const [now, setNow] = useState(() => Date.now())

  useExternalSync(() => {
    if (!enabled || startedAt === null) return

    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [enabled, startedAt])

  if (!enabled || startedAt === null) return null
  return formatElapsedTime(now - startedAt)
}

function GenImageResultThumb({ id, flush = false, className }: { id: string; flush?: boolean; className?: string }) {
  const { t } = useI18n()
  const { ref, src, failed } = useImageSrc(id, 'image/png', undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${className ?? 'aspect-square w-full'} ${flush ? 'rounded-none' : 'rounded-[var(--radius-md)]'}`}
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

function hasCompleteGenImageArguments(call: AgentMessageToolCall): boolean {
  const args = call.arguments
  return (
    typeof args.image_id === 'string' &&
    args.image_id.trim() !== '' &&
    typeof args.prompt === 'string' &&
    args.prompt.trim() !== '' &&
    typeof args.model === 'string' &&
    args.model.trim() !== '' &&
    typeof args.resolution === 'string' &&
    args.resolution.trim() !== '' &&
    typeof args.ratio === 'string' &&
    args.ratio.trim() !== '' &&
    typeof args.n === 'number'
  )
}

// Largest WxH box that fits within `max` on both sides for the given ratio.
function fitWithinBox(aspectRatioCss: string, max: number): { width: number; height: number } {
  const [w, h] = aspectRatioCss.split('/').map((part) => Number(part.trim()))
  if (!w || !h) return { width: max, height: max }
  const ratio = w / h
  if (ratio >= 1) return { width: max, height: Math.round(max / ratio) }
  return { width: Math.round(max * ratio), height: max }
}

// Width cap that keeps a cell's height under `maxHeight` for the given ratio.
function maxCellWidthForHeight(aspectRatioCss: string, maxHeight: number): number {
  const [w, h] = aspectRatioCss.split('/').map((part) => Number(part.trim()))
  if (!w || !h) return maxHeight
  return Math.round(maxHeight * (w / h))
}

const COMPLETED_CELL_MAX_HEIGHT = 480

function getCompletedGridColumnCount(count: number): number {
  if (count <= 3) return Math.max(1, count)
  if (count === 4) return 2
  if (count <= 6) return 3

  return [3, 4].reduce(
    (best, columns) => {
      const rows = Math.ceil(count / columns)
      const emptySlots = rows * columns - count
      const lastRowCount = count % columns || columns
      const orphanPenalty = lastRowCount === 1 ? 4 : 0
      const score = emptySlots * 3 + rows + orphanPenalty

      return score < best.score ? { columns, score } : best
    },
    { columns: 3, score: Number.POSITIVE_INFINITY },
  ).columns
}

function SkeletonSlot({
  flush = false,
  aspectRatio,
  compact = false,
  queued = false,
}: {
  flush?: boolean
  aspectRatio?: string
  compact?: boolean
  queued?: boolean
}) {
  const { t } = useI18n()
  const statusLabel = queued ? t('imageDetail.queue.status.queued') : t('imageDetail.queue.status.generating')
  return (
    <div
      className={`relative w-full overflow-hidden shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${flush ? 'rounded-none' : 'rounded-[var(--radius-sm)]'}`}
      style={{
        aspectRatio: aspectRatio ?? '1 / 1',
        background: 'repeating-linear-gradient(-45deg, var(--color-surface-2) 0 6px, var(--color-surface-3) 6px 12px)',
      }}
      title={compact ? `${statusLabel} · ${t('imageDetail.queue.keepPageOpen')}` : undefined}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-(--color-text-3)">
        {queued ? (
          <div className="h-2 w-2 rounded-full" style={{ background: 'var(--color-text-4)' }} />
        ) : (
          <span className="spinner" style={{ width: 12, height: 12 }} />
        )}
        {!compact && (
          <>
            <span className="text-sm leading-[1.4]">{statusLabel}</span>
            <span className="text-center text-xs leading-[1.35] text-(--color-text-4)">
              {t('imageDetail.queue.keepPageOpen')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function Tag({
  children,
  mono = false,
  bold = false,
  tabular = false,
}: {
  children: ReactNode
  mono?: boolean
  bold?: boolean
  tabular?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1.5 py-0.5 text-sm leading-none text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${mono ? 'mono' : ''} ${tabular ? 'tabular-nums' : ''} ${bold ? 'font-semibold text-(--color-text)' : ''}`}
    >
      {children}
    </span>
  )
}

function AgentImagePromptBox({ text }: { text: string }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [measurement, setMeasurement] = useState<PromptBoxMeasurement | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    let frame: number | null = null
    const measure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = null

        const styles = window.getComputedStyle(el)
        const fontSize = Number.parseFloat(styles.fontSize) || 13
        const rawLineHeight = Number.parseFloat(styles.lineHeight)
        const lineHeight = Number.isFinite(rawLineHeight) ? rawLineHeight : fontSize * 1.5
        const lineCount = Math.max(1, Math.round(el.scrollHeight / lineHeight))
        const hiddenLineCount = Math.max(0, lineCount - PROMPT_BOX_COLLAPSED_LINE_COUNT)
        const nextMeasurement = {
          overflowing: hiddenLineCount > 0,
          hiddenLineCount,
          collapsedTextMaxHeight: Math.floor(lineHeight * PROMPT_BOX_COLLAPSED_LINE_COUNT),
        }

        setMeasurement((prev) => {
          if (!prev) return nextMeasurement

          return prev.overflowing === nextMeasurement.overflowing &&
            prev.hiddenLineCount === nextMeasurement.hiddenLineCount &&
            prev.collapsedTextMaxHeight === nextMeasurement.collapsedTextMaxHeight
            ? prev
            : nextMeasurement
        })
      })
    }

    measure()

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(el)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
    }
  }, [text])

  const collapsed = !expanded && (measurement?.overflowing ?? true)
  const collapsedTextMaxHeight =
    measurement?.collapsedTextMaxHeight ?? DEFAULT_PROMPT_BOX_MEASUREMENT.collapsedTextMaxHeight

  return (
    <div className="mt-2 max-w-[532px]">
      <div className="rounded-[var(--radius-sm)] bg-(--color-surface) px-2 pt-1.5 pb-2 text-base leading-[1.5] text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
        <div
          ref={ref}
          className="whitespace-pre-wrap"
          style={collapsed ? { maxHeight: collapsedTextMaxHeight, overflowY: 'hidden' } : undefined}
        >
          {text}
        </div>
      </div>
      {measurement?.overflowing && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((prev) => !prev)
          }}
          className="mt-1 bg-transparent py-0 pr-0 pl-2 text-sm text-(--color-text-3) transition-colors hover:text-(--color-text)"
        >
          {expanded ? (
            t('agentChat.truncated.collapse')
          ) : (
            <>
              {t('agentChat.truncated.expandMoreLinesPrefix')}{' '}
              <span className="tabular-nums">{measurement.hiddenLineCount}</span>{' '}
              {t('agentChat.truncated.expandMoreLinesSuffix')}
            </>
          )}
        </button>
      )}
    </div>
  )
}

function AgentImageErrorDetail({ text }: { text: string }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const detailText = normalizeErrorText(text)
  const summaryText = summarizeImageTaskError(detailText) || t('agentChat.tool.result.failed')
  const canExpand = detailText !== '' && detailText !== summaryText

  return (
    <div className="mt-2.5 px-2 text-base leading-[1.45] text-(--color-danger)">
      <p className="m-0 min-w-0 break-words [overflow-wrap:anywhere]">
        <span className="font-medium">{t('agentChat.errorPrefix')}</span>
        <span>{summaryText}</span>
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((prev) => !prev)
          }}
          className="mt-1 bg-transparent p-0 text-sm text-(--color-text-3) transition-colors hover:text-(--color-text)"
        >
          {expanded ? t('agentChat.question.collapseDetails') : t('agentChat.question.expandDetails')}
        </button>
      )}
      {expanded && (
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2 py-1.5 text-sm leading-[1.45] whitespace-pre-wrap text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] [overflow-wrap:anywhere]">
          {detailText}
        </div>
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const ignoreNextShellClickRef = useRef(false)

  const isComposingPrompt = isStreaming && !task && !result && !hasCompleteGenImageArguments(call)
  const status: AgentImageTask['status'] = task?.status ?? (result?.isError ? 'failed' : 'pending_approval')
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'
  const isDimmed = status === 'rejected' || status === 'canceled'
  const isActiveGenerating = status === 'approved' || status === 'queued' || status === 'running'
  const isPendingApproval = task?.status === 'pending_approval'
  const activeElapsedTime = useElapsedTime(task?.createdAt ?? null, Boolean(task && isActiveGenerating))

  const reservedIds = task?.request.reservedImageIds ?? []
  const requestedFromArgs = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : undefined
  const requestedCountFromArgs = typeof call.arguments.n === 'number' ? call.arguments.n : 1
  const promptFromArgs = typeof call.arguments.prompt === 'string' ? call.arguments.prompt : ''
  const targetIds = reservedIds.length > 0 ? reservedIds : requestedFromArgs ? [requestedFromArgs] : []
  const targetIdLabel = compactImageIdLabel(targetIds)
  const targetIdTitle = targetIds.length > 1 ? Array.from(new Set(targetIds)).join(', ') : targetIdLabel

  const promptText = task?.request.prompt ?? promptFromArgs
  const referenceIds = task?.request.referenceImageIds ?? []
  const resultIds = task?.resultImageIds ?? []
  const batchCount = task?.request.batchCount ?? requestedCountFromArgs

  const modelName = task
    ? (MODEL_CONFIGS.find((item) => item.id === task.request.modelId)?.name ?? task.request.modelId)
    : null

  const taskErrorText = task?.error
  const taskDetail = taskErrorText
    ? undefined
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
    (task.request.stackId || task.generationJobId || task.resultImageIds.length > 0) &&
    (task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved' ||
      task.status === 'completed' ||
      task.status === 'failed'),
  )
  const handleCardClick = canFocus && task ? () => onFocus?.(task, { behavior: 'open' }) : undefined
  const handleLocateClick = canFocus && task ? () => onFocus?.(task, { behavior: 'locate' }) : undefined
  const handleShellClick = canFocus
    ? (event: MouseEvent<HTMLDivElement>) => {
        if (ignoreNextShellClickRef.current) {
          ignoreNextShellClickRef.current = false
          return
        }
        if (event.target instanceof Element && event.target.closest('[data-stack-item-thumb]')) return
        handleCardClick?.()
      }
    : undefined
  const handleShellPointerDown = canFocus
    ? (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'touch' || !event.isPrimary) return
        touchStartRef.current = { x: event.clientX, y: event.clientY }
      }
    : undefined
  const handleShellPointerUp =
    canFocus && task
      ? (event: PointerEvent<HTMLDivElement>) => {
          if (event.pointerType !== 'touch' || !event.isPrimary) return
          const start = touchStartRef.current
          touchStartRef.current = null
          if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return
          if (event.target instanceof Element && event.target.closest('button')) return

          const thumb =
            event.target instanceof Element ? event.target.closest<HTMLElement>('[data-stack-item-thumb]') : null
          const itemId = thumb?.dataset.stackItemId
          ignoreNextShellClickRef.current = true
          onFocus?.(task, itemId ? { behavior: 'open', itemId } : { behavior: 'open' })
        }
      : undefined
  const shellShadowClass = isPendingApproval
    ? 'shadow-[0_0_0_1px_var(--color-warning),0_0_0_3px_color-mix(in_srgb,var(--color-warning)_16%,transparent),var(--shadow-lift)]'
    : 'shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)]'

  // Param chip row, shared by all post-composing states. Renders nothing in
  // composing because we don't know the model/resolution yet.
  const paramTags =
    task && modelName ? (
      <>
        <Tag bold={isActiveGenerating}>{modelName}</Tag>
        <Tag tabular>{task.request.resolution}</Tag>
        <Tag tabular>{task.request.aspectRatio}</Tag>
        {batchCount > 1 && <Tag tabular>{`×${batchCount}`}</Tag>}
      </>
    ) : null

  const targetIdNode = targetIdLabel ? (
    <span
      className="mono min-w-0 break-all text-sm leading-[1.35] font-medium text-(--color-text)"
      title={targetIdTitle ?? targetIdLabel}
    >
      {targetIdLabel}
    </span>
  ) : null
  const approvalStatusNode = isPendingApproval ? (
    <span className="inline-flex items-center rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-1.5 py-0.5 text-xs leading-none font-semibold text-(--color-warning) shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-warning)_20%,transparent)]">
      <span>{t('agentChat.taskStatus.pendingApproval')}</span>
    </span>
  ) : null
  const activeStatusNode =
    task && isActiveGenerating ? (
      <span
        className="inline-flex items-center gap-1.5 py-0.5 text-sm leading-none font-medium text-(--color-text-3)"
        title={taskStatusLabel(status)}
      >
        {status === 'queued' ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-(--color-text-4)" />
            <span>{taskStatusLabel(status)}</span>
          </>
        ) : (
          activeElapsedTime && <span className="tabular-nums text-(--color-text-4)">{activeElapsedTime}</span>
        )}
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
            <div key={id} className="w-full" style={{ aspectRatio: aspectRatioCss }}>
              <StackItemThumb
                item={item}
                number={stackItemNumberByImageId.get(id)}
                outerRing
                hoverLift={false}
                className="h-full w-full"
                numberBadgeInset={6}
                onSelect={() => {
                  if (canFocus) onFocus?.(task, { behavior: 'open' })
                }}
              />
            </div>
          ) : (
            <GenImageResultThumb key={id} id={id} />
          ),
        )
      } else if (isActiveGenerating) {
        items.push(
          <SkeletonSlot key={`skeleton-${index}`} aspectRatio={aspectRatioCss} compact queued={status === 'queued'} />,
        )
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
        className="mt-2.5 grid gap-1.5 px-2"
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
    const completedAspectRatio = task ? parseAspectRatioCss(task.request.aspectRatio) : '1 / 1'
    const completedCellMaxWidth = maxCellWidthForHeight(completedAspectRatio, COMPLETED_CELL_MAX_HEIGHT)
    return (
      <div
        className="grid gap-px overflow-hidden bg-(--agent-image-task-empty-bg)"
        style={{
          gridTemplateColumns: `repeat(${getCompletedGridColumnCount(resultIds.length)}, minmax(0, ${completedCellMaxWidth}px))`,
        }}
      >
        {resultIds.map((id) => {
          const item = stackItemByImageId.get(id)
          return (
            <div
              key={id}
              className="relative w-full"
              style={{
                aspectRatio: completedAspectRatio,
                maxHeight: COMPLETED_CELL_MAX_HEIGHT,
              }}
            >
              {/* Inner absolute wrapper sidesteps the aspect-ratio + max-height
                  + percentage-height combo that lets some browsers leave the
                  thumb shorter than the cell, exposing the grid background. */}
              <div className="absolute inset-0">
                {item ? (
                  <StackItemThumb
                    item={item}
                    number={stackItemNumberByImageId.get(id)}
                    outerRing
                    hoverLift={false}
                    className="h-full w-full"
                    roundedClassName="rounded-none"
                    numberBadgeInset={6}
                    metaBadge={completedMetaBadge}
                    metaBadgeTitle={completedMetaBadge}
                    onSelect={(item) => {
                      if (task && canFocus) onFocus?.(task, { behavior: 'open', itemId: item.id })
                    }}
                  />
                ) : (
                  <GenImageResultThumb id={id} flush className="h-full w-full" />
                )}
              </div>
            </div>
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
        role={canFocus ? 'button' : undefined}
        tabIndex={canFocus ? 0 : undefined}
        onClick={handleShellClick}
        onPointerDown={handleShellPointerDown}
        onPointerUp={handleShellPointerUp}
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
        className={`group relative w-fit overflow-hidden rounded-[var(--radius-lg)] bg-(--agent-image-task-empty-bg) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)] md:m-1 md:max-w-[560px] ${canFocus ? 'cursor-pointer' : ''}`}
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
      onPointerDown={handleShellPointerDown}
      onPointerUp={handleShellPointerUp}
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
      className={`w-full rounded-[var(--radius-lg)] bg-(--color-surface) px-3 py-2.5 ${shellShadowClass} md:m-1 md:max-w-[560px] ${isPendingApproval ? 'agent-image-task-card-pending' : ''} ${canFocus ? 'cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-surface-2)_50%,var(--color-surface))]' : ''} ${isDimmed ? 'opacity-60' : ''}`}
    >
      {/* Composing micro header (only state that gets a header) */}
      {isComposingPrompt && (
        <div className="flex max-w-[532px] min-w-0 items-center justify-between gap-2 px-2">
          {targetIdNode}
          <span className="ml-auto inline-flex shrink-0 items-center gap-2 text-sm text-(--color-text-3)">
            <span className="spinner" style={{ width: 10, height: 10 }} />
            <span>{t('agentChat.taskStatus.prompting')}</span>
          </span>
        </div>
      )}

      {/* Target id on the left, generation parameter tags on the right. */}
      {!isComposingPrompt && (approvalStatusNode || activeStatusNode || paramTags || targetIdNode) && (
        <div className="flex max-w-[532px] min-w-0 flex-col items-stretch gap-1.5 px-2 md:flex-row md:items-start md:justify-between md:gap-2">
          {(targetIdNode || approvalStatusNode) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {targetIdNode}
              {approvalStatusNode}
            </div>
          )}
          {(activeStatusNode || paramTags || isFailed) && (
            <div className="flex min-w-0 items-start justify-between gap-2 md:ml-auto md:shrink-0">
              <div className="flex min-w-0 items-center">{activeStatusNode}</div>
              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                {paramTags}
                {isFailed && (
                  <span className="inline-flex items-center" style={{ color: 'var(--color-danger)' }}>
                    <Icon name="alert_circle" size={13} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {promptText && <AgentImagePromptBox text={promptText} />}

      {referenceIds.length > 0 && (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 px-2 text-sm text-(--color-text-3)">
          <span className="text-(--color-text-3)">{t('agentChat.imageTask.reference')}</span>
          <span className="mono truncate text-(--color-text-4)" title={referenceIds.join(', ')}>
            {referenceIds.join(', ')}
          </span>
        </div>
      )}

      {renderInProgressGrid()}

      {taskErrorText && <AgentImageErrorDetail text={taskErrorText} />}
      {taskDetail && (
        <div
          className="mt-2.5 px-2 text-base leading-[1.45]"
          style={{ color: isFailed ? 'var(--color-danger)' : 'var(--color-text-3)' }}
        >
          {taskDetail}
        </div>
      )}
      {noTaskErrorText && <AgentImageErrorDetail text={noTaskErrorText} />}

      {(showApprove || showCancel) && task && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 px-2">
          {showApprove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onApprove(task.id)
              }}
              className="chip accent-active agent-image-task-approve text-base"
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
