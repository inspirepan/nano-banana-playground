import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { GeneratedSource, GroundingMetadata, PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import type { GenerationJob } from '../hooks/usePlayground'
import { MODEL_CONFIGS, DEFAULT_MODEL, defaultOptionsFor, type ModelConfig } from '../config/models'
import { getActualCost, getPricePerImage } from '../lib/pricing'
import { ensureBlobLoaded, useImageSrc } from '../hooks/useImageSrc'
import { loadImageMetas } from '../lib/history'
import { Icon, type IconName } from './Icon'
import { ChipGroup } from './ChipGroup'
import { AspectRatioSelector } from './AspectRatioSelector'
import { ReferenceImageUpload, type LockedReferenceImage } from './ReferenceImageUpload'
import { QueueJobSection } from './QueueJobSection'
import { DrawableLayer, type DrawableLayerHandle, type DrawMode, type DrawTool } from './DrawableLayer'
import { computeItemCounts, copyEditState, getEditState, setEditItems, setEditPrompt, type ItemCounts } from '../lib/editStateCache'
import { openAISize } from '../lib/openai'
import { readFileAsImageData } from '../lib/fileToImage'
import { imageDownloadFileName } from '../lib/downloadFileName'
import type { ImageStack, StackItem } from '../lib/stacks'
import { StackItemThumb } from './StackItemThumb'

type EditMode = 'view' | DrawMode
type ModalViewMode = 'detail' | 'gallery'

// Three brush presets (in source-image natural pixels). These map to the
// [细 · 中 · 粗] chips in the canvas toolbar; they stay mode-agnostic so
// annotate and mask share one control.
const BRUSH_PRESETS = [
  { id: 'S', label: '细', size: 24 },
  { id: 'M', label: '中', size: 56 },
  { id: 'L', label: '粗', size: 96 },
] as const
type BrushPresetId = (typeof BRUSH_PRESETS)[number]['id']

// Normalize generated-source metadata into a single `options` bag, folding in
// legacy top-level fields (`quality`, `searchTools`) from pre-refactor records.
function effectiveOptions(source: GeneratedSource): Record<string, unknown> {
  const bag: Record<string, unknown> = { ...(source.options ?? {}) }
  if (source.quality !== undefined && bag.quality === undefined) {
    bag.quality = source.quality
  }
  if (source.searchTools && bag.webSearch === undefined && bag.imageSearch === undefined) {
    if (source.searchTools.web) bag.webSearch = true
    if (source.searchTools.image) bag.imageSearch = true
  }
  return bag
}

// Format an option value for display in the metadata table.
function formatOptionValue(model: ModelConfig | null | undefined, optionId: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '' || value === false) return null
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt?.type === 'select' && typeof value === 'string') {
    return opt.choices.find((c) => c.value === value)?.label ?? value
  }
  if (opt?.type === 'toggle') {
    return value === true ? '已启用' : null
  }
  // Legacy / unknown options — render raw.
  if (typeof value === 'boolean') return value ? '是' : null
  return String(value)
}

// Pick a human label for an option; falls back to the raw id for legacy keys.
function optionLabel(model: ModelConfig | null | undefined, optionId: string): string {
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt) return opt.label
  // Legacy fallbacks for options no longer declared by the active model.
  if (optionId === 'quality') return '质量'
  if (optionId === 'webSearch') return 'Web 搜索'
  if (optionId === 'imageSearch') return '图片搜索'
  if (optionId === 'background') return '背景'
  if (optionId === 'thinkingLevel') return '思考等级'
  return optionId
}

const MIN_SCALE = 0.5
const MAX_SCALE = 6
const FIT_SCALE = 1

type Props = {
  stack: ImageStack
  initialItemId?: string
  initialViewMode?: ModalViewMode
  initialEditing?: boolean
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  onClose: () => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onEditImage: (params: {
    sourceImage: PlaygroundImageMeta
    model: ModelConfig
    prompt: string
    extraReferences: PlaygroundImage[]
    resolution: string
    aspectRatio: string
    options: Record<string, unknown>
    batchCount: number
    annotatedSource?: PlaygroundImage
    mask?: PlaygroundImage
  }) => Promise<string | null>
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRemove: (id: string) => void
}

type Point = { x: number; y: number }
type Size = { width: number; height: number }

// Labels for syntax highlighting (same list as InputPanel)
const HIGHLIGHT_LABELS = [
  '参考图说明',
  '画面中的文字',
  '画中文字',
  '编辑类型',
  '编辑请求',
  '目标场景',
  '目标风格',
  '保持不变',
  '构图',
  '风格',
  '光影',
  '色彩',
  '约束',
  '避免',
]

const MOBILE_SHEET_EXPANDED_VH = 45
const MOBILE_SHEET_LOW_PX = 88

// Prefer visualViewport.height so the sheet math follows the dynamic viewport
// (excluding the iOS soft keyboard area) instead of the layout viewport.
function getVisualViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  return window.visualViewport?.height ?? window.innerHeight
}

function getMobileSheetHeights(viewportHeight: number) {
  const expandedVh = MOBILE_SHEET_EXPANDED_VH
  const expandedHeight = Math.max(MOBILE_SHEET_LOW_PX, Math.round((viewportHeight * expandedVh) / 100))
  const initialHeight = Math.min(MOBILE_SHEET_LOW_PX, expandedHeight)
  return { initialHeight, expandedHeight }
}

function renderPromptLines(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => {
    for (const lbl of HIGHLIGHT_LABELS) {
      const needle = `${lbl}：`
      if (line.startsWith(needle)) {
        return (
          <div key={i}>
            <span
              className="rounded-[3px] px-[3px] font-medium"
              style={{ background: 'var(--color-accent-wash)', color: 'var(--color-accent)' }}
            >
              {lbl}
            </span>
            ：{line.slice(needle.length)}
          </div>
        )
      }
    }
    return <div key={i}>{line || ' '}</div>
  })
}

function MetaRow({ label, value, mono, last }: { label: string; value: ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <div
      className="flex items-baseline gap-3 py-1.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}
    >
      <div className="w-[76px] shrink-0 text-xs font-medium text-(--color-text-3)">{label}</div>
      <div className={`${mono ? 'mono' : ''} flex-1 break-words text-right text-sm text-(--color-text)`}>
        {value}
      </div>
    </div>
  )
}

function SlotHero({
  item,
  onCancelSlot,
  onCancelJob,
  onDismissJob,
}: {
  item: StackItem | null
  onCancelSlot: (slotId: string) => void
  onCancelJob: (jobId: string) => void
  onDismissJob: (jobId: string) => void
}) {
  const slot = item?.type === 'slot' ? item.slot : null
  const job = item?.type === 'slot' ? item.job : null
  const label =
    slot?.status === 'failed'
      ? '生成失败'
      : slot?.status === 'canceled'
        ? '已取消'
        : slot?.status === 'retrying'
          ? '重试中'
          : slot?.status === 'running'
            ? '生成中'
            : '排队中'
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-(--color-text-3)">
      {slot?.status === 'failed' || slot?.status === 'canceled' ? (
        <Icon name="close" size={16} strokeWidth={1.8} />
      ) : (
        <span className="spinner" />
      )}
      <div className="mono text-sm text-(--color-text-2)">{label}</div>
      {slot?.error && <div className="max-w-[420px] text-xs leading-[1.5] text-(--color-text-4)">{slot.error}</div>}
      {slot && job && (slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying') && (
        job.slots.length === 1 ? (
          <button type="button" className="chip danger mt-2" onClick={() => onCancelSlot(slot.id)}>
            取消
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="chip danger" onClick={() => onCancelSlot(slot.id)}>
              取消当前
            </button>
            <button type="button" className="chip ghost" onClick={() => onCancelJob(job.id)}>
              取消全部
            </button>
          </div>
        )
      )}
      {slot && job && (slot.status === 'failed' || slot.status === 'canceled') && (
        <button type="button" className="chip ghost mt-2" onClick={() => onDismissJob(job.id)}>
          关闭任务
        </button>
      )}
    </div>
  )
}

