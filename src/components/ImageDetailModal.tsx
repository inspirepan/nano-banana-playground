import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlaygroundImageMeta } from '../lib/types'
import { MODEL_CONFIGS } from '../config/models'
import { ensureBlobLoaded, useImageSrc } from '../hooks/useImageSrc'
import { loadImageMetas } from '../lib/history'

const MIN_SCALE = 0.5
const MAX_SCALE = 6
const FIT_SCALE = 1

type Props = {
  image: PlaygroundImageMeta
  history: PlaygroundImageMeta[]
  onClose: () => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
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

export function ImageDetailModal({ image, history, onClose, onAddToRef, onRegenerate, onRemove }: Props) {
  // Navigation: -1 means image is not in history (e.g. uploaded reference)
  const [currentIdx, setCurrentIdx] = useState(() => history.findIndex(h => h.id === image.id))

  const currentImage = currentIdx >= 0 ? history[currentIdx] : image
  const { ref: imgRef, src: currentSrc } = useImageSrc(currentImage.id, currentImage.mimeType)
  const currentMeta = currentImage.source.type === 'generated' ? currentImage.source : null
  const canNavigate = currentIdx >= 0

  const [toast, setToast] = useState(false)
  const [refDetailId, setRefDetailId] = useState<string | null>(null)
  const [refDetailSrc, setRefDetailSrc] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Resolve reference image metas not present in `history` from IndexedDB
  const [dbRefMetas, setDbRefMetas] = useState<Map<string, PlaygroundImageMeta>>(new Map())
  const missingRefIds = useMemo(() => {
    if (!currentMeta) return []
    return currentMeta.referenceImageIds.filter((id) => !history.find((h) => h.id === id))
  }, [currentMeta, history])

  useEffect(() => {
    if (missingRefIds.length === 0) return
    loadImageMetas(missingRefIds).then(setDbRefMetas)
  }, [missingRefIds])

  const findRefImage = useCallback((id: string): PlaygroundImageMeta | undefined => {
    return history.find((h) => h.id === id) ?? dbRefMetas.get(id)
  }, [history, dbRefMetas])

  // Load ref detail image blob when selected
  useEffect(() => {
    if (!refDetailId) return
    const refImg = findRefImage(refDetailId)
    if (!refImg) return
    ensureBlobLoaded(refImg.id, refImg.mimeType).then((src) => {
      if (src) setRefDetailSrc(src)
    })
  }, [refDetailId, findRefImage])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [refDetailId])

  const goToPrev = useCallback(() => {
    setCurrentIdx(i => Math.max(0, i - 1))
    setRefDetailId(null)
  }, [])

  const goToNext = useCallback(() => {
    setCurrentIdx(i => Math.min(history.length - 1, i + 1))
    setRefDetailId(null)
  }, [history.length])

  // Eagerly load the current image blob when navigating
  useEffect(() => {
    ensureBlobLoaded(currentImage.id, currentImage.mimeType)
  }, [currentImage.id, currentImage.mimeType])

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

  const modelConfig = currentMeta ? MODEL_CONFIGS.find((m) => m.id === currentMeta.modelId) : null
  const modelName = modelConfig?.name ?? currentMeta?.modelId ?? null

  // Compute actual cost from token usage; fall back to per-image estimate if no token data
  const estimatedCost = (() => {
    if (!currentMeta || !modelConfig) return null
    const usage = currentMeta.tokenUsage
    if (usage) {
      const inputCost = usage.inputTokens * modelConfig.inputPricePerMillion / 1_000_000
      const imageCost = usage.imageOutputTokens * modelConfig.imageOutputPricePerMillion / 1_000_000
      const textCost = usage.textOutputTokens * modelConfig.textOutputPricePerMillion / 1_000_000
      return inputCost + imageCost + textCost
    }
    // Legacy images without token data: use per-image lookup
    return modelConfig.imagePriceByResolution[currentMeta.resolution] ?? null
  })()

  const showCopiedToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 1500)
  }

  const handleDownload = () => {
    if (!currentSrc) return
    const anchor = document.createElement('a')
    anchor.href = currentSrc
    anchor.download = `nano-banana-${currentImage.id.slice(0, 8)}.png`
    anchor.click()
  }

  const handleCopyImage = async () => {
    if (!currentSrc) return
    const response = await fetch(currentSrc)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    showCopiedToast()
  }

  const handleRegenerate = () => {
    onRegenerate(currentImage)
    onClose()
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
        <div ref={imgRef} className={`${refDetailId ? 'shrink-0' : 'h-[45vh] shrink-0'} relative md:h-auto md:flex-1 md:shrink min-w-0 bg-surface-dim`}>
          {refDetailId && refDetailSrc ? (
            <div className="flex flex-col md:flex-row md:h-full gap-px">
              <div className="h-[33vh] md:h-auto md:flex-1 min-w-0 relative">
                <ZoomableImageView src={refDetailSrc} alt="" label="参考图" />
                <button
                  type="button"
                  onClick={() => setRefDetailId(null)}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                             flex items-center gap-1 rounded-full
                             border border-outline-variant/70 bg-surface/82
                             pl-2 pr-3 py-1 text-2xs text-on-surface
                             shadow-sm backdrop-blur-sm transition-colors hover:bg-surface active:bg-surface-dim"
                  aria-label="关闭对比"
                >
                  <span className="material-symbols-rounded text-sm shrink-0">close</span>
                  关闭对比
                </button>
              </div>
              <div className="h-[33vh] md:h-auto md:flex-1 min-w-0 relative">
                <ZoomableImageView src={currentSrc ?? ''} alt={currentMeta?.prompt ?? ''} label="生成图" />
              </div>
            </div>
          ) : (
            <ZoomableImageView
              src={currentSrc ?? ''}
              alt={currentMeta?.prompt ?? ''}
              onSwipeLeft={hasNext ? goToNext : undefined}
              onSwipeRight={hasPrev ? goToPrev : undefined}
            />
          )}

          {/* Prev / Next arrows — desktop only */}
          {!refDetailId && hasPrev && (
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
              <span className="material-symbols-rounded text-base">chevron_left</span>
            </button>
          )}
          {!refDetailId && hasNext && (
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
              <span className="material-symbols-rounded text-base">chevron_right</span>
            </button>
          )}

          {/* Image counter */}
          {canNavigate && !refDetailId && (
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
              <span className="material-symbols-rounded text-base">close</span>
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {currentMeta && (
              <>
                <MetaRow label="模型" value={modelName!} />
                <MetaRow label="分辨率" value={currentMeta.resolution} />
                <MetaRow label="宽高比" value={currentMeta.aspectRatio} />
                {(estimatedCost !== null || currentMeta.tokenUsage) && (
                  <div>
                  <div className="mb-1 text-sm font-medium text-on-surface-variant">消耗</div>
                  <div className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 space-y-2">
                    {estimatedCost !== null && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-on-surface-variant">费用</span>
                        <span className="text-sm font-medium text-on-surface font-mono">
                          ${estimatedCost.toFixed(4)}
                          {!currentMeta.tokenUsage && <span className="ml-1 text-xs font-normal text-on-surface-variant">估算</span>}
                        </span>
                      </div>
                    )}
                    {currentMeta.tokenUsage && (
                      <>
                        {estimatedCost !== null && <div className="border-t border-outline-variant" />}
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-on-surface-variant">输入 Token</span>
                          <span className="text-xs font-mono text-on-surface">
                            {currentMeta.tokenUsage.inputTokens.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-on-surface-variant">图片输出 Token</span>
                          <span className="text-xs font-mono text-on-surface">
                            {currentMeta.tokenUsage.imageOutputTokens.toLocaleString()}
                          </span>
                        </div>
                        {currentMeta.tokenUsage.textOutputTokens > 0 && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-on-surface-variant">思考 Token</span>
                            <span className="text-xs font-mono text-on-surface">
                              {currentMeta.tokenUsage.textOutputTokens.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-sm font-medium text-on-surface-variant">提示词</div>
                  <div className="max-h-[40vh] overflow-y-auto rounded-xl bg-surface-container px-3 py-2 text-xs leading-relaxed text-on-surface whitespace-pre-wrap">
                    {currentMeta.prompt}
                  </div>
                </div>
                {currentMeta.referenceImageIds.length > 0 && (
                  <div>
                    <div className="mb-1 text-sm font-medium text-on-surface-variant">
                      参考图片 ({currentMeta.referenceImageIds.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentMeta.referenceImageIds.map((refId) => {
                        const refImg = findRefImage(refId)
                        if (!refImg) return (
                          <div key={refId} className="h-12 w-12 rounded-md bg-surface-container border border-outline-variant flex items-center justify-center text-2xs text-on-surface-variant/40">?</div>
                        )
                        return (
                          <RefThumbnail
                            key={refId}
                            image={refImg}
                            isActive={refDetailId === refImg.id}
                            onClick={() => setRefDetailId((prev) => prev === refImg.id ? null : refImg.id)}
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
              <div className="rounded bg-on-surface/80 px-4 py-2 text-xs font-medium text-surface backdrop-blur-sm">
                已复制
              </div>
            </div>
            <div className="flex gap-2">
              <ModalAction label="+参考" onClick={() => { onAddToRef(currentImage); onClose() }} />
              <ModalAction label="保存" onClick={handleDownload} />
              <ModalAction label="复制图" onClick={handleCopyImage} />
              {currentMeta?.prompt && <ModalAction label="重做" onClick={handleRegenerate} />}
            </div>
            {canNavigate && (
              <button
                type="button"
                onClick={() => { onRemove(currentImage.id); onClose() }}
                className="w-full rounded-xl bg-error-dim py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/15 active:bg-error/20"
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

function RefThumbnail({ image, isActive, onClick }: { image: PlaygroundImageMeta; isActive: boolean; onClick: () => void }) {
  const { ref, src } = useImageSrc(image.id, image.mimeType, undefined, { variant: 'preview' })

  return (
    <div ref={ref} className="h-12 w-12">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-12 w-12 rounded-md object-cover border cursor-pointer transition-colors ${isActive ? 'border-primary' : 'border-outline-variant hover:border-primary/40'}`}
          onClick={onClick}
        />
      ) : (
        <div className="h-12 w-12 rounded-md bg-surface-container border border-outline-variant animate-pulse" />
      )}
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
        {src ? (
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
              // hide until fitSize is ready to avoid the natural->contained size flash
              opacity: fitSize.width ? 1 : 0,
              transition: isDragging || isInteracting
                ? 'none'
                : fitSize.width
                  ? 'transform 160ms ease-out, opacity 120ms ease-out'
                  : 'none',
            }}
          />
        ) : (
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
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
          <span className="material-symbols-rounded text-sm shrink-0">zoom_in</span>
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
          <span className="material-symbols-rounded text-sm shrink-0">zoom_out_map</span>
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
      <div className="mb-1 text-sm font-medium text-on-surface-variant">{label}</div>
      <div className="text-sm text-on-surface">{value}</div>
    </div>
  )
}

function ModalAction({ label, onClick }: { label: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl bg-surface-container py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/12"
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
