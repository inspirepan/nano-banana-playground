import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaygroundImage } from '../lib/types'
import { MODEL_CONFIGS } from '../config/models'

const MIN_SCALE = 1
const MAX_SCALE = 6

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
  const src = `data:${image.mimeType};base64,${image.data}`
  const meta = image.source.type === 'generated' ? image.source : null
  const [toast, setToast] = useState(false)
  const [refDetail, setRefDetail] = useState<PlaygroundImage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [refDetail])

  const modelName = meta
    ? MODEL_CONFIGS.find((m) => m.id === meta.modelId)?.name ?? meta.modelId
    : null

  const showCopiedToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 1500)
  }

  const handleDownload = () => {
    const anchor = document.createElement('a')
    anchor.href = src
    anchor.download = `nano-banana-${image.id.slice(0, 8)}.png`
    anchor.click()
  }

  const handleCopyImage = async () => {
    const response = await fetch(src)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    showCopiedToast()
  }

  const handleCopyPrompt = () => {
    if (meta?.prompt) {
      navigator.clipboard.writeText(meta.prompt)
      showCopiedToast()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-white/72 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        ref={scrollRef}
        className="relative flex flex-col md:flex-row max-h-[96vh] w-full max-w-[1400px] overflow-y-auto md:overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`${refDetail ? 'shrink-0' : 'h-[45vh] shrink-0'} md:h-auto md:flex-1 md:shrink min-w-0 bg-surface-dim p-4`}>
          {refDetail ? (
            <div className="flex flex-col md:flex-row md:h-full gap-3">
              <div className="h-[33vh] md:h-auto md:flex-1 min-w-0 relative">
                <ZoomableImageView key={`ref-${refDetail.id}`} src={`data:${refDetail.mimeType};base64,${refDetail.data}`} alt="" label="参考图" />
              </div>
              <div className="h-[33vh] md:h-auto md:flex-1 min-w-0 relative">
                <ZoomableImageView key={`gen-${image.id}`} src={src} alt={meta?.prompt ?? ''} label="生成图" />
              </div>
            </div>
          ) : (
            <ZoomableImageView key={image.id} src={src} alt={meta?.prompt ?? ''} />
          )}
        </div>

        <div className="flex w-full md:w-[320px] md:shrink-0 flex-col md:overflow-y-auto border-t md:border-t-0 md:border-l border-outline-variant p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-on-surface">详情</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-on-surface-variant hover:bg-surface-container"
            >
              x
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {meta && (
              <>
                <MetaRow label="模型" value={modelName!} />
                <MetaRow label="分辨率" value={meta.resolution} />
                <MetaRow label="宽高比" value={meta.aspectRatio} />
                <div>
                  <div className="mb-1 text-[11px] font-medium text-on-surface-variant">提示词</div>
                  <div className="max-h-[120px] overflow-y-auto rounded-lg bg-surface-container p-2.5 text-xs leading-relaxed text-on-surface">
                    {meta.prompt}
                  </div>
                </div>
                {meta.referenceImageIds.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-on-surface-variant">
                      参考图片 ({meta.referenceImageIds.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.referenceImageIds.map((refId) => {
                        const refImg = history.find((h) => h.id === refId)
                        if (!refImg) return (
                          <div key={refId} className="h-12 w-12 rounded-md bg-surface-container border border-outline-variant flex items-center justify-center text-[10px] text-on-surface-variant/40">?</div>
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

            {image.source.type === 'upload' && (
              <MetaRow label="来源" value={`上传: ${image.source.fileName}`} />
            )}

            <MetaRow label="创建时间" value={new Date(image.timestamp).toLocaleString()} />
          </div>

          <div className="relative mt-4 space-y-2 border-t border-outline-variant pt-4">
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center transition-all duration-300 ${toast ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            >
              <div className="rounded-lg bg-on-surface/80 px-3.5 py-2 text-[12px] font-medium text-surface backdrop-blur-sm">
                已复制
              </div>
            </div>
            <div className="flex gap-2">
              <ModalAction label="+参考" onClick={() => { onAddToRef(image); onClose() }} />
              <ModalAction label="保存" onClick={handleDownload} />
              <ModalAction label="复制图" onClick={handleCopyImage} />
              {meta?.prompt && <ModalAction label="复制词" onClick={handleCopyPrompt} />}
            </div>
            <button
              type="button"
              onClick={() => { onRemove(image.id); onClose() }}
              className="w-full rounded-lg py-1.5 text-xs text-error transition-colors hover:bg-error-dim"
            >
              删除
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

function ZoomableImageView({ src, alt, label }: { src: string; alt: string; label?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activePointersRef = useRef(new Map<number, Point>())
  const pointerStartsRef = useRef(new Map<number, Point>())
  const dragStartRef = useRef<{ point: Point; offset: Point } | null>(null)
  const pinchStartRef = useRef<{ center: Point; distance: number; scale: number; offset: Point } | null>(null)
  const naturalSizeRef = useRef<Size>({ width: 0, height: 0 })
  const fitSizeRef = useRef<Size>({ width: 0, height: 0 })
  const scaleRef = useRef(MIN_SCALE)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const lastTapRef = useRef<{ at: number; point: Point } | null>(null)
  const didPinchRef = useRef(false)

  const [scale, setScale] = useState(MIN_SCALE)
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
    applyView(MIN_SCALE, { x: 0, y: 0 })
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

  return (
    <div className="relative h-full min-h-0 md:min-h-[640px] w-full overflow-hidden rounded-2xl border border-outline-variant bg-surface-container shadow-sm">
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden touch-none select-none"
        onDoubleClick={(event) => {
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          if (scaleRef.current > MIN_SCALE) {
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
            setIsDragging(scaleRef.current > MIN_SCALE)
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
              if (scaleRef.current > MIN_SCALE) {
                resetView()
              } else {
                zoomAtPoint(2.5, endPoint)
              }
              lastTapRef.current = null
            } else {
              lastTapRef.current = { at: now, point: endPoint }
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
        style={{ cursor: scale > MIN_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
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
            syncFitSize()
          }}
          className="shrink-0 object-contain shadow-2xl"
          style={{
            width: fitSize.width || undefined,
            height: fitSize.height || undefined,
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging || isInteracting ? 'none' : 'transform 160ms ease-out',
          }}
        />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        {label && (
          <div className="rounded-full border border-outline-variant bg-surface/82 px-2.5 py-1 text-[11px] text-on-surface-variant shadow-sm backdrop-blur-sm">
            {label}
          </div>
        )}
        <div className="rounded-full border border-outline-variant bg-surface/82 px-3 py-1 text-[11px] font-mono text-on-surface shadow-sm backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          onClick={() => zoomAtPoint(scaleRef.current * 1.25, { x: 0, y: 0 })}
          className="rounded-full border border-outline-variant bg-surface/82 px-3 py-1 text-[11px] text-on-surface shadow-sm backdrop-blur-sm transition-colors hover:bg-surface"
        >
          放大
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-full border border-outline-variant bg-surface/82 px-3 py-1 text-[11px] text-on-surface shadow-sm backdrop-blur-sm transition-colors hover:bg-surface"
        >
          重置
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="rounded-full border border-outline-variant bg-surface/78 px-3 py-1 text-[11px] text-on-surface-variant shadow-sm backdrop-blur-sm">
          滚轮或双指缩放，拖动查看细节
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium text-on-surface-variant">{label}</div>
      <div className="text-xs text-on-surface">{value}</div>
    </div>
  )
}

function ModalAction({ label, onClick }: { label: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-lg bg-surface-container py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
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
  if (!viewport.width || !viewport.height || !fitSize.width || !fitSize.height || scale <= MIN_SCALE) {
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
