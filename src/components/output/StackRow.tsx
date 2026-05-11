import { memo, useCallback, useMemo, useState } from 'react'

import {
  activeStackStatusParts,
  canDismissFailedGenerationJob,
  stackItemAspectRatio,
  stackItemGenerationSummary,
} from './outputPanelHelpers'
import type { Translate } from '../../i18n'
import { downloadImagePng, downloadImagesZip } from '../../lib/exportImages'
import { formatTime } from '../../lib/queueJobDisplay'
import type { ImageStack, StackItem, StackImageItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { GridCell, ImageGrid } from '../ImageGrid'
import { StackItemThumb } from '../StackItemThumb'

export type StackRowProps = {
  stack: ImageStack
  onOpenItem: (stackId: string, item: StackItem) => void
  onEditItem: (stackId: string, item: StackItem) => void
  onCancelStackGeneration: (stack: ImageStack) => void
  onRetryStackFailedSlots: (stack: ImageStack) => void
  onDismissStackFailedJobs: (stack: ImageStack) => void
  onRemoveStackImages: (stack: ImageStack) => void
  onOpenGenerationSettings: () => void
  batchManageMode?: boolean
  selectedImageIds?: Set<string>
  onToggleBatchImage?: (image: StackImageItem['image']) => void
  onLongPressBatchImage?: (image: StackImageItem['image']) => void
  compactHeader?: boolean
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
        className="media-action min-w-0 flex-1 px-2"
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
        className="media-action min-w-0 flex-1 px-2"
      >
        <Icon name="download" size={11} strokeWidth={1.8} />
        {t('common.download')}
      </button>
    </div>
  )
})

