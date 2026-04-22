import { useCallback, useRef } from 'react'
import type { PlaygroundImage } from '../lib/types'
import { Icon } from './Icon'

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
      <div className="flex items-center justify-between mb-1.5">
        <span className="label">参考图</span>
        <span className="mono text-[11px] text-(--color-text-4)">{images.length}/{maxTotal}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative group aspect-square rounded-[6px] border border-(--color-border) overflow-hidden bg-(--color-surface-2)"
          >
            <img
              src={`data:${img.mimeType};base64,${img.data}`}
              alt={getLabel(img)}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <button
              type="button"
              onClick={() => onRemove(img.id)}
              aria-label="移除参考图"
              className="absolute top-[3px] right-[3px] w-4 h-4 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="close" size={9} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        {images.length < maxTotal && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`dropzone aspect-square flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-(--color-text-3) ${dragOver ? 'border-(--color-accent) bg-(--color-accent-wash)' : ''}`}
          >
            <Icon name="plus" size={14} />
            上传
          </button>
        )}
      </div>
      <div className="text-[11px] text-(--color-text-4) mt-1.5">
        拖拽文件、粘贴图片，或从历史中拖入
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
