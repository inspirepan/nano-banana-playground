import type { CSSProperties, ReactNode } from 'react'

import { Icon } from './Icon'
import { getBlobFromCache, useImageSrc } from '../hooks/useImageSrc'
import type { StackItem } from '../lib/stacks'

type Props = {
  item: StackItem
  number?: number
  active?: boolean
  outerRing?: boolean
  selectable?: boolean
  selected?: boolean
  showSlotReason?: boolean
  actions?: ReactNode
  className?: string
  numberBadgeInset?: number
  metaBadge?: string
  metaBadgeTitle?: string
  onSelect: (item: StackItem) => void
}

type Slot = Extract<StackItem, { type: 'slot' }>['slot']
type StackThumbStyle = CSSProperties & { '--stack-thumb-action-bg'?: string }

function slotReasonText(slot: Slot): string | null {
  if (slot.status === 'queued') return '排队中'
  if (slot.status === 'failed') return slot.error ? `失败：${slot.error}` : '失败：未知错误'
  if (slot.status !== 'retrying') return null

  const parts = [`重试中 ${slot.attempt}/${slot.maxAttempts}`]
  if (slot.error) parts.push(slot.error)
  return parts.join(' · ')
}

function slotReasonColor(slot: Slot): string {
  if (slot.status === 'failed') return 'var(--color-danger)'
  if (slot.status === 'retrying') return 'var(--color-accent)'
  return 'var(--color-text-4)'
}

