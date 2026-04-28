import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from '../Icon'
import {
  FIT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  clamp,
  clampOffset,
  getCenter,
  getContainedSize,
  getDistance,
  getRelativePoint,
  getViewportSize,
  type Point,
  type Size,
} from './viewGeometry'

/* ========================================================================
   ZoomableImageView — wheel/drag/pinch zoom, with Linear-style Zoom HUD
   ======================================================================== */

export function ZoomableImageView({
  src,
  alt,
  label,
  onSwipeLeft,
  onSwipeRight,
}: {
  src: string
  alt: string
  label?: string
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pictureRef = useRef<HTMLImageElement>(null)
  const activePointersRef = useRef(new Map<number, Point>())
  const pointerStartsRef = useRef(new Map<number, Point>())
  const dragStartRef = useRef<{ point: Point; offset: Point } | null>(null)
  const pinchStartRef = useRef<{ center: Point; distance: number; scale: number; offset: Point } | null>(null)
  const naturalSizeRef = useRef<Size>({ width: 0, height: 0 })
  const fitSizeRef = useRef<Size>({ width: 0, height: 0 })
  const scaleRef = useRef(FIT_SCALE)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const lastTapRef = useRef<{ at: number; point: Point } | null>(null)
  const didPinchRef = useRef(false)

  const [scale, setScale] = useState(FIT_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [fitSize, setFitSize] = useState<Size>({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)

  const applyView = useCallback((nextScale: number, nextOffset: Point) => {
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    const viewport = getViewportSize(containerRef.current)
    const clampedOffset = clampOffset(nextOffset, clampedScale, viewport, fitSizeRef.current)

    scaleRef.current = clampedScale
    offsetRef.current = clampedOffset
    // Paint transform straight to the DOM so pinch/pan follows the finger
    // without waiting for React's render + reconcile cycle. State updates
    // below keep downstream UI (cursor, etc.) consistent on the next render.
    const picture = pictureRef.current
    if (picture) {
      picture.style.transform = `translate3d(${clampedOffset.x}px, ${clampedOffset.y}px, 0) scale(${clampedScale})`
    }
    setScale(clampedScale)
    setOffset(clampedOffset)
  }, [])

  const syncFitSize = useCallback(() => {
    const viewport = getViewportSize(containerRef.current)
    const nextFitSize = getContainedSize(viewport, naturalSizeRef.current)
    fitSizeRef.current = nextFitSize
    setFitSize(nextFitSize)
    applyView(scaleRef.current, offsetRef.current)
  }, [applyView])

  const resetView = useCallback(() => {
    activePointersRef.current.clear()
    pointerStartsRef.current.clear()
    dragStartRef.current = null
    pinchStartRef.current = null
    didPinchRef.current = false
    setIsDragging(false)
    setIsInteracting(false)
    applyView(FIT_SCALE, { x: 0, y: 0 })
  }, [applyView])

  const zoomAtPoint = useCallback(
    (targetScale: number, anchor: Point) => {
      const currentScale = scaleRef.current
      const nextScale = clamp(targetScale, MIN_SCALE, MAX_SCALE)
      const ratio = nextScale / currentScale
      const currentOffset = offsetRef.current
      applyView(nextScale, {
        x: anchor.x - ratio * (anchor.x - currentOffset.x),
        y: anchor.y - ratio * (anchor.y - currentOffset.y),
      })
    },
    [applyView],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(syncFitSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [syncFitSize])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
      // Chrome reports trackpad pinch gestures as wheel events with ctrlKey
      // set. Their deltaY is small, so a larger coefficient is needed to
      // match the feel of a mouse scroll-wheel zoom.
      const factor = event.ctrlKey ? 0.02 : 0.0015
      const delta = Math.exp(-event.deltaY * factor)
      zoomAtPoint(scaleRef.current * delta, point)
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [zoomAtPoint])

  // Keyboard 0 = reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '0') {
        e.preventDefault()
        resetView()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [resetView])

  return (
    <div className="relative h-full min-h-0 md:min-h-[640px] w-full overflow-hidden">
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden touch-none select-none"
        onDoubleClick={(event) => {
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          if (scaleRef.current > FIT_SCALE) {
            resetView()
            return
          }
          zoomAtPoint(2.5, point)
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          event.currentTarget.setPointerCapture(event.pointerId)
          activePointersRef.current.set(event.pointerId, point)
          pointerStartsRef.current.set(event.pointerId, point)
          // Kill the idle 160ms transform transition immediately — otherwise the
          // first pinch/drag frame animates into place and feels laggy.
          if (pictureRef.current) pictureRef.current.style.transition = 'none'
          setIsInteracting(true)
          if (activePointersRef.current.size === 1) {
            dragStartRef.current = { point, offset: offsetRef.current }
            pinchStartRef.current = null
            setIsDragging(scaleRef.current > FIT_SCALE)
          }
          if (activePointersRef.current.size === 2) {
            const [first, second] = Array.from(activePointersRef.current.values())
            pinchStartRef.current = {
              center: getCenter(first, second),
              distance: Math.max(getDistance(first, second), 1),
              scale: scaleRef.current,
              offset: offsetRef.current,
            }
            dragStartRef.current = null
            didPinchRef.current = true
            setIsDragging(false)
          }
        }}
        onPointerMove={(event) => {
          if (!activePointersRef.current.has(event.pointerId)) return
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          activePointersRef.current.set(event.pointerId, point)

          if (activePointersRef.current.size === 2 && pinchStartRef.current) {
            const [first, second] = Array.from(activePointersRef.current.values())
            const start = pinchStartRef.current
            const distance = Math.max(getDistance(first, second), 1)
            const center = getCenter(first, second)
            const nextScale = clamp(start.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE)
            const ratio = nextScale / start.scale
            applyView(nextScale, {
              x: center.x - ratio * (start.center.x - start.offset.x),
              y: center.y - ratio * (start.center.y - start.offset.y),
            })
            return
          }

          if (activePointersRef.current.size === 1 && dragStartRef.current && scaleRef.current > MIN_SCALE) {
            const start = dragStartRef.current
            applyView(scaleRef.current, {
              x: start.offset.x + point.x - start.point.x,
              y: start.offset.y + point.y - start.point.y,
            })
          }
        }}
        onPointerUp={(event) => {
          const endPoint = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          const startPoint = pointerStartsRef.current.get(event.pointerId)
          const wasTap = startPoint ? getDistance(startPoint, endPoint) < 12 : false
          const wasPinching = didPinchRef.current

          activePointersRef.current.delete(event.pointerId)
          pointerStartsRef.current.delete(event.pointerId)

          if (activePointersRef.current.size === 1) {
            const [remainingPoint] = Array.from(activePointersRef.current.values())
            dragStartRef.current = { point: remainingPoint, offset: offsetRef.current }
            pinchStartRef.current = null
            setIsInteracting(true)
          } else {
            dragStartRef.current = null
            pinchStartRef.current = null
            setIsDragging(false)
            setIsInteracting(false)
          }

          if (event.pointerType === 'touch' && wasTap && !wasPinching) {
            const now = Date.now()
            const lastTap = lastTapRef.current
            if (lastTap && now - lastTap.at < 280 && getDistance(lastTap.point, endPoint) < 28) {
              if (scaleRef.current > FIT_SCALE) resetView()
              else zoomAtPoint(2.5, endPoint)
              lastTapRef.current = null
            } else {
              lastTapRef.current = { at: now, point: endPoint }
            }
          }

          if (
            event.pointerType === 'touch' &&
            !wasPinching &&
            activePointersRef.current.size === 0 &&
            scaleRef.current <= FIT_SCALE &&
            startPoint
          ) {
            const deltaX = endPoint.x - startPoint.x
            const deltaY = endPoint.y - startPoint.y
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
              if (deltaX < 0 && onSwipeLeft) onSwipeLeft()
              if (deltaX > 0 && onSwipeRight) onSwipeRight()
            }
          }

          if (activePointersRef.current.size < 2) didPinchRef.current = false
        }}
        onPointerCancel={() => {
          activePointersRef.current.clear()
          pointerStartsRef.current.clear()
          dragStartRef.current = null
          pinchStartRef.current = null
          didPinchRef.current = false
          setIsDragging(false)
          setIsInteracting(false)
        }}
        style={{ cursor: scale > FIT_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        {src ? (
          <img
            ref={pictureRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(event) => {
              naturalSizeRef.current = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              }
              resetView()
              syncFitSize()
            }}
            className="shrink-0 object-contain"
            style={{
              width: fitSize.width || undefined,
              height: fitSize.height || undefined,
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center',
              borderRadius: 8,
              boxShadow:
                '0 0 0 1px var(--ring-edge-strong), 0 30px 60px -24px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.06)',
              opacity: fitSize.width ? 1 : 0,
              transition:
                isDragging || isInteracting
                  ? 'none'
                  : fitSize.width
                    ? 'transform 160ms ease-out, opacity 120ms ease-out'
                    : 'none',
            }}
          />
        ) : (
          <div className="flex items-center justify-center">
            <span className="spinner" />
          </div>
        )}
      </div>

      {/* Label */}
      {label && <div className="pointer-events-none absolute left-4 top-4 tag">{label}</div>}

      {/* Zoom HUD */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
          borderRadius: 8,
          padding: 3,
          boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <button
          className="icon-btn"
          onClick={() => zoomAtPoint(scaleRef.current * 0.8, { x: 0, y: 0 })}
          style={{ width: 24, height: 22 }}
          title="缩小"
        >
          <Icon name="zoom_out_map" size={11} strokeWidth={1.8} />
        </button>
        <button
          onClick={resetView}
          className="mono text-sm font-medium"
          title="双击画布可重置 · 快捷键 0"
          style={{
            background: 'none',
            border: 0,
            color: 'var(--color-text-2)',
            minWidth: 48,
            textAlign: 'center',
            padding: '0 4px',
            cursor: 'pointer',
          }}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          className="icon-btn"
          onClick={() => zoomAtPoint(scaleRef.current * 1.25, { x: 0, y: 0 })}
          style={{ width: 24, height: 22 }}
          title="放大"
        >
          <Icon name="zoom_in" size={11} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
