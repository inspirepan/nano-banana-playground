import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react'

import { Icon } from './Icon'
import { LazyChunkLoadErrorBoundary } from './LazyChunkLoadErrorBoundary'
import { Tooltip } from './Tooltip'
import { canDismissFailedGenerationJob, hasActiveGenerationSlots, type DetailTarget } from './output/outputPanelHelpers'
import { StackRow } from './output/StackRow'
import { useInfiniteScrollSentinel } from './output/useInfiniteScrollSentinel'
import { useStackDetailNavigation } from './output/useStackDetailNavigation'
import { useStackExporting } from './output/useStackExporting'
import { useStackScrollSync } from './output/useStackScrollSync'
import type { ModelConfig } from '../config/models'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { GenerationJob } from '../hooks/usePlayground'
import { useStripDownloadMetadata } from '../hooks/useStripDownloadMetadata'
import { useI18n } from '../i18n'
import { buildImageStacks, type ImageStack } from '../lib/stacks'
import { downloadImagesZip } from '../lib/exportImages'
import { recoverFromLazyChunkLoadError } from '../lib/lazyChunkRecovery'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

const ImageDetailModal = lazy(() =>
  import('./image-detail/ImageDetailModal')
    .then((module) => ({ default: module.ImageDetailModal }))
    .catch((error: unknown) => recoverFromLazyChunkLoadError(error, 'ImageDetailModal')),
)

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}

type Props = {
  history: PlaygroundImageMeta[]
  historyHasMore: boolean
  generationJobs: GenerationJob[]
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRetryGenerationSlot: (jobId: string, slotId: string) => { ok: boolean; message: string }
  onRetryFailedGenerationImage: (image: PlaygroundImageMeta) => Promise<{ ok: boolean; message: string }>
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onReroll: (image: PlaygroundImageMeta) => Promise<{ ok: boolean; message: string }>
  onEditImage: (params: {
    sourceImage: PlaygroundImageMeta
    model: ModelConfig
    prompt: string
    extraReferences: PlaygroundImage[]
    resolution: string
    aspectRatio: string
    options: Record<string, unknown>
    batchCount: number
    annotatedSource?: PlaygroundImage
    mask?: PlaygroundImage
  }) => Promise<string | null>
  onRemove: (id: string) => void
  onLoadMore: () => void
  onOpenGenerationSettings: () => void
  highlightStackId?: string | null
  externalDetailTarget?: DetailTarget | null
  onExternalDetailTargetConsumed?: () => void
  compactStackHeader?: boolean
}

