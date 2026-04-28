import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import type { ItemCounts } from '../../lib/editStateCache'
import { Icon, type IconName } from '../Icon'
import { BrushPresetDot } from './annotationControls'
import { BRUSH_PRESETS, type BrushPresetId } from './annotationPresets'
import { DrawableLayer, type DrawableLayerHandle, type DrawMode, type DrawTool } from './DrawableLayer'
import {
  FIT_SCALE,
  MAX_SCALE,
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

export function MobileDrawFullscreen({
  imageId,
  src,
  mode,
  tool,
  brushPreset,
  brushSize,
  counts,
  drawableRef,
  onChangeTool,
  onChangeBrushPreset,
  onItemsChange,
  onUndo,
  onClear,
  onClose,
}: {
  imageId: string
  src: string
  mode: DrawMode
  tool: DrawTool
  brushPreset: BrushPresetId
  brushSize: number
  counts: ItemCounts
  drawableRef: RefObject<DrawableLayerHandle | null>
  onChangeTool: (tool: DrawTool) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
  onItemsChange: (counts: ItemCounts) => void
  onUndo: () => void
  onClear: () => void
  onClose: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const activePointersRef = useRef(new Map<number, Point>())
  const dragStartRef = useRef<{ point: Point; offset: Point } | null>(null)
  const pinchStartRef = useRef<{ center: Point; distance: number; scale: number; offset: Point } | null>(null)
  const scaleRef = useRef(FIT_SCALE)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const fitSizeRef = useRef<Size>({ width: 0, height: 0 })

  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 })
  const [scale, setScale] = useState(FIT_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [mobileTool, setMobileTool] = useState<DrawTool | 'move'>(tool)

  const layerHasItems = counts.mask > 0 || counts.annotate > 0
  const isMoveTool = mobileTool === 'move'
  const toolOptions: Array<{ id: DrawTool | 'move'; label: string; icon: IconName }> = [
    { id: 'move', label: '拖动', icon: 'mouse_pointer' },
    { id: 'brush', label: '涂抹', icon: 'brush' },
    { id: 'step', label: '编号', icon: 'map_pin' },
    { id: 'eraser', label: '橡皮', icon: 'eraser' },
  ]

  const applyView = useCallback(
    (nextScale: number, nextOffset: Point) => {
      const clampedScale = clamp(nextScale, FIT_SCALE, MAX_SCALE)
      const viewport = viewportSize.width ? viewportSize : getViewportSize(viewportRef.current)
      const clampedOffset = clampOffset(nextOffset, clampedScale, viewport, fitSizeRef.current)
      scaleRef.current = clampedScale
      offsetRef.current = clampedOffset
      setScale(clampedScale)
      setOffset(clampedOffset)
    },
    [viewportSize],
  )

  const resetView = useCallback(() => {
    activePointersRef.current.clear()
    dragStartRef.current = null
    pinchStartRef.current = null
    applyView(FIT_SCALE, { x: 0, y: 0 })
  }, [applyView])

  const zoomAtPoint = useCallback(
    (targetScale: number, anchor: Point) => {
      const currentScale = scaleRef.current
      const nextScale = clamp(targetScale, FIT_SCALE, MAX_SCALE)
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
    if (!src) {
      setNaturalSize({ width: 0, height: 0 })
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const update = () => setViewportSize(getViewportSize(element))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const nextFit = getContainedSize(viewportSize, naturalSize)
    fitSizeRef.current = nextFit
    applyView(scaleRef.current, offsetRef.current)
  }, [applyView, naturalSize, viewportSize])

  useEffect(() => {
    resetView()
  }, [imageId, resetView])

  useEffect(() => {
    activePointersRef.current.clear()
    dragStartRef.current = null
    pinchStartRef.current = null
  }, [mobileTool])

  const startViewGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMoveTool) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const point = getRelativePoint(viewportRef.current, event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointersRef.current.set(event.pointerId, point)
    if (activePointersRef.current.size === 1) {
      dragStartRef.current = { point, offset: offsetRef.current }
      pinchStartRef.current = null
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
    }
  }

  const moveViewGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMoveTool) return
    if (!activePointersRef.current.has(event.pointerId)) return
    const point = getRelativePoint(viewportRef.current, event.clientX, event.clientY)
    activePointersRef.current.set(event.pointerId, point)
    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const [first, second] = Array.from(activePointersRef.current.values())
      const start = pinchStartRef.current
      const nextScale = clamp(
        start.scale * (Math.max(getDistance(first, second), 1) / start.distance),
        FIT_SCALE,
        MAX_SCALE,
      )
      const center = getCenter(first, second)
      const ratio = nextScale / start.scale
      applyView(nextScale, {
        x: center.x - ratio * (start.center.x - start.offset.x),
        y: center.y - ratio * (start.center.y - start.offset.y),
      })
      return
    }
    if (activePointersRef.current.size === 1 && dragStartRef.current && scaleRef.current > FIT_SCALE) {
      const start = dragStartRef.current
      applyView(scaleRef.current, {
        x: start.offset.x + point.x - start.point.x,
        y: start.offset.y + point.y - start.point.y,
      })
    }
  }

  const endViewGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMoveTool) return
    activePointersRef.current.delete(event.pointerId)
    if (activePointersRef.current.size === 1) {
      const [remainingPoint] = Array.from(activePointersRef.current.values())
      dragStartRef.current = { point: remainingPoint, offset: offsetRef.current }
      pinchStartRef.current = null
    } else {
      dragStartRef.current = null
      pinchStartRef.current = null
    }
  }

  const zoomCenter = (factor: number) => {
    zoomAtPoint(scaleRef.current * factor, { x: 0, y: 0 })
  }

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-(--color-bg)">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-(--color-border) px-3">
        <button type="button" className="icon-btn" onClick={onClose} title="完成">
          <Icon name="chevron_left" size={15} strokeWidth={1.8} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-(--color-text)">标注</div>
          <div className="text-xs text-(--color-text-4)">
            {isMoveTool ? '单指拖动，双指缩放' : '涂抹编辑区域，或用编号补充说明'}
          </div>
        </div>
        <button type="button" className="chip text-xs" onClick={onClose} style={{ height: 28 }}>
          完成
        </button>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden touch-none select-none"
        style={{
          backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: '28px 28px, 28px 28px',
          backgroundColor: 'var(--color-bg-sunken)',
        }}
        onPointerDown={startViewGesture}
        onPointerMove={moveViewGesture}
        onPointerUp={endViewGesture}
        onPointerCancel={endViewGesture}
        onDoubleClick={(event) => {
          if (!isMoveTool) return
          const point = getRelativePoint(viewportRef.current, event.clientX, event.clientY)
          if (scaleRef.current > FIT_SCALE) resetView()
          else zoomAtPoint(2.5, point)
        }}
      >
        <DrawableLayer
          ref={drawableRef}
          key={`${imageId}:mobile-draw`}
          imageId={imageId}
          src={src}
          mode={mode}
          tool={tool}
          brushSize={brushSize}
          viewTransform={{ scale, offset }}
          visibleModes={['mask', 'annotate']}
          eraseAllModes
          readOnly={isMoveTool}
          onItemsChange={onItemsChange}
        />

        <div
          className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[8px] p-1"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
            boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <button
            type="button"
            className="icon-btn pointer-events-auto"
            onClick={() => zoomCenter(0.8)}
            title="缩小"
            style={{ width: 28, height: 26 }}
          >
            <Icon name="zoom_out_map" size={12} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="mono pointer-events-auto px-2 text-xs font-medium text-(--color-text-2)"
            onClick={resetView}
            title="重置"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            className="icon-btn pointer-events-auto"
            onClick={() => zoomCenter(1.25)}
            title="放大"
            style={{ width: 28, height: 26 }}
          >
            <Icon name="zoom_in" size={12} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-(--color-border) px-3 py-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {toolOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMobileTool(item.id)
                  if (item.id !== 'move') onChangeTool(item.id)
                }}
                className="chip shrink-0 text-sm"
                data-active={mobileTool === item.id}
                style={{ height: 36 }}
              >
                <Icon name={item.icon} size={14} strokeWidth={1.8} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {mobileTool !== 'move' &&
              mobileTool !== 'eraser' &&
              BRUSH_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeBrushPreset(item.id)}
                  className="chip shrink-0 text-sm"
                  data-active={brushPreset === item.id}
                  title={item.label}
                  aria-label={item.label}
                  style={{ height: 36 }}
                >
                  <BrushPresetDot preset={item} />
                </button>
              ))}
            <div className="flex-1" />
            <button
              type="button"
              className="chip shrink-0 text-sm"
              onClick={onUndo}
              disabled={!layerHasItems}
              style={{ height: 36 }}
            >
              <Icon name="undo" size={14} strokeWidth={1.8} />
              撤销
            </button>
            <button
              type="button"
              className="chip ghost shrink-0 text-sm"
              onClick={onClear}
              disabled={!layerHasItems}
              style={{ height: 36 }}
            >
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
