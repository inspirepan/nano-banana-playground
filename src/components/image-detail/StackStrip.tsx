import { memo, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'

import { useExternalSync } from '../../hooks/effects'
import type { ImageStack, StackItem } from '../../lib/stacks'
import { StackItemThumb } from '../StackItemThumb'

export const StackStrip = memo(function StackStrip({
  stack,
  selectedId,
  onSelect,
  leadingNode,
  isMobileLayout,
  sidebarCollapsed,
}: {
  stack: ImageStack
  selectedId: string | null
  onSelect: (item: StackItem) => void
  leadingNode?: ReactNode
  isMobileLayout: boolean
  sidebarCollapsed: boolean
}) {
  const stripScrollRef = useRef<HTMLDivElement | null>(null)
  const selectedItemRef = useRef<HTMLDivElement | null>(null)
  const itemNumberById = useMemo(() => new Map(stack.items.map((item, index) => [item.id, index + 1])), [stack.items])
  const selectedScrollKey = `${selectedId ?? 'none'}:${stack.items.length}:${isMobileLayout ? 'mobile' : 'desktop'}`
  const surfaceStyle: CSSProperties = isMobileLayout
    ? {
        backgroundColor: 'var(--color-bg-sunken)',
        backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-surface) 46%, transparent), color-mix(in srgb, var(--color-surface) 46%, transparent)), linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: 'auto, 28px 28px, 28px 28px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }
    : {
        maxWidth: `clamp(220px, calc(100% - ${sidebarCollapsed ? 24 : 364}px), 560px)`,
        backgroundColor: 'color-mix(in srgb, var(--color-surface) 68%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }
  const scrollerClassName = isMobileLayout
    ? 'scroll-fade-x -m-1 flex min-w-0 flex-1 items-stretch gap-2.5 overflow-x-auto py-1 pl-3 pr-3 [--scroll-fade-end-size:0.9rem] [--scroll-fade-start-size:0.9rem]'
    : 'flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto px-1 py-1'

  useExternalSync(() => {
    if (selectedScrollKey.length === 0) return
    const scroller = stripScrollRef.current
    const selected = selectedItemRef.current
    if (!scroller || !selected) return

    const selectedStart = selected.offsetLeft
    const selectedSize = selected.offsetWidth
    const scrollerStart = scroller.scrollLeft
    const scrollerSize = scroller.clientWidth
    const maxScroll = scroller.scrollWidth - scroller.clientWidth
    const inset = 10
    const selectedEnd = selectedStart + selectedSize
    const scrollerEnd = scrollerStart + scrollerSize

    let target = scrollerStart
    if (selectedStart < scrollerStart + inset) target = selectedStart - inset
    else if (selectedEnd > scrollerEnd - inset) target = selectedEnd - scrollerSize + inset
    else return

    const nextScroll = Math.max(0, Math.min(target, maxScroll))
    scroller.scrollTo({ left: nextScroll, behavior: 'smooth' })
  }, [selectedScrollKey])

  return (
    <div
      className="shrink-0 overflow-hidden px-3.5 py-2 shadow-[inset_0_-1px_0_var(--ring-edge-soft)] md:absolute md:left-3 md:top-3 md:z-30 md:flex md:min-w-0 md:rounded-[var(--radius-lg)] md:px-2 md:py-2 md:shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
      style={surfaceStyle}
    >
      <div className="flex items-center gap-2 md:min-w-0 md:flex-1">
        {leadingNode && <div className="hidden shrink-0 md:flex md:pr-1">{leadingNode}</div>}
        <div ref={stripScrollRef} className={scrollerClassName}>
          {stack.items.map((item) => {
            const active = selectedId === item.id
            return (
              <div key={item.id} ref={active ? selectedItemRef : undefined} className="shrink-0">
                <StackItemThumb
                  item={item}
                  number={itemNumberById.get(item.id)}
                  active={active}
                  outerRing
                  hoverLift={false}
                  showImageIdLabel={false}
                  compactSlotStatus
                  onSelect={onSelect}
                />
              </div>
            )
          })}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  )
})