function StackStrip({
  stack,
  selectedId,
  onSelect,
  onCancelActiveJobs,
}: {
  stack: ImageStack
  selectedId: string | null
  onSelect: (item: StackItem) => void
  onCancelActiveJobs: () => void
}) {
  const hasActiveJobs = stack.jobs.some((job) =>
    job.slots.some((slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'),
  )
  return (
    <div
      className="shrink-0 overflow-x-auto border-b border-(--color-border) px-3.5 py-2"
      style={{ background: 'color-mix(in srgb, var(--color-surface) 74%, transparent)' }}
    >
      <div className="flex items-center gap-2">
        <div className="-m-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-1">
        {stack.items.map((item) => (
          <StackItemThumb key={item.id} item={item} active={selectedId === item.id} outerRing onSelect={onSelect} />
        ))}
        </div>
        {hasActiveJobs && (
          <button type="button" onClick={onCancelActiveJobs} className="chip danger shrink-0 text-xs" style={{ height: 24, padding: '0 8px' }}>
            取消全部
          </button>
        )}
      </div>
    </div>
  )
}

function StackGallery({ stack, selectedId, onSelect }: { stack: ImageStack; selectedId: string | null; onSelect: (item: StackItem) => void }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
      <div className="mb-4 flex items-end gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-semibold tracking-[-0.01em]">全部图片</div>
          <div className="mt-0.5 text-xs text-(--color-text-3)">
            {stack.images.length} 张图片，{stack.activeSlotCount} 个生成中
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {stack.items.map((item) => (
          <StackItemThumb
            key={item.id}
            item={item}
            active={selectedId === item.id}
            outerRing
            className="aspect-square h-auto w-full"
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

export function ImageDetailModal({
  stack,
  initialItemId,
  initialViewMode = 'detail',
  initialEditing = false,
  history,
  generationJobs,
  onClose,
  onAddToRef,
  onRegenerate,
  onEditImage,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRemove,
}: Props) {
  const initialItem = useMemo(
    () => stack.items.find((item) => item.id === initialItemId) ?? stack.items[stack.items.length - 1] ?? null,
    [initialItemId, stack.items],
  )
  const toSelection = useCallback((item: StackItem | null) => {
    return item ? { id: item.id, batchId: item.batchId, order: item.order } : null
  }, [])
  const [selection, setSelection] = useState<{ id: string; batchId: string; order: number } | null>(() =>
    toSelection(initialItem),
  )
  const selectedItem =
    (selection && stack.items.find((item) => item.id === selection.id)) ??
    (selection && stack.items.find((item) => item.batchId === selection.batchId && item.order === selection.order)) ??
    stack.items[stack.items.length - 1] ??
    null
  if (selectedItem && selection?.id !== selectedItem.id) {
    setSelection(toSelection(selectedItem))
  }
  const currentIdx = selectedItem ? stack.items.findIndex((item) => item.id === selectedItem.id) : -1
  const currentImage = selectedItem?.type === 'image' ? selectedItem.image : null
  const currentSlot = selectedItem?.type === 'slot' ? selectedItem.slot : null
  const [editing, setEditing] = useState(initialEditing)
  const [mobileDrawOpen, setMobileDrawOpen] = useState(false)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ModalViewMode>(initialViewMode)
  // After submit, we watch history for the first new image with this batchId
  // and auto-navigate the pager to it.
  const [activeEditBatchId, setActiveEditBatchId] = useState<string | null>(null)
  const activeEditSourceIdRef = useRef<string | null>(null)
  const setActiveEditBatch = useCallback((batchId: string | null, sourceImageId?: string) => {
    activeEditSourceIdRef.current = batchId ? (sourceImageId ?? activeEditSourceIdRef.current) : null
    setActiveEditBatchId(batchId)
  }, [])
  // Canvas-edit mode: view (default pan/zoom), annotate (paint colored strokes
  // baked into the reference), or mask (paint a region for OpenAI's mask
  // field / Gemini red overlay).
  const [editMode, setEditMode] = useState<EditMode>('view')
  const [drawTool, setDrawTool] = useState<DrawTool>('brush')
  if (drawTool === 'rect') {
    setDrawTool('brush')
  }
  const [brushPreset, setBrushPreset] = useState<BrushPresetId>('M')
  const brushSize = BRUSH_PRESETS.find((p) => p.id === brushPreset)?.size ?? 56
  const activeDrawMode: DrawMode = drawTool === 'step' ? 'annotate' : 'mask'
  // Per-layer item counts. Seed from the cache so the mode-segment dots
  // light up on modal open even before the drawable layer mounts; the
  // layer's onItemsChange keeps us in sync afterward; pager image changes
  // reseed counts during render (see drawablePagerImageId below).
  const [drawableCounts, setDrawableCounts] = useState<ItemCounts>(() =>
    computeItemCounts(getEditState(currentImage?.id ?? '').items),
  )
  const [drawRevision, setDrawRevision] = useState(0)
  const [drawablePagerImageId, setDrawablePagerImageId] = useState(currentImage?.id ?? '')
  if ((currentImage?.id ?? '') !== drawablePagerImageId) {
    const imageId = currentImage?.id ?? ''
    setDrawablePagerImageId(imageId)
    setDrawableCounts(computeItemCounts(getEditState(imageId).items))
  }
  const drawableRef = useRef<DrawableLayerHandle | null>(null)

  const { ref: imgRef, src: currentSrc } = useImageSrc(currentImage?.id ?? '', currentImage?.mimeType ?? 'image/png')
  const currentMeta = currentImage?.source.type === 'generated' ? currentImage.source : null
  const canNavigate = stack.items.length > 0 && currentIdx >= 0

  const [toast, setToast] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [refDetailId, setRefDetailId] = useState<string | null>(null)
  const [refSrcMap, setRefSrcMap] = useState<Map<string, string>>(new Map())
  const refDetailSrc = refDetailId ? (refSrcMap.get(refDetailId) ?? null) : null

  // Resolve missing refs from IndexedDB
  const [dbRefMetas, setDbRefMetas] = useState<Map<string, PlaygroundImageMeta>>(new Map())
  const missingRefIds = useMemo(() => {
    if (!currentMeta) return []
    return currentMeta.referenceImageIds.filter((id) => !history.find((h) => h.id === id))
  }, [currentMeta, history])

  useEffect(() => {
    if (missingRefIds.length === 0) return
    loadImageMetas(missingRefIds).then(setDbRefMetas)
  }, [missingRefIds])

  const findRefImage = useCallback(
    (id: string): PlaygroundImageMeta | undefined => {
      return history.find((h) => h.id === id) ?? dbRefMetas.get(id)
    },
    [history, dbRefMetas],
  )

  useEffect(() => {
    if (!refDetailId) return
    if (refSrcMap.has(refDetailId)) return
    const refImg = findRefImage(refDetailId)
    if (!refImg) return
    ensureBlobLoaded(refImg.id, refImg.mimeType).then((src) => {
      if (!src) return
      setRefSrcMap((prev) => {
        if (prev.has(refDetailId)) return prev
        const next = new Map(prev)
        next.set(refDetailId, src)
        return next
      })
    })
  }, [refDetailId, refSrcMap, findRefImage])

  const goToPrev = useCallback(() => {
    const prev = stack.items[Math.max(0, currentIdx - 1)] ?? null
    setSelection(toSelection(prev))
    setRefDetailId(null)
    // No explicit clear — DrawableLayer remounts under the new image's key
    // and restores that image's cached items (empty for never-edited ones).
  }, [currentIdx, stack.items, toSelection])

  const goToNext = useCallback(() => {
    const next = stack.items[Math.min(stack.items.length - 1, currentIdx + 1)] ?? null
    setSelection(toSelection(next))
    setRefDetailId(null)
  }, [currentIdx, stack.items, toSelection])

  useEffect(() => {
    if (!currentImage) return
    ensureBlobLoaded(currentImage.id, currentImage.mimeType)
  }, [currentImage])

  // Prefetch neighbor blobs and prime the browser image decode cache so left/
  // right pager switches swap frames without a blank flash.
  useEffect(() => {
    if (!canNavigate) return
    const neighbors: PlaygroundImageMeta[] = []
    const prev = stack.items[currentIdx - 1]
    const next = stack.items[currentIdx + 1]
    if (prev?.type === 'image') neighbors.push(prev.image)
    if (next?.type === 'image') neighbors.push(next.image)
    let cancelled = false
    for (const n of neighbors) {
      ensureBlobLoaded(n.id, n.mimeType).then((dataUrl) => {
        if (cancelled || !dataUrl) return
        const pre = new Image()
        pre.decoding = 'async'
        pre.src = dataUrl
      })
    }
    return () => {
      cancelled = true
    }
  }, [canNavigate, currentIdx, stack.items])

  const exitEdit = useCallback(() => {
    setEditing(false)
    setEditMode('view')
    setDrawTool('brush')
    // Keep items — they're cached per-image so reopening the modal restores
    // whatever annotations were in progress. Counts stay for the dots.
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd+Z triggers an undo on the drawable layer. Skip when the user
      // is typing into an input/textarea (e.g. the prompt or text-pin editor)
      // so undo stays a text-level operation there.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
        if (editing && editMode !== 'view' && !isTextInput) {
          e.preventDefault()
          drawableRef.current?.undo()
          return
        }
      }
      if (e.key === 'Escape') {
        if (mobilePreviewOpen) {
          setMobilePreviewOpen(false)
          return
        }
        if (mobileDrawOpen) {
          setMobileDrawOpen(false)
          return
        }
        if (editMode !== 'view') {
          setEditMode('view')
          return
        }
        if (editing) {
          exitEdit()
          return
        }
        onClose()
        return
      }
      if (editing) return
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
  }, [canNavigate, editing, editMode, exitEdit, goToNext, goToPrev, mobileDrawOpen, mobilePreviewOpen, onClose])

  // Auto-select the new edit batch inside the stack strip. The selection starts
  // on the pending slot, then follows the same batch/order when it becomes an image.
  const navedBatchIdRef = useRef<string | null>(null)
  const copiedEditTargetIdsRef = useRef(new Set<string>())
  useEffect(() => {
    if (!activeEditBatchId) return
    const firstItem = stack.items.find((item) => item.batchId === activeEditBatchId)
    if (firstItem && navedBatchIdRef.current !== activeEditBatchId) {
      navedBatchIdRef.current = activeEditBatchId
      setSelection(toSelection(firstItem))
      setRefDetailId(null)
    }

    const sourceId = activeEditSourceIdRef.current
    if (sourceId) {
      for (const item of stack.items) {
        if (item.batchId !== activeEditBatchId || item.type !== 'image') continue
        if (copiedEditTargetIdsRef.current.has(item.image.id)) continue
        copyEditState(sourceId, item.image.id)
        copiedEditTargetIdsRef.current.add(item.image.id)
      }
    }
  }, [activeEditBatchId, stack.items, toSelection])

  // —— Mobile bottom-sheet: start lower to prioritize the image, but keep a
  // larger expanded stop for metadata-heavy batches.
  const [isMobileSheet, setIsMobileSheet] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  // null = use the initial lower resting height; a number overrides with an
  // explicit snapped pixel height after the first drag.
  const [sheetHeightPx, setSheetHeightPx] = useState<number | null>(null)
  const [sheetDragging, setSheetDragging] = useState(false)
  const sheetLayoutKey = `${isMobileSheet}`
  const [sheetLayoutStamp, setSheetLayoutStamp] = useState(sheetLayoutKey)
  if (sheetLayoutKey !== sheetLayoutStamp) {
    setSheetLayoutStamp(sheetLayoutKey)
    if (sheetHeightPx !== null) setSheetHeightPx(null)
  }
  const sheetDragRef = useRef<{
    startY: number
    startHeight: number
    initialHeight: number
    expandedHeight: number
    pointerId: number
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobileSheet(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!isMobileSheet || !editing) setMobileDrawOpen(false)
  }, [isMobileSheet, editing])

  useEffect(() => {
    if (!isMobileSheet || !currentImage) setMobilePreviewOpen(false)
  }, [isMobileSheet, currentImage])

  // Clamp the snapped sheet height against the current visual viewport so it
  // doesn't overflow when the iOS keyboard opens.
  useEffect(() => {
    if (!isMobileSheet) return
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => {
      setSheetHeightPx((prev) => {
        if (prev === null) return prev
        const { expandedHeight } = getMobileSheetHeights(vv.height)
        return Math.min(prev, expandedHeight)
      })
    }
    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
  }, [isMobileSheet])

  // Desktop-only: collapse the right metadata sidebar to give the canvas more room.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nano-banana-detail-sidebar-collapsed') === '1'
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nano-banana-detail-sidebar-collapsed', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const expandMobileSheet = useCallback(() => {
    if (!isMobileSheet) return
    const { expandedHeight } = getMobileSheetHeights(getVisualViewportHeight())
    setSheetHeightPx(expandedHeight)
  }, [isMobileSheet])

  const handleSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileSheet) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const { initialHeight, expandedHeight } = getMobileSheetHeights(getVisualViewportHeight())
    sheetDragRef.current = {
      startY: e.clientY,
      startHeight: sheetHeightPx ?? initialHeight,
      initialHeight,
      expandedHeight,
      pointerId: e.pointerId,
    }
    setSheetDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const delta = e.clientY - drag.startY // +down, -up
    const next = Math.max(drag.initialHeight, Math.min(drag.expandedHeight, drag.startHeight - delta))
    setSheetHeightPx(next)
  }

  const handleSheetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    sheetDragRef.current = null
    setSheetDragging(false)
    const delta = e.clientY - drag.startY
    const current = Math.max(drag.initialHeight, Math.min(drag.expandedHeight, drag.startHeight - delta))
    const nextHeight =
      delta < -8
        ? drag.expandedHeight
        : delta > 8
          ? drag.initialHeight
          : Math.abs(drag.expandedHeight - current) < Math.abs(current - drag.initialHeight)
            ? drag.expandedHeight
            : drag.initialHeight
    setSheetHeightPx(nextHeight)
  }

  const modelConfig = currentMeta ? MODEL_CONFIGS.find((m) => m.id === currentMeta.modelId) : null
  const modelName = modelConfig?.name ?? currentMeta?.modelId ?? null
  const modelApiId = modelConfig?.apiModel ?? null

  const actualCost = (() => {
    if (!currentMeta || !modelConfig) return null
    return getActualCost(modelConfig, currentMeta.tokenUsage)
  })()

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }

  const handleDownload = async () => {
    if (!currentImage || !currentSrc) return
    const fileName = imageDownloadFileName(currentImage, 'png')
    try {
      const res = await fetch(currentSrc)
      const blob = await res.blob()
      const file = new File([blob], fileName, { type: blob.type || currentImage.mimeType || 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName })
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
    const anchor = document.createElement('a')
    anchor.href = currentSrc
    anchor.download = fileName
    anchor.click()
    flash('开始下载 PNG')
  }

  const handleCopyPrompt = () => {
    if (!currentMeta?.prompt) return
    navigator.clipboard?.writeText(currentMeta.prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 1400)
  }

  const handleAddRef = () => {
    if (!currentImage) return
    onAddToRef(currentImage)
    flash('已加为参考图')
  }

  const handleRegenerateAction = () => {
    if (!currentImage) return
    onRegenerate(currentImage)
    onClose()
  }

  const hasPrev = canNavigate && currentIdx > 0
  const hasNext = canNavigate && currentIdx < stack.items.length - 1
  const hasDrawableMarks = drawableCounts.annotate > 0 || drawableCounts.mask > 0

  const startAnnotation = () => {
    if (!currentImage) return
    setEditing(true)
    setRefDetailId(null)
    setEditMode('mask')
    if (drawTool === 'rect') setDrawTool('brush')
    if (isMobileSheet) setMobileDrawOpen(true)
  }

  const finishAnnotation = () => {
    setMobileDrawOpen(false)
    setEditMode('view')
  }

  const clearAnnotations = () => {
    if (!currentImage) return
    drawableRef.current?.clearAll()
    setEditItems(currentImage.id, [])
    setDrawableCounts({ annotate: 0, mask: 0 })
    setDrawRevision((prev) => prev + 1)
    setMobileDrawOpen(false)
    setEditMode('view')
    setDrawTool('brush')
  }

  // Size helper — show approximate px
  const pxDim = currentMeta ? `${currentMeta.resolution} · ${currentMeta.aspectRatio}` : ''

  const stackInfo =
    currentImage &&
    (() => {
      const posInStack = stack.images.findIndex((img) => img.id === currentImage.id)
      return { pos: posInStack + 1, total: stack.images.length }
    })()

  return createPortal(
    <div
      className="fixed top-0 left-0 w-full z-[100] flex flex-col fade-in"
      style={{
        // Track the dynamic viewport so the modal's bottom rises with the iOS
        // soft keyboard — otherwise `inset-0` pins the bottom to the layout
        // viewport and the edit sheet's CTA is hidden behind the keyboard.
        height: '100dvh',
        background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {/* Sentinel for preview loader */}
      <div ref={imgRef} className="fixed top-0 left-0 w-0 h-0 pointer-events-none" aria-hidden />

      {/* ——— Header ——— */}
      <div
        className="flex items-center gap-2 px-3.5 shrink-0 flex-nowrap"
        style={{
          height: 48,
          borderBottom: '1px solid var(--color-border)',
          background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
        }}
      >
        <button className="icon-btn shrink-0" onClick={onClose} title="关闭 (Esc)" style={{ width: 32, height: 32 }}>
          <Icon name="close" size={13} strokeWidth={1.8} />
        </button>
        <div className="h-6 w-px shrink-0 bg-(--color-border)" />

        {currentMeta ? (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-base font-semibold leading-none tracking-[-0.01em] text-(--color-text) md:text-sm md:font-medium md:tracking-normal">
              {modelName}
            </span>
            <span className="mono shrink-0 text-sm leading-none text-(--color-text-4)">{pxDim}</span>
          </div>
        ) : (
          <span className="truncate text-base font-semibold leading-none tracking-[-0.01em] text-(--color-text) md:text-sm md:font-medium md:tracking-normal">
            {currentSlot ? '生成任务' : '图片组'}
          </span>
        )}

        <div className="flex-1" />

        <button
          className="chip hidden shrink-0 md:inline-flex"
          onClick={() => setViewMode((prev) => (prev === 'gallery' ? 'detail' : 'gallery'))}
          title={viewMode === 'gallery' ? '回到预览' : '查看全部图片'}
        >
          <Icon name={viewMode === 'gallery' ? 'chevron_left' : 'image'} size={12} strokeWidth={1.8} />
          <span className="hidden md:inline">{viewMode === 'gallery' ? '回到预览' : '全部图片'}</span>
        </button>
        {viewMode === 'detail' && (
          <button
            className="chip shrink-0 text-sm md:hidden"
            onClick={() => setMobilePreviewOpen(true)}
            disabled={!currentImage}
            title="全屏预览"
            style={{ height: 36, padding: '0 12px' }}
          >
            <Icon name="image" size={14} strokeWidth={1.8} />
            全屏
          </button>
        )}
        {viewMode === 'detail' && (
          <>
            <button className="chip hidden shrink-0 md:inline-flex" onClick={handleAddRef} disabled={!currentImage} title="加为参考">
              <Icon name="plus" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">参考</span>
            </button>
            {currentMeta?.prompt && (
              <button className="chip hidden shrink-0 md:inline-flex" onClick={handleRegenerateAction} title="还原参数">
                <Icon name="refresh" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">还原参数</span>
              </button>
            )}
            <button
              className="chip shrink-0 text-sm md:hidden"
              onClick={handleDownload}
              disabled={!currentImage}
              title="下载 PNG"
              style={{ height: 36, padding: '0 12px' }}
            >
              <Icon name="download" size={14} strokeWidth={1.8} /> 下载
            </button>
            <button className="chip hidden shrink-0 md:inline-flex" onClick={handleDownload} disabled={!currentImage} title="下载 PNG">
              <Icon name="download" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">PNG</span>
            </button>
          </>
        )}
        {viewMode === 'detail' && (
          <button
            className="chip shrink-0 hidden md:inline-flex"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? '展开详情面板' : '收起详情面板'}
            aria-pressed={!sidebarCollapsed}
          >
            <Icon name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'} size={12} strokeWidth={1.8} />
            {sidebarCollapsed ? '展开详情' : '收起详情'}
          </button>
        )}
      </div>

      {viewMode === 'gallery' ? (
        <StackGallery
          stack={stack}
          selectedId={selectedItem?.id ?? null}
          onSelect={(item) => {
            setSelection(toSelection(item))
            setRefDetailId(null)
            setViewMode('detail')
          }}
        />
      ) : (
        <>
          <StackStrip
            stack={stack}
            selectedId={selectedItem?.id ?? null}
            onSelect={(item) => {
              setSelection(toSelection(item))
              setRefDetailId(null)
            }}
            onCancelActiveJobs={() => {
              for (const job of stack.jobs) {
                if (job.slots.some((slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying')) {
                  onCancelGenerationJob(job.id)
                }
              }
            }}
          />

          {/* ——— Body ——— */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Canvas with grid background */}
        <div
          className="relative min-h-0 min-w-0 overflow-hidden md:flex-1"
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
            backgroundSize: '28px 28px, 28px 28px',
            backgroundColor: 'var(--color-bg-sunken)',
          }}
        >
          {refDetailId && refDetailSrc && currentImage ? (
            <div className="relative flex flex-row h-full gap-px">
              <div className="h-full flex-1 min-w-0 relative">
                <ZoomableImageView key={refDetailId ?? 'ref'} src={refDetailSrc} alt="" label="左 · 参考图" />
              </div>
              <div className="h-full flex-1 min-w-0 relative">
                <ZoomableImageView
                  key={currentImage.id}
                  src={currentSrc ?? ''}
                  alt={currentMeta?.prompt ?? ''}
                  label="右 · 生成图"
                />
              </div>
              <button
                type="button"
                onClick={() => setRefDetailId(null)}
                className="absolute top-3 right-3 z-30 chip"
                style={{ height: 26 }}
                title="退出对比"
                aria-label="退出对比"
              >
                <Icon name="close" size={12} />
                <span className="hidden sm:inline">退出对比</span>
                <span className="sm:hidden">退出</span>
              </button>
            </div>
          ) : editing && currentImage && (editMode !== 'view' || hasDrawableMarks) && !mobileDrawOpen ? (
            <DrawableLayer
              ref={drawableRef}
              key={`${currentImage.id}:${drawRevision}:${editMode === 'view' ? 'preview' : 'draw'}`}
              imageId={currentImage.id}
              src={currentSrc ?? ''}
              mode={activeDrawMode}
              tool={drawTool}
              brushSize={brushSize}
              visibleModes={['mask', 'annotate']}
              eraseAllModes
              readOnly={editMode === 'view'}
              onItemsChange={setDrawableCounts}
            />
          ) : currentImage ? (
            <ZoomableImageView
              key={currentImage.id}
              src={currentSrc ?? ''}
              alt={currentMeta?.prompt ?? ''}
              onSwipeLeft={hasNext ? goToNext : undefined}
              onSwipeRight={hasPrev ? goToPrev : undefined}
            />
          ) : (
            <SlotHero
              item={selectedItem}
              onCancelSlot={onCancelGenerationSlot}
              onCancelJob={onCancelGenerationJob}
              onDismissJob={onDismissGenerationJob}
            />
          )}

          {!refDetailId && hasPrev && (
            <button
              onClick={goToPrev}
              aria-label="上一张"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
                color: 'var(--color-text-2)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <Icon name="chevron_left" size={14} strokeWidth={1.8} />
            </button>
          )}
          {!refDetailId && hasNext && (
            <button
              onClick={goToNext}
              aria-label="下一张"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
                color: 'var(--color-text-2)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <Icon name="chevron_right" size={14} strokeWidth={1.8} />
            </button>
          )}

          {toast && (
            <div
              className="absolute top-4 left-1/2 z-20 -translate-x-1/2 text-xs font-medium fade-in"
              style={{
                background: 'var(--color-text)',
                color: 'var(--color-bg)',
                padding: '6px 12px',
                borderRadius: 6,
                boxShadow: '0 10px 28px -12px rgba(30,27,20,0.18), 0 2px 6px rgba(30,27,20,0.06)',
              }}
            >
              {toast}
            </div>
          )}
        </div>

        {/* Right metadata panel (mobile: draggable bottom sheet) */}
        <div
          className="w-full overflow-y-auto overflow-x-hidden border-t md:border-t-0 md:border-l border-(--color-border) md:h-auto"
          style={{
            background: 'var(--color-bg)',
            overscrollBehavior: 'contain',
            ...(isMobileSheet
              ? {
                  flexShrink: 0,
                  height: `${sheetHeightPx ?? getMobileSheetHeights(getVisualViewportHeight()).initialHeight}px`,
                  transition: sheetDragging ? 'none' : 'height 260ms cubic-bezier(0.22, 0.8, 0.4, 1)',
                }
              : {
                  flexShrink: 0,
                  width: sidebarCollapsed ? 0 : 340,
                  minWidth: 0,
                  transition: 'width 280ms cubic-bezier(0.22, 0.8, 0.4, 1)',
                }),
          }}
        >
          {/* Mobile drag handle */}
          {isMobileSheet && (
            <div
              className="md:hidden sticky top-0 z-10 flex justify-center items-center h-7 cursor-grab active:cursor-grabbing select-none"
              style={{ background: 'var(--color-bg)', touchAction: 'none' }}
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={handleSheetPointerUp}
              onPointerCancel={handleSheetPointerUp}
            >
              <div className="w-9 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
            </div>
          )}

          <div
            className="px-[18px] pt-1 md:pt-4 pb-24 md:pb-10"
            style={{ width: isMobileSheet ? undefined : 340 }}
          >
            <div
              className="mb-[18px]"
              style={isMobileSheet ? { touchAction: 'none' } : undefined}
              onClick={expandMobileSheet}
              onPointerDown={isMobileSheet ? handleSheetPointerDown : undefined}
              onPointerMove={isMobileSheet ? handleSheetPointerMove : undefined}
              onPointerUp={isMobileSheet ? handleSheetPointerUp : undefined}
              onPointerCancel={isMobileSheet ? handleSheetPointerUp : undefined}
            >
              <div
                className="segmented"
                style={{
                  width: '100%',
                  ['--seg-count' as string]: 2,
                  ['--seg-index' as string]: editing ? 1 : 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    expandMobileSheet()
                    exitEdit()
                  }}
                  data-active={!editing}
                >
                  <span>详情</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    expandMobileSheet()
                    if (currentImage) setEditing(true)
                  }}
                  disabled={!currentImage}
                  data-active={editing}
                >
                  <span>编辑</span>
                </button>
              </div>
            </div>
            {editing && currentImage ? (
              <EditSidebar
                sourceImage={currentImage}
                generationJobs={generationJobs}
                activeEditBatchId={activeEditBatchId}
                onEditImage={onEditImage}
                onSetActiveBatchId={setActiveEditBatch}
                onCancelGenerationJob={onCancelGenerationJob}
                onDismissGenerationJob={onDismissGenerationJob}
                onCancelGenerationSlot={onCancelGenerationSlot}
                onAddToRef={onAddToRef}
                onRegenerate={onRegenerate}
                onRemove={onRemove}
                onOpenImage={(img) => {
                  const item = stack.items.find((candidate) => candidate.type === 'image' && candidate.image.id === img.id)
                  setSelection(toSelection(item ?? null))
                  setRefDetailId(null)
                }}
                onViewQueue={onClose}
                annotationActive={editMode !== 'view'}
                hasAnnotations={hasDrawableMarks}
                drawableCounts={drawableCounts}
                drawableRef={drawableRef}
                drawTool={drawTool}
                brushPreset={brushPreset}
                onStartAnnotation={startAnnotation}
                onFinishAnnotation={finishAnnotation}
                onClearAnnotations={clearAnnotations}
                onChangeDrawTool={setDrawTool}
                onChangeBrushPreset={setBrushPreset}
              />
            ) : (
              <>
                {currentImage && (
                  <div className="mb-[18px] grid grid-cols-2 gap-1.5 md:hidden">
                    <button type="button" className="chip justify-center" onClick={handleAddRef} disabled={!currentImage}>
                      <Icon name="plus" size={12} strokeWidth={1.8} />
                      +参考
                    </button>
                    <button
                      type="button"
                      className="chip justify-center"
                      onClick={handleRegenerateAction}
                      disabled={!currentMeta?.prompt}
                    >
                      <Icon name="refresh" size={12} strokeWidth={1.8} />
                      还原参数
                    </button>
                  </div>
                )}

                {/* Prompt */}
                {currentMeta?.prompt && (
                  <div className="mb-[18px]">
                    <div className="flex items-center mb-1.5">
                      <span className="label">提示词</span>
                      <div className="flex-1" />
                      <button className="chip shrink-0 text-xs" style={{ height: 26 }} onClick={handleCopyPrompt}>
                        {/* Safari (WebKit) ignores flex layout on <button> itself;
                      nesting the flex container in a <span> works around it. */}
                        <span className="inline-flex items-center gap-1.5">
                          <Icon
                            name={copiedPrompt ? 'check' : 'copy'}
                            size={12}
                            strokeWidth={copiedPrompt ? 2.2 : 1.8}
                          />
                          {copiedPrompt ? '已复制' : '复制'}
                        </span>
                      </button>
                    </div>
                    <div
                      className="rounded-[8px] p-3 text-sm leading-[1.6] text-(--color-text-2)"
                      style={{
                        background: 'var(--color-surface)',
                        boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {renderPromptLines(currentMeta.prompt)}
                    </div>
                  </div>
                )}

                {/* Reference images */}
                {currentMeta && currentMeta.referenceImageIds.length > 0 && (
                  <div className="mb-[18px]">
                    <div className="flex items-center mb-1.5">
                      <span className="label">参考图</span>
                      <span className="ml-1.5 text-xs text-(--color-text-4)">
                        {currentMeta.referenceImageIds.length} 张
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {currentMeta.referenceImageIds.map((refId) => {
                        const refImg = findRefImage(refId)
                        if (!refImg)
                          return (
                            <div
                              key={refId}
                              className="aspect-square rounded-[6px] flex items-center justify-center text-(--color-text-4)"
                              style={{
                                boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
                                background: 'var(--color-surface-2)',
                              }}
                            >
                              ?
                            </div>
                          )
                        return (
                          <RefThumbnail
                            key={refId}
                            image={refImg}
                            isActive={refDetailId === refImg.id}
                            onClick={() => setRefDetailId((prev) => (prev === refImg.id ? null : refImg.id))}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="mb-[18px]">
                  <div className="label mb-1">元数据</div>
                  {currentMeta && (
                    <>
                      <MetaRow label="模型" value={modelName!} />
                      {modelApiId && <MetaRow label="模型 ID" value={modelApiId} mono />}
                      <MetaRow label="分辨率" value={currentMeta.resolution} mono />
                      <MetaRow label="宽高比" value={currentMeta.aspectRatio} mono />
                      {(() => {
                        const bag = effectiveOptions(currentMeta)
                        // Render rows in the order the active model declares options, then any
                        // legacy keys that don't appear in the current descriptors.
                        const declaredIds = modelConfig?.options?.map((o) => o.id) ?? []
                        const leftover = Object.keys(bag).filter((id) => !declaredIds.includes(id))
                        const ordered = [...declaredIds, ...leftover]
                        return ordered.map((id) => {
                          const formatted = formatOptionValue(modelConfig, id, bag[id])
                          if (formatted === null) return null
                          return <MetaRow key={id} label={optionLabel(modelConfig, id)} value={formatted} />
                        })
                      })()}
                      {actualCost !== null && (
                        <MetaRow label="费用" value={<span>${actualCost.toFixed(4)}</span>} mono />
                      )}
                      {currentMeta.tokenUsage && modelConfig?.provider === 'openai' && (
                        <>
                          <MetaRow
                            label="文本输入 Token"
                            value={
                              currentMeta.tokenUsage.inputTextTokens?.toLocaleString() ??
                              currentMeta.tokenUsage.inputTokens.toLocaleString()
                            }
                            mono
                          />
                          {(currentMeta.tokenUsage.inputImageTokens ?? 0) > 0 && (
                            <MetaRow
                              label="图片输入 Token"
                              value={(currentMeta.tokenUsage.inputImageTokens ?? 0).toLocaleString()}
                              mono
                            />
                          )}
                          <MetaRow
                            label="图片输出 Token"
                            value={currentMeta.tokenUsage.imageOutputTokens.toLocaleString()}
                            mono
                          />
                          {currentMeta.tokenUsage.textOutputTokens > 0 && (
                            <MetaRow
                              label="文本输出 Token"
                              value={currentMeta.tokenUsage.textOutputTokens.toLocaleString()}
                              mono
                            />
                          )}
                        </>
                      )}
                      {currentMeta.tokenUsage && modelConfig?.provider === 'google' && (
                        <>
                          <MetaRow
                            label="输入 Token"
                            value={currentMeta.tokenUsage.inputTokens.toLocaleString()}
                            mono
                          />
                          <MetaRow
                            label="图片 Token"
                            value={currentMeta.tokenUsage.imageOutputTokens.toLocaleString()}
                            mono
                          />
                          {currentMeta.tokenUsage.textOutputTokens > 0 && (
                            <MetaRow
                              label="思考 Token"
                              value={currentMeta.tokenUsage.textOutputTokens.toLocaleString()}
                              mono
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                  {currentImage?.source.type === 'upload' && (
                    <MetaRow label="来源" value={`上传: ${currentImage.source.fileName}`} />
                  )}
                  {currentImage ? (
                    <MetaRow
                      label="创建时间"
                      value={new Date(currentImage.timestamp).toLocaleString('zh-CN', { hour12: false })}
                      mono
                    />
                  ) : (
                    <MetaRow label="状态" value={currentSlot?.status === 'failed' ? '生成失败' : '等待生成'} />
                  )}
                  {currentMeta && stackInfo && (
                    <MetaRow
                      label="Stack"
                      value={
                        <span>
                          <span className="mono">s_{stack.id.slice(0, 6)}</span>
                          <span className="mono text-(--color-text-4) ml-1.5">
                            #{stackInfo.pos}/{stackInfo.total}
                          </span>
                        </span>
                      }
                      last
                    />
                  )}
                </div>

                {/* Grounding sources (Google Search / Image Search) */}
                {currentMeta?.groundingMetadata && <GroundingSection metadata={currentMeta.groundingMetadata} />}

                {/* Danger delete */}
                {currentImage && canNavigate && (
                  <button
                    className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                    style={{
                      height: 30,
                      borderRadius: 6,
                      boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-danger)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        'color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))'
                      e.currentTarget.style.boxShadow =
                        'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 30%, transparent)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface)'
                      e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge)'
                    }}
                    onClick={() => {
                      onRemove(currentImage.id)
                      onClose()
                    }}
                  >
                    <Icon name="trash" size={12} strokeWidth={1.8} /> 从历史中删除
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ——— Footer shortcuts ——— */}
      <div
        className="hidden shrink-0 items-center gap-3.5 px-3.5 text-xs text-(--color-text-4) md:flex"
        style={{
          height: 30,
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-sunken)',
        }}
      >
        {!editing && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <kbd>←</kbd>
              <kbd>→</kbd> 切换
            </span>
            <span className="inline-flex items-center gap-1.5">滚轮 缩放</span>
            <span className="inline-flex items-center gap-1.5">
              <kbd>0</kbd> / 双击 重置
            </span>
          </>
        )}
        {editing && (
          <span className="inline-flex items-center gap-1.5">
            <kbd>⌘</kbd>
            <kbd>Z</kbd> 撤销
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <kbd>Esc</kbd> 关闭
        </span>
        <div className="flex-1" />
        <span className="mono">#{(currentImage?.id ?? selectedItem?.id ?? stack.id).slice(0, 8)}</span>
      </div>
      {editing && mobileDrawOpen && currentImage && (
        <MobileDrawFullscreen
          imageId={currentImage.id}
          src={currentSrc ?? ''}
          mode={activeDrawMode}
          tool={drawTool}
          brushPreset={brushPreset}
          brushSize={brushSize}
          counts={drawableCounts}
          drawableRef={drawableRef}
          onChangeTool={setDrawTool}
          onChangeBrushPreset={setBrushPreset}
          onItemsChange={setDrawableCounts}
          onUndo={() => drawableRef.current?.undo()}
          onClear={clearAnnotations}
          onClose={finishAnnotation}
        />
      )}
      {mobilePreviewOpen && currentImage && (
        <MobilePreviewFullscreen
          src={currentSrc ?? ''}
          alt={currentMeta?.prompt ?? ''}
          onClose={() => setMobilePreviewOpen(false)}
          onSwipeLeft={hasNext ? goToNext : undefined}
          onSwipeRight={hasPrev ? goToPrev : undefined}
        />
      )}
        </>
      )}
    </div>,
    document.body,
  )
}

// Render Google Search grounding attribution. Required when image_search is
// enabled per the API usage terms (direct, single-click link back to each
// source landing page, plus the provided `searchEntryPoint` HTML chip).
function GroundingSection({ metadata }: { metadata: GroundingMetadata }) {
  const chunks = metadata.groundingChunks ?? []
  const sources: Array<{ uri: string; title: string; isImage: boolean }> = []
  for (const chunk of chunks) {
    const web = chunk.web
    const image = chunk.image
    const uri = web?.uri ?? image?.uri
    if (!uri) continue
    sources.push({
      uri,
      title: web?.title ?? image?.title ?? uri,
      isImage: !web && !!image,
    })
  }
  const queries = [...(metadata.webSearchQueries ?? []), ...(metadata.imageSearchQueries ?? [])]
  if (!metadata.searchEntryPoint?.renderedContent && sources.length === 0 && queries.length === 0) {
    return null
  }
  return (
    <div className="mb-[18px]">
      <div className="label mb-1">搜索来源</div>
      {metadata.searchEntryPoint?.renderedContent && (
        <div
          className="mb-2"
          // Google returns styled HTML for the search suggestion chip; must be
          // rendered as-is per their display requirements.
          dangerouslySetInnerHTML={{ __html: metadata.searchEntryPoint.renderedContent }}
        />
      )}
      {sources.length > 0 && (
        <ul className="list-none p-0 m-0 space-y-1">
          {sources.map((s, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5 text-xs">
              <Icon name={s.isImage ? 'image' : 'search'} size={11} />
              <a
                href={s.uri}
                target="_blank"
                rel="noreferrer"
                className="truncate text-(--color-accent) hover:underline"
                title={s.uri}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {queries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {queries.map((q, i) => (
            <span key={i} className="tag text-xs">
              {q}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Rotating example prompts for the edit textarea.
const EDIT_PROMPT_EXAMPLES = [
  '把背景换成日落海边',
  '将外套改成米色风衣',
  '去掉桌上的杯子',
  '整体色调调成复古胶片感',
  '人物改成侧面视角',
]

type EditSidebarProps = {
  sourceImage: PlaygroundImageMeta
  generationJobs: GenerationJob[]
  activeEditBatchId: string | null
  onEditImage: Props['onEditImage']
  onSetActiveBatchId: (id: string | null, sourceImageId?: string) => void
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onRemove: (id: string) => void
  onOpenImage: (image: PlaygroundImageMeta) => void
  onViewQueue: () => void
  annotationActive: boolean
  hasAnnotations: boolean
  drawableCounts: ItemCounts
  drawableRef: React.RefObject<DrawableLayerHandle | null>
  drawTool: DrawTool
  brushPreset: BrushPresetId
  onStartAnnotation: () => void
  onFinishAnnotation: () => void
  onClearAnnotations: () => void
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
}

function EditSidebar({
  sourceImage,
  generationJobs,
  activeEditBatchId,
  onEditImage,
  onSetActiveBatchId,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onAddToRef,
  onRegenerate,
  onRemove,
  onOpenImage,
  onViewQueue,
  annotationActive,
  hasAnnotations,
  drawableCounts,
  drawableRef,
  drawTool,
  brushPreset,
  onStartAnnotation,
  onFinishAnnotation,
  onClearAnnotations,
  onChangeDrawTool,
  onChangeBrushPreset,
}: EditSidebarProps) {
  // Resolve the model / resolution / aspect ratio / options that generated the
  // source. For uploads, fall back to the default model's defaults.
  const sourceModel = useMemo(() => {
    const src = sourceImage.source
    if (src.type !== 'generated') return DEFAULT_MODEL
    return MODEL_CONFIGS.find((m) => m.id === src.modelId) ?? DEFAULT_MODEL
  }, [sourceImage])

  const sourceRes =
    sourceImage.source.type === 'generated' ? sourceImage.source.resolution : sourceModel.defaultResolution
  const sourceAspect =
    sourceImage.source.type === 'generated' ? sourceImage.source.aspectRatio : sourceModel.defaultAspectRatio

  const [resolution, setResolution] = useState(() =>
    sourceModel.resolutions.includes(sourceRes) ? sourceRes : sourceModel.defaultResolution,
  )
  const [aspectRatio, setAspectRatio] = useState(() =>
    sourceModel.aspectRatios.includes(sourceAspect) ? sourceAspect : sourceModel.defaultAspectRatio,
  )
  const [batchCount, setBatchCount] = useState(1)
  // Prompt text is cached per source image so users who close the modal
  // mid-edit (or switch between images via the pager) don't lose what they
  // were writing.
  const [prompt, setPrompt] = useState(() => getEditState(sourceImage.id).prompt)
  const [extraRefs, setExtraRefs] = useState<PlaygroundImage[]>([])
  const [refsError, setRefsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Editing rarely needs resolution / aspect changes, so collapse by default.
  const [paramsCollapsed, setParamsCollapsed] = useState(true)

  // Sync non-prompt params when the source image changes (pager nav or auto-
  // nav after a successful edit). Prompt is also restored from this image's
  // cache entry so per-image drafts survive pager navigation; extra refs
  // intentionally do not.
  const sourceIdRef = useRef(sourceImage.id)
  useEffect(() => {
    if (sourceIdRef.current === sourceImage.id) return
    sourceIdRef.current = sourceImage.id
    setResolution(sourceModel.resolutions.includes(sourceRes) ? sourceRes : sourceModel.defaultResolution)
    setAspectRatio(sourceModel.aspectRatios.includes(sourceAspect) ? sourceAspect : sourceModel.defaultAspectRatio)
    setPrompt(getEditState(sourceImage.id).prompt)
  }, [sourceImage.id, sourceModel, sourceRes, sourceAspect])

  // Write-through the prompt back to the cache so it survives remounts of
  // this sidebar (closing the modal or switching to another image and back).
  useEffect(() => {
    setEditPrompt(sourceImage.id, prompt)
  }, [sourceImage.id, prompt])

  // Pick a stable placeholder example per source image.
  const placeholder = useMemo(() => {
    const hash = Array.from(sourceImage.id).reduce((a, c) => (a + c.charCodeAt(0)) | 0, 0)
    return `例：${EDIT_PROMPT_EXAMPLES[Math.abs(hash) % EDIT_PROMPT_EXAMPLES.length]}`
  }, [sourceImage.id])

  const hasAnnotationStrokes = drawableCounts.annotate > 0
  const hasMaskStrokes = drawableCounts.mask > 0
  const isOpenAI = sourceModel.provider === 'openai'
  const hasOpenAIMask = hasMaskStrokes && isOpenAI
  const hasAnnotatedSource = hasAnnotationStrokes || hasMaskStrokes
  const maxReferenceImages = sourceModel.maxReferenceImages + sourceModel.maxCharacterImages
  const maxExtraRefs = Math.max(0, maxReferenceImages - 1 - (hasAnnotatedSource ? 1 : 0))
  const referenceLimitExceeded = extraRefs.length > maxExtraRefs
  const effectiveRefsError = referenceLimitExceeded
    ? '当前标注会占用一个参考图名额，请移除一张参考图后再提交'
    : refsError

  const handleAddFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const remaining = maxExtraRefs - extraRefs.length
      if (remaining <= 0) return
      const results = await Promise.allSettled(
        files.slice(0, remaining).map(async (file) => {
          const result = await readFileAsImageData(file)
          if (!result) return null
          const { base64, mimeType, fileName } = result
          return {
            id: crypto.randomUUID(),
            data: base64,
            mimeType,
            source: { type: 'upload' as const, fileName },
            timestamp: Date.now(),
          } as PlaygroundImage
        }),
      )
      const added: PlaygroundImage[] = []
      const errors: string[] = []
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) added.push(r.value)
        else if (r.status === 'rejected') errors.push((r.reason as Error).message)
      }
      if (added.length > 0) setExtraRefs((prev) => [...prev, ...added].slice(0, maxExtraRefs))
      if (errors.length > 0) setRefsError(errors.join('\n'))
    },
    [extraRefs.length, maxExtraRefs],
  )

  const removeExtraRef = useCallback((id: string) => {
    setExtraRefs((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearExtraRefs = useCallback(() => {
    setExtraRefs([])
    setRefsError(null)
  }, [])

  const activeJob = useMemo(() => {
    if (!activeEditBatchId) return null
    return generationJobs.find((j) => j.id === activeEditBatchId) ?? null
  }, [activeEditBatchId, generationJobs])

  // Clear activeEditBatchId when the job it points to is fully terminal, or
  // when it has dropped off the active jobs list (e.g. pruned after completion).
  useEffect(() => {
    if (!activeEditBatchId) return
    if (!activeJob) {
      onSetActiveBatchId(null)
      return
    }
    const anyActive = activeJob.slots.some(
      (s) => s.status === 'queued' || s.status === 'running' || s.status === 'retrying',
    )
    if (!anyActive) onSetActiveBatchId(null)
  }, [activeJob, activeEditBatchId, onSetActiveBatchId])

  // Inherit the source's declared options into the new job. We intentionally
  // don't surface them as editable fields in v1 — they stay silent.
  const inheritedOptions = useMemo(() => {
    const bag = defaultOptionsFor(sourceModel)
    if (sourceImage.source.type === 'generated') {
      const src = sourceImage.source
      if (src.options) Object.assign(bag, src.options)
      if (src.quality !== undefined && bag.quality === undefined) bag.quality = src.quality
      if (src.searchTools?.web && bag.webSearch === undefined) bag.webSearch = true
      if (src.searchTools?.image && bag.imageSearch === undefined) bag.imageSearch = true
    }
    return bag
  }, [sourceImage, sourceModel])

  const pricePerImage = getPricePerImage(sourceModel, resolution, aspectRatio, inheritedOptions)
  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null

  // Allow submitting a new edit even while a previous batch is still running.
  // The new batchId overrides activeEditBatchId, replacing what the embedded
  // QueueJobSection tracks; previous jobs keep running in their stack strip.
  const canSubmit = prompt.trim() !== '' && !submitting && !referenceLimitExceeded

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Bake all visible marks into a reference image. If there are mask
      // strokes and the provider supports native masks, also export the alpha
      // mask so the API gets both a precise edit region and visual guidance.
      let annotatedSource: PlaygroundImage | undefined
      let mask: PlaygroundImage | undefined
      const drawable = drawableRef.current
      const needsDrawableExport = hasAnnotationStrokes || hasMaskStrokes
      if (needsDrawableExport && (!drawable || !drawable.isReady())) {
        setSubmitError('图片仍在加载，请稍后再提交')
        return
      }
      if (drawable && needsDrawableExport) {
        const out = await drawable.exportMarkedComposite()
        if (!out) {
          setSubmitError('标注导出失败，请稍后再试')
          return
        }
        annotatedSource = {
          id: crypto.randomUUID(),
          data: out.base64,
          mimeType: out.mimeType,
          source: { type: 'upload', fileName: 'annotated.png' },
          timestamp: Date.now(),
        }
      }
      if (drawable && hasOpenAIMask) {
        if (sourceModel.provider === 'openai') {
          const out = await drawable.exportMaskAlpha()
          if (!out) {
            setSubmitError('Mask 导出失败，请稍后再试')
            return
          }
          mask = {
            id: crypto.randomUUID(),
            data: out.base64,
            mimeType: out.mimeType,
            source: { type: 'upload', fileName: 'mask.png' },
            timestamp: Date.now(),
          }
        }
      }

      const batchId = await onEditImage({
        sourceImage,
        model: sourceModel,
        prompt,
        extraReferences: extraRefs,
        resolution,
        aspectRatio,
        options: inheritedOptions,
        batchCount,
        annotatedSource,
        mask,
      })
      if (batchId) {
        onSetActiveBatchId(batchId, sourceImage.id)
        setPrompt('')
        // Intentionally do NOT clear strokes here — the user usually iterates
        // on the same annotations across multiple generations.
      }
    } finally {
      setSubmitting(false)
    }
  }, [
    canSubmit,
    onEditImage,
    sourceImage,
    sourceModel,
    prompt,
    extraRefs,
    resolution,
    aspectRatio,
    inheritedOptions,
    batchCount,
    onSetActiveBatchId,
    drawableRef,
    drawableCounts,
    hasAnnotationStrokes,
    hasMaskStrokes,
    hasOpenAIMask,
  ])

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight + 2, 96)}px`
  }, [prompt])

  // Cmd+Enter to submit when focused inside the edit panel.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault()
        if (canSubmit) handleGenerate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canSubmit, handleGenerate])

  // Count what actually ships to the provider. With annotations we send BOTH
  // the annotated composite and the clean source, so the model has the
  // unobscured pixels available for regions outside the user's marks.
  const lockedReferenceImages: LockedReferenceImage[] = [{ id: `${sourceImage.id}:source`, image: sourceImage, label: '原图' }]
  if (hasAnnotatedSource) lockedReferenceImages.push({ id: `${sourceImage.id}:annotate`, image: sourceImage, label: '标注' })
  if (hasOpenAIMask) lockedReferenceImages.push({ id: `${sourceImage.id}:mask`, image: sourceImage, label: 'Mask' })

  return (
    <div>
      {/* Active edit job (embedded copy of the queue card). Sticky at the top
          so the user can scroll the edit form below while keeping progress,
          slot thumbnails, and cancel within reach. */}
      {activeJob && (
        <div
          className="sticky top-0 z-20 -mx-[18px] mb-[18px] px-[18px] pt-2 pb-3"
          style={{
            background: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <QueueJobSection
            job={activeJob}
            onCancelJob={onCancelGenerationJob}
            onDismissJob={onDismissGenerationJob}
            onCancelSlot={onCancelGenerationSlot}
            onAddToRef={onAddToRef}
            onRegenerate={onRegenerate}
            onRemove={onRemove}
            onOpen={onOpenImage}
            maxRowHeight={110}
          />
          <button
            type="button"
            onClick={onViewQueue}
            className="chip ghost mt-2 w-full justify-center text-xs"
            style={{ height: 26 }}
          >
            查看全部队列 <Icon name="chevron_right" size={11} />
          </button>
        </div>
      )}

      {/* Resolution + aspect ratio (collapsed by default — rarely adjusted
          while editing). The grid-template-rows 0fr→1fr animation is paint-
          only: no layout recalc on the inner chips/grid during the
          transition, so even the AspectRatioSelector grid doesn't re-layout. */}
      <div className="mb-[18px]">
        <button
          type="button"
          onClick={() => setParamsCollapsed((v) => !v)}
          aria-expanded={!paramsCollapsed}
          className="flex items-center w-full bg-transparent border-0 p-0 cursor-pointer min-h-[20px]"
        >
          <span className="label">分辨率 · 宽高比</span>
          <span className="flex-1" />
          <span className="mono mr-1.5 text-xs text-(--color-text-3)">
            {resolution} · {aspectRatio}
          </span>
          <Icon name={paramsCollapsed ? 'chevron_right' : 'chevron_down'} size={12} className="text-(--color-text-4)" />
        </button>
        <div
          className="grid"
          style={{
            gridTemplateRows: paramsCollapsed ? '0fr' : '1fr',
            transition: 'grid-template-rows 260ms cubic-bezier(0.22, 0.8, 0.4, 1)',
          }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="pt-2.5">
              <div className="mb-[14px]">
                <ChipGroup
                  options={sourceModel.resolutions}
                  value={resolution}
                  onChange={setResolution}
                  mono={false}
                  columns={sourceModel.resolutions.length}
                />
              </div>
              <AspectRatioSelector
                options={sourceModel.aspectRatios}
                value={aspectRatio}
                resolution={resolution}
                onChange={setAspectRatio}
                showLabel={false}
                pixelLabel={
                  sourceModel.provider === 'openai'
                    ? (ratio, res) => openAISize(res, ratio).replace('x', '×')
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="mb-[18px]">
        <div className="label mb-1.5">编辑指令</div>
        <div className="prompt-wrap">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={1}
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-base leading-[1.55] focus:outline-none md:text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2 border-t border-(--color-border) px-2.5 py-1.5 text-xs text-(--color-text-3)">
            <span className="mono text-xs text-(--color-text-4)">{prompt.length} 字</span>
            <div className="flex-1" />
            {prompt.length > 0 && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
              >
                <Icon name="close" size={11} /> 清空
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-[18px]">
        <div className="label mb-1.5">标注</div>
        <div className="flex items-center gap-2">
          <button type="button" className="chip flex-1 justify-center" onClick={annotationActive ? onFinishAnnotation : onStartAnnotation}>
            <Icon name={annotationActive ? 'check' : 'brush'} size={13} strokeWidth={1.8} />
            {annotationActive ? '完成标注' : '标注'}
          </button>
          {hasAnnotations && (
            <button type="button" className="chip ghost shrink-0" onClick={onClearAnnotations}>
              清空标注
            </button>
          )}
        </div>
        {annotationActive && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[
                { id: 'brush' as const, label: '涂抹', icon: 'brush' as const },
                { id: 'step' as const, label: '编号', icon: 'map_pin' as const },
                { id: 'eraser' as const, label: '橡皮', icon: 'eraser' as const },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip shrink-0"
                  data-active={drawTool === item.id}
                  onClick={() => onChangeDrawTool(item.id)}
                >
                  <Icon name={item.icon} size={13} strokeWidth={1.8} />
                  {item.label}
                </button>
              ))}
            </div>
            {drawTool !== 'eraser' && (
              <div className="grid grid-cols-3 gap-1.5">
                {BRUSH_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chip justify-center"
                    data-active={brushPreset === item.id}
                    onClick={() => onChangeBrushPreset(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extra references */}
      <div className="mb-[18px]">
        <ReferenceImageUpload
          images={extraRefs}
          lockedImages={lockedReferenceImages}
          maxTotal={maxExtraRefs}
          dragOver={false}
          error={effectiveRefsError}
          onAdd={handleAddFiles}
          onRemove={removeExtraRef}
          onClearAll={clearExtraRefs}
          onClearError={() => setRefsError(null)}
        />
      </div>

      {/* Batch count */}
      <div className="mb-[18px]">
        <div className="label mb-1.5">数量</div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sourceModel.maxBatchCount}, 1fr)` }}>
          {Array.from({ length: sourceModel.maxBatchCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="chip justify-center"
              data-active={batchCount === n}
              onClick={() => setBatchCount(n)}
            >
              <span className="mono">×{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary + CTA */}
      <div className="pt-2.5 border-t border-dashed border-(--color-border)">
        {estimatedCost !== null && <div className="mono mb-2 text-right text-xs text-(--color-text-2)">≈ ${estimatedCost.toFixed(3)}</div>}
        {submitError && <div className="mb-2 text-xs text-(--color-danger)">{submitError}</div>}
        <button type="button" onClick={handleGenerate} disabled={!canSubmit} className="cta w-full">
          <Icon name="wand" size={13} strokeWidth={1.8} />
          <span>{submitting ? '提交中…' : `生成编辑 ×${batchCount}`}</span>
          <span className="flex-1" />
          <span className="flex gap-0.5">
            <kbd>⌘</kbd>
            <kbd>⏎</kbd>
          </span>
        </button>
      </div>
    </div>
  )
}

function RefThumbnail({
  image,
  isActive,
  onClick,
}: {
  image: PlaygroundImageMeta
  isActive: boolean
  onClick: () => void
}) {
  const { ref, src } = useImageSrc(image.id, image.mimeType, undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      onClick={onClick}
      className="aspect-square rounded-[6px] overflow-hidden cursor-pointer transition-colors"
      style={{
        boxShadow: isActive ? 'inset 0 0 0 1px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge)',
        background: 'var(--color-surface-2)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge-strong)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge)'
      }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full skeleton-animated" />
      )}
    </div>
  )
}

function MobileDrawFullscreen({
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
  const pinchStartRef = useRef<{ center: Point; distance: number; scale: number; offset: Point } | null>(null)
  const scaleRef = useRef(FIT_SCALE)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const fitSizeRef = useRef<Size>({ width: 0, height: 0 })

  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 })
  const [scale, setScale] = useState(FIT_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })

  const layerHasItems = counts.mask > 0 || counts.annotate > 0
  const toolOptions: Array<{ id: DrawTool; label: string; icon: IconName }> = [
    { id: 'brush', label: '涂抹', icon: 'brush' },
    { id: 'step', label: '编号', icon: 'map_pin' },
    { id: 'eraser', label: '橡皮', icon: 'eraser' },
  ]

  const applyView = useCallback((nextScale: number, nextOffset: Point) => {
    const clampedScale = clamp(nextScale, FIT_SCALE, MAX_SCALE)
    const viewport = viewportSize.width ? viewportSize : getViewportSize(viewportRef.current)
    const clampedOffset = clampOffset(nextOffset, clampedScale, viewport, fitSizeRef.current)
    scaleRef.current = clampedScale
    offsetRef.current = clampedOffset
    setScale(clampedScale)
    setOffset(clampedOffset)
  }, [viewportSize])

  const resetView = useCallback(() => {
    activePointersRef.current.clear()
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

  const startViewGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const point = getRelativePoint(viewportRef.current, event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointersRef.current.set(event.pointerId, point)
    if (activePointersRef.current.size === 2) {
      const [first, second] = Array.from(activePointersRef.current.values())
      pinchStartRef.current = {
        center: getCenter(first, second),
        distance: Math.max(getDistance(first, second), 1),
        scale: scaleRef.current,
        offset: offsetRef.current,
      }
    }
  }

  const moveViewGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return
    const point = getRelativePoint(viewportRef.current, event.clientX, event.clientY)
    activePointersRef.current.set(event.pointerId, point)
    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const [first, second] = Array.from(activePointersRef.current.values())
      const start = pinchStartRef.current
      const nextScale = clamp(start.scale * (Math.max(getDistance(first, second), 1) / start.distance), FIT_SCALE, MAX_SCALE)
      const center = getCenter(first, second)
      const ratio = nextScale / start.scale
      applyView(nextScale, {
        x: center.x - ratio * (start.center.x - start.offset.x),
        y: center.y - ratio * (start.center.y - start.offset.y),
      })
      return
    }
  }

  const endViewGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)
    if (activePointersRef.current.size < 2) pinchStartRef.current = null
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
          <div className="text-xs text-(--color-text-4)">涂抹编辑区域，或用编号补充说明</div>
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
          onItemsChange={onItemsChange}
        />

        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[8px] p-1"
          style={{ background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)', boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)', backdropFilter: 'blur(10px)' }}
        >
          <button type="button" className="icon-btn pointer-events-auto" onClick={() => zoomCenter(0.8)} title="缩小" style={{ width: 28, height: 26 }}>
            <Icon name="zoom_out_map" size={12} strokeWidth={1.8} />
          </button>
          <button type="button" className="mono pointer-events-auto px-2 text-xs font-medium text-(--color-text-2)" onClick={resetView} title="重置">
            {Math.round(scale * 100)}%
          </button>
          <button type="button" className="icon-btn pointer-events-auto" onClick={() => zoomCenter(1.25)} title="放大" style={{ width: 28, height: 26 }}>
            <Icon name="zoom_in" size={12} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-(--color-border) px-3 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {toolOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTool(item.id)}
                className="chip shrink-0 text-sm"
                data-active={tool === item.id}
                style={{ height: 36 }}
              >
                <Icon name={item.icon} size={14} strokeWidth={1.8} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {tool !== 'eraser' &&
              BRUSH_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeBrushPreset(item.id)}
                  className="chip shrink-0 text-sm"
                  data-active={brushPreset === item.id}
                  style={{ height: 36 }}
                >
                  {item.label}
                </button>
              ))}
            <div className="flex-1" />
            <button type="button" className="chip shrink-0 text-sm" onClick={onUndo} disabled={!layerHasItems} style={{ height: 36 }}>
              <Icon name="undo" size={14} strokeWidth={1.8} />
              撤销
            </button>
            <button type="button" className="chip ghost shrink-0 text-sm" onClick={onClear} disabled={!layerHasItems} style={{ height: 36 }}>
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobilePreviewFullscreen({
  src,
  alt,
  onClose,
  onSwipeLeft,
  onSwipeRight,
}: {
  src: string
  alt: string
  onClose: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-(--color-bg)">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-(--color-border) px-3">
        <button type="button" className="icon-btn" onClick={onClose} title="退出全屏预览">
          <Icon name="chevron_left" size={15} strokeWidth={1.8} />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-(--color-text)">全屏预览</div>
        <button type="button" className="chip text-xs" onClick={onClose} style={{ height: 28 }}>
          退出
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {src ? (
          <ZoomableImageView src={src} alt={alt} onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="spinner" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ========================================================================
   ZoomableImageView — wheel/drag/pinch zoom, with Linear-style Zoom HUD
   ======================================================================== */

function ZoomableImageView({
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
          className="mono text-xs font-medium"
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function getCenter(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
function getViewportSize(element: HTMLDivElement | null): Size {
  if (!element) return { width: 0, height: 0 }
  return { width: element.clientWidth, height: element.clientHeight }
}
function getContainedSize(viewport: Size, naturalSize: Size): Size {
  if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) return { width: 0, height: 0 }
  const ratio = Math.min(viewport.width / naturalSize.width, viewport.height / naturalSize.height)
  return { width: naturalSize.width * ratio, height: naturalSize.height * ratio }
}
function clampOffset(offset: Point, scale: number, viewport: Size, fitSize: Size): Point {
  if (!viewport.width || !viewport.height || !fitSize.width || !fitSize.height || scale <= FIT_SCALE)
    return { x: 0, y: 0 }
  const maxX = Math.max(0, (fitSize.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (fitSize.height * scale - viewport.height) / 2)
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) }
}
function getRelativePoint(element: HTMLDivElement | null, clientX: number, clientY: number): Point {
  if (!element) return { x: 0, y: 0 }
  const rect = element.getBoundingClientRect()
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
}
