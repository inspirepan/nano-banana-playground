import { lazy, memo, Suspense, useCallback, useMemo } from 'react'

import { Icon } from './Icon'
import { hasActiveGenerationSlots, canDismissFailedGenerationJob } from './output/outputPanelHelpers'
import { StackRow } from './output/StackRow'
import { useInfiniteScrollSentinel } from './output/useInfiniteScrollSentinel'
import { useStackDeletion } from './output/useStackDeletion'
import { useStackDetailNavigation } from './output/useStackDetailNavigation'
import { useStackExporting } from './output/useStackExporting'
import { useStackScrollSync } from './output/useStackScrollSync'
import type { ModelConfig } from '../config/models'
import type { GenerationJob } from '../hooks/usePlayground'
import { useI18n } from '../i18n'
import { buildImageStacks, type ImageStack } from '../lib/stacks'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

const ImageDetailModal = lazy(() =>
  import('./image-detail/ImageDetailModal').then((module) => ({ default: module.ImageDetailModal })),
)

type Props = {
  history: PlaygroundImageMeta[]
  historyHasMore: boolean
  generationJobs: GenerationJob[]
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRetryGenerationSlot: (jobId: string, slotId: string) => { ok: boolean; message: string }
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
}

export const OutputPanel = memo(function OutputPanel({
  history,
  historyHasMore,
  generationJobs,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onRemove,
  onLoadMore,
  onOpenGenerationSettings,
  highlightStackId,
}: Props) {
  const { t } = useI18n()
  const stacks = useMemo(() => buildImageStacks(history, generationJobs), [history, generationJobs])
  const generatedImageCount = useMemo(
    () => history.reduce((count, img) => count + (img.source.type === 'generated' ? 1 : 0), 0),
    [history],
  )
  const stackIndexById = useMemo(() => new Map(stacks.map((stack, index) => [stack.id, index])), [stacks])

  const {
    detailTarget,
    setDetailTarget,
    detailStack,
    previousStackTarget,
    nextStackTarget,
    openStackItem,
    editStackItem,
    openStackGallery,
    navigateDetailToTarget,
  } = useStackDetailNavigation({ stacks, stackIndexById })

  const { exporting, exportingStackId, handleExportAll, handleExportStack } = useStackExporting({ history })

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
    },
    [onDismissGenerationJob],
  )

  const {
    confirmDeleteStackId,
    deletingStackId,
    handleRequestDeleteStack,
    handleCancelDeleteStack,
    handleDeleteStackClick,
  } = useStackDeletion({ onRemove })

  const { scrollRef, stackRowRefs } = useStackScrollSync({ stacks, highlightStackId })
  const { sentinelRef } = useInfiniteScrollSentinel({ historyHasMore, onLoadMore })

  return (
    <div
      ref={scrollRef}
      className="flex-1 md:flex-[2_1_0%] overflow-visible md:overflow-y-auto md:[scrollbar-gutter:stable] md:px-[26px] md:py-[22px] md:pb-[80px]"
    >
      <div className="mb-5 space-y-3 px-3 md:px-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="font-display text-xl font-semibold tracking-[-0.01em]">{t('common.gallery')}</div>
            <div className="text-sm text-(--color-text-3) mt-0.5">
              {t('output.gallerySummary', { groups: stacks.length, count: generatedImageCount })}
            </div>
          </div>
          <div className="flex-1" />
          {history.length > 0 && (
            <button type="button" onClick={handleExportAll} disabled={exporting} className="chip shrink-0">
              <Icon name="download" size={12} /> {exporting ? t('output.exporting') : t('output.exportZip')}
            </button>
          )}
        </div>
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
                    onOpenGallery={openStackGallery}
                    onDownloadStack={handleExportStack}
                    onCancelStackGeneration={handleCancelStackGeneration}
                    onDismissStackFailedJobs={handleDismissStackFailedJobs}
                    onOpenGenerationSettings={onOpenGenerationSettings}
                    onDeleteStack={handleDeleteStackClick}
                    downloading={exportingStackId === stack.id}
                    deleteConfirming={confirmDeleteStackId === stack.id}
                    deleting={deletingStackId === stack.id}
                    onRequestDeleteConfirm={handleRequestDeleteStack}
                    onCancelDeleteConfirm={handleCancelDeleteStack}
                    t={t}
                  />
                </div>
              )
            })}
          </div>

          {historyHasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <div className="text-sm text-(--color-text-3)">{t('common.loadingMore')}</div>
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

      {detailStack && (
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
            onRemove={onRemove}
          />
        </Suspense>
      )}
    </div>
  )
})