export function StackItemThumb({
  item,
  number,
  active = false,
  outerRing = false,
  selectable = false,
  selected = false,
  showSlotReason = false,
  actions,
  className = 'h-14 w-14',
  numberBadgeInset = 3,
  metaBadge,
  metaBadgeTitle,
  onSelect,
}: Props) {
  const image = item.type === 'image' ? item.image : null
  const slot = item.type === 'slot' ? item.slot : null
  const imageIdLabel =
    image?.source.type === 'generated' && image.source.imageIdSource === 'agent'
      ? image.id
      : item.type === 'slot'
        ? item.job.request.outputImageIds?.[item.slot.index]
        : undefined
  const imageIdDisplay = imageIdLabel ? Array.from(imageIdLabel).slice(0, 20).join('') : undefined
  const inlineData = image && 'data' in image && typeof image.data === 'string' ? image.data : undefined
  const { ref, src } = useImageSrc(image?.id ?? item.id, image?.mimeType ?? 'image/png', inlineData, {
    variant: 'preview',
  })
  const highlighted = selected || active
  const slotReason = showSlotReason && slot ? slotReasonText(slot) : null
  const title = image?.source.type === 'generated' ? image.source.prompt : (slotReason ?? undefined)
  const outerRingShadow = slot ? '' : ', var(--shadow-lift)'
  const boxShadow = outerRing
    ? highlighted
      ? `0 0 0 1px var(--ring-edge-elevated), 0 0 0 3px color-mix(in srgb, var(--color-accent) 70%, transparent)${outerRingShadow}`
      : `0 0 0 1px var(--ring-edge-elevated)${outerRingShadow}`
    : highlighted
      ? '0 0 0 2px var(--color-surface), 0 0 0 3px var(--color-accent)'
      : 'inset 0 0 0 1px var(--ring-edge)'
  const actionStyle: StackThumbStyle | undefined = src ? { '--stack-thumb-action-bg': `url("${src}")` } : undefined
  // Slot placeholders get a subtle diagonal stripe texture so they read as
  // "work pending" rather than an empty tile.
  const background = slot
    ? 'repeating-linear-gradient(-45deg, var(--color-surface-2) 0 6px, var(--color-surface-3) 6px 12px)'
    : 'var(--color-surface-2)'
  const metaBadgeParts = metaBadge?.split(' · ')
  const splitMetaBadge =
    metaBadgeParts && metaBadgeParts.length >= 3
      ? { title: metaBadgeParts[0], detail: metaBadgeParts.slice(1).join(' · ') }
      : null
  const badgeSurface = slot
    ? {
        background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
        color: 'var(--color-text-2)',
        boxShadow: 'inset 0 0 0 1px var(--ring-edge-strong), 0 1px 2px rgba(0,0,0,0.04)',
      }
    : {
        background: 'rgba(0,0,0,0.56)',
        color: '#fff',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
      }
  const metaBadgeStyle: CSSProperties = {
    top: numberBadgeInset,
    right: numberBadgeInset,
    maxWidth: `calc(100% - ${numberBadgeInset * 2 + 36}px)`,
    background: slot ? badgeSurface.background : 'rgba(0,0,0,0.5)',
    color: badgeSurface.color,
    boxShadow: slot ? badgeSurface.boxShadow : 'inset 0 0 0 1px rgba(255,255,255,0.16)',
    backdropFilter: 'blur(8px)',
  }

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
      style={{ background, boxShadow }}
      title={title}
    >
      <div ref={ref} className="absolute inset-0">
        {image ? (
          src ? (
            <img src={src} alt="" decoding="async" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full skeleton-animated" />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-(--color-text-4)">
            {slot?.status === 'failed' || slot?.status === 'canceled' ? (
              <Icon name="close" size={13} strokeWidth={1.8} />
            ) : slot?.status === 'queued' ? (
              <div className="h-2 w-2 rounded-full" style={{ background: 'var(--color-text-4)' }} />
            ) : (
              <span className="spinner" style={{ width: 12, height: 12 }} />
            )}
            <span className="text-sm">#{(slot?.index ?? item.order) + 1}</span>
            {slotReason && slot && (
              <span
                className="mt-1 max-w-full text-center text-sm font-normal leading-[1.45]"
                style={{
                  color: slotReasonColor(slot),
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                  overflow: 'hidden',
                }}
              >
                {slotReason}
              </span>
            )}
          </div>
        )}
      </div>
      <span
        className="pointer-events-none absolute z-10 inline-flex h-[18px] min-w-[24px] items-center justify-center rounded-[5px] px-1.5 text-base font-normal leading-none"
        style={{
          left: numberBadgeInset,
          top: numberBadgeInset,
          ...badgeSurface,
          backdropFilter: 'blur(8px)',
        }}
      >
        #{number ?? item.order + 1}
      </span>
      {imageIdLabel && imageIdDisplay && (
        <span
          className="pointer-events-none absolute z-10 mono max-w-[calc(100%-16px)] truncate rounded-[5px] px-1.5 py-0.5 text-[10px] leading-none"
          style={{
            left: numberBadgeInset,
            bottom: numberBadgeInset,
            ...badgeSurface,
            backdropFilter: 'blur(8px)',
          }}
          title={imageIdLabel}
        >
          {imageIdDisplay}
        </span>
      )}
      {metaBadge && (
        <span
          className="pointer-events-none absolute z-10 flex flex-col items-start rounded-[5px] px-1.5 py-1 text-white"
          style={metaBadgeStyle}
          title={metaBadgeTitle ?? metaBadge}
        >
          {splitMetaBadge ? (
            <>
              <span className="max-w-full truncate text-[11px] font-medium leading-[12px]">{splitMetaBadge.title}</span>
              <span
                className={`mt-0.5 max-w-full truncate text-[10px] font-normal leading-[11px] tabular-nums ${slot ? 'text-(--color-text-3)' : 'text-white/85'}`}
              >
                {splitMetaBadge.detail}
              </span>
            </>
          ) : (
            <span className="max-w-full truncate text-[11px] font-medium leading-none tabular-nums">{metaBadge}</span>
          )}
        </span>
      )}
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
      {actions && (
        <div className="stack-thumb-actions absolute inset-x-1.5 bottom-1.5 z-10" style={actionStyle}>
          {actions}
        </div>
      )}
    </div>
  )
}
