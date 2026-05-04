import { memo, useCallback, useMemo } from 'react'

import {
  activeStackStatusParts,
  canDismissFailedGenerationJob,
  stackItemAspectRatio,
  stackItemGenerationSummary,
} from './outputPanelHelpers'
import type { Translate } from '../../i18n'
import { downloadImagePng } from '../../lib/exportImages'
import { formatTime } from '../../lib/queueJobDisplay'
import type { ImageStack, StackItem, StackImageItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { GridCell, ImageGrid } from '../ImageGrid'
import { StackItemThumb } from '../StackItemThumb'

export type StackRowProps = {
  stack: ImageStack
  onOpenItem: (stackId: string, item: StackItem) => void
  onEditItem: (stackId: string, item: StackItem) => void
  onOpenGallery: (stack: ImageStack) => void
  onDownloadStack: (stack: ImageStack) => void
  onCancelStackGeneration: (stack: ImageStack) => void
  onRetryStackFailedSlots: (stack: ImageStack) => void
  onDismissStackFailedJobs: (stack: ImageStack) => void
  onOpenGenerationSettings: () => void
  onDeleteStack: (stack: ImageStack) => void
  downloading: boolean
  deleteConfirming: boolean
  deleting: boolean
  onRequestDeleteConfirm: (stackId: string) => void
  onCancelDeleteConfirm: () => void
  t: Translate
}

type StackThumbActionsProps = {
  item: StackImageItem
  stackId: string
  onEditItem: (stackId: string, item: StackItem) => void
  t: Translate
}

const StackThumbActions = memo(function StackThumbActions({ item, stackId, onEditItem, t }: StackThumbActionsProps) {
  return (
    <div className="pointer-events-none hidden items-center gap-1 opacity-[0.001] transition-opacity md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onEditItem(stackId, item)
        }}
        className="media-action flex-1"
      >
        <Icon name="wand" size={11} strokeWidth={1.8} />
        {t('common.edit')}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          void downloadImagePng(item.image)
        }}
        className="media-action flex-1"
      >
        <Icon name="download" size={11} strokeWidth={1.8} />
        PNG
      </button>
    </div>
  )
})

