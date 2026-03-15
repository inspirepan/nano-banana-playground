import { memo, useMemo, useRef, useState, useEffect } from 'react'
import JSZip from 'jszip'
import type { PlaygroundImage } from '../lib/types'
import type { GenerationPreviewSlot, GenerationState, GenerationSnapshot } from '../hooks/usePlayground'
import { ImageCard } from './ImageCard'
import { ImageDetailModal } from './ImageDetailModal'
import { ImageGrid, GridCell } from './ImageGrid'

type Props = {
  history: PlaygroundImage[]
  generationState: GenerationState
  generationSnapshot: GenerationSnapshot | null
  generationPreview: GenerationPreviewSlot[]
  showDraft: boolean
  error: string | null
  batchCount: number
  draftBatchOverride: number | null
  draftLabels: string[] | null
  aspectRatio: string
  resolution: string
  onAddToRef: (image: PlaygroundImage) => void
  onRegenerate: (image: PlaygroundImage) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

type HistoryBatch = {
  batchId: string
  resolution: string
  aspectRatio: string
  images: PlaygroundImage[]
  timestamp: number
}

function groupByBatch(images: PlaygroundImage[]): HistoryBatch[] {
  const map = new Map<string, HistoryBatch>()
  for (const img of images) {
    if (img.source.type !== 'generated') continue
    const { batchId, resolution, aspectRatio } = img.source
    let batch = map.get(batchId)
    if (!batch) {
      batch = { batchId, resolution, aspectRatio, images: [], timestamp: img.timestamp }
      map.set(batchId, batch)
    }
    batch.images.push(img)
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp)
}

function SkeletonCard({ aspectRatio, resolution, label }: { aspectRatio: string; resolution: string; label?: string }) {
  return (
    <div className="w-full h-full rounded-xl bg-surface-container overflow-hidden relative">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {label && <div className="text-sm font-medium text-on-surface-variant/40 px-2 text-center">{label}</div>}
        <div className="text-xs tabular-nums text-on-surface-variant/30">{resolution} {aspectRatio}</div>
        <div className="text-sm text-on-surface-variant/25">按「生成」键确认</div>
      </div>
      <div className="absolute skeleton-shimmer" />
    </div>
  )
}

function LoadingCard({ index }: { index: number }) {
  return (
    <div className="w-full h-full rounded-xl bg-surface-container overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <div className="text-2xs tabular-nums text-on-surface-variant/50">{`生成中 #${index + 1}...`}</div>
        </div>
      </div>
    </div>
  )
}

function FailedCard({ index }: { index: number }) {
  return (
    <div className="w-full h-full rounded-xl border border-error/20 bg-error-dim/40 overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-error/12 text-error text-xs font-bold">×</div>
          <div className="text-2xs tabular-nums text-error/80">{`失败 #${index + 1}`}</div>
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
  generationState,
  generationSnapshot,
  generationPreview,
  showDraft,
  error,
  batchCount,
  draftBatchOverride,
  draftLabels,
  aspectRatio,
  resolution,
  onAddToRef,
  onRegenerate,
  onRemove,
  onClearAll,
}: Props) {
  const [detailImage, setDetailImage] = useState<PlaygroundImage | null>(null)
  const [exporting, setExporting] = useState(false)
  const isGenerating = generationState === 'generating'

  const handleExportAll = async () => {
    if (exporting || history.length === 0) return
    setExporting(true)
    try {
      const zip = new JSZip()
      for (const img of history) {
        const ext = img.mimeType === 'image/png' ? 'png' : 'jpg'
        const name = `nano-banana-${img.id.slice(0, 8)}.${ext}`
        zip.file(name, img.data, { base64: true })
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

  const draftRatio = isGenerating && generationSnapshot ? generationSnapshot.aspectRatio : aspectRatio
  const draftRes = isGenerating && generationSnapshot ? generationSnapshot.resolution : resolution
  const draftCount = isGenerating && generationSnapshot ? generationSnapshot.batchCount : (draftBatchOverride ?? batchCount)
  const previewSlots = isGenerating && generationPreview.length > 0
    ? generationPreview
    : Array.from({ length: draftCount }, (): GenerationPreviewSlot => ({ status: 'pending' }))
  const completedCount = previewSlots.filter((slot) => slot.status === 'fulfilled').length

  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to top when preview becomes visible so skeleton is always in view
  useEffect(() => {
    if (showDraft || isGenerating) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [showDraft, isGenerating])

  // Global shimmer clock: rAF drives a shared CSS variable so all skeletons stay in sync
  const hasSkeletons = showDraft || (isGenerating && previewSlots.some((s) => s.status === 'pending'))
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !hasSkeletons) return
    let frameId: number
    const DURATION = 2000
    const tick = () => {
      const t = (Date.now() % DURATION) / DURATION
      // Approximate CSS ease-in-out
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      el.style.setProperty('--shimmer-x', `${-60 + 120 * e}%`)
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [hasSkeletons])

  return (
    <div ref={scrollRef} className="flex-1 md:flex-[2_1_0%] overflow-visible md:overflow-y-auto [scrollbar-gutter:stable] md:pl-6 md:pr-8">
      <div className="h-4" />
      {error && (
        <div className="mb-4 px-4 py-3 bg-error-dim text-error text-sm rounded-xl border border-error/20">
          {error}
        </div>
      )}

      {/* Draft skeleton — animated enter/exit via grid-rows */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
          ${!isGenerating && showDraft ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="mb-6">
            <div className="text-xs font-medium text-on-surface-variant mb-2">预览</div>
            <ImageGrid>
              {Array.from({ length: draftCount }, (_, i) => (
                <GridCell key={i} aspectRatio={draftRatio}>
                  <SkeletonCard aspectRatio={draftRatio} resolution={draftRes} label={draftLabels?.[i]} />
                </GridCell>
              ))}
            </ImageGrid>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isGenerating && generationSnapshot && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-medium text-on-surface-variant">预览</div>
            <div className="text-2xs font-mono text-on-surface-variant/50">
              {completedCount} / {draftCount}
            </div>
          </div>
          <ImageGrid>
            {previewSlots.map((slot, i) => (
              <GridCell key={i} aspectRatio={draftRatio}>
                {slot.status === 'fulfilled' ? (
                  <ImageCard
                    image={slot.image}
                    index={draftCount > 1 ? i : undefined}
                    onAddToRef={onAddToRef}
                    onRegenerate={onRegenerate}
                    onOpen={setDetailImage}
                  />
                ) : slot.status === 'rejected' ? (
                  <FailedCard index={i} />
                ) : (
                  <LoadingCard index={i} />
                )}
              </GridCell>
            ))}
          </ImageGrid>
        </div>
      )}

      {/* History batches */}
      {batches.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-on-surface-variant">历史记录 (本地浏览器存储)</div>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={exporting}
              className="text-2xs text-primary hover:text-primary/80 transition-colors disabled:text-on-surface-variant/30"
            >
              {exporting ? '导出中...' : '导出全部'}
            </button>
          </div>
          {batches.map((batch) => {
            return (
              <div key={batch.batchId}>
                <div className="mb-2 flex items-center justify-between gap-3 text-2xs font-mono text-on-surface-variant/50">
                  <div>{formatTime(batch.timestamp)}</div>
                  <div className="truncate">
                    {batch.resolution} · {batch.aspectRatio} · {batch.images.length}张
                  </div>
                </div>
                <ImageGrid>
                  {batch.images.map((img, i) => (
                    <GridCell key={img.id} aspectRatio={img.source.type === 'generated' ? img.source.aspectRatio : '1:1'}>
                      <ImageCard
                        image={img}
                        index={batch.images.length > 1 ? i : undefined}
                        onAddToRef={onAddToRef}
                        onRegenerate={onRegenerate}
                        onOpen={setDetailImage}
                      />
                    </GridCell>
                  ))}
                </ImageGrid>
              </div>
            )
          })}
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={onClearAll}
              className="text-2xs text-error hover:text-error/80 transition-colors"
            >
              清除全部
            </button>
          </div>
          <div className="h-4" />
        </div>
      )}

      {batches.length === 0 && !isGenerating && (
        <div className="mt-4 text-center text-on-surface-variant/40 text-sm">
          设置选项并输入提示词来生成图片
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
