import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

import { hitTestItem, nextStepNumber } from './drawableLayer/hitTest'
import { DEFAULT_ANNOTATE_COLOR, MASK_OVERLAY_COLOR, paintItem } from './drawableLayer/paint'
import { clamp, getViewportSize } from './viewGeometry'
import { useExternalSync, useResizeObserver } from '../../hooks/effects'
import { dataUrlToBase64 } from '../../lib/blobUtils'
import {
  computeItemCounts,
  getEditState,
  setEditItems,
  type DrawItem,
  type DrawMode,
  type DrawTool,
  type ItemCounts,
  type Point,
} from '../../lib/editStateCache'

export type { DrawMode, DrawTool, ItemCounts } from '../../lib/editStateCache'

export type DrawableLayerHandle = {
  isReady: () => boolean
  hasItems: () => boolean
  clear: () => void
  clearAll: () => void
  undo: () => void
  exportMarkedComposite: () => Promise<{ base64: string; mimeType: 'image/png' } | null>
  exportAnnotated: () => Promise<{ base64: string; mimeType: 'image/png' } | null>
  exportMaskAlpha: () => Promise<{ base64: string; mimeType: 'image/png' } | null>
  exportMaskRedOverlay: () => Promise<{ base64: string; mimeType: 'image/png' } | null>
}

type Props = {
  imageId: string
  src: string
  mode: DrawMode
  tool: DrawTool
  brushSize: number
  annotateColor?: string
  viewTransform?: { scale: number; offset: Point }
  visibleModes?: DrawMode[]
  eraseAllModes?: boolean
  readOnly?: boolean
  panEnabled?: boolean
  // Fires whenever the items list changes. Breakdown by mode lets the
  // parent drive per-layer indicators without peeking into the cache.
  onItemsChange?: (counts: ItemCounts) => void
}

const LOCAL_MIN_SCALE = 0.5
const LOCAL_FIT_SCALE = 1
const LOCAL_MAX_SCALE = 6

