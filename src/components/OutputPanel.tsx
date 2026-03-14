import { useState } from 'react'
import type { PlaygroundImage } from '../lib/types'
import type { GenerationState, GenerationSnapshot } from '../hooks/usePlayground'
import { ImageCard } from './ImageCard'
import { ImageDetailModal } from './ImageDetailModal'
import { ImageGrid, GridCell, getGridSpan, parseAspectRatio } from './ImageGrid'

type Props = {
  history: PlaygroundImage[]
  generationState: GenerationState
  generationSnapshot: GenerationSnapshot | null
  showDraft: boolean
  error: string | null
  batchCount: number
  aspectRatio: string
  resolution: string
  onEdit: (image: PlaygroundImage) => void
  onAddToRef: (image: PlaygroundImage) => void
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

function SkeletonCard({ aspectRatio, resolution }: { aspectRatio: string; resolution: string }) {
  return (
    <div className="w-full h-full rounded-xl bg-surface-container border border-outline-variant overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-on-surface-variant/30 text-xs font-mono">{resolution} {aspectRatio}</div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />
    </div>
  )
}

function LoadingCard({ index }: { index: number }) {
  return (
    <div className="w-full h-full rounded-xl bg-surface-container border border-primary/20 overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <div className="text-on-surface-variant/50 text-[11px] font-mono">{`生成中 #${index + 1}...`}</div>
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

export function OutputPanel({
  history,
  generationState,
  generationSnapshot,
  showDraft,
  error,
  batchCount,
  aspectRatio,
  resolution,
  onEdit,
  onAddToRef,
  onRemove,
  onClearAll,
}: Props) {
  const [detailImage, setDetailImage] = useState<PlaygroundImage | null>(null)
  const isGenerating = generationState === 'generating'
  const batches = groupByBatch(history)

  const draftRatio = isGenerating && generationSnapshot ? generationSnapshot.aspectRatio : aspectRatio
  const draftRes = isGenerating && generationSnapshot ? generationSnapshot.resolution : resolution
  const draftCount = isGenerating && generationSnapshot ? generationSnapshot.batchCount : batchCount
  const draftNumRatio = parseAspectRatio(draftRatio)
  const draftSpan = getGridSpan(draftNumRatio)

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      {error && (
        <div className="mb-4 px-4 py-3 bg-error-dim text-error text-sm rounded-xl border border-error/20">
          {error}
        </div>
      )}

      {/* Draft skeleton */}
      {!isGenerating && showDraft && (
        <div className="mb-6">
          <div className="text-[11px] text-on-surface-variant/50 font-mono mb-2">草稿</div>
          <ImageGrid ratio={draftNumRatio}>
            {Array.from({ length: draftCount }, (_, i) => (
              <GridCell key={i} cols={draftSpan.cols} rows={draftSpan.rows}>
                <SkeletonCard aspectRatio={draftRatio} resolution={draftRes} />
              </GridCell>
            ))}
          </ImageGrid>
        </div>
      )}

      {/* Loading */}
      {isGenerating && generationSnapshot && (
        <div className="mb-6">
          <div className="text-[11px] text-on-surface-variant/50 font-mono mb-2">生成中...</div>
          <ImageGrid ratio={draftNumRatio}>
            {Array.from({ length: draftCount }, (_, i) => (
              <GridCell key={i} cols={draftSpan.cols} rows={draftSpan.rows}>
                <LoadingCard index={i} />
              </GridCell>
            ))}
          </ImageGrid>
        </div>
      )}

      {/* History batches */}
      {batches.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-on-surface-variant/50 font-mono">历史记录</div>
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] text-error hover:text-error/80 transition-colors"
            >
              清除全部
            </button>
          </div>
          {batches.map((batch) => {
            const batchRatio = parseAspectRatio(batch.aspectRatio)
            const span = getGridSpan(batchRatio)
            return (
              <div key={batch.batchId}>
                <div className="text-[11px] text-on-surface-variant/50 font-mono mb-2">
                  {formatTime(batch.timestamp)}
                </div>
                <ImageGrid ratio={batchRatio}>
                  {batch.images.map((img) => (
                    <GridCell key={img.id} cols={span.cols} rows={span.rows}>
                      <div
                        onClick={() => setDetailImage(img)}
                        className="cursor-pointer w-full h-full"
                      >
                        <ImageCard image={img} onAddToRef={onAddToRef} />
                      </div>
                    </GridCell>
                  ))}
                </ImageGrid>
              </div>
            )
          })}
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
          onClose={() => setDetailImage(null)}
          onEdit={onEdit}
          onAddToRef={onAddToRef}
          onRemove={onRemove}
        />
      )}
    </div>
  )
}
