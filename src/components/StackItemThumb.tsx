import { useImageSrc } from '../hooks/useImageSrc'
import type { StackItem } from '../lib/stacks'
import { Icon } from './Icon'

type Props = {
  item: StackItem
  active?: boolean
  outerRing?: boolean
  className?: string
  onSelect: (item: StackItem) => void
}

export function StackItemThumb({ item, active = false, outerRing = false, className = 'h-14 w-14', onSelect }: Props) {
  const image = item.type === 'image' ? item.image : null
  const slot = item.type === 'slot' ? item.slot : null
  const { ref, src } = useImageSrc(image?.id ?? item.id, image?.mimeType ?? 'image/png', undefined, { variant: 'preview' })
  const boxShadow = outerRing
    ? active
      ? '0 0 0 1px rgba(3, 7, 18, 0.16), 0 0 0 3px color-mix(in srgb, var(--color-accent) 70%, transparent), 0 10px 24px -16px rgba(3, 7, 18, 0.28)'
      : '0 0 0 1px rgba(3, 7, 18, 0.16), 0 10px 24px -16px rgba(3, 7, 18, 0.28)'
    : active
      ? '0 0 0 2px var(--color-surface), 0 0 0 3px var(--color-accent)'
      : 'inset 0 0 0 1px var(--ring-edge)'

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`relative shrink-0 overflow-hidden rounded-[7px] transition-transform hover:-translate-y-0.5 ${className}`}
      style={{ background: 'var(--color-surface-2)', boxShadow }}
      title={image?.source.type === 'generated' ? image.source.prompt : undefined}
    >
      <div ref={ref} className="absolute inset-0">
        {image ? (
          src ? (
            <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
            <span className="mono text-[9.5px]">#{(slot?.index ?? item.order) + 1}</span>
          </div>
        )}
      </div>
    </button>
  )
}
