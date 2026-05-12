import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { useMountEffect, useWindowEvent } from '../hooks/effects'

type Props = {
  text: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  // Preferred placement; will flip to the other side if viewport space is tight.
  placement?: 'top' | 'bottom'
  // Max width for the tooltip content. Defaults to 320, then clamps to viewport.
  maxWidth?: number
}

const SHOW_DELAY_MS = 500
const HIDE_GRACE_MS = 100
const GAP = 6
const VIEWPORT_PAD = 8
const MIN_SCROLL_HEIGHT = 96
const FOCUS_SUPPRESS_MS = 800

function supportsHoverTooltip(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

// Shared Notion-style dark tooltip. Uses a fixed-position portal so it can
// escape clipping ancestors (for example the `overflow-y-auto` InputPanel
// scroll container). Positioning: centered under/above the trigger, clamped
// horizontally to the viewport, flipped vertically when space is tight.
export function Tooltip({ text, children, className, style, placement = 'bottom', maxWidth = 320 }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const showTimerRef = useRef<number>(0)
  const hideTimerRef = useRef<number>(0)
  const lastPointerDownAtRef = useRef(0)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number }>({
    top: -9999,
    left: -9999,
    maxHeight: 9999,
  })

  const scheduleShow = () => {
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
    showTimerRef.current = window.setTimeout(() => {
      setPos({ top: -9999, left: -9999, maxHeight: 9999 })
      setVisible(true)
    }, SHOW_DELAY_MS)
  }

  const hideTooltip = () => {
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
    setVisible(false)
  }

  const scheduleHide = () => {
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setVisible(false), HIDE_GRACE_MS)
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

  const handleWindowScroll = (event: Event) => {
    const target = event.target
    if (target instanceof Node && tooltipRef.current?.contains(target)) return
    setVisible(false)
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
    const topSpace = Math.max(0, tr.top - GAP - VIEWPORT_PAD)
    const bottomSpace = Math.max(0, window.innerHeight - tr.bottom - GAP - VIEWPORT_PAD)
    const preferredSpace = placement === 'top' ? topSpace : bottomSpace
    const fallbackSpace = placement === 'top' ? bottomSpace : topSpace
    const shouldFlip = th > preferredSpace && fallbackSpace > preferredSpace
    const finalPlacement = shouldFlip ? (placement === 'top' ? 'bottom' : 'top') : placement
    const viewportMaxHeight = Math.max(48, window.innerHeight - VIEWPORT_PAD * 2)
    const availableHeight = Math.min(
      viewportMaxHeight,
      Math.max(MIN_SCROLL_HEIGHT, finalPlacement === 'top' ? topSpace : bottomSpace),
    )
    const renderedHeight = Math.min(th, availableHeight)
    const rawTop = finalPlacement === 'top' ? tr.top - renderedHeight - GAP : tr.bottom + GAP
    const top = Math.max(VIEWPORT_PAD, Math.min(window.innerHeight - renderedHeight - VIEWPORT_PAD, rawTop))
    let left = tr.left + tr.width / 2 - tw / 2
    left = Math.max(VIEWPORT_PAD, Math.min(window.innerWidth - tw - VIEWPORT_PAD, left))
    setPos({ top, left, maxHeight: availableHeight })
  }, [visible, placement, text, maxWidth])

  // Dismiss when the page or an ancestor scrolls, but keep long tooltips open
  // while the user scrolls inside the tooltip itself.
  useWindowEvent('scroll', handleWindowScroll, { capture: true }, visible)
  useWindowEvent('resize', () => setVisible(false), undefined, visible)

  useMountEffect(() => () => {
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
  })

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={scheduleHide}
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
            className="fixed z-[9999] overflow-y-auto px-2.5 py-1.5 rounded-[var(--radius-sm)] text-sm leading-[1.45] whitespace-pre-wrap break-words fade-in"
            onPointerEnter={() => window.clearTimeout(hideTimerRef.current)}
            onPointerLeave={hideTooltip}
            style={{
              top: pos.top,
              left: pos.left,
              maxWidth: `min(${maxWidth}px, calc(100vw - ${VIEWPORT_PAD * 2}px))`,
              maxHeight: pos.maxHeight,
              width: 'max-content',
              overscrollBehavior: 'contain',
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
