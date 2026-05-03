import { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from 'react'

import { Icon } from './Icon'
import { GridCell, ImageGrid } from './ImageGrid'
import { StackItemThumb } from './StackItemThumb'
import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import { useExternalSync } from '../hooks/effects'
import type { GenerationJob } from '../hooks/usePlayground'
import { useI18n, type Translate } from '../i18n'
import { downloadImagePng, downloadImagesZip } from '../lib/exportImages'
import { countSlots, formatTime } from '../lib/queueJobDisplay'
import { buildImageStacks, type ImageStack, type StackItem } from '../lib/stacks'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

const MODEL_CONFIG_BY_ID = new Map(MODEL_CONFIGS.map((m) => [m.id, m]))
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

type DetailTarget = { stackId: string; itemId?: string; viewMode?: 'detail' | 'gallery'; initialEditing?: boolean }
type DetailNavigationTarget = { stackId: string; itemId: string }
type ActiveStackStatusPart = { kind: 'running' | 'retrying' | 'queued'; label: string }
type ItemGenerationSummary = { modelName: string; aspectRatio: string; resolution: string }

function latestImages(stack: ImageStack): PlaygroundImageMeta[] {
  return stack.images.toSorted((a, b) => b.timestamp - a.timestamp)
}

function firstStackItemTarget(stack: ImageStack | undefined): DetailNavigationTarget | null {
  const item = stack?.items[0]
  return item ? { stackId: stack.id, itemId: item.id } : null
}

function lastStackItemTarget(stack: ImageStack | undefined): DetailNavigationTarget | null {
  const item = stack?.items[stack.items.length - 1]
  return item ? { stackId: stack.id, itemId: item.id } : null
}

function stackItemAspectRatio(item: StackItem): string {
  if (item.type === 'image' && item.image.source.type === 'generated') return item.image.source.aspectRatio
  if (item.type === 'slot') return item.job.request.aspectRatio
  return '1:1'
}

function stackItemGenerationSummary(item: StackItem): ItemGenerationSummary | null {
  if (item.type === 'slot') {
    return {
      modelName: item.job.request.model.name,
      aspectRatio: item.job.request.aspectRatio,
      resolution: item.job.request.resolution,
    }
  }
  const source = item.image.source
  if (source.type !== 'generated') return null
  return {
    modelName: MODEL_CONFIG_BY_ID.get(source.modelId)?.name ?? source.modelId,
    aspectRatio: source.aspectRatio,
    resolution: source.resolution,
  }
}

function hasActiveGenerationSlots(job: GenerationJob): boolean {
  return job.slots.some((slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying')
}

function canDismissFailedGenerationJob(job: GenerationJob): boolean {
  return !hasActiveGenerationSlots(job) && job.slots.some((slot) => slot.status === 'failed')
}

function activeStackStatusParts(stack: ImageStack, t: Translate): ActiveStackStatusPart[] {
  const counts = countSlots(stack.jobs.flatMap((job) => job.slots))
  const parts: ActiveStackStatusPart[] = []
  if (counts.running > 0)
    parts.push({ kind: 'running', label: t('output.status.generatingCount', { count: counts.running }) })
  if (counts.retrying > 0)
    parts.push({ kind: 'retrying', label: t('output.status.retryingCount', { count: counts.retrying }) })
  if (counts.queued > 0) parts.push({ kind: 'queued', label: t('output.status.queuedCount', { count: counts.queued }) })
  return parts
}

const StackRow = memo(function StackRow({
  stack,
  onOpenItem,
  onEditItem,
  onOpenGallery,
  onDownloadStack,
  onCancelStackGeneration,
  onDismissStackFailedJobs,
  onOpenGenerationSettings,
  onDeleteStack,
  downloading,
  deleteConfirming,
  deleting,
  onRequestDeleteConfirm,
  onCancelDeleteConfirm,
  t,
}: {
  stack: ImageStack
  onOpenItem: (stack: ImageStack, item: StackItem) => void
  onEditItem: (stack: ImageStack, item: StackItem) => void
  onOpenGallery: (stack: ImageStack) => void
  onDownloadStack: (stack: ImageStack) => void
  onCancelStackGeneration: (stack: ImageStack) => void
  onDismissStackFailedJobs: (stack: ImageStack) => void
  onOpenGenerationSettings: () => void
  onDeleteStack: (stack: ImageStack) => void
  downloading: boolean
  deleteConfirming: boolean
  deleting: boolean
  onRequestDeleteConfirm: (stackId: string) => void
  onCancelDeleteConfirm: () => void
  t: Translate
}) {
  const totalItems = stack.images.length + stack.activeSlotCount + stack.failedSlotCount
  const activeStatusParts = useMemo(() => activeStackStatusParts(stack, t), [stack, t])
  const hasDismissibleFailures = useMemo(() => stack.jobs.some(canDismissFailedGenerationJob), [stack.jobs])
  const stackItemNumberById = useMemo(
    () => new Map(stack.items.map((item, index) => [item.id, index + 1])),
    [stack.items],
  )
  const previewItems = stack.items
  const canDelete = stack.images.length > 0 && activeStatusParts.length === 0

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
                      onSelect={(next) => onOpenItem(stack, next)}
                      actions={
                        item.type === 'image' ? (
                          <div className="pointer-events-none hidden items-center gap-1 opacity-[0.001] transition-opacity md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                onEditItem(stack, item)
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
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingStackId, setExportingStackId] = useState<string | null>(null)
  const [confirmDeleteStackId, setConfirmDeleteStackId] = useState<string | null>(null)
  const [deletingStackId, setDeletingStackId] = useState<string | null>(null)
  const stackRowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const stacks = useMemo(() => buildImageStacks(history, generationJobs), [history, generationJobs])
  const generatedImageCount = useMemo(
    () => history.reduce((count, img) => count + (img.source.type === 'generated' ? 1 : 0), 0),
    [history],
  )
  const stackIndexById = useMemo(() => new Map(stacks.map((stack, index) => [stack.id, index])), [stacks])
  const detailStackIndex = detailTarget ? (stackIndexById.get(detailTarget.stackId) ?? -1) : -1
  const detailStack = detailStackIndex >= 0 ? stacks[detailStackIndex] : null
  const previousStackTarget = detailStackIndex > 0 ? lastStackItemTarget(stacks[detailStackIndex - 1]) : null
  const nextStackTarget =
    detailStackIndex >= 0 && detailStackIndex < stacks.length - 1
      ? firstStackItemTarget(stacks[detailStackIndex + 1])
      : null

  const openStackItem = useCallback((stack: ImageStack, item: StackItem) => {
    setDetailTarget({ stackId: stack.id, itemId: item.id, viewMode: 'detail' })
  }, [])

  const editStackItem = useCallback((stack: ImageStack, item: StackItem) => {
    if (item.type !== 'image') return
    setDetailTarget({ stackId: stack.id, itemId: item.id, viewMode: 'detail', initialEditing: true })
  }, [])

  const openStackGallery = useCallback((stack: ImageStack) => {
    const newestImage = latestImages(stack)[0]
    const fallbackItem = stack.items[stack.items.length - 1]
    setDetailTarget({ stackId: stack.id, itemId: newestImage?.id ?? fallbackItem?.id, viewMode: 'gallery' })
  }, [])

  const navigateDetailToTarget = useCallback((target: DetailNavigationTarget) => {
    setDetailTarget({ stackId: target.stackId, itemId: target.itemId, viewMode: 'detail' })
  }, [])

  const handleExportAll = async () => {
    if (exporting || history.length === 0) return
    setExporting(true)
    try {
      await downloadImagesZip(history, `nano-banana-export-${new Date().toISOString().slice(0, 10)}.zip`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportStack = useCallback(
    async (stack: ImageStack) => {
      if (exportingStackId || stack.images.length < 2) return
      setExportingStackId(stack.id)
      try {
        await downloadImagesZip(stack.images, `nano-banana-stack-${stack.id.slice(0, 8)}.zip`)
      } finally {
        setExportingStackId(null)
      }
    },
    [exportingStackId],
  )

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

  const handleRequestDeleteStack = useCallback((stackId: string) => {
    setConfirmDeleteStackId(stackId)
  }, [])

  const handleCancelDeleteStack = useCallback(() => {
    setConfirmDeleteStackId(null)
  }, [])

  const handleDeleteStack = useCallback(
    async (stack: ImageStack) => {
      if (deletingStackId) return
      setDeletingStackId(stack.id)
      try {
        for (const image of stack.images) {
          await Promise.resolve(onRemove(image.id))
        }
        setConfirmDeleteStackId((current) => (current === stack.id ? null : current))
      } finally {
        setDeletingStackId(null)
      }
    },
    [deletingStackId, onRemove],
  )

  const handleDeleteStackClick = useCallback(
    (stack: ImageStack) => {
      handleDeleteStack(stack).catch(() => undefined)
    },
    [handleDeleteStack],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const topStackIdRef = useRef<string | null>(null)

  useExternalSync(() => {
    const topStackId = stacks[0]?.id ?? null
    if (topStackId && topStackIdRef.current !== topStackId) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    topStackIdRef.current = topStackId
  }, [stacks])

  useExternalSync(() => {
    if (!highlightStackId) return
    const el = stackRowRefs.current.get(highlightStackId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightStackId])

  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreStable = useCallback(() => {
    onLoadMore()
  }, [onLoadMore])

  useExternalSync(() => {
    const el = sentinelRef.current
    if (!el || !historyHasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMoreStable()
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [historyHasMore, onLoadMoreStable])

  return (
    <div
      ref={scrollRef}
      className="flex-1 md:flex-[2_1_0%] overflow-visible md:overflow-y-auto [scrollbar-gutter:stable] md:px-[26px] md:py-[22px] md:pb-[80px]"
    >
      <div className="mb-5 space-y-3">
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
