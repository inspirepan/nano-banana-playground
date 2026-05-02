import { useLayoutEffect, useRef, useState } from 'react'

import { useI18n } from '../../i18n'

export function TruncatedText({
  text,
  className,
  fadeColor,
  maxHeight = 200,
}: {
  text: string
  className?: string
  fadeColor: string
  maxHeight?: number
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

  return (
    <div>
      <div className="relative">
        <div ref={ref} className={className} style={collapsed ? { maxHeight, overflow: 'hidden' } : undefined}>
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
