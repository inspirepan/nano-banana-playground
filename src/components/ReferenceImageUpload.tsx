import { useCallback, useRef } from 'react'
import type { PlaygroundImage } from '../lib/types'

type Props = {
  images: PlaygroundImage[]
  maxTotal: number
  dragOver: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}

export function ReferenceImageUpload({ images, maxTotal, dragOver, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

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
        {images.length > 0 && (
          <span className="text-sm text-on-surface-variant/60">
            {images.length}/{maxTotal}
          </span>
        )}
      </div>
      {images.length > 0 ? (
        <div
          className={`rounded-2xl transition-colors p-4 flex flex-col justify-center
            ${dragOver ? 'bg-primary-dim' : 'bg-surface-container hover:bg-surface-container-high'}`}
        >
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
                             bg-on-surface/60 text-surface
                             hover:bg-on-surface/80
                             rounded-full flex items-center justify-center
                             opacity-0 group-hover:opacity-100
                             transition-opacity duration-150"
                >
                  <span className="material-symbols-rounded leading-none" style={{ fontSize: 12, fontVariationSettings: "'wght' 500" }}>close</span>
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
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl w-full transition-colors
            ${dragOver ? 'bg-primary-dim' : 'bg-surface-container hover:bg-surface-container-high'}`}
        >
          <span className="material-symbols-rounded text-lg leading-none text-on-surface-variant/60">add_photo_alternate</span>
          <span className="text-sm text-on-surface-variant/60">点击上传或拖入图片</span>
        </button>
      )}
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