export const StackRow = memo(function StackRow({
  stack,
  onOpenItem,
  onEditItem,
  onOpenGallery,
  onDownloadStack,
  onCancelStackGeneration,
  onRetryStackFailedSlots,
  onDismissStackFailedJobs,
  onOpenGenerationSettings,
  onDeleteStack,
  downloading,
  deleteConfirming,
  deleting,
  onRequestDeleteConfirm,
  onCancelDeleteConfirm,
  t,
}: StackRowProps) {
  const totalItems = stack.images.length + stack.activeSlotCount + stack.failedSlotCount
  const activeStatusParts = useMemo(() => activeStackStatusParts(stack, t), [stack, t])
  const hasDismissibleFailures = useMemo(() => stack.jobs.some(canDismissFailedGenerationJob), [stack.jobs])
  const stackItemNumberById = useMemo(
    () => new Map(stack.items.map((item, index) => [item.id, index + 1])),
    [stack.items],
  )
  const previewItems = stack.items
  const canDelete = stack.images.length > 0 && activeStatusParts.length === 0
  const stackId = stack.id
  const handleSelectItem = useCallback((item: StackItem) => onOpenItem(stackId, item), [onOpenItem, stackId])

  return (
    <div className="min-w-0">
      <div className="min-w-0 px-3 py-2">
        <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-base">
          <span className="shrink-0 font-normal text-(--color-text-3)">{formatTime(stack.updatedAt, t)}</span>
          <span className="meta-dot text-(--color-text-4)" aria-hidden />
          <span className="font-normal text-(--color-text-3)">{t('output.imageCount', { count: totalItems })}</span>
          <span className="meta-dot text-(--color-text-4)" aria-hidden />
          <button
            type="button"
            onClick={() => onOpenGallery(stack)}
            className="bg-transparent p-0 text-base font-medium text-(--color-text-3) transition-colors hover:text-(--color-text-2)"
          >
            {t('output.viewAll')}
          </button>
          {stack.images.length > 1 && (
            <>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              <button
                type="button"
                onClick={() => onDownloadStack(stack)}
                disabled={downloading}
                className="bg-transparent p-0 text-base font-medium text-(--color-text-3) transition-colors hover:text-(--color-text-2) disabled:cursor-not-allowed disabled:opacity-45"
              >
                {downloading ? t('output.packaging') : t('output.downloadZip')}
              </button>
            </>
          )}
          {activeStatusParts.length > 0 && (
            <>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 font-normal text-(--color-text-3)">
                  {activeStatusParts.map((part, index) => (
                    <span key={part.kind} className="contents">
                      {index > 0 && <span className="meta-dot text-(--color-text-4)" aria-hidden />}
                      <span>
                        {part.label}
                        {part.kind === 'queued' && (
                          <button
                            type="button"
                            onClick={onOpenGenerationSettings}
                            className="bg-transparent p-0 font-normal text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
                          >
                            {t('output.adjustParenthetical')}
                          </button>
                        )}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="meta-dot text-(--color-text-4)" aria-hidden />
                <button
                  type="button"
                  onClick={() => onCancelStackGeneration(stack)}
                  className="bg-transparent p-0 text-base font-semibold transition-colors hover:brightness-110"
                  style={{ color: 'var(--color-danger)' }}
                >
                  {t('output.cancelGeneration')}
                </button>
              </span>
            </>
          )}
          {stack.failedSlotCount > 0 && (
            <>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              <span className="text-base" style={{ color: 'var(--color-danger)' }}>
                {t('output.failedCount', { count: stack.failedSlotCount })}
              </span>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              <button
                type="button"
                onClick={() => onRetryStackFailedSlots(stack)}
                className="bg-transparent p-0 text-base font-semibold transition-colors hover:text-(--color-text-2)"
                style={{ color: 'var(--color-text-3)' }}
              >
                {t('output.retryFailed')}
              </button>
              {hasDismissibleFailures && (
                <>
                  <span className="meta-dot text-(--color-text-4)" aria-hidden />
                  <button
                    type="button"
                    onClick={() => onDismissStackFailedJobs(stack)}
                    className="bg-transparent p-0 text-base font-semibold transition-colors hover:brightness-110"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    {t('output.clearFailed')}
                  </button>
                </>
              )}
            </>
          )}
          {canDelete && (
            <>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              {deleteConfirming ? (
                <>
                  <button
                    type="button"
                    onClick={() => onDeleteStack(stack)}
                    disabled={deleting}
                    className="bg-transparent p-0 text-base font-semibold transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    {deleting ? t('common.deleting') : t('common.confirmDelete')}
                  </button>
                  <span className="meta-dot text-(--color-text-4)" aria-hidden />
                  <button
                    type="button"
                    onClick={onCancelDeleteConfirm}
                    disabled={deleting}
                    className="bg-transparent p-0 text-base font-medium text-(--color-text-3) transition-colors hover:text-(--color-text-2) disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestDeleteConfirm(stack.id)}
                  className="bg-transparent p-0 text-base font-medium transition-colors hover:brightness-110"
                  style={{ color: 'var(--color-danger)' }}
                >
                  {t('common.delete')}
                </button>
              )}
            </>
          )}
        </div>
        <div className="min-w-0">
          <ImageGrid>
            {previewItems.length > 0 ? (
              previewItems.map((item) => {
                const summary = stackItemGenerationSummary(item)
                const metaBadge = summary
                  ? `${summary.modelName} · ${summary.resolution} · ${summary.aspectRatio}`
                  : undefined
                return (
                  <GridCell key={item.id} aspectRatio={stackItemAspectRatio(item)}>
                    <StackItemThumb
                      item={item}
                      number={stackItemNumberById.get(item.id)}
                      outerRing
                      showSlotReason
                      className="h-full w-full"
                      numberBadgeInset={8}
                      metaBadge={metaBadge}
                      metaBadgeTitle={metaBadge}
                      onSelect={handleSelectItem}
                      actions={
                        item.type === 'image' ? (
                          <StackThumbActions item={item} stackId={stackId} onEditItem={onEditItem} t={t} />
                        ) : undefined
                      }
                    />
                  </GridCell>
                )
              })
            ) : (
              <GridCell aspectRatio="4:3">
                <button
                  type="button"
                  onClick={() => onOpenGallery(stack)}
                  className="h-full w-full rounded-[var(--radius-md)] text-sm text-(--color-text-4)"
                  style={{ background: 'var(--color-surface-2)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                >
                  {t('output.noImages')}
                </button>
              </GridCell>
            )}
          </ImageGrid>
        </div>
      </div>
    </div>
  )
})
