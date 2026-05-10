import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

import { useI18n } from '../../i18n'

export function TruncatedText({
  text,
  className,
  fadeColor,
  maxHeight = 200,
  expandedMaxHeight,
}: {
  text: string
  className?: string
  fadeColor: string
  maxHeight?: number
  expandedMaxHeight?: CSSProperties['maxHeight']
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    let frame: number | null = null
    const measure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = null
        const nextOverflowing = el.scrollHeight > maxHeight + 4
        setOverflowing((prev) => (prev === nextOverflowing ? prev : nextOverflowing))
      })
    }

    measure()

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(el)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
    }
  }, [text, maxHeight])

  const collapsed = overflowing && !expanded
  const contentStyle: CSSProperties | undefined = collapsed
    ? { maxHeight, overflow: 'hidden' }
    : expanded && expandedMaxHeight !== undefined
      ? { maxHeight: expandedMaxHeight, overflowY: 'auto', overscrollBehavior: 'contain' }
      : undefined
  const contentClassName =
    expanded && expandedMaxHeight !== undefined
      ? `${className ?? ''} scroll-fade-y [--scroll-fade-end-size:1.25rem] [--scroll-fade-start-size:1.25rem]`
      : className

  return (
    <div>
      <div className="relative">
        <div ref={ref} className={contentClassName} style={contentStyle}>
          {text}
        </div>
        {collapsed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{ background: `linear-gradient(to bottom, transparent, ${fadeColor})` }}
          />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((prev) => !prev)
          }}
          className="relative z-10 mt-1.5 bg-transparent p-0 text-sm text-(--color-text-3) transition-colors hover:text-(--color-text)"
        >
          {expanded ? t('agentChat.truncated.collapse') : t('agentChat.truncated.expand')}
        </button>
      )}
    </div>
  )
}