export const DrawableLayer = forwardRef<DrawableLayerHandle, Props>(function DrawableLayer(
  {
    imageId,
    src,
    mode,
    tool,
    brushSize,
    annotateColor = DEFAULT_ANNOTATE_COLOR,
    viewTransform,
    visibleModes,
    eraseAllModes = false,
    readOnly = false,
    panEnabled = false,
    onItemsChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Items are the source of truth for both on-screen render and exports.
  // They live in state so React renders react to them; `itemsRef` mirrors
  // the latest value for synchronous access during pointer events (React
  // may batch the state update across pointermove frames).
  const [items, setItems] = useState<DrawItem[]>(() => getEditState(imageId).items)
  const itemsRef = useRef<DrawItem[]>(items)
  // Reload items from the cache when the active image changes — required
  // now that callers no longer key us by imageId (avoids unmount-flicker
  // when paging through images).
  const lastImageIdRef = useRef(imageId)
  if (lastImageIdRef.current !== imageId) {
    lastImageIdRef.current = imageId
    const next = getEditState(imageId).items
    itemsRef.current = next
    setItems(next)
  }

  // Item currently being drawn before pointer-up commits it (rect preview and
  // in-progress paths). Ref mirror avoids StrictMode double-invoke of setState
  // functional updaters causing side effects to fire twice.
  const [draft, setDraft] = useState<DrawItem | null>(null)
  const draftRef = useRef<DrawItem | null>(null)
  const writeDraft = useCallback((next: DrawItem | null) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  const pointerStateRef = useRef<{ pointerId: number; kind: 'path' | 'rect' | 'eraser' } | null>(null)
  const panStateRef = useRef<{ pointerId: number; point: Point; offset: Point } | null>(null)

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [stage, setStage] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [localView, setLocalView] = useState<{ scale: number; offset: Point }>({
    scale: LOCAL_FIT_SCALE,
    offset: { x: 0, y: 0 },
  })
  const [isPanning, setIsPanning] = useState(false)
  const localViewRef = useRef(localView)

  // Persist items to cache whenever they change (write-through), and keep
  // the sync ref fresh so pointer handlers see the current list even if
  // multiple setState calls are batched.
  const pushItems = useCallback(
    (next: DrawItem[]) => {
      itemsRef.current = next
      setItems(next)
      setEditItems(imageId, next)
      onItemsChange?.(computeItemCounts(next))
    },
    [imageId, onItemsChange],
  )

  itemsRef.current = items
  const localViewImageIdRef = useRef(imageId)
  const interactionModeRef = useRef({ mode, tool, panEnabled })

  // Clear image state when src is removed (e.g. switching images).
  useExternalSync(() => {
    if (!src) {
      imageRef.current = null
      setNatural(null)
    }
  }, [src])

  useExternalSync(() => {
    if (localViewImageIdRef.current === imageId) return
    localViewImageIdRef.current = imageId
    const next = { scale: LOCAL_FIT_SCALE, offset: { x: 0, y: 0 } }
    localViewRef.current = next
    setLocalView(next)
  }, [imageId])

  // Report current counts to the parent. Runs on mount (so a remount under
  // a new imageId syncs the restored breakdown) and whenever items shift.
  useExternalSync(() => {
    onItemsChange?.(computeItemCounts(items))
  }, [items, onItemsChange])

  // Reset the pending draft when mode or tool switches, since its kind no
  // longer matches the active tool.
  useExternalSync(() => {
    const prev = interactionModeRef.current
    if (prev.mode === mode && prev.tool === tool && prev.panEnabled === panEnabled) return
    interactionModeRef.current = { mode, tool, panEnabled }
    setDraft(null)
    pointerStateRef.current = null
    panStateRef.current = null
    setIsPanning(false)
  }, [mode, tool, panEnabled])

  const recomputeStage = useCallback(() => {
    const container = containerRef.current
    const nat = natural
    if (!container || !nat) return
    const { width: cw, height: ch } = getViewportSize(container)
    if (cw <= 0 || ch <= 0) return
    const ratio = Math.min(cw / nat.w, ch / nat.h)
    setStage({ w: Math.round(nat.w * ratio), h: Math.round(nat.h * ratio) })
  }, [natural])

  useLayoutEffect(() => {
    recomputeStage()
  }, [recomputeStage])

  useResizeObserver(containerRef, recomputeStage)

  const clampLocalOffset = useCallback(
    (offset: Point, scale: number): Point => {
      const container = containerRef.current
      if (!container) return { x: 0, y: 0 }
      const safe = getViewportSize(container)
      const maxX = Math.max(0, (stage.w * scale - safe.width) / 2)
      const maxY = Math.max(0, (stage.h * scale - safe.height) / 2)
      return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) }
    },
    [stage],
  )

  const applyLocalView = useCallback(
    (scale: number, offset: Point) => {
      const nextScale = clamp(scale, LOCAL_MIN_SCALE, LOCAL_MAX_SCALE)
      const next = { scale: nextScale, offset: clampLocalOffset(offset, nextScale) }
      localViewRef.current = next
      setLocalView(next)
    },
    [clampLocalOffset],
  )

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const container = containerRef.current
      if (viewTransform || !natural || stage.w === 0 || stage.h === 0 || !container) return
      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const anchor = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      }
      const current = localViewRef.current
      const factor = event.ctrlKey ? 0.02 : 0.0015
      const nextScale = clamp(current.scale * Math.exp(-event.deltaY * factor), LOCAL_MIN_SCALE, LOCAL_MAX_SCALE)
      const ratio = nextScale / current.scale
      applyLocalView(nextScale, {
        x: anchor.x - ratio * (anchor.x - current.offset.x),
        y: anchor.y - ratio * (anchor.y - current.offset.y),
      })
    },
    [applyLocalView, natural, stage, viewTransform],
  )

  useExternalSync(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handlePanPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!panEnabled || viewTransform || !natural || stage.w === 0 || stage.h === 0) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const point = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      panStateRef.current = { pointerId: event.pointerId, point, offset: localViewRef.current.offset }
      setIsPanning(true)
    },
    [natural, panEnabled, stage, viewTransform],
  )

  const handlePanPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panStateRef.current
      if (!pan || pan.pointerId !== event.pointerId) return
      const rect = event.currentTarget.getBoundingClientRect()
      const point = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      }
      applyLocalView(localViewRef.current.scale, {
        x: pan.offset.x + point.x - pan.point.x,
        y: pan.offset.y + point.y - pan.point.y,
      })
    },
    [applyLocalView],
  )

  const handlePanPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    panStateRef.current = null
    setIsPanning(false)
  }, [])

  useExternalSync(() => {
    if (viewTransform) return
    applyLocalView(localViewRef.current.scale, localViewRef.current.offset)
  }, [applyLocalView, viewTransform])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const nat = natural
    if (!canvas || !nat) return
    if (canvas.width !== nat.w) canvas.width = nat.w
    if (canvas.height !== nat.h) canvas.height = nat.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Only paint items belonging to the active layer — annotate and mask
    // are conceptually separate, so a mask shouldn't bleed into the
    // annotate view and vice versa.
    const modes = visibleModes ?? [mode]
    for (const item of items) {
      if (!modes.includes(item.mode)) continue
      const color = item.mode === 'mask' ? MASK_OVERLAY_COLOR : item.color
      paintItem(ctx, item, color)
    }
    if (draft && modes.includes(draft.mode)) {
      const color = draft.mode === 'mask' ? MASK_OVERLAY_COLOR : draft.color
      paintItem(ctx, draft, color)
    }
  }, [natural, items, draft, mode, visibleModes])

  useLayoutEffect(() => {
    redraw()
  }, [redraw])

  const toNatural = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const canvas = canvasRef.current
      const nat = natural
      if (!canvas || !nat || stage.w === 0 || stage.h === 0) return null
      const rect = canvas.getBoundingClientRect()
      const sx = (clientX - rect.left) / rect.width
      const sy = (clientY - rect.top) / rect.height
      if (sx < 0 || sx > 1 || sy < 0 || sy > 1) return null
      return { x: sx * nat.w, y: sy * nat.h }
    },
    [natural, stage],
  )

  // Eraser hit-test deletes any item in the active layer that the drag
  // passes through. We deliberately skip items from the other layer — user
  // expects "standing on the mask layer" to never touch annotate strokes.
  const eraseAt = useCallback(
    (pt: Point) => {
      const prev = itemsRef.current
      const kept = prev.filter((item) => {
        if (!eraseAllModes && item.mode !== mode) return true
        return !hitTestItem(item, pt)
      })
      if (kept.length !== prev.length) pushItems(kept)
    },
    [eraseAllModes, pushItems, mode],
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const pt = toNatural(e.clientX, e.clientY)
    if (!pt) return

    if (tool === 'step') {
      // Pins drop on click (no drag/capture). Radius is clamped so large
      // brush presets don't produce oversized pins.
      const size = Math.min(22, Math.max(12, brushSize * 1.1))
      const n = nextStepNumber(itemsRef.current)
      pushItems([
        ...itemsRef.current,
        {
          id: crypto.randomUUID(),
          kind: 'step',
          mode,
          color: annotateColor,
          size,
          anchor: pt,
          n,
        },
      ])
      return
    }

    // Path / rect / eraser all need pointer move/up delivered even if the
    // pointer leaves canvas bounds mid-gesture, so we capture for those.
    e.currentTarget.setPointerCapture(e.pointerId)

    if (tool === 'eraser') {
      pointerStateRef.current = { pointerId: e.pointerId, kind: 'eraser' }
      eraseAt(pt)
      return
    }

    if (tool === 'rect') {
      pointerStateRef.current = { pointerId: e.pointerId, kind: 'rect' }
      writeDraft({
        id: crypto.randomUUID(),
        kind: 'rect',
        mode,
        color: annotateColor,
        size: brushSize,
        start: pt,
        end: pt,
      })
      return
    }

    // brush
    pointerStateRef.current = { pointerId: e.pointerId, kind: 'path' }
    writeDraft({
      id: crypto.randomUUID(),
      kind: 'path',
      mode,
      color: annotateColor,
      size: brushSize,
      points: [pt],
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = pointerStateRef.current
    if (!state || state.pointerId !== e.pointerId) return
    const pt = toNatural(e.clientX, e.clientY)
    if (!pt) return
    if (state.kind === 'eraser') {
      eraseAt(pt)
      return
    }
    // Read the draft through the ref so we don't have to rely on setState
    // functional updaters — in StrictMode dev those run twice and any side
    // effect inside fires twice, which we explicitly want to avoid here.
    const prev = draftRef.current
    if (state.kind === 'rect') {
      if (prev?.kind === 'rect') writeDraft({ ...prev, end: pt })
      return
    }
    // path
    if (prev?.kind === 'path') {
      const last = prev.points[prev.points.length - 1]
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1) return
      writeDraft({ ...prev, points: [...prev.points, pt] })
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = pointerStateRef.current
    if (!state || state.pointerId !== e.pointerId) return
    pointerStateRef.current = null
    const d = draftRef.current
    writeDraft(null)
    if (!d) return
    // Drop zero-size rects so a stray click in rect mode doesn't leave a point.
    if (d.kind === 'rect' && Math.abs(d.end.x - d.start.x) < 2 && Math.abs(d.end.y - d.start.y) < 2) {
      return
    }
    pushItems([...itemsRef.current, d])
  }

  // Handle methods read items through `itemsRef` rather than the `items`
  // closure — `drawableRef.current.undo()` is fired from a window keydown
  // listener whose re-bind timing is independent of the layer's render, and
  // in React StrictMode the imperative handle's closure can lag one render
  // behind. Reading the ref guarantees "always latest". undo/clear scope
  // to the current mode so the user never touches the hidden other layer.
  const ready = natural !== null && stage.w > 0
  useImperativeHandle(
    ref,
    () => ({
      isReady: () => ready,
      hasItems: () => itemsRef.current.some((it) => it.mode === mode),
      clear: () => {
        const cur = itemsRef.current
        const kept = cur.filter((it) => it.mode !== mode)
        if (kept.length !== cur.length) pushItems(kept)
      },
      clearAll: () => {
        if (itemsRef.current.length > 0) pushItems([])
      },
      undo: () => {
        const cur = itemsRef.current
        for (let i = cur.length - 1; i >= 0; i--) {
          if (cur[i].mode === mode) {
            pushItems([...cur.slice(0, i), ...cur.slice(i + 1)])
            return
          }
        }
      },
      exportMarkedComposite: async () => {
        const img = imageRef.current
        const nat = natural
        if (!img || !nat) return null
        const canvas = document.createElement('canvas')
        canvas.width = nat.w
        canvas.height = nat.h
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, nat.w, nat.h)
        for (const item of itemsRef.current) {
          if (item.mode !== 'mask') continue
          paintItem(ctx, item, MASK_OVERLAY_COLOR)
        }
        for (const item of itemsRef.current) {
          if (item.mode !== 'annotate') continue
          paintItem(ctx, item, item.color)
        }
        return { base64: dataUrlToBase64(canvas.toDataURL('image/png')), mimeType: 'image/png' as const }
      },
      exportAnnotated: async () => {
        const img = imageRef.current
        const nat = natural
        if (!img || !nat) return null
        const canvas = document.createElement('canvas')
        canvas.width = nat.w
        canvas.height = nat.h
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, nat.w, nat.h)
        for (const item of itemsRef.current) {
          if (item.mode !== 'annotate') continue
          paintItem(ctx, item, item.color)
        }
        return { base64: dataUrlToBase64(canvas.toDataURL('image/png')), mimeType: 'image/png' as const }
      },
      exportMaskAlpha: async () => {
        const nat = natural
        if (!nat) return null
        const canvas = document.createElement('canvas')
        canvas.width = nat.w
        canvas.height = nat.h
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        // White-opaque background; alpha=0 strokes mark the edit region per the
        // OpenAI images.edits spec. Text items are intentionally skipped — a
        // label's bounding box rarely matches what the user wants masked.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, nat.w, nat.h)
        ctx.globalCompositeOperation = 'destination-out'
        for (const item of itemsRef.current) {
          if (item.mode !== 'mask') continue
          paintItem(ctx, item, '#ffffff')
        }
        ctx.globalCompositeOperation = 'source-over'
        return { base64: dataUrlToBase64(canvas.toDataURL('image/png')), mimeType: 'image/png' as const }
      },
      exportMaskRedOverlay: async () => {
        const img = imageRef.current
        const nat = natural
        if (!img || !nat) return null
        const canvas = document.createElement('canvas')
        canvas.width = nat.w
        canvas.height = nat.h
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, nat.w, nat.h)
        for (const item of itemsRef.current) {
          if (item.mode !== 'mask') continue
          paintItem(ctx, item, MASK_OVERLAY_COLOR)
        }
        return { base64: dataUrlToBase64(canvas.toDataURL('image/png')), mimeType: 'image/png' as const }
      },
    }),
    [natural, pushItems, mode, ready],
  )

  const cursor = panEnabled ? (isPanning ? 'grabbing' : 'grab') : tool === 'eraser' ? 'cell' : 'crosshair'
  const transform = viewTransform ?? localView

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center select-none"
      style={{
        touchAction: 'none',
        cursor,
        // Opaque grid background so this layer fully occludes whatever is
        // mounted underneath (e.g. ZoomableImageView base). Otherwise a
        // scaled-down picture would expose the bottom viewer's untouched
        // image, doubling the canvas. Fades in together with the picture
        // so the entry into edit mode is seamless.
        backgroundColor: 'var(--color-bg-sunken)',
        backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: '28px 28px, 28px 28px',
        opacity: ready ? 1 : 0,
        transition: 'opacity 200ms ease-out',
        // Defer pointer capture until ready so the (visible) layer below
        // keeps responding to wheel/drag during the brief fade-in.
        pointerEvents: ready && (!readOnly || panEnabled) ? 'auto' : 'none',
      }}
      onPointerDown={handlePanPointerDown}
      onPointerMove={handlePanPointerMove}
      onPointerUp={handlePanPointerUp}
      onPointerCancel={handlePanPointerUp}
    >
      <div
        className="relative flex-none"
        style={{
          // Keep the wrapper at zero until stage is known so the picture
          // doesn't briefly fit to the raw container size before stage is set.
          width: ready ? stage.w : 0,
          height: ready ? stage.h : 0,
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          boxShadow: ready
            ? '0 0 0 1px var(--ring-edge-strong), 0 30px 60px -24px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.06)'
            : 'none',
          transform: `translate3d(${transform.offset.x}px, ${transform.offset.y}px, 0) scale(${transform.scale})`,
          transformOrigin: 'center center',
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            imageRef.current = img
            // Same URL may fire onLoad again (e.g. StrictMode mount/unmount
            // cycle hitting the browser cache). Bailing when the size hasn't
            // changed keeps us from churning state.
            setNatural((prev) => {
              if (prev && prev.w === img.naturalWidth && prev.h === img.naturalHeight) return prev
              return { w: img.naturalWidth, h: img.naturalHeight }
            })
          }}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor,
            // Until `natural` is known, canvas coords are meaningless and
            // we don't want to swallow clicks that land "somewhere" — defer
            // pointer events until the stage is sized.
            pointerEvents: ready && !readOnly ? 'auto' : 'none',
            visibility: ready ? 'visible' : 'hidden',
          }}
        />
      </div>
    </div>
  )
})
