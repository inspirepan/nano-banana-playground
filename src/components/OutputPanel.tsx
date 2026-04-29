import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from './Icon'
import { ImageDetailModal } from './image-detail/ImageDetailModal'
import { GridCell, ImageGrid } from './ImageGrid'
import { StackItemThumb } from './StackItemThumb'
import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import type { GenerationJob } from '../hooks/usePlayground'
import { downloadImagePng, downloadImagesZip } from '../lib/exportImages'
import { countSlots, formatTime } from '../lib/queueJobDisplay'
import { buildImageStacks, type ImageStack, type StackItem } from '../lib/stacks'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

type Props = {
  history: PlaygroundImageMeta[]
  historyHasMore: boolean
  generationJobs: GenerationJob[]
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
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
  onClearAll: () => void
  onLoadMore: () => void
  onOpenGenerationSettings: () => void
}

type DetailTarget = { stackId: string; itemId?: string; viewMode?: 'detail' | 'gallery'; initialEditing?: boolean }
type ActiveStackStatusPart = { kind: 'running' | 'retrying' | 'queued'; label: string }
type ItemGenerationSummary = { modelName: string; aspectRatio: string; resolution: string }

function latestImages(stack: ImageStack): PlaygroundImageMeta[] {
  return [...stack.images].sort((a, b) => b.timestamp - a.timestamp)
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
    modelName: MODEL_CONFIGS.find((model) => model.id === source.modelId)?.name ?? source.modelId,
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

function activeStackStatusParts(stack: ImageStack): ActiveStackStatusPart[] {
  const counts = countSlots(stack.jobs.flatMap((job) => job.slots))
  const parts: ActiveStackStatusPart[] = []
  if (counts.running > 0) parts.push({ kind: 'running', label: `${counts.running} 项生成中` })
  if (counts.retrying > 0) parts.push({ kind: 'retrying', label: `${counts.retrying} 项重试中` })
  if (counts.queued > 0) parts.push({ kind: 'queued', label: `${counts.queued} 项排队中` })
  return parts
}

function StackRow({
  stack,
  onOpenItem,
  onEditItem,
  onOpenGallery,
  onDownloadStack,
  onCancelStackGeneration,
  onDismissStackFailedJobs,
  onOpenGenerationSettings,
  downloading,
}: {
  stack: ImageStack
  onOpenItem: (stack: ImageStack, item: StackItem) => void
  onEditItem: (stack: ImageStack, item: StackItem) => void
  onOpenGallery: (stack: ImageStack) => void
  onDownloadStack: (stack: ImageStack) => void
  onCancelStackGeneration: (stack: ImageStack) => void
  onDismissStackFailedJobs: (stack: ImageStack) => void
  onOpenGenerationSettings: () => void
  downloading: boolean
}) {
  const totalItems = stack.images.length + stack.activeSlotCount + stack.failedSlotCount
  const activeStatusParts = activeStackStatusParts(stack)
  const hasDismissibleFailures = stack.jobs.some(canDismissFailedGenerationJob)
  const stackItemNumberById = new Map(stack.items.map((item, index) => [item.id, index + 1]))
  const previewItems = stack.items

  return (
    <div className="min-w-0">
      <div className="min-w-0 px-3 py-2">
        <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-base">
          <span className="shrink-0 font-normal text-(--color-text-3)">{formatTime(stack.updatedAt)}</span>
          <span className="meta-dot text-(--color-text-4)" aria-hidden />
          <span className="font-normal text-(--color-text-3)">{totalItems} 张</span>
          <span className="meta-dot text-(--color-text-4)" aria-hidden />
          <button
            type="button"
            onClick={() => onOpenGallery(stack)}
            className="bg-transparent p-0 text-base font-medium text-(--color-text-3) transition-colors hover:text-(--color-text-2)"
          >
            查看全部
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
                {downloading ? '打包中…' : '下载 ZIP'}
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
                            （调整）
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
                  取消生成
                </button>
              </span>
            </>
          )}
          {stack.failedSlotCount > 0 && (
            <>
              <span className="meta-dot text-(--color-text-4)" aria-hidden />
              <span className="text-base" style={{ color: 'var(--color-danger)' }}>
                失败 {stack.failedSlotCount}
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
                    清空失败
                  </button>
                </>
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
                              编辑
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
                  className="h-full w-full rounded-[8px] text-sm text-(--color-text-4)"
                  style={{ background: 'var(--color-surface-2)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                >
                  暂无图片
                </button>
              </GridCell>
            )}
          </ImageGrid>
        </div>
      </div>
    </div>
  )
}

export const OutputPanel = memo(function OutputPanel({
  history,
  historyHasMore,
  generationJobs,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onRemove,
  onClearAll,
  onLoadMore,
  onOpenGenerationSettings,
}: Props) {
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingStackId, setExportingStackId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const stacks = useMemo(() => buildImageStacks(history, generationJobs), [history, generationJobs])
  const generatedImageCount = useMemo(() => history.filter((img) => img.source.type === 'generated').length, [history])
  const detailStack = detailTarget ? (stacks.find((stack) => stack.id === detailTarget.stackId) ?? null) : null

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

  const scrollRef = useRef<HTMLDivElement>(null)
  const topStackIdRef = useRef<string | null>(null)

  useEffect(() => {
    const topStackId = stacks[0]?.id ?? null
    if (topStackId && topStackIdRef.current !== topStackId) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    topStackIdRef.current = topStackId
  }, [stacks])

  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreStable = useCallback(() => {
    onLoadMore()
  }, [onLoadMore])

  useEffect(() => {
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
            <div className="font-display text-xl font-semibold tracking-[-0.01em]">结果</div>
            <div className="text-sm text-(--color-text-3) mt-0.5">
              {stacks.length} 组，{generatedImageCount} 张生成图，存储于本地浏览器
            </div>
          </div>
          <div className="flex-1" />
          {history.length > 0 && (
            <button type="button" onClick={handleExportAll} disabled={exporting} className="chip shrink-0">
              <Icon name="download" size={12} /> {exporting ? '导出中…' : '导出 ZIP'}
            </button>
          )}
        </div>
      </div>

      {stacks.length > 0 ? (
        <div className="space-y-[26px]">
          <div className="space-y-2">
            {stacks.map((stack) => (
              <StackRow
                key={stack.id}
                stack={stack}
                onOpenItem={openStackItem}
                onEditItem={editStackItem}
                onOpenGallery={openStackGallery}
                onDownloadStack={handleExportStack}
                onCancelStackGeneration={handleCancelStackGeneration}
                onDismissStackFailedJobs={handleDismissStackFailedJobs}
                onOpenGenerationSettings={onOpenGenerationSettings}
                downloading={exportingStackId === stack.id}
              />
            ))}
          </div>

          {historyHasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <div className="text-sm text-(--color-text-4)">加载更多…</div>
            </div>
          )}

          <div className="flex justify-center py-2">
            {confirmClear ? (
              <div className="flex items-center gap-3 text-base">
                <span className="text-(--color-text-3)">确认清除全部历史？</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false)
                    onClearAll()
                  }}
                  className="font-medium transition-colors hover:brightness-110"
                  style={{ color: 'var(--color-danger)', background: 'none', border: 0 }}
                >
                  确认
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="text-(--color-text-3) hover:text-(--color-text) transition-colors"
                  style={{ background: 'none', border: 0 }}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-base font-medium transition-colors hover:brightness-110"
                style={{ color: 'var(--color-danger)', background: 'none', border: 0 }}
              >
                清除全部
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card px-4 py-5 text-(--color-text-3)">
          <div className="label mb-2">空历史</div>
          <div className="text-base font-medium text-(--color-text-2)">生成结果会出现在这里</div>
          <div className="mt-1 text-sm leading-[1.7] text-(--color-text-4)">配置左侧参数并点击「生成」开始。</div>
        </div>
      )}

      {detailStack && (
        <ImageDetailModal
          stack={detailStack}
          initialItemId={detailTarget?.itemId}
          initialViewMode={detailTarget?.viewMode}
          initialEditing={detailTarget?.initialEditing}
          history={history}
          generationJobs={generationJobs}
          onClose={() => setDetailTarget(null)}
          onAddToRef={onAddToRef}
          onRegenerate={onRegenerate}
          onReroll={onReroll}
          onEditImage={onEditImage}
          onCancelGenerationJob={onCancelGenerationJob}
          onDismissGenerationJob={onDismissGenerationJob}
          onCancelGenerationSlot={onCancelGenerationSlot}
          onRemove={onRemove}
        />
      )}
    </div>
  )
})
