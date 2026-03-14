import { memo, useMemo, useState } from 'react'
import type { PlaygroundImage } from '../lib/types'

type Props = {
  image: PlaygroundImage
  index?: number
  onAddToRef: (image: PlaygroundImage) => void
  onOpen: (image: PlaygroundImage) => void
}

export const ImageCard = memo(function ImageCard({ image, index, onAddToRef, onOpen }: Props) {
  const src = useMemo(() => `data:${image.mimeType};base64,${image.data}`, [image.data, image.mimeType])
  const meta = image.source.type === 'generated' ? image.source : null
  const [toast, setToast] = useState(false)

  const showCopiedToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 1500)
  }

  const handleDownload = () => {
    const anchor = document.createElement('a')
    anchor.href = src
    anchor.download = `nano-banana-${image.id.slice(0, 8)}.png`
    anchor.click()
  }

  const handleCopyImage = async () => {
    const response = await fetch(src)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    showCopiedToast()
  }

  const handleCopyPrompt = () => {
    if (meta?.prompt) {
      navigator.clipboard.writeText(meta.prompt)
      showCopiedToast()
    }
  }

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/x-playground-image', JSON.stringify(image))
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onOpen(image)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(image)
        }
      }}
      className="@container group relative h-full w-full cursor-pointer overflow-hidden rounded-2xl border border-outline-variant bg-surface-container"
    >
      <img
        src={src}
        alt={meta?.prompt ?? ''}
        className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />

      {/* Gradient scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* MD3 state layer on hover */}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />

      {/* Copied toast */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center transition-all duration-300 ${toast ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
      >
        <div className="rounded-full bg-black/70 px-4 py-2 text-[12px] font-medium text-white backdrop-blur-sm">
          已复制
        </div>
      </div>

      {/* Meta chip — top right, pill */}
      {meta && (
        <div className="pointer-events-none absolute top-2.5 right-2.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-md">
          {meta.resolution} · {meta.aspectRatio}
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="mb-2.5 min-w-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="line-clamp-2 text-[12px] font-medium leading-[1.45] text-white/90">
            {index !== undefined && (
              <span className="mr-1 text-white/50">#{index + 1}</span>
            )}
            {meta?.prompt || '上传图片'}
          </div>
        </div>

        {/* Action buttons — pill shape, slide up on hover */}
        <div className="hidden md:grid grid-cols-2 @[200px]:grid-cols-4 gap-1 opacity-0 translate-y-1.5 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <ActionButton label="+参考" onClick={() => onAddToRef(image)} />
          <ActionButton label="下载" onClick={handleDownload} />
          <ActionButton label="复制图" onClick={handleCopyImage} />
          {meta?.prompt && <ActionButton label="复制词" onClick={handleCopyPrompt} />}
        </div>
      </div>
    </div>
  )
})

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="w-full rounded-full bg-white/20 px-2 py-1.5 text-[10px] font-medium text-white whitespace-nowrap backdrop-blur-sm transition-colors hover:bg-white/32"
    >
      {label}
    </button>
  )
}
