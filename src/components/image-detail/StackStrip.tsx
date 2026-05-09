import { memo, useMemo, useRef, type ReactNode } from 'react'

import { useExternalSync } from '../../hooks/effects'
import type { ImageStack, StackItem } from '../../lib/stacks'
import { StackItemThumb } from '../StackItemThumb'

export const StackStrip = memo(function StackStrip({
  stack,
  selectedId,
  onSelect,
  leadingNode,
  trailingNode,
}: {
  stack: ImageStack
  selectedId: string | null
  onSelect: (item: StackItem) => void
  leadingNode?: ReactNode
  trailingNode?: ReactNode
}) {
  const stripScrollRef = useRef<HTMLDivElement | null>(null)
  const selectedItemRef = useRef<HTMLDivElement | null>(null)
  const itemNumberById = useMemo(() => new Map(stack.items.map((item, index) => [item.id, index + 1])), [stack.items])
  const selectedScrollKey = `${selectedId ?? 'none'}:${stack.items.length}`

  useExternalSync(() => {
    if (selectedScrollKey.length === 0) return
    const scroller = stripScrollRef.current
    const selected = selectedItemRef.current
    if (!scroller || !selected) return

    const targetLeft = selected.offsetLeft + selected.offsetWidth - scroller.clientWidth + 10
    const maxLeft = scroller.scrollWidth - scroller.clientWidth
    scroller.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior: 'smooth' })
  }, [selectedScrollKey])

  return (
    <div
      className="shrink-0 overflow-x-auto px-3.5 py-2 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]"
      style={{
        backgroundColor: 'var(--color-bg-sunken)',
        backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-surface) 46%, transparent), color-mix(in srgb, var(--color-surface) 46%, transparent)), linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: 'auto, 28px 28px, 28px 28px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2">
        {leadingNode && <div className="hidden shrink-0 md:flex">{leadingNode}</div>}
        <div
          ref={stripScrollRef}
          className="scroll-fade-x -m-1 flex min-w-0 flex-1 items-stretch gap-2.5 overflow-x-auto py-1 pl-3 pr-3 [--scroll-fade-end-size:0.9rem] [--scroll-fade-start-size:0.9rem]"
        >
          {stack.items.map((item) => {
            const active = selectedId === item.id
            return (
              <div key={item.id} ref={active ? selectedItemRef : undefined} className="shrink-0">
                <StackItemThumb
                  item={item}
                  number={itemNumberById.get(item.id)}
                  active={active}
                  outerRing
                  showImageIdLabel={false}
                  compactSlotStatus
                  onSelect={onSelect}
                />
              </div>
            )
          })}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
        {trailingNode && (
          <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 md:flex">{trailingNode}</div>
        )}
      </div>
    </div>
  )
})