export const StackRow = memo(function StackRow({
  stack,
  onOpenItem,
  onEditItem,
  onCancelStackGeneration,
  onRetryStackFailedSlots,
  onDismissStackFailedJobs,
  onRemoveStackImages,
  onOpenGenerationSettings,
  batchManageMode = false,
  selectedImageIds,
  onToggleBatchImage,
  onLongPressBatchImage,
  compactHeader = false,
  t,
}: StackRowProps) {
  const [exporting, setExporting] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const totalItems = stack.images.length + stack.activeSlotCount + stack.failedSlotCount
  const activeStatusParts = useMemo(() => activeStackStatusParts(stack, t), [stack, t])
  const hasDismissibleFailures = useMemo(() => stack.jobs.some(canDismissFailedGenerationJob), [stack.jobs])
  const stackItemNumberById = useMemo(
    () => new Map(stack.items.map((item, index) => [item.id, index + 1])),
    [stack.items],
  )
  const previewItems = stack.items
  const stackId = stack.id
  const handleSelectItem = useCallback(
    (item: StackItem) => {
      if (batchManageMode) {
        if (item.type === 'image') onToggleBatchImage?.(item.image)
        return
      }
      onOpenItem(stackId, item)
    },
    [batchManageMode, onOpenItem, onToggleBatchImage, stackId],
  )

  const handleDownloadStack = useCallback(async () => {
    if (exporting || stack.images.length === 0) return
    setExporting(true)
    try {
      if (stack.images.length === 1) await downloadImagePng(stack.images[0])
      else await downloadImagesZip(stack.images, `nano-banana-stack-${stack.id.slice(0, 8)}.zip`)
    } finally {
      setExporting(false)
    }
  }, [exporting, stack.id, stack.images])

  const handleDeleteStackImages = useCallback(() => {
    if (stack.images.length === 0) return
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      return
    }
    onRemoveStackImages(stack)
    setDeleteConfirming(false)
  }, [deleteConfirming, onRemoveStackImages, stack])

  return (
    <div className="min-w-0">
      <div className="min-w-0 px-3 py-2">
        <div
          className={`mb-2 flex min-w-0 gap-x-2 gap-y-1 text-base ${compactHeader ? 'flex-col items-start' : 'flex-wrap items-center'}`}
        >
          {stack.title && (
            <span className="min-w-0 max-w-[48ch] truncate font-medium text-(--color-text-2)" title={stack.title}>
              {stack.title}
            </span>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-[450] leading-none">
            {stack.title && !compactHeader && <span className="meta-dot text-(--color-text-4)" aria-hidden />}
            <span className="shrink-0 tabular-nums text-(--color-text-3)">{formatTime(stack.updatedAt, t)}</span>
            <span className="meta-dot text-(--color-text-4)" aria-hidden />
            <span className="tabular-nums text-(--color-text-3)">{t('output.imageCount', { count: totalItems })}</span>
            {activeStatusParts.length > 0 && (
              <>
                <span className="meta-dot text-(--color-text-4)" aria-hidden />
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-(--color-text-3)">
                    {activeStatusParts.map((part, index) => (
                      <span key={part.kind} className="contents">
                        {index > 0 && <span className="meta-dot text-(--color-text-4)" aria-hidden />}
                        <span>
                          {part.label}
                          {part.kind === 'queued' && (
                            <button
                              type="button"
                              onClick={onOpenGenerationSettings}
                              className="bg-transparent p-0 text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
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
                <span className="text-base tabular-nums" style={{ color: 'var(--color-danger)' }}>
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
            {stack.images.length > 0 && (
              <>
                <span className="meta-dot text-(--color-text-4)" aria-hidden />
                <button
                  type="button"
                  onClick={handleDownloadStack}
                  disabled={exporting}
                  className="inline-flex items-center gap-1 bg-transparent p-0 text-base text-(--color-text-3) transition-colors hover:text-(--color-text-2) disabled:cursor-default disabled:text-(--color-text-4)"
                  aria-label={t('common.download')}
                  title={t('common.download')}
                >
                  <Icon name="download" size={13} strokeWidth={1.8} />
                  {exporting ? t('output.exporting') : t('common.download')}
                </button>
                <span className="meta-dot text-(--color-text-4)" aria-hidden />
                <button
                  type="button"
                  onClick={handleDeleteStackImages}
                  className="bg-transparent p-0 text-base font-semibold transition-colors hover:brightness-110"
                  style={{ color: 'var(--color-danger)' }}
                  aria-label={t('output.deleteStack')}
                  title={t('output.deleteStack')}
                >
                  {deleteConfirming
                    ? t('output.confirmDeleteStack', { count: stack.images.length })
                    : t('common.delete')}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <ImageGrid layout="justified">
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
                      selectable={batchManageMode && item.type === 'image'}
                      selected={batchManageMode && item.type === 'image' && selectedImageIds?.has(item.image.id)}
                      showSlotReason
                      className="h-full w-full"
                      numberBadgeInset={8}
                      metaBadge={metaBadge}
                      metaBadgeTitle={metaBadge}
                      onSelect={handleSelectItem}
                      onLongPress={
                        !batchManageMode && item.type === 'image'
                          ? () => onLongPressBatchImage?.(item.image)
                          : undefined
                      }
                      onQuickSelect={
                        !batchManageMode && item.type === 'image'
                          ? () => onLongPressBatchImage?.(item.image)
                          : undefined
                      }
                      actions={
                        !batchManageMode && item.type === 'image' ? (
                          <StackThumbActions item={item} stackId={stackId} onEditItem={onEditItem} t={t} />
                        ) : undefined
                      }
                    />
                  </GridCell>
                )
              })
            ) : (
              <GridCell aspectRatio="4:3">
                <div
                  className="flex h-full w-full items-center justify-center rounded-[var(--radius-md)] text-sm text-(--color-text-4)"
                  style={{ background: 'var(--color-surface-2)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                >
                  {t('output.noImages')}
                </div>
              </GridCell>
            )}
          </ImageGrid>
        </div>
      </div>
    </div>
  )
})
