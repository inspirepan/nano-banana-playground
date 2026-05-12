import { memo, useCallback, useMemo, useRef, useState } from 'react'

import { activeStackStatusParts, stackItemAspectRatio, stackItemGenerationSummary } from './outputPanelHelpers'
import { useWindowEvent } from '../../hooks/effects'
import type { Translate } from '../../i18n'
import { downloadImagePng, downloadImagesZip } from '../../lib/exportImages'
import { formatTime } from '../../lib/queueJobDisplay'
import type { ImageStack, StackItem, StackImageItem, StackSlotItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { GridCell, ImageGrid } from '../ImageGrid'
import { StackItemThumb } from '../StackItemThumb'
import { Tooltip } from '../Tooltip'

export type StackRowProps = {
  stack: ImageStack
  onOpenItem: (stackId: string, item: StackItem) => void
  onEditItem: (stackId: string, item: StackItem) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRetrySlotItem: (item: StackSlotItem) => void
  onDismissSlotItem: (item: StackSlotItem) => void
  onRemoveStackImages: (stack: ImageStack) => void
  onOpenGenerationSettings: () => void
  batchManageMode?: boolean
  selectedImageIds?: Set<string>
  onToggleBatchImage?: (image: StackImageItem['image']) => void
  onLongPressBatchImage?: (image: StackImageItem['image']) => void
  compactHeader?: boolean
  indexNumber?: number
  t: Translate
}

type SlotThumbActionsProps = {
  item: StackSlotItem
  onCancelGenerationSlot: (slotId: string) => void
  onRetrySlotItem: (item: StackSlotItem) => void
  onDismissSlotItem: (item: StackSlotItem) => void
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
    <div className="pointer-events-none hidden items-center gap-1 opacity-[0.001] transition-opacity md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 @max-[140px]/thumb:justify-end">
      <Tooltip text={t('common.edit')} placement="top" className="min-w-0 flex-1 @max-[140px]/thumb:flex-none">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEditItem(stackId, item)
          }}
          aria-label={t('common.edit')}
          className="media-action w-full min-w-0 px-2 @max-[140px]/thumb:size-7 @max-[140px]/thumb:justify-center @max-[140px]/thumb:px-0"
        >
          <Icon name="wand" size={11} strokeWidth={1.8} />
          <span className="@max-[140px]/thumb:hidden">{t('common.edit')}</span>
        </button>
      </Tooltip>
      <Tooltip text={t('common.download')} placement="top" className="min-w-0 flex-1 @max-[140px]/thumb:flex-none">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void downloadImagePng(item.image)
          }}
          aria-label={t('common.download')}
          className="media-action w-full min-w-0 px-2 @max-[140px]/thumb:size-7 @max-[140px]/thumb:justify-center @max-[140px]/thumb:px-0"
        >
          <Icon name="download" size={11} strokeWidth={1.8} />
          <span className="@max-[140px]/thumb:hidden">{t('common.download')}</span>
        </button>
      </Tooltip>
    </div>
  )
})

const SlotThumbActions = memo(function SlotThumbActions({
  item,
  onCancelGenerationSlot,
  onRetrySlotItem,
  onDismissSlotItem,
  t,
}: SlotThumbActionsProps) {
  const active = item.slot.status === 'queued' || item.slot.status === 'running' || item.slot.status === 'retrying'
  if (active) {
    return (
      <div className="pointer-events-auto flex w-full max-w-[9rem] items-center gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCancelGenerationSlot(item.slot.id)
          }}
          className="media-action danger min-w-0 flex-1 px-2"
        >
          {t('common.cancel')}
        </button>
      </div>
    )
  }

  if (item.slot.status !== 'failed') return null
  return (
    <div className="pointer-events-auto flex w-full max-w-[18rem] items-center gap-1.5">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onRetrySlotItem(item)
        }}
        className="media-action light min-w-0 flex-1 px-2"
      >
        <Icon name="refresh" size={11} strokeWidth={1.8} />
        {t('common.retry')}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDismissSlotItem(item)
        }}
        className="media-action light min-w-0 flex-1 px-2"
      >
        {t('common.close')}
      </button>
    </div>
  )
})

