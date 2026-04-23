import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react'
import JSZip from 'jszip'
import type { PlaygroundImageMeta } from '../lib/types'
import type {
  GenerationPreviewSlot,
  GenerationRetryNotice,
  GenerationState,
  GenerationSnapshot,
} from '../hooks/usePlayground'
import { MODEL_CONFIGS } from '../config/models'
import { loadImageBlobs } from '../lib/history'
import { getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'
import { ImageCard } from './ImageCard'
import { ImageDetailModal } from './ImageDetailModal'
import { ImageGrid, GridCell } from './ImageGrid'
import { Icon } from './Icon'

type Props = {
  history: PlaygroundImageMeta[]
  historyHasMore: boolean
  generationState: GenerationState
  generationSnapshot: GenerationSnapshot | null
  generationPreview: GenerationPreviewSlot[]
  generationRetryNotices: GenerationRetryNotice[]
  error: string | null
  batchCount: number
  aspectRatio: string
  resolution: string
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
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

function SkeletonCard({ aspectRatio, resolution }: { aspectRatio: string; resolution: string }) {
  return (
    <div className="img-card w-full h-full">
      <div className="absolute inset-0 skeleton-animated" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-(--color-text-3)">
        <div className="mono text-[11px] text-(--color-text-4)">{resolution} · {aspectRatio}</div>
        <div className="text-[11px] text-(--color-text-4)">按「生成」开始</div>
      </div>
    </div>
  )
}

function LoadingCard({ index }: { index: number }) {
  return (
    <div
      className="w-full h-full rounded-[8px] overflow-hidden relative"
      style={{
        boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
        background: 'var(--color-surface-2)',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-(--color-text-3)">
        <span className="spinner" />
        <div className="mono text-[11px] text-(--color-text-4)">生成中 #{index + 1}</div>
      </div>
    </div>
  )
}

function FailedCard({ index, error }: { index: number; error: string }) {
  return (
    <div
      className="w-full h-full rounded-[8px] overflow-hidden relative"
      style={{
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 24%, transparent)',
        background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
      }}
    >
      <div className="absolute inset-0 flex flex-col gap-2 px-3 py-2.5 text-left">
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="w-4 h-4 rounded-full flex shrink-0 items-center justify-center text-[10px] font-semibold leading-none"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 14%, transparent)', color: 'var(--color-danger)' }}
          >
            ×
          </div>
          <div className="mono text-[10.5px]" style={{ color: 'var(--color-danger)' }}>
            失败 #{index + 1}
          </div>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto mono text-[11px] leading-[1.55] break-words text-(--color-text-2) whitespace-pre-wrap"
        >
          {error}
        </div>
      </div>
    </div>
  )
}

function RetryNoticeCard({ notice }: { notice: GenerationRetryNotice }) {
  return (
    <div
      className="rounded-[6px] px-3 py-2.5"
      style={{
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-warning) 24%, transparent)',
        background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
            color: 'var(--color-warning)',
          }}
        >
          <Icon name="refresh" size={11} strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-medium leading-[1.45]" style={{ color: 'var(--color-warning)' }}>
            任务 #{notice.slotIndex + 1} 第 {notice.attempt} 次尝试失败，正在进行第 {notice.nextAttempt} 次尝试
          </div>
          <div className="mt-1 break-words text-[11.5px] leading-[1.5] text-(--color-text-2)">
            原因：{notice.error}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return new Date(ts).toLocaleDateString()
}

export const OutputPanel = memo(function OutputPanel({
  history,
  historyHasMore,
  generationState,
  generationSnapshot,
  generationPreview,
  generationRetryNotices,
  error,
  batchCount,
  aspectRatio,
  resolution,
  onAddToRef,
  onRegenerate,
  onRemove,
  onClearAll,
  onLoadMore,
}: Props) {
  const [detailImage, setDetailImage] = useState<PlaygroundImageMeta | null>(null)
  const [exporting, setExporting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const isGenerating = generationState === 'generating'

  const lastGenRef = useRef<{ preview: GenerationPreviewSlot[]; ratio: string; res: string; count: number; batchId: string } | null>(null)
  if (isGenerating && generationPreview.length > 0 && generationSnapshot) {
    lastGenRef.current = {
      preview: generationPreview,
      ratio: generationSnapshot.aspectRatio,
      res: generationSnapshot.resolution,
      count: generationSnapshot.batchCount,
      batchId: generationSnapshot.batchId,
    }
  }

  const [settled, setSettled] = useState(false)
  const prevGeneratingRef = useRef(false)

  if (prevGeneratingRef.current !== isGenerating) {
    if (prevGeneratingRef.current && !isGenerating && lastGenRef.current) {
      if (!settled) setSettled(true)
    }
    if (!prevGeneratingRef.current && isGenerating) {
      if (settled) setSettled(false)
      lastGenRef.current = null
    }
    prevGeneratingRef.current = isGenerating
  }

  const handleExportAll = async () => {
    if (exporting || history.length === 0) return
    setExporting(true)
    try {
      const needLoad = history.filter((img) => !getBlobFromCache(img.id)).map((img) => img.id)
      if (needLoad.length > 0) {
        const blobs = await loadImageBlobs(needLoad)
        for (const [id, data] of blobs) putBlobInCache(id, data)
      }

      const zip = new JSZip()
      for (const img of history) {
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

  const settledData = settled && !isGenerating ? lastGenRef.current : null
  const previewVisible = isGenerating || !!settledData

  const draftRatio = settledData ? settledData.ratio : isGenerating && generationSnapshot ? generationSnapshot.aspectRatio : aspectRatio
  const draftRes = settledData ? settledData.res : isGenerating && generationSnapshot ? generationSnapshot.resolution : resolution
  const draftCount = settledData ? settledData.count : isGenerating && generationSnapshot ? generationSnapshot.batchCount : batchCount
  const previewSlots = settledData ? settledData.preview
    : isGenerating && generationPreview.length > 0 ? generationPreview
    : Array.from({ length: draftCount }, (): GenerationPreviewSlot => ({ status: 'pending' }))
  const completedCount = previewSlots.filter((slot) => slot.status === 'fulfilled').length

  const settledBatchId = settledData?.batchId ?? null
  const displayBatches = settledBatchId
    ? batches.filter((b) => b.batchId !== settledBatchId)
    : batches

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isGenerating) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isGenerating])

  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreStable = useCallback(() => { onLoadMore() }, [onLoadMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !historyHasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMoreStable() },
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
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div>
          <div className="font-display text-[15px] font-semibold tracking-[-0.01em]">结果</div>
          <div className="text-[11.5px] text-(--color-text-3) mt-0.5">
            {history.length} 张，存储于本地浏览器
          </div>
        </div>
        <div className="flex-1" />
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exporting}
            className="chip"
          >
            <Icon name="download" size={12} /> {exporting ? '导出中…' : '导出 ZIP'}
          </button>
        )}
      </div>

      {generationRetryNotices.length > 0 && (
        <div className="mb-4 space-y-2">
          {generationRetryNotices.map((notice) => (
            <RetryNoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}

      {error && (
        <div
          className="mb-4 rounded-[6px] px-3 py-2 text-[12px]"
          style={{
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 24%, transparent)',
            background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* Unified preview — grid-rows expand animation */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
          ${previewVisible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
      >
        <div className="overflow-y-clip min-h-0">
          <div className="mb-6">
            <div
              className="flex items-center gap-2.5 mb-2.5 px-3 py-1.5 rounded-[6px]"
              style={{
                background: isGenerating ? 'var(--color-accent-soft)' : 'transparent',
                boxShadow: isGenerating ? 'inset 0 0 0 1px var(--color-accent-wash-2)' : 'none',
              }}
            >
              {isGenerating ? (
                <>
                  <span className="spinner" />
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--color-accent)' }}>
                    生成中
                  </span>
                  <span className="mono text-[11.5px] text-(--color-text-3)">
                    {completedCount} / {draftCount}
                  </span>
                </>
              ) : settledData ? (
                <>
                  <span className="mono text-[11.5px] text-(--color-text-3)">刚刚</span>
                  <span className="text-(--color-text-4)">·</span>
                  <span className="mono text-[11.5px] text-(--color-text-3)">
                    {settledData.res} · {settledData.ratio} · {settledData.count}
                  </span>
                </>
              ) : (
                <span className="label">预览</span>
              )}
            </div>
            <ImageGrid>
              {previewSlots.map((slot, i) => (
                <GridCell key={i} aspectRatio={draftRatio}>
                  {slot.status === 'fulfilled' ? (
                    <ImageCard
                      image={slot.image}
                      inlineData={slot.image.data}
                      index={draftCount > 1 ? i : undefined}
                      onAddToRef={onAddToRef}
                      onRegenerate={onRegenerate}
                      onRemove={onRemove}
                      onOpen={setDetailImage}
                    />
                  ) : slot.status === 'rejected' ? (
                    <FailedCard index={i} error={slot.error} />
                  ) : isGenerating ? (
                    <LoadingCard index={i} />
                  ) : (
                    <SkeletonCard aspectRatio={draftRatio} resolution={draftRes} />
                  )}
                </GridCell>
              ))}
            </ImageGrid>
          </div>
        </div>
      </div>

      {/* History batches */}
      {displayBatches.length > 0 && (
        <div className="space-y-[26px]">
          {displayBatches.map((batch) => (
            <div key={batch.batchId}>
              <div className="flex items-center gap-2 mb-2">
                <span className="mono text-[11.5px] text-(--color-text-3)">{formatTime(batch.timestamp)}</span>
                <span className="text-(--color-text-4)">·</span>
                <span className="text-[11.5px] font-medium text-(--color-text-2)">
                  {modelNameOf(batch.modelId)}
                </span>
                <span className="text-(--color-text-4)">·</span>
                <span className="mono text-[11.5px] text-(--color-text-3)">
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
                      onRegenerate={onRegenerate}
                      onRemove={onRemove}
                      onOpen={setDetailImage}
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
                  onClick={() => { setConfirmClear(false); onClearAll() }}
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

      {displayBatches.length === 0 && !isGenerating && !settledData && (
        <div className="py-20 text-center text-(--color-text-3)">
          <div className="text-[13px] mb-1.5">尚无生成记录</div>
          <div className="text-[11.5px] text-(--color-text-4)">配置参数并点击「生成」开始</div>
        </div>
      )}

      {detailImage && (
        <ImageDetailModal
          image={detailImage}
          history={history}
          onClose={() => setDetailImage(null)}
          onAddToRef={onAddToRef}
          onRegenerate={onRegenerate}
          onRemove={onRemove}
        />
      )}
    </div>
  )
})
