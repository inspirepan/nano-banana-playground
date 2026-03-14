import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaygroundImage } from '../lib/types'
import { MODEL_CONFIGS } from '../config/models'

const MIN_SCALE = 0.5
const MAX_SCALE = 6
const FIT_SCALE = 1

type Props = {
  image: PlaygroundImage
  history: PlaygroundImage[]
  onClose: () => void
  onAddToRef: (image: PlaygroundImage) => void
  onRemove: (id: string) => void
}

type Point = {
  x: number
  y: number
}

type Size = {
  width: number
  height: number
}

export function ImageDetailModal({ image, history, onClose, onAddToRef, onRemove }: Props) {
  // Navigation: -1 means image is not in history (e.g. uploaded reference)
  const [currentIdx, setCurrentIdx] = useState(() => history.findIndex(h => h.id === image.id))

  const currentImage = currentIdx >= 0 ? history[currentIdx] : image
  const currentSrc = `data:${currentImage.mimeType};base64,${currentImage.data}`
  const currentMeta = currentImage.source.type === 'generated' ? currentImage.source : null
  const canNavigate = currentIdx >= 0

  const [toast, setToast] = useState(false)
  const [refDetail, setRefDetail] = useState<PlaygroundImage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [refDetail])

  const goToPrev = useCallback(() => {
    setCurrentIdx(i => Math.max(0, i - 1))
  }, [])

  const goToNext = useCallback(() => {
    setCurrentIdx(i => Math.min(history.length - 1, i + 1))
  }, [history.length])

  // Reset compare view when navigating
  useEffect(() => {
    setRefDetail(null)
  }, [currentIdx])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!canNavigate) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [canNavigate, goToNext, goToPrev])

  const modelName = currentMeta
    ? MODEL_CONFIGS.find((m) => m.id === currentMeta.modelId)?.name ?? currentMeta.modelId
    : null

  const showCopiedToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 1500)
  }

  const handleDownload = () => {
    const anchor = document.createElement('a')
    anchor.href = currentSrc
    anchor.download = `nano-banana-${currentImage.id.slice(0, 8)}.png`
    anchor.click()
  }

  const handleCopyImage = async () => {
    const response = await fetch(currentSrc)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    showCopiedToast()
  }

  const handleCopyPrompt = () => {
    if (currentMeta?.prompt) {
      navigator.clipboard.writeText(currentMeta.prompt)
      showCopiedToast()
    }
  }

  const hasPrev = canNavigate && currentIdx > 0
  const hasNext = canNavigate && currentIdx < history.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-white/72 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        ref={scrollRef}
        className="relative flex flex-col md:flex-row max-h-[96vh] w-full max-w-[1400px] overflow-y-auto md:overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`${refDetail ? 'shrink-0' : 'h-[45vh] shrink-0'} relative md:h-auto md:flex-1 md:shrink min-w-0 bg-surface-dim`}>
          {refDetail ? (
            <div className="flex flex-col md:flex-row md:h-full gap-px">
              <div className="h-[33vh] md:h-auto md:flex-1 min-w-0 relative">
                <ZoomableImageView src={`data:${refDetail.mimeType};base64,${refDetail.data}`} alt="" label="参考图" />
                <button
                  type="button"
                  onClick={() => setRefDetail(null)}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                             flex items-center gap-1 rounded-full
                             border border-outline-variant/70 bg-surface/82
                             pl-2 pr-3 py-1 text-2xs text-on-surface
                             shadow-sm backdrop-blur-sm transition-colors hover:bg-surface active:bg-surface-dim"
                  aria-label="关闭对比"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  关闭对比
                </button>
              </div>
              <div className="h-[33vh] md:h-auto md:flex-1 min-w-0 relative">
                <ZoomableImageView src={currentSrc} alt={currentMeta?.prompt ?? ''} label="生成图" />
              </div>
            </div>
          ) : (
            <ZoomableImageView
              src={currentSrc}
              alt={currentMeta?.prompt ?? ''}
              onSwipeLeft={hasNext ? goToNext : undefined}
              onSwipeRight={hasPrev ? goToPrev : undefined}
            />
          )}

          {/* Prev / Next arrows — desktop only */}
          {!refDetail && hasPrev && (
            <button
              type="button"
              onClick={goToPrev}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-10
                         w-9 h-9 items-center justify-center rounded-full
                         border border-outline-variant/70 bg-surface/82
                         text-on-surface shadow-sm backdrop-blur-sm
                         transition-colors hover:bg-surface active:bg-surface-dim"
              aria-label="上一张"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
          )}
          {!refDetail && hasNext && (
            <button
              type="button"
              onClick={goToNext}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-10
                         w-9 h-9 items-center justify-center rounded-full
                         border border-outline-variant/70 bg-surface/82
                         text-on-surface shadow-sm backdrop-blur-sm
                         transition-colors hover:bg-surface active:bg-surface-dim"
              aria-label="下一张"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          )}

          {/* Image counter */}
          {canNavigate && !refDetail && (
            <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-10
                            rounded-full border border-outline-variant bg-surface/82 px-3 py-1
                            text-2xs font-mono text-on-surface shadow-sm backdrop-blur-sm">
              {currentIdx + 1} / {history.length}
            </div>
          )}
        </div>

        <div className="flex w-full md:w-[320px] md:shrink-0 flex-col md:overflow-y-auto border-t md:border-t-0 md:border-l border-outline-variant p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-on-surface">详情</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full
                         border border-outline-variant text-on-surface-variant
                         hover:bg-on-surface/8 hover:border-outline
                         active:bg-on-surface/12 transition-colors"
              aria-label="关闭"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {currentMeta && (
              <>
                <MetaRow label="模型" value={modelName!} />
                <MetaRow label="分辨率" value={currentMeta.resolution} />
                <MetaRow label="宽高比" value={currentMeta.aspectRatio} />
                <div>
                  <div className="mb-1 text-2xs font-medium text-on-surface-variant">提示词</div>
                  <div className="max-h-[40vh] overflow-y-auto rounded-xl bg-surface-container px-3 py-2 text-xs leading-relaxed text-on-surface whitespace-pre-wrap">
                    {currentMeta.prompt}
                  </div>
                </div>
                {currentMeta.referenceImageIds.length > 0 && (
                  <div>
                    <div className="mb-1 text-2xs font-medium text-on-surface-variant">
                      参考图片 ({currentMeta.referenceImageIds.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentMeta.referenceImageIds.map((refId) => {
                        const refImg = history.find((h) => h.id === refId)
                        if (!refImg) return (
                          <div key={refId} className="h-12 w-12 rounded-md bg-surface-container border border-outline-variant flex items-center justify-center text-2xs text-on-surface-variant/40">?</div>
                        )
                        return (
                          <img
                            key={refId}
                            src={`data:${refImg.mimeType};base64,${refImg.data}`}
                            alt=""
                            className={`h-12 w-12 rounded-md object-cover border cursor-pointer transition-colors ${refDetail?.id === refImg.id ? 'border-primary' : 'border-outline-variant hover:border-primary/40'}`}
                            onClick={() => setRefDetail((prev) => prev?.id === refImg.id ? null : refImg)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {currentImage.source.type === 'upload' && (
              <MetaRow label="来源" value={`上传: ${currentImage.source.fileName}`} />
            )}

            <MetaRow label="创建时间" value={new Date(currentImage.timestamp).toLocaleString()} />
          </div>

          <div className="relative mt-4 space-y-2 border-t border-outline-variant pt-4">
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center transition-all duration-300 ${toast ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            >
              <div className="rounded-lg bg-on-surface/80 px-4 py-2 text-xs font-medium text-surface backdrop-blur-sm">
                已复制
              </div>
            </div>
            <div className="flex gap-2">
              <ModalAction label="+参考" onClick={() => { onAddToRef(currentImage); onClose() }} />
              <ModalAction label="保存" onClick={handleDownload} />
              <ModalAction label="复制图" onClick={handleCopyImage} />
              {currentMeta?.prompt && <ModalAction label="复制词" onClick={handleCopyPrompt} />}
            </div>
            {canNavigate && (
              <button
                type="button"
                onClick={() => { onRemove(currentImage.id); onClose() }}
                className="w-full rounded-full bg-error-dim py-2 text-xs font-medium text-error transition-colors hover:bg-error/15 active:bg-error/20"
              >
                删除
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

function ZoomableImageView({ src, alt, label, onSwipeLeft, onSwipeRight }: {
  src: string
  alt: string
  label?: string
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
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

  const zoomAtPoint = useCallback((targetScale: number, anchor: Point) => {
    const currentScale = scaleRef.current
    const nextScale = clamp(targetScale, MIN_SCALE, MAX_SCALE)
    const ratio = nextScale / currentScale
    const currentOffset = offsetRef.current

    applyView(nextScale, {
      x: anchor.x - ratio * (anchor.x - currentOffset.x),
      y: anchor.y - ratio * (anchor.y - currentOffset.y),
    })
  }, [applyView])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(syncFitSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [syncFitSize])

  useEffect(() => {
    lastTapRef.current = null
  }, [src])

  return (
    <div className="relative h-full min-h-0 md:min-h-[640px] w-full overflow-hidden bg-surface-container">
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
              if (scaleRef.current > FIT_SCALE) {
                resetView()
              } else {
                zoomAtPoint(2.5, endPoint)
              }
              lastTapRef.current = null
            } else {
              lastTapRef.current = { at: now, point: endPoint }
            }
          }

          // Swipe navigation: single touch, not pinching, at fit scale
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

          if (activePointersRef.current.size < 2) {
            didPinchRef.current = false
          }
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
        onWheel={(event) => {
          event.preventDefault()
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          const delta = Math.exp(-event.deltaY * 0.0015)
          zoomAtPoint(scaleRef.current * delta, point)
        }}
        style={{ cursor: scale > FIT_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
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
          className="shrink-0 object-contain shadow-2xl"
          style={{
            width: fitSize.width || undefined,
            height: fitSize.height || undefined,
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            // hide until fitSize is ready to avoid the natural→contained size flash
            opacity: fitSize.width ? 1 : 0,
            transition: isDragging || isInteracting
              ? 'none'
              : fitSize.width
                ? 'transform 160ms ease-out, opacity 120ms ease-out'
                : 'none',
          }}
        />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        {label && (
          <div className="rounded-full border border-outline-variant bg-surface/82 px-3 py-1 text-2xs text-on-surface-variant shadow-sm backdrop-blur-sm">
            {label}
          </div>
        )}
        <div className="rounded-full border border-outline-variant bg-surface/82 px-3 py-1 text-2xs font-mono text-on-surface shadow-sm backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          onClick={() => zoomAtPoint(scaleRef.current * 1.25, { x: 0, y: 0 })}
          className="flex items-center gap-1 rounded-full border border-outline-variant/70
                     bg-surface/82 pl-2 pr-3 py-1 text-2xs text-on-surface
                     shadow-sm backdrop-blur-sm transition-colors hover:bg-surface active:bg-surface-dim"
          aria-label="放大"
        >
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2z"/>
          </svg>
          放大
        </button>
        <button
          type="button"
          onClick={resetView}
          className="flex items-center gap-1 rounded-full border border-outline-variant/70
                     bg-surface/82 pl-2 pr-3 py-1 text-2xs text-on-surface
                     shadow-sm backdrop-blur-sm transition-colors hover:bg-surface active:bg-surface-dim"
          aria-label="重置"
        >
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zm6 12-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zm12-6-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6z"/>
          </svg>
          重置
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="rounded-full border border-outline-variant bg-surface/78 px-3 py-1 text-2xs text-on-surface-variant shadow-sm backdrop-blur-sm">
          滚轮或双指缩放，拖动查看细节
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-2xs font-medium text-on-surface-variant">{label}</div>
      <div className="text-xs text-on-surface">{value}</div>
    </div>
  )
}

function ModalAction({ label, onClick }: { label: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full bg-surface-container py-2 text-xs font-medium text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/12"
    >
      {label}
    </button>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getCenter(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

function getViewportSize(element: HTMLDivElement | null): Size {
  if (!element) return { width: 0, height: 0 }

  return {
    width: element.clientWidth,
    height: element.clientHeight,
  }
}

function getContainedSize(viewport: Size, naturalSize: Size): Size {
  if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) {
    return { width: 0, height: 0 }
  }

  const ratio = Math.min(viewport.width / naturalSize.width, viewport.height / naturalSize.height)
  return {
    width: naturalSize.width * ratio,
    height: naturalSize.height * ratio,
  }
}

function clampOffset(offset: Point, scale: number, viewport: Size, fitSize: Size): Point {
  if (!viewport.width || !viewport.height || !fitSize.width || !fitSize.height || scale <= FIT_SCALE) {
    return { x: 0, y: 0 }
  }

  const maxX = Math.max(0, (fitSize.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (fitSize.height * scale - viewport.height) / 2)

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  }
}

function getRelativePoint(element: HTMLDivElement | null, clientX: number, clientY: number): Point {
  if (!element) return { x: 0, y: 0 }

  const rect = element.getBoundingClientRect()
  return {
    x: clientX - rect.left - rect.width / 2,
    y: clientY - rect.top - rect.height / 2,
  }
}