export const StackRow = memo(function StackRow({
  stack,
  onOpenItem,
  onEditItem,
  onCancelGenerationSlot,
  onRetrySlotItem,
  onDismissSlotItem,
  onRemoveStackImages,
  onOpenGenerationSettings,
  batchManageMode = false,
  selectedImageIds,
  onToggleBatchImage,
  onLongPressBatchImage,
  compactHeader = false,
  indexNumber,
  t,
}: StackRowProps) {
  const [exporting, setExporting] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const activeStatusParts = useMemo(() => activeStackStatusParts(stack, t), [stack, t])

  // Dismiss the delete-confirm pending state on outside pointerdown or Esc,
  // so users can opt out without an explicit cancel control.
  useWindowEvent(
    'pointerdown',
    (event) => {
      if (deleteButtonRef.current?.contains(event.target as Node)) return
      setDeleteConfirming(false)
    },
    { capture: true },
    deleteConfirming,
  )
  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') setDeleteConfirming(false)
    },
    undefined,
    deleteConfirming,
  )

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
      else {
        // stack.id is "stack-{hash}"; slice(6, 12) drops the literal prefix
        // so the zip name doesn't duplicate "stack-" twice.
        const stackDate = new Date(stack.updatedAt).toISOString().slice(0, 10)
        const stackHash = stack.id.slice(6, 12)
        await downloadImagesZip(stack.images, `image-stack-${stackDate}-${stackHash}.zip`)
      }
    } finally {
      setExporting(false)
    }
  }, [exporting, stack.id, stack.images, stack.updatedAt])

  const handleDeleteStackImages = useCallback(() => {
    if (stack.images.length === 0) return
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      return
    }
    onRemoveStackImages(stack)
    setDeleteConfirming(false)
  }, [deleteConfirming, onRemoveStackImages, stack])

  const actionsPinned = deleteConfirming || exporting

  return (
    <div className="group/stack w-full max-w-full min-w-0 overflow-hidden">
      <div className="w-full max-w-full min-w-0 px-3 py-2">
        <div className="mb-1 flex w-full min-w-0 flex-col gap-y-1 overflow-hidden">
          {(stack.title || indexNumber !== undefined) &&
            (stack.title ? (
              <Tooltip text={stack.title} placement="bottom" maxWidth={360} className="block w-full min-w-0">
                <span className="block w-full min-w-0 truncate text-base font-medium leading-tight text-(--color-text-1) tracking-[-0.005em]">
                  {indexNumber !== undefined && (
                    <span className="mono mr-2 text-xs font-medium text-(--color-text-4) tabular-nums tracking-normal">
                      #{String(indexNumber).padStart(2, '0')}
                    </span>
                  )}
                  <span key={stack.title} className="title-fade-in">
                    {stack.title}
                  </span>
                </span>
              </Tooltip>
            ) : (
              <span className="block w-full min-w-0 truncate text-base font-medium leading-tight text-(--color-text-1) tracking-[-0.005em]">
                {indexNumber !== undefined && (
                  <span className="mono mr-2 text-xs font-medium text-(--color-text-4) tabular-nums tracking-normal">
                    #{String(indexNumber).padStart(2, '0')}
                  </span>
                )}
              </span>
            ))}
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-none">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-(--color-text-3)">
              <span className="shrink-0 tabular-nums">{formatTime(stack.updatedAt, t)}</span>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              <span className="tabular-nums">{t('output.imageCount', { count: stack.images.length })}</span>
              {activeStatusParts.length > 0 && (
                <>
                  <span className="meta-dot text-(--color-text-4)" aria-hidden />
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    {activeStatusParts.map((part, index) => (
                      <span key={part.kind} className="contents">
                        {index > 0 && <span className="meta-dot text-(--color-text-4)" aria-hidden />}
                        <span>
                          {part.label}
                          {part.kind === 'queued' && (
                            <button
                              type="button"
                              onClick={onOpenGenerationSettings}
                              className="ml-0.5 bg-transparent p-0 text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
                            >
                              {t('output.adjustParenthetical')}
                            </button>
                          )}
                        </span>
                      </span>
                    ))}
                  </span>
                </>
              )}
              {stack.failedSlotCount > 0 && (
                <>
                  <span className="meta-dot text-(--color-text-4)" aria-hidden />
                  <span className="tabular-nums text-(--color-danger)">
                    {t('output.failedCount', { count: stack.failedSlotCount })}
                  </span>
                </>
              )}
            </div>
            {stack.images.length > 0 && (
              <div
                className={`flex shrink-0 items-center gap-1 transition-opacity duration-150 ${
                  actionsPinned || compactHeader
                    ? 'opacity-100'
                    : 'opacity-100 md:pointer-events-none md:opacity-0 md:group-hover/stack:pointer-events-auto md:group-hover/stack:opacity-100 md:group-focus-within/stack:pointer-events-auto md:group-focus-within/stack:opacity-100'
                }`}
              >
                <Tooltip text={t('common.download')} placement="top" className="shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadStack}
                    disabled={exporting}
                    className={`chip ghost h-7 shrink-0 text-xs text-(--color-text-3) hover:text-(--color-text-1) ${compactHeader ? 'w-7 justify-center px-0' : 'px-2'}`}
                    aria-label={t('common.download')}
                  >
                    <Icon name="download" size={11} strokeWidth={1.8} />
                    {!compactHeader && (exporting ? t('output.exporting') : t('common.download'))}
                  </button>
                </Tooltip>
                <Tooltip text={t('output.deleteStack')} placement="top" className="shrink-0">
                  <button
                    ref={deleteButtonRef}
                    type="button"
                    onClick={handleDeleteStackImages}
                    className={`chip h-7 shrink-0 text-xs ${
                      deleteConfirming
                        ? 'danger px-2'
                        : `ghost text-(--color-text-3) hover:text-(--color-danger) ${compactHeader ? 'w-7 justify-center px-0' : 'px-2'}`
                    }`}
                    aria-label={t('output.deleteStack')}
                  >
                    <Icon name="trash" size={11} strokeWidth={1.8} />
                    {deleteConfirming
                      ? t('output.confirmDeleteStack', { count: stack.images.length })
                      : !compactHeader && t('common.delete')}
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
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
                        ) : !batchManageMode && item.type === 'slot' ? (
                          <SlotThumbActions
                            item={item}
                            onCancelGenerationSlot={onCancelGenerationSlot}
                            onRetrySlotItem={onRetrySlotItem}
                            onDismissSlotItem={onDismissSlotItem}
                            t={t}
                          />
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
