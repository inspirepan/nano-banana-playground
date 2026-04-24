import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react'
import JSZip from 'jszip'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationJob, GenerationQueueSummary } from '../hooks/usePlayground'
import { MODEL_CONFIGS } from '../config/models'
import { loadImageBlobs } from '../lib/history'
import { getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'
import { ImageCard } from './ImageCard'
import { ImageDetailModal } from './ImageDetailModal'
import { ImageGrid, GridCell } from './ImageGrid'
import { Icon } from './Icon'
import { Tooltip } from './Tooltip'
import { formatTime } from '../lib/queueJobDisplay'
import { QueueJobSection } from './QueueJobSection'

type Props = {
  history: PlaygroundImageMeta[]
  historyHasMore: boolean
  generationJobs: GenerationJob[]
  generationQueueSummary: GenerationQueueSummary
  generationConcurrency: number
  onGenerationConcurrencyChange: (value: number) => void
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
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
}

type HistoryBatch = {
  batchId: string
  resolution: string
  aspectRatio: string
  modelId: string
  images: PlaygroundImageMeta[]
  timestamp: number
}

function groupByBatch(images: PlaygroundImageMeta[]): HistoryBatch[] {
  const map = new Map<string, HistoryBatch>()
  for (const img of images) {
    if (img.source.type !== 'generated') continue
    const { batchId, resolution, aspectRatio, modelId } = img.source
    let batch = map.get(batchId)
    if (!batch) {
      batch = { batchId, resolution, aspectRatio, modelId, images: [], timestamp: img.timestamp }
      map.set(batchId, batch)
    }
    batch.images.push(img)
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp)
}

function modelNameOf(modelId: string): string {
  return MODEL_CONFIGS.find((m) => m.id === modelId)?.name ?? modelId
}

function queueSummaryLabel(summary: GenerationQueueSummary): string {
  const parts = [`队列 ${summary.total}`]
  const running = summary.running + summary.retrying
  if (running > 0) parts.push(`运行 ${running}`)
  if (summary.queued > 0) parts.push(`排队 ${summary.queued}`)
  if (summary.failed > 0) parts.push(`失败 ${summary.failed}`)
  return parts.join(' · ')
}

export const OutputPanel = memo(function OutputPanel({
  history,
  historyHasMore,
  generationJobs,
  generationQueueSummary,
  generationConcurrency,
  onGenerationConcurrencyChange,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onAddToRef,
  onRegenerate,
  onEditImage,
  onRemove,
  onClearAll,
  onLoadMore,
}: Props) {
  const [detailImage, setDetailImage] = useState<PlaygroundImageMeta | null>(null)
  const [detailInitialEditing, setDetailInitialEditing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const handleOpenForEdit = useCallback((img: PlaygroundImageMeta) => {
    setDetailImage(img)
    setDetailInitialEditing(true)
  }, [])
  const handleOpenForView = useCallback((img: PlaygroundImageMeta) => {
    setDetailImage(img)
    setDetailInitialEditing(false)
  }, [])

  const handleExportAll = async () => {
    if (exporting || exportableHistory.length === 0) return
    setExporting(true)
    try {
      const needLoad = exportableHistory.filter((img) => !getBlobFromCache(img.id)).map((img) => img.id)
      if (needLoad.length > 0) {
        const blobs = await loadImageBlobs(needLoad)
        for (const [id, data] of blobs) putBlobInCache(id, data)
      }

      const zip = new JSZip()
      for (const img of exportableHistory) {
        const data = getBlobFromCache(img.id)
        if (!data) continue
        const ext = img.mimeType === 'image/png' ? 'png' : 'jpg'
        const name = `nano-banana-${img.id.slice(0, 8)}.${ext}`
        zip.file(name, data, { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `nano-banana-export-${new Date().toISOString().slice(0, 10)}.zip`
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const batches = useMemo(() => groupByBatch(history), [history])
  const queueBatchIds = useMemo(() => new Set(generationJobs.map((job) => job.id)), [generationJobs])
  const displayBatches = useMemo(
    () => batches.filter((batch) => !queueBatchIds.has(batch.batchId)),
    [batches, queueBatchIds],
  )
  const exportableHistory = useMemo(
    () => history.filter((img) => img.source.type !== 'generated' || !queueBatchIds.has(img.source.batchId)),
    [history, queueBatchIds],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const topJobIdRef = useRef<string | null>(null)

  useEffect(() => {
    const topJobId = generationJobs[0]?.id ?? null
    if (topJobId && topJobIdRef.current !== topJobId) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    topJobIdRef.current = topJobId
  }, [generationJobs])

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
            <div className="font-display text-[15px] font-semibold tracking-[-0.01em]">结果</div>
            <div className="text-[11.5px] text-(--color-text-3) mt-0.5">{history.length} 张，存储于本地浏览器</div>
          </div>
          <div className="flex-1" />
          {exportableHistory.length > 0 && (
            <button type="button" onClick={handleExportAll} disabled={exporting} className="chip shrink-0">
              <Icon name="download" size={12} /> {exporting ? '导出中…' : '导出 ZIP'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tooltip
              text="控制一次最多同时生成几张图。数字越大，排队更少，但也更容易遇到接口限流；不影响每个任务本身要生成的张数。"
              placement="bottom"
              maxWidth={260}
            >
              <div className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-(--color-text-4)">
                <span>同时最多生成</span>
                <span
                  className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-full mono text-[9px]"
                  style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                >
                  ?
                </span>
              </div>
            </Tooltip>
            <div
              className="segmented"
              style={{
                width: 156,
                ['--seg-count' as string]: 4,
                ['--seg-index' as string]: generationConcurrency - 1,
              }}
            >
              {[1, 2, 3, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onGenerationConcurrencyChange(value)}
                  data-active={generationConcurrency === value}
                >
                  <span>
                    <span className="mono text-[11px]">{value}</span> 张
                  </span>
                </button>
              ))}
            </div>
          </div>
          {generationQueueSummary.total > 0 && (
            <div
              className="mono inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-[6px] px-2 text-[11.5px] text-(--color-text-3)"
              style={{ background: 'var(--color-surface-2)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
            >
              {queueSummaryLabel(generationQueueSummary)}
            </div>
          )}
        </div>
      </div>

      {generationJobs.length > 0 && (
        <div className="mb-[26px] space-y-[26px]">
          {generationJobs.map((job) => (
            <QueueJobSection
              key={job.id}
              job={job}
              onCancelJob={onCancelGenerationJob}
              onDismissJob={onDismissGenerationJob}
              onCancelSlot={onCancelGenerationSlot}
              onAddToRef={onAddToRef}
              onEdit={handleOpenForEdit}
              onRegenerate={onRegenerate}
              onRemove={onRemove}
              onOpen={handleOpenForView}
            />
          ))}
        </div>
      )}

      {displayBatches.length > 0 && (
        <div className="space-y-[26px]">
          {displayBatches.map((batch) => (
            <div key={batch.batchId}>
              <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="mono whitespace-nowrap text-[11.5px] text-(--color-text-3)">
                  {formatTime(batch.timestamp)}
                </span>
                <span className="text-(--color-text-4)">·</span>
                <span className="whitespace-nowrap text-[11.5px] font-medium text-(--color-text-2)">
                  {modelNameOf(batch.modelId)}
                </span>
                <span className="text-(--color-text-4)">·</span>
                <span className="mono whitespace-nowrap text-[11.5px] text-(--color-text-3)">
                  {batch.resolution} · {batch.aspectRatio} · {batch.images.length}
                </span>
              </div>
              <ImageGrid>
                {batch.images.map((img, i) => (
                  <GridCell key={img.id} aspectRatio={img.source.type === 'generated' ? img.source.aspectRatio : '1:1'}>
                    <ImageCard
                      image={img}
                      index={batch.images.length > 1 ? i : undefined}
                      onAddToRef={onAddToRef}
                      onEdit={handleOpenForEdit}
                      onRegenerate={onRegenerate}
                      onRemove={onRemove}
                      onOpen={handleOpenForView}
                    />
                  </GridCell>
                ))}
              </ImageGrid>
            </div>
          ))}

          {historyHasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <div className="text-[11px] text-(--color-text-4)">加载更多…</div>
            </div>
          )}

          <div className="flex justify-center py-2">
            {confirmClear ? (
              <div className="flex items-center gap-3 text-[12px]">
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
                className="text-[11.5px] font-medium transition-colors hover:brightness-110"
                style={{ color: 'var(--color-danger)', background: 'none', border: 0 }}
              >
                清除全部
              </button>
            )}
          </div>
        </div>
      )}

      {displayBatches.length === 0 && generationJobs.length === 0 && (
        <div className="py-20 text-center text-(--color-text-3)">
          <div className="text-[13px] mb-1.5">尚无生成记录</div>
          <div className="text-[11.5px] text-(--color-text-4)">配置参数并点击「生成」开始</div>
        </div>
      )}

      {detailImage && (
        <ImageDetailModal
          image={detailImage}
          initialEditing={detailInitialEditing}
          history={history}
          generationJobs={generationJobs}
          onClose={() => setDetailImage(null)}
          onAddToRef={onAddToRef}
          onRegenerate={onRegenerate}
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
