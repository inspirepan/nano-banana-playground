import { useState } from 'react'
import type { PlaygroundImage } from '../lib/types'

type Props = {
  image: PlaygroundImage
  onAddToRef: (image: PlaygroundImage) => void
}

export function ImageCard({ image, onAddToRef }: Props) {
  const [showFullscreen, setShowFullscreen] = useState(false)
  const src = `data:${image.mimeType};base64,${image.data}`
  const meta = image.source.type === 'generated' ? image.source : null

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = `nano-banana-${image.id.slice(0, 8)}.png`
    a.click()
  }

  const handleCopyImage = async () => {
    const res = await fetch(src)
    const blob = await res.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
  }

  const handleCopyPrompt = () => {
    if (meta?.prompt) {
      navigator.clipboard.writeText(meta.prompt)
    }
  }

  return (
    <>
      <div className="group relative rounded-xl overflow-hidden bg-surface-container border border-outline-variant w-full h-full">
        <img
          src={src}
          alt={meta?.prompt ?? ''}
          className="w-full h-full object-contain block"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-between">
          {/* Center: click to view */}
          <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span
              className="text-white/80 text-xs cursor-pointer hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowFullscreen(true) }}
            >
              点击查看大图
            </span>
          </div>
          {/* Bottom: action buttons */}
          <div className="w-full p-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
            <ActionButton label="+参考" onClick={() => onAddToRef(image)} />
            <ActionButton label="下载" onClick={handleDownload} />
            <ActionButton label="复制图片" onClick={handleCopyImage} />
            {meta?.prompt && <ActionButton label="复制提示词" onClick={handleCopyPrompt} />}
          </div>
        </div>
        {/* Resolution badge */}
        {meta && (
          <div className="absolute top-1.5 right-1.5 px-1 py-0.5 bg-black/50 text-white text-[9px] font-mono rounded">
            {meta.resolution} {meta.aspectRatio}
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setShowFullscreen(false)}
        >
          <img
            src={src}
            alt={meta?.prompt ?? ''}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex-1 py-1 text-[10px] font-medium text-white bg-white/20 hover:bg-white/30
                 backdrop-blur-sm rounded-md transition-colors truncate px-1"
    >
      {label}
    </button>
  )
}
