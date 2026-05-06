import { useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useMountEffect, useWindowEvent } from '../hooks/effects'

type Props = {
  text: string
  children: ReactNode
  className?: string
  // Preferred placement; will flip to the other side if viewport space is tight.
  placement?: 'top' | 'bottom'
  // Max width for the tooltip content. Defaults to 240.
  maxWidth?: number
}

const SHOW_DELAY_MS = 500
const GAP = 6
const VIEWPORT_PAD = 8
const FOCUS_SUPPRESS_MS = 800

function supportsHoverTooltip() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

// Shared Notion-style dark tooltip. Uses a fixed-position portal so it can
// escape clipping ancestors (for example the `overflow-y-auto` InputPanel
// scroll container). Positioning: centered under/above the trigger, clamped
// horizontally to the viewport, flipped vertically when space is tight.
export function Tooltip({ text, children, className, placement = 'bottom', maxWidth = 240 }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const showTimerRef = useRef<number>(0)
  const lastPointerDownAtRef = useRef(0)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })

  const scheduleShow = () => {
    window.clearTimeout(showTimerRef.current)
    showTimerRef.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
  }

  const hideTooltip = () => {
    window.clearTimeout(showTimerRef.current)
    setVisible(false)
  }

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !supportsHoverTooltip()) return
    scheduleShow()
  }

  const handlePointerDown = () => {
    lastPointerDownAtRef.current = window.performance.now()
    hideTooltip()
  }

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (window.performance.now() - lastPointerDownAtRef.current < FOCUS_SUPPRESS_MS) return
    scheduleShow()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    hideTooltip()
  }

  // Measure after mount and set final position. Runs synchronously before
  // paint so the tooltip doesn't flash at (-9999, -9999).
  useLayoutEffect(() => {
    if (!visible) return
    const trigger = wrapperRef.current
    const tip = tooltipRef.current
    if (!trigger || !tip) return
    const tr = trigger.getBoundingClientRect()
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    let finalPlacement = placement
    if (placement === 'bottom' && tr.bottom + th + GAP > window.innerHeight - VIEWPORT_PAD) {
      finalPlacement = 'top'
    } else if (placement === 'top' && tr.top - th - GAP < VIEWPORT_PAD) {
      finalPlacement = 'bottom'
    }
    const top = finalPlacement === 'top' ? tr.top - th - GAP : tr.bottom + GAP
    let left = tr.left + tr.width / 2 - tw / 2
    left = Math.max(VIEWPORT_PAD, Math.min(window.innerWidth - tw - VIEWPORT_PAD, left))
    setPos({ top, left })
  }, [visible, placement, text])

  // Dismiss on scroll or resize — recomputing on scroll would require listening
  // to every scrollable ancestor; dismissing is simpler and consistent with
  // other popovers in the app.
  useWindowEvent('scroll', () => setVisible(false), { capture: true }, visible)
  useWindowEvent('resize', () => setVisible(false), undefined, visible)

  useMountEffect(() => () => window.clearTimeout(showTimerRef.current))

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className ?? ''}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={hideTooltip}
      onPointerDown={handlePointerDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none fixed z-[9999] px-2.5 py-1.5 rounded-[var(--radius-sm)] text-sm leading-[1.45] whitespace-pre-wrap break-words fade-in"
            style={{
              top: pos.top,
              left: pos.left,
              maxWidth,
              width: 'max-content',
              background: 'var(--color-text)',
              color: 'var(--color-bg)',
              boxShadow: '0 6px 16px -6px rgba(15,17,21,0.24), 0 2px 4px rgba(15,17,21,0.08)',
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </div>
  )
}
