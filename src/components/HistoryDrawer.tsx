import { useState } from 'react'
import type { PlaygroundImage } from '../lib/types'
import { ImageDetailModal } from './ImageDetailModal'

type Props = {
  history: PlaygroundImage[]
  onAddToRef: (image: PlaygroundImage) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

export function HistoryDrawer({ history, onAddToRef, onRemove, onClearAll }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [detailImage, setDetailImage] = useState<PlaygroundImage | null>(null)

  if (history.length === 0) return null

  return (
    <>
      <div className="border-t border-outline-variant bg-surface">
        {/* Toggle bar */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-surface-container transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-on-surface-variant">历史记录</span>
            <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[11px] font-mono rounded">
              {history.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {expanded && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onClearAll()
                }}
                className="text-xs text-error hover:text-error/80 cursor-pointer"
              >
                清除全部
              </span>
            )}
            <svg
              className={`w-4 h-4 text-on-surface-variant transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </div>
        </button>

        {/* Expandable content */}
        {expanded && (
          <div className="px-5 pb-4 overflow-x-auto">
            <div className="flex gap-3 min-w-0">
              {history.map((img) => (
                <HistoryThumbnail
                  key={img.id}
                  image={img}
                  onClick={() => setDetailImage(img)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailImage && (
        <ImageDetailModal
          image={detailImage}
          history={history}
          onClose={() => setDetailImage(null)}
          onAddToRef={onAddToRef}
          onRemove={onRemove}
        />
      )}
    </>
  )
}

function HistoryThumbnail({
  image,
  onClick,
}: {
  image: PlaygroundImage
  onClick: () => void
}) {
  const src = `data:${image.mimeType};base64,${image.data}`
  const meta = image.source.type === 'generated' ? image.source : null

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-playground-image', JSON.stringify(image))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="relative group shrink-0">
      <img
        src={src}
        alt={meta?.prompt ?? ''}
        draggable
        onDragStart={handleDragStart}
        className="h-20 w-auto rounded-lg object-cover cursor-pointer border border-outline-variant
                   hover:border-primary/40 transition-colors"
        onClick={onClick}
      />
      {meta && (
        <div className="absolute top-1 right-1 px-1 bg-black/50 text-white text-[8px] font-mono rounded">
          {meta.resolution}
        </div>
      )}
    </div>
  )
}
