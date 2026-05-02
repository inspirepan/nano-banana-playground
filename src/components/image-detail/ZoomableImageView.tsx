import { useCallback, useRef, useState } from 'react'

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
import { useExternalSync, useResizeObserver, useWindowEvent } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

const PINCH_HANDOFF_THRESHOLD = 1.05
const PINCH_FULLSCREEN_SCALE = 1.25
const CTRL_WHEEL_HANDOFF_DELAY = 180

export type ZoomableImageViewState = {
  scale: number
  focalPoint: Point
}

type TouchListLike = {
  item: (index: number) => { clientX: number; clientY: number } | null
}

function getTouchDistance(touches: TouchListLike) {
  const first = touches.item(0)
  const second = touches.item(1)
  if (!first || !second) return null
  return Math.max(getDistance({ x: first.clientX, y: first.clientY }, { x: second.clientX, y: second.clientY }), 1)
}

/* ========================================================================
   ZoomableImageView — wheel/drag/pinch zoom, with Linear-style Zoom HUD
   ======================================================================== */

export function ZoomableImageView({
  src,
  alt,
  label,
  initialView,
  onSwipeLeft,
  onSwipeRight,
  onPinchZoom,
}: {
  src: string
  alt: string
  label?: string
  initialView?: ZoomableImageViewState | null
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onPinchZoom?: (view: ZoomableImageViewState) => void
}) {
  const { t } = useI18n()
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
  const touchPinchStartDistanceRef = useRef<number | null>(null)
  const pinchHandoffActiveRef = useRef(false)
  const pinchHandoffPendingRef = useRef(false)
  const wheelHandoffTimerRef = useRef<number | null>(null)
  const initialViewAppliedKeyRef = useRef<string | null>(null)
  const initialViewKey = initialView
    ? `${src}:${initialView.scale}:${initialView.focalPoint.x}:${initialView.focalPoint.y}`
    : src

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

  const getViewState = useCallback((): ZoomableImageViewState | null => {
    const scale = scaleRef.current
    const offset = offsetRef.current
    const fitSize = fitSizeRef.current
    if (!fitSize.width || !fitSize.height || scale <= 0) return null
    return {
      scale,
      focalPoint: {
        x: clamp(0.5 - offset.x / (fitSize.width * scale), 0, 1),
        y: clamp(0.5 - offset.y / (fitSize.height * scale), 0, 1),
      },
    }
  }, [])

  const applyInitialView = useCallback(() => {
    if (!initialView || initialViewAppliedKeyRef.current === initialViewKey) return false
    const fitSize = fitSizeRef.current
    if (!fitSize.width || !fitSize.height) return false
    const nextScale = clamp(initialView.scale, MIN_SCALE, MAX_SCALE)
    initialViewAppliedKeyRef.current = initialViewKey
    applyView(nextScale, {
      x: -(initialView.focalPoint.x - 0.5) * fitSize.width * nextScale,
      y: -(initialView.focalPoint.y - 0.5) * fitSize.height * nextScale,
    })
    return true
  }, [applyView, initialView, initialViewKey])

  const clearInteractionState = useCallback(() => {
    activePointersRef.current.clear()
    pointerStartsRef.current.clear()
    dragStartRef.current = null
    pinchStartRef.current = null
    touchPinchStartDistanceRef.current = null
    pinchHandoffPendingRef.current = false
    didPinchRef.current = false
    setIsDragging(false)
    setIsInteracting(false)
  }, [])

  const commitPinchHandoff = useCallback(() => {
    if (!onPinchZoom || pinchHandoffActiveRef.current || !pinchHandoffPendingRef.current) return
    pinchHandoffPendingRef.current = false
    if (scaleRef.current < PINCH_FULLSCREEN_SCALE) return
    const view = getViewState()
    if (!view) return
    pinchHandoffActiveRef.current = true
    clearInteractionState()
    onPinchZoom(view)
    window.setTimeout(() => {
      pinchHandoffActiveRef.current = false
    }, 300)
  }, [clearInteractionState, getViewState, onPinchZoom])

  const scheduleWheelHandoff = useCallback(() => {
    if (!onPinchZoom) return
    if (wheelHandoffTimerRef.current !== null) window.clearTimeout(wheelHandoffTimerRef.current)
    wheelHandoffTimerRef.current = window.setTimeout(() => {
      wheelHandoffTimerRef.current = null
      commitPinchHandoff()
    }, CTRL_WHEEL_HANDOFF_DELAY)
  }, [commitPinchHandoff, onPinchZoom])

  const syncFitSize = useCallback(() => {
    const viewport = getViewportSize(containerRef.current)
    const nextFitSize = getContainedSize(viewport, naturalSizeRef.current)
    fitSizeRef.current = nextFitSize
    setFitSize(nextFitSize)
    if (applyInitialView()) return
    applyView(scaleRef.current, offsetRef.current)
  }, [applyInitialView, applyView])

  const resetView = useCallback(() => {
    clearInteractionState()
    applyView(FIT_SCALE, { x: 0, y: 0 })
  }, [applyView, clearInteractionState])

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

  useResizeObserver(containerRef, syncFitSize)

  useExternalSync(() => {
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
      const nextScale = scaleRef.current * delta
      zoomAtPoint(nextScale, point)
      if (onPinchZoom && event.ctrlKey && delta > 1 && nextScale >= PINCH_FULLSCREEN_SCALE) {
        pinchHandoffPendingRef.current = true
        scheduleWheelHandoff()
      }
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [onPinchZoom, scheduleWheelHandoff, zoomAtPoint])

  // Keyboard 0 = reset
  useWindowEvent('keydown', (e) => {
    if (e.key !== '0') return
    const target = e.target as HTMLElement | null
    const tag = target?.tagName
    const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
    if (isTextInput) return
    e.preventDefault()
    resetView()
  })

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
            if (
              onPinchZoom &&
              nextScale >= PINCH_FULLSCREEN_SCALE &&
              distance > start.distance * PINCH_HANDOFF_THRESHOLD
            ) {
              pinchHandoffPendingRef.current = true
            }
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

          if (event.pointerType === 'touch' && wasPinching && activePointersRef.current.size === 0) {
            commitPinchHandoff()
            return
          }

          if (activePointersRef.current.size < 2) didPinchRef.current = false
        }}
        onPointerCancel={() => {
          clearInteractionState()
        }}
        onTouchStart={(event) => {
          if (!onPinchZoom || event.touches.length < 2) return
          touchPinchStartDistanceRef.current = getTouchDistance(event.touches)
        }}
        onTouchMove={(event) => {
          if (!onPinchZoom || pinchHandoffActiveRef.current || event.touches.length < 2) return
          const distance = getTouchDistance(event.touches)
          if (!distance) return
          const startDistance = touchPinchStartDistanceRef.current
          if (!startDistance) {
            touchPinchStartDistanceRef.current = distance
            return
          }
          // touch-none CSS already prevents default scroll; no preventDefault() needed
          if (distance > startDistance * PINCH_HANDOFF_THRESHOLD) {
            if (scaleRef.current >= PINCH_FULLSCREEN_SCALE) pinchHandoffPendingRef.current = true
          }
        }}
        onTouchEnd={(event) => {
          if (event.touches.length < 2) touchPinchStartDistanceRef.current = null
          if (event.touches.length === 0) {
            commitPinchHandoff()
            pinchHandoffActiveRef.current = false
          }
        }}
        onTouchCancel={() => {
          touchPinchStartDistanceRef.current = null
          pinchHandoffActiveRef.current = false
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
          title={t('imageDetail.zoom.out')}
        >
          <Icon name="zoom_out_map" size={11} strokeWidth={1.8} />
        </button>
        <button
          onClick={resetView}
          className="text-sm font-medium"
          title={t('imageDetail.zoom.resetHint')}
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
          title={t('imageDetail.zoom.in')}
        >
          <Icon name="zoom_in" size={11} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
