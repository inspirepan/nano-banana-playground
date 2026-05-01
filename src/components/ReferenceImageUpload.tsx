import { useCallback, useRef } from 'react'

import { Icon } from './Icon'
import { useImageSrc } from '../hooks/useImageSrc'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

export type LockedReferenceImage = {
  id: string
  image: PlaygroundImageMeta
  label?: string
  preview?: PlaygroundImage
}

type Props = {
  images: PlaygroundImage[]
  lockedImages?: LockedReferenceImage[]
  hint?: string
  labelClassName?: string
  maxTotal: number
  dragOver: boolean
  error: string | null
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onClearAll: () => void
  onClearError: () => void
}

export function ReferenceImageUpload({
  images,
  lockedImages = [],
  hint = '可拖入本地图片，或按 ⌘/Ctrl+V 粘贴；也可拖入右侧历史图',
  labelClassName = 'label',
  maxTotal,
  dragOver,
  error,
  onAdd,
  onRemove,
  onClearAll,
  onClearError,
}: Props) {
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
      <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
        <span className={labelClassName}>参考图</span>
        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-sm text-(--color-text-4) hover:text-(--color-text-2) transition-colors"
            >
              清空
            </button>
          )}
          <span className="text-sm text-(--color-text-4)">
            {lockedImages.length + images.length}/{lockedImages.length + maxTotal}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {lockedImages.map((item) => (
          <LockedReferenceThumb key={item.id} item={item} />
        ))}
        {images.map((img) => (
          <div key={img.id} className="ref-thumb group aspect-square">
            <img
              src={`data:${img.mimeType};base64,${img.data}`}
              alt={getLabel(img)}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <button type="button" onClick={() => onRemove(img.id)} aria-label="移除参考图" className="ref-thumb-close">
              <Icon name="close" size={9} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        {images.length < maxTotal && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="dropzone aspect-square flex flex-col items-center justify-center gap-1 text-base font-medium text-(--color-text-3)"
            data-drag-active={dragOver}
          >
            <Icon name="plus" size={14} />
            上传
          </button>
        )}
      </div>
      {error && (
        <div
          className="mt-1.5 flex items-start gap-1.5 text-sm leading-[1.45] rounded-[var(--radius-sm)] px-2 py-1.5"
          style={{ color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
        >
          <Icon name="alert_circle" size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          <span className="flex-1 whitespace-pre-wrap">{error}</span>
          <button
            type="button"
            onClick={onClearError}
            className="flex-shrink-0 p-0 bg-transparent border-0 cursor-pointer"
            style={{ color: 'var(--color-danger)', opacity: 0.6 }}
            aria-label="关闭"
          >
            <Icon name="close" size={11} strokeWidth={2} />
          </button>
        </div>
      )}
      <div className="text-sm text-(--color-text-4) mt-1.5">{hint}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif,.heics,.heifs"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

function LockedReferenceThumb({ item }: { item: LockedReferenceImage }) {
  const { ref, src } = useImageSrc(item.image.id, item.image.mimeType, undefined, { variant: 'preview' })
  const previewSrc = item.preview ? `data:${item.preview.mimeType};base64,${item.preview.data}` : null
  return (
    <div ref={ref} className="ref-thumb group aspect-square">
      {previewSrc || src ? (
        <img
          src={previewSrc ?? src ?? undefined}
          alt={item.label ?? '锁定参考图'}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 skeleton-animated" />
      )}
      {item.label && (
        <span className="absolute bottom-1 left-1 rounded-[var(--radius-xs)] bg-black/55 px-1.5 py-0.5 text-base font-medium leading-none text-white backdrop-blur-[4px]">
          {item.label}
        </span>
      )}
      <span className="ref-thumb-close" style={{ opacity: 1, cursor: 'default' }} aria-label="系统锁定参考图">
        <Icon name="lock" size={9} strokeWidth={2.4} />
      </span>
    </div>
  )
}
