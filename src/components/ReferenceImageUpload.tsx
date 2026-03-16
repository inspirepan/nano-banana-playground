import { useCallback, useRef, useState } from 'react'
import type { PlaygroundImage } from '../lib/types'

type Props = {
  images: PlaygroundImage[]
  maxTotal: number
  onAdd: (files: File[]) => void
  onAddImage: (image: PlaygroundImage) => void
  onRemove: (id: string) => void
}

export function ReferenceImageUpload({ images, maxTotal, onAdd, onAddImage, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      // Check for playground image data (dragged from history)
      const imageJson = e.dataTransfer.getData('application/x-playground-image')
      if (imageJson) {
        try {
          const img: PlaygroundImage = JSON.parse(imageJson)
          // Avoid adding duplicates
          onAddImage(img)
          return
        } catch { /* fall through to file handling */ }
      }

      // Regular file drop
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (files.length > 0) onAdd(files)
    },
    [onAdd, onAddImage],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) onAdd(files)
      e.target.value = ''
    },
    [onAdd],
  )

  const getLabel = (img: PlaygroundImage) => {
    if (img.source.type === 'upload') return img.source.fileName
    return `gen-${img.id.slice(0, 6)}`
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <label className="text-sm font-medium text-on-surface-variant">参考图片</label>
        <span className="text-sm text-on-surface-variant/60">
          {images.length}/{maxTotal}
        </span>
      </div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`min-h-[120px] rounded-2xl transition-colors p-4 flex flex-col justify-center
          ${dragOver ? 'bg-primary-dim' : 'bg-surface-container hover:bg-surface-container-high'}`}
      >
        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2 w-full">
            {images.map((img) => (
              <div key={img.id} className="relative group w-16 h-16">
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={getLabel(img)}
                  className="w-full h-full object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => onRemove(img.id)}
                  aria-label="移除参考图"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5
                             bg-error-container text-on-error-container
                             hover:bg-error hover:text-on-primary hover:scale-110
                             rounded-full flex items-center justify-center
                             transition-all duration-150
                             [box-shadow:0_1px_3px_rgba(0,0,0,0.25)]"
                >
                  <span className="material-symbols-rounded leading-none" style={{ fontSize: 12, fontVariationSettings: "'wght' 700" }}>close</span>
                </button>
              </div>
            ))}
            {images.length < maxTotal && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-16 h-16 rounded-xl bg-surface-container-high
                           hover:bg-outline-variant flex items-center justify-center
                           text-on-surface-variant text-xl transition-colors"
              >
                +
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-full min-h-[56px] flex flex-col items-center justify-center gap-1
                       text-on-surface-variant cursor-pointer"
          >
            <span className="text-base">+</span>
            <span className="text-sm">拖放或点击上传</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