export const OutputPanel = memo(function OutputPanel({
  history,
  historyHasMore,
  generationJobs,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  onRetryFailedGenerationImage,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onRemove,
  onLoadMore,
  onOpenGenerationSettings,
  highlightStackId,
  externalDetailTarget,
  onExternalDetailTargetConsumed,
  compactStackHeader = false,
}: Props) {
  const { t } = useI18n()
  const stacks = useMemo(() => buildImageStacks(history, generationJobs), [history, generationJobs])
  const exportableHistory = useMemo(
    () => history.filter((image) => image.source.type !== 'generation-failure'),
    [history],
  )
  const generatedImageCount = useMemo(() => {
    let total = 0
    for (const stack of stacks) total += stack.images.length
    return total
  }, [stacks])
  const [batchManageMode, setBatchManageMode] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set())
  const [batchExporting, setBatchExporting] = useState(false)
  const [batchDeleteConfirming, setBatchDeleteConfirming] = useState(false)
  const selectedImages = useMemo(
    () => exportableHistory.filter((image) => selectedImageIds.has(image.id)),
    [exportableHistory, selectedImageIds],
  )
  const selectedImageCount = selectedImages.length
  const allBatchSelected = exportableHistory.length > 0 && selectedImageCount === exportableHistory.length
  const stackIndexById = useMemo(() => new Map(stacks.map((stack, index) => [stack.id, index])), [stacks])
  const { stripDownloadMetadata, setStripDownloadMetadata } = useStripDownloadMetadata()

  const {
    detailTarget,
    setDetailTarget,
    detailStack,
    previousStackTarget,
    nextStackTarget,
    openStackItem,
    editStackItem,
    navigateDetailToTarget,
  } = useStackDetailNavigation({ stacks, stackIndexById })

  useExternalSync(() => {
    if (!externalDetailTarget) return
    setDetailTarget(externalDetailTarget)
    onExternalDetailTargetConsumed?.()
  }, [externalDetailTarget, onExternalDetailTargetConsumed, setDetailTarget])

  const { exporting, handleExportAll } = useStackExporting({
    history: exportableHistory,
  })

  const handleCancelStackGeneration = useCallback(
    (stack: ImageStack) => {
      for (const job of stack.jobs) {
        if (hasActiveGenerationSlots(job)) onCancelGenerationJob(job.id)
      }
    },
    [onCancelGenerationJob],
  )

  const handleDismissStackFailedJobs = useCallback(
    (stack: ImageStack) => {
      for (const job of stack.jobs) {
        if (canDismissFailedGenerationJob(job)) onDismissGenerationJob(job.id)
      }
      for (const item of stack.items) {
        if (item.type === 'slot' && item.failureImage) void onRemove(item.failureImage.id)
      }
    },
    [onDismissGenerationJob, onRemove],
  )

  const handleRetryStackFailedSlots = useCallback(
    (stack: ImageStack) => {
      for (const item of stack.items) {
        if (item.type !== 'slot' || item.slot.status !== 'failed') continue
        if (item.failureImage) void onRetryFailedGenerationImage(item.failureImage)
        else onRetryGenerationSlot(item.job.id, item.slot.id)
      }
    },
    [onRetryFailedGenerationImage, onRetryGenerationSlot],
  )

  const handleEnterBatchManage = useCallback(() => {
    setBatchDeleteConfirming(false)
    setBatchManageMode(true)
  }, [])

  const handleExitBatchManage = useCallback(() => {
    setBatchDeleteConfirming(false)
    setSelectedImageIds(new Set())
    setBatchManageMode(false)
  }, [])

  const handleToggleBatchImage = useCallback((image: PlaygroundImageMeta) => {
    setBatchDeleteConfirming(false)
    setSelectedImageIds((prev) => {
      const next = new Set(prev)
      if (next.has(image.id)) next.delete(image.id)
      else next.add(image.id)
      return next
    })
  }, [])

  const handleLongPressBatchImage = useCallback((image: PlaygroundImageMeta) => {
    setBatchDeleteConfirming(false)
    setBatchManageMode(true)
    setSelectedImageIds((prev) => {
      const next = new Set(prev)
      next.add(image.id)
      return next
    })
  }, [])

  const handleToggleBatchSelectAll = useCallback(() => {
    setBatchDeleteConfirming(false)
    setSelectedImageIds(allBatchSelected ? new Set() : new Set(exportableHistory.map((image) => image.id)))
  }, [allBatchSelected, exportableHistory])

  const handleExportSelected = useCallback(async () => {
    if (batchExporting || selectedImages.length === 0) return
    setBatchExporting(true)
    try {
      await downloadImagesZip(selectedImages, `nano-banana-selected-${new Date().toISOString().slice(0, 10)}.zip`)
    } finally {
      setBatchExporting(false)
    }
  }, [batchExporting, selectedImages])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedImages.length === 0) return
    if (!batchDeleteConfirming) {
      setBatchDeleteConfirming(true)
      return
    }
    await Promise.all(selectedImages.map((image) => Promise.resolve(onRemove(image.id))))
    setSelectedImageIds(new Set())
    setBatchDeleteConfirming(false)
  }, [batchDeleteConfirming, onRemove, selectedImages])

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        handleExitBatchManage()
        return
      }
      if (event.key.toLowerCase() !== 'a' || (!event.metaKey && !event.ctrlKey) || event.altKey) return
      if (isEditableKeyboardTarget(event.target)) return
      event.preventDefault()
      setBatchDeleteConfirming(false)
      setSelectedImageIds(new Set(exportableHistory.map((image) => image.id)))
    },
    undefined,
    batchManageMode,
  )

  const { scrollRef, stackRowRefs } = useStackScrollSync({ stacks, highlightStackId })
  const { sentinelRef } = useInfiniteScrollSentinel({ historyHasMore, onLoadMore })
  const batchToolbar = (
    <>
      <span className="inline-flex h-7 shrink-0 items-center rounded-[var(--radius-sm)] bg-(--color-accent-wash) px-2.5 text-base font-medium text-(--color-accent-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
        {selectedImageCount > 0 ? t('output.selectedCount', { selected: selectedImageCount }) : t('output.batchManage')}
      </span>
      <button type="button" onClick={handleToggleBatchSelectAll} className="chip ghost shrink-0">
        {allBatchSelected ? t('output.deselectAll') : t('output.selectAll')}
      </button>
      <button
        type="button"
        onClick={handleExportSelected}
        disabled={batchExporting || selectedImageCount === 0}
        className="chip ghost shrink-0"
      >
        <Icon name="download" size={12} strokeWidth={1.8} />
        {batchExporting ? t('output.exporting') : t('common.download')}
      </button>
      <button
        type="button"
        onClick={handleDeleteSelected}
        disabled={selectedImageCount === 0}
        className="chip ghost danger shrink-0"
      >
        <Icon name="trash" size={12} strokeWidth={1.8} />
        {batchDeleteConfirming ? t('output.confirmDeleteSelected', { count: selectedImageCount }) : t('common.delete')}
      </button>
      <button type="button" onClick={handleExitBatchManage} className="chip ghost shrink-0">
        {t('output.done')}
      </button>
    </>
  )

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-visible px-[var(--panel-pad-x)] py-[var(--panel-pad-top)] pb-[var(--panel-pad-bottom)] md:flex-[2_1_0%] md:overflow-y-auto md:[scrollbar-gutter:stable_both-edges] md:px-[26px] md:py-[22px] md:pb-[80px]"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="font-display text-xl font-semibold tracking-[-0.01em]">{t('common.gallery')}</div>
          <div className="mt-1.5 text-pretty text-sm tabular-nums text-(--color-text-3)">
            {t('output.gallerySummary', { groups: stacks.length, count: generatedImageCount })}
          </div>
        </div>
        <div className="flex-1" />
        {exportableHistory.length > 0 && (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end">
            {!batchManageMode && (
              <>
                <Tooltip
                  text={t('output.stripMetadataTooltip')}
                  placement="top"
                  maxWidth={300}
                  className="inline-flex shrink-0"
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={stripDownloadMetadata}
                    aria-label={t('output.stripMetadataToggle')}
                    onClick={() => setStripDownloadMetadata(!stripDownloadMetadata)}
                    data-active={stripDownloadMetadata}
                    className="chip shrink-0"
                  >
                    <span
                      className={`size-1.5 rounded-full ${stripDownloadMetadata ? 'bg-(--color-accent)' : 'bg-(--color-text-4)'}`}
                      aria-hidden="true"
                    />
                    {t('output.stripMetadataShort')}
                  </button>
                </Tooltip>
                <button type="button" onClick={handleExportAll} disabled={exporting} className="chip shrink-0">
                  <Icon name="download" size={12} /> {exporting ? t('output.exporting') : t('output.exportZip')}
                </button>
                <button type="button" onClick={handleEnterBatchManage} className="chip shrink-0">
                  <Icon name="list_checks" size={12} /> {t('output.batchManage')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {stacks.length > 0 ? (
        <div className="space-y-[26px]">
          <div className="space-y-2">
            {stacks.map((stack) => {
              const isHighlighted = highlightStackId === stack.id
              return (
                <div
                  key={stack.id}
                  ref={(el) => {
                    if (el) stackRowRefs.current.set(stack.id, el)
                    else stackRowRefs.current.delete(stack.id)
                  }}
                  className="rounded-[var(--radius-lg)] transition-shadow duration-300 ease-out motion-reduce:!transition-none"
                  style={
                    isHighlighted
                      ? {
                          boxShadow: 'inset 0 0 0 2px var(--color-accent), 0 0 0 4px var(--color-accent-soft)',
                        }
                      : undefined
                  }
                >
                  <StackRow
                    stack={stack}
                    onOpenItem={openStackItem}
                    onEditItem={editStackItem}
                    onCancelStackGeneration={handleCancelStackGeneration}
                    onRetryStackFailedSlots={handleRetryStackFailedSlots}
                    onDismissStackFailedJobs={handleDismissStackFailedJobs}
                    onOpenGenerationSettings={onOpenGenerationSettings}
                    batchManageMode={batchManageMode}
                    selectedImageIds={selectedImageIds}
                    onToggleBatchImage={handleToggleBatchImage}
                    onLongPressBatchImage={handleLongPressBatchImage}
                    compactHeader={compactStackHeader}
                    t={t}
                  />
                </div>
              )
            })}
          </div>

          {historyHasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <button type="button" onClick={onLoadMore} className="chip justify-center text-sm">
                <Icon name="expand_more" size={13} />
                {t('common.loadMore')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card px-4 py-5 text-(--color-text-3)">
          <div className="label mb-2">{t('output.emptyHistory')}</div>
          <div className="text-base font-medium text-(--color-text-2)">{t('output.emptyTitle')}</div>
          <div className="mt-1 text-sm leading-[1.7] text-(--color-text-3)">{t('output.emptyDescription')}</div>
        </div>
      )}

      {batchManageMode && (
        <div className="pointer-events-none fixed right-4 top-[calc(env(safe-area-inset-top)+64px)] z-40 flex max-w-[calc(100vw-24px)] justify-end pl-2 md:right-6 md:top-6">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[var(--radius-lg)] bg-(--color-surface) p-1.5 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]">
            {batchToolbar}
          </div>
        </div>
      )}

      {detailStack && (
        <LazyChunkLoadErrorBoundary
          title={t('imageDetail.loadError.title')}
          description={t('imageDetail.loadError.description')}
          closeLabel={t('common.close')}
          refreshLabel={t('common.refresh')}
          onClose={() => setDetailTarget(null)}
        >
          <Suspense fallback={null}>
            <ImageDetailModal
              stack={detailStack}
              initialItemId={detailTarget?.itemId}
              initialViewMode={detailTarget?.viewMode}
              initialEditing={detailTarget?.initialEditing}
              previousStackTarget={previousStackTarget}
              nextStackTarget={nextStackTarget}
              history={history}
              generationJobs={generationJobs}
              onNavigateToStackItem={navigateDetailToTarget}
              onClose={() => setDetailTarget(null)}
              onAddToRef={onAddToRef}
              onRegenerate={onRegenerate}
              onReroll={onReroll}
              onEditImage={onEditImage}
              onCancelGenerationJob={onCancelGenerationJob}
              onDismissGenerationJob={onDismissGenerationJob}
              onCancelGenerationSlot={onCancelGenerationSlot}
              onRetryGenerationSlot={onRetryGenerationSlot}
              onRetryFailedGenerationImage={onRetryFailedGenerationImage}
              onRemove={onRemove}
            />
          </Suspense>
        </LazyChunkLoadErrorBoundary>
      )}
    </div>
  )
})
