import type { ReactNode } from 'react'

import { Icon } from './Icon'
import { getBlobFromCache, useImageSrc } from '../hooks/useImageSrc'
import type { StackItem } from '../lib/stacks'

type Props = {
  item: StackItem
  active?: boolean
  outerRing?: boolean
  selectable?: boolean
  selected?: boolean
  actions?: ReactNode
  className?: string
  onSelect: (item: StackItem) => void
}

export function StackItemThumb({
  item,
  active = false,
  outerRing = false,
  selectable = false,
  selected = false,
  actions,
  className = 'h-14 w-14',
  onSelect,
}: Props) {
  const image = item.type === 'image' ? item.image : null
  const slot = item.type === 'slot' ? item.slot : null
  const { ref, src } = useImageSrc(image?.id ?? item.id, image?.mimeType ?? 'image/png', undefined, {
    variant: 'preview',
  })
  const highlighted = selected || active
  const boxShadow = outerRing
    ? highlighted
      ? '0 0 0 1px rgba(3, 7, 18, 0.16), 0 0 0 3px color-mix(in srgb, var(--color-accent) 70%, transparent), 0 10px 24px -16px rgba(3, 7, 18, 0.28)'
      : '0 0 0 1px rgba(3, 7, 18, 0.16), 0 10px 24px -16px rgba(3, 7, 18, 0.28)'
    : highlighted
      ? '0 0 0 2px var(--color-surface), 0 0 0 3px var(--color-accent)'
      : 'inset 0 0 0 1px var(--ring-edge)'

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={Boolean(image)}
      onDragStart={(event) => {
        if (!image) return
        const data = getBlobFromCache(image.id)
        const payload = data ? { ...image, data } : image
        event.dataTransfer.setData('application/x-playground-image', JSON.stringify(payload))
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
      aria-pressed={selectable ? selected : undefined}
      className={`group relative shrink-0 overflow-hidden rounded-[7px] transition-transform ${selectable ? '' : 'hover:-translate-y-0.5'} ${className}`}
      style={{ background: 'var(--color-surface-2)', boxShadow }}
      title={image?.source.type === 'generated' ? image.source.prompt : undefined}
    >
      <div ref={ref} className="absolute inset-0">
        {image ? (
          src ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full skeleton-animated" />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-(--color-text-4)">
            {slot?.status === 'failed' || slot?.status === 'canceled' ? (
              <Icon name="close" size={13} strokeWidth={1.8} />
            ) : slot?.status === 'queued' ? (
              <div className="h-2 w-2 rounded-full" style={{ background: 'var(--color-text-4)' }} />
            ) : (
              <span className="spinner" style={{ width: 12, height: 12 }} />
            )}
            <span className="mono text-xs">#{(slot?.index ?? item.order) + 1}</span>
          </div>
        )}
      </div>
      {selectable && (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-[5px] transition-colors"
          style={{
            background: selected ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-surface) 86%, transparent)',
            color: selected ? 'var(--color-accent-fg)' : 'var(--color-text-4)',
            boxShadow: selected ? 'inset 0 0 0 1px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge-strong)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {selected && <Icon name="check" size={11} strokeWidth={2.4} />}
        </span>
      )}
      {actions && <div className="absolute inset-x-1.5 bottom-1.5 z-10">{actions}</div>}
    </div>
  )
}
