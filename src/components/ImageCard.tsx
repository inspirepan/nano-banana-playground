import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlaygroundImageMeta } from '../lib/types'
import { ensureBlobLoaded, useImageSrc, getBlobFromCache } from '../hooks/useImageSrc'

type Props = {
  image: PlaygroundImageMeta
  inlineData?: string
  index?: number
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onRemove: (id: string) => void
  onOpen: (image: PlaygroundImageMeta) => void
}

export const ImageCard = memo(function ImageCard({ image, inlineData, index, onAddToRef, onRegenerate, onRemove, onOpen }: Props) {
  const CONTEXT_MENU_WIDTH = 160
  const CONTEXT_MENU_ITEM_HEIGHT = 36
  const CONTEXT_MENU_PADDING = 8
  const { ref, src } = useImageSrc(image.id, image.mimeType, inlineData, { variant: 'preview' })
  const meta = image.source.type === 'generated' ? image.source : null
  const [toast, setToast] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const showCopiedToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 1500)
  }

  const resolveFullSrc = async () => {
    if (inlineData) {
      return `data:${image.mimeType};base64,${inlineData}`
    }

    return ensureBlobLoaded(image.id, image.mimeType)
  }

  const handleDownload = async () => {
    const fullSrc = await resolveFullSrc()
    if (!fullSrc) return
    const anchor = document.createElement('a')
    anchor.href = fullSrc
    anchor.download = `nano-banana-${image.id.slice(0, 8)}.png`
    anchor.click()
  }

  const handleCopyImage = async () => {
    const fullSrc = await resolveFullSrc()
    if (!fullSrc) return
    const response = await fetch(fullSrc)
    const sourceBlob = await response.blob()
    let clipboardBlob = sourceBlob

    if (sourceBlob.type !== 'image/png') {
      const bitmap = await createImageBitmap(sourceBlob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })
      if (!pngBlob) return
      clipboardBlob = pngBlob
    }

    await navigator.clipboard.write([new ClipboardItem({ [clipboardBlob.type]: clipboardBlob })])
    showCopiedToast()
  }

  const handleRegenerate = () => {
    onRegenerate(image)
  }

  const handleDelete = () => {
    onRemove(image.id)
  }

  const handleDragStart = (event: React.DragEvent) => {
    const data = getBlobFromCache(image.id)
    const payload = data ? { ...image, data } : image
    event.dataTransfer.setData('application/x-playground-image', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'copy'
  }

  useEffect(() => {
    if (!menu) return
    const handleClose = () => setMenu(null)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', handleClose)
    window.addEventListener('scroll', handleClose, true)
    window.addEventListener('resize', handleClose)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClose)
      window.removeEventListener('scroll', handleClose, true)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [menu])

  const actionItems: Array<{ label: string; onClick: () => void; danger?: boolean }> = [
    { label: '+参考', onClick: () => onAddToRef(image) },
    { label: '下载', onClick: handleDownload },
    { label: '复制图', onClick: handleCopyImage },
    ...(meta?.prompt ? [{ label: '重做', onClick: handleRegenerate }] : []),
    { label: '删除', onClick: handleDelete, danger: true },
  ]

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      draggable
      onContextMenu={(event) => {
        event.preventDefault()
        const menuHeight = actionItems.length * CONTEXT_MENU_ITEM_HEIGHT + CONTEXT_MENU_PADDING
        const x = Math.min(event.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 8)
        const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8)
        setMenu({ x: Math.max(8, x), y: Math.max(8, y) })
      }}
      onDragStart={handleDragStart}
      onClick={() => onOpen(image)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(image)
        }
      }}
      className="@container group relative h-full w-full cursor-pointer overflow-hidden rounded-xl border border-outline-variant bg-surface-container"
    >
      {src ? (
        <img
          src={src}
          alt={meta?.prompt ?? ''}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-surface-container-high" />
      )}

      {/* Gradient scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* MD3 state layer on hover */}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />

      {/* Copied toast */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center transition-all duration-300 ${toast ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
      >
        <div className="rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
          已复制
        </div>
      </div>

      {/* Meta chip — top right, pill */}
      {meta && (
        <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/40 px-2 py-1 text-2xs font-medium tabular-nums text-white/90 backdrop-blur-md">
          {meta.resolution} · {meta.aspectRatio}
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="mb-2 min-w-0">
          <div className="line-clamp-2 text-xs font-medium leading-[1.45] text-white/90">
            {index !== undefined && (
              <span className="mr-1 text-white/50">#{index + 1}</span>
            )}
            {meta?.prompt || '上传图片'}
          </div>
        </div>

        {/* Action buttons — pill shape, slide up on hover */}
        <div className="hidden md:grid grid-cols-2 @[200px]:grid-cols-5 gap-1 opacity-0 translate-y-2 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          {actionItems.map((item) => (
            <ActionButton key={item.label} label={item.label} onClick={item.onClick} danger={item.danger} />
          ))}
        </div>
      </div>

      {menu && createPortal(
        <div
          style={{ top: menu.y, left: menu.x }}
          className="fixed z-[120] min-w-28 rounded-xl border border-outline-variant bg-surface-container p-1 shadow-xl"
        >
          {actionItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setMenu(null)
                item.onClick()
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors
                ${item.danger
                  ? 'text-error hover:bg-error/12 active:bg-error/20'
                  : 'text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
})

function ActionButton({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`w-full rounded-xl px-2 py-1.5 text-xs font-medium whitespace-nowrap backdrop-blur-sm transition-colors
        ${danger
          ? 'bg-error/30 text-white hover:bg-error/40 active:bg-error/50'
          : 'bg-white/20 text-white hover:bg-white/30 active:bg-white/40'}`}
    >
      {label}
    </button>
  )
}
