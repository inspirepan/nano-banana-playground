import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon'
import { MODEL_CONFIGS } from '../config/models'
import { ensureBlobLoaded, useImageSrc } from '../hooks/useImageSrc'
import type { GenerationJob } from '../hooks/usePlayground'
import { imageDownloadFileName } from '../lib/downloadFileName'
import { computeItemCounts, copyEditState, getEditState, setEditItems, type ItemCounts } from '../lib/editStateCache'
import { loadImageMetas } from '../lib/history'
import { getActualCost } from '../lib/pricing'
import type { ImageStack, StackItem } from '../lib/stacks'
import type { PlaygroundImageMeta } from '../lib/types'
import { DesktopAnnotationToolbar } from './image-detail/annotationControls'
import { BRUSH_PRESETS, type BrushPresetId } from './image-detail/annotationPresets'
import { DetailSidebar } from './image-detail/DetailSidebar'
import { DrawableLayer, type DrawableLayerHandle, type DrawMode, type DrawTool } from './image-detail/DrawableLayer'
import { EditSidebar, type EditImageHandler } from './image-detail/EditSidebar'
import { MobileDrawFullscreen } from './image-detail/MobileDrawFullscreen'
import { MobilePreviewFullscreen } from './image-detail/MobilePreviewFullscreen'
import { SlotHero, StackGallery, StackStrip } from './image-detail/StackViews'
import { ZoomableImageView } from './image-detail/ZoomableImageView'

type EditMode = 'view' | DrawMode
type ModalViewMode = 'detail' | 'gallery'
type GalleryMode = 'view' | 'manage'
type GalleryReturnTarget = 'output' | 'detail'

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
  onEditImage: EditImageHandler
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRemove: (id: string) => void | Promise<void>
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
  const currentJob = selectedItem?.type === 'slot' ? selectedItem.job : null
  const [editing, setEditing] = useState(initialEditing)
  const [mobileDrawOpen, setMobileDrawOpen] = useState(false)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ModalViewMode>(initialViewMode)
  const [galleryInitialMode, setGalleryInitialMode] = useState<GalleryMode>('view')
  const [galleryReturnTarget, setGalleryReturnTarget] = useState<GalleryReturnTarget>(() =>
    initialViewMode === 'gallery' ? 'output' : 'detail',
  )

  useEffect(() => {
    if (viewMode === 'detail' && galleryReturnTarget !== 'detail') setGalleryReturnTarget('detail')
  }, [galleryReturnTarget, viewMode])
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
  const [desktopMoveActive, setDesktopMoveActive] = useState(false)
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
  const [displayImage, setDisplayImage] = useState<{ id: string; src: string; alt: string } | null>(null)
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
    void loadImageMetas(missingRefIds)
      .then(setDbRefMetas)
      .catch(() => setDbRefMetas(new Map()))
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
    void ensureBlobLoaded(refImg.id, refImg.mimeType)
      .then((src) => {
        if (!src) return
        setRefSrcMap((prev) => {
          if (prev.has(refDetailId)) return prev
          const next = new Map(prev)
          next.set(refDetailId, src)
          return next
        })
      })
      .catch(() => {})
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
    void ensureBlobLoaded(currentImage.id, currentImage.mimeType).catch(() => {})
  }, [currentImage])

  useEffect(() => {
    if (!currentImage) {
      setDisplayImage(null)
      return
    }
    if (!currentSrc) return
    let cancelled = false
    const next = { id: currentImage.id, src: currentSrc, alt: currentMeta?.prompt ?? '' }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (!cancelled) setDisplayImage(next)
    }
    img.onerror = () => {
      if (!cancelled) setDisplayImage(next)
    }
    img.src = currentSrc
    return () => {
      cancelled = true
    }
  }, [currentImage, currentMeta?.prompt, currentSrc])

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
      void ensureBlobLoaded(n.id, n.mimeType)
        .then((dataUrl) => {
          if (cancelled || !dataUrl) return
          const pre = new Image()
          pre.decoding = 'async'
          pre.src = dataUrl
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [canNavigate, currentIdx, stack.items])

  const exitEdit = useCallback(() => {
    setEditing(false)
    setEditMode('view')
    setDrawTool('brush')
    setDesktopMoveActive(false)
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
          setDrawRevision((prev) => prev + 1)
          return
        }
        if (viewMode === 'gallery') {
          if (galleryReturnTarget === 'detail') setViewMode('detail')
          else onClose()
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
  }, [
    canNavigate,
    editing,
    editMode,
    exitEdit,
    galleryReturnTarget,
    goToNext,
    goToPrev,
    mobileDrawOpen,
    mobilePreviewOpen,
    onClose,
    viewMode,
  ])

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

  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobileLayout(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!isMobileLayout || !editing) setMobileDrawOpen(false)
  }, [isMobileLayout, editing])

  useEffect(() => {
    if (!isMobileLayout || !currentImage) setMobilePreviewOpen(false)
  }, [isMobileLayout, currentImage])

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
    const promptToCopy = currentMeta?.prompt ?? currentJob?.request.prompt
    if (!promptToCopy) return
    void navigator.clipboard?.writeText(promptToCopy).catch(() => {})
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
  const desktopAnnotationActive = editing && editMode !== 'view' && !isMobileLayout && !mobileDrawOpen
  const drawableLayerVisible = (editMode !== 'view' || hasDrawableMarks) && !mobileDrawOpen
  const desktopDrawableLayerVisible = drawableLayerVisible && !isMobileLayout

  const startAnnotation = () => {
    if (!currentImage) return
    setEditing(true)
    setRefDetailId(null)
    setEditMode('mask')
    if (drawTool === 'rect') setDrawTool('brush')
    setDesktopMoveActive(false)
    if (isMobileLayout) setMobileDrawOpen(true)
  }

  const finishAnnotation = () => {
    setMobileDrawOpen(false)
    setEditMode('view')
    setDesktopMoveActive(false)
    setDrawRevision((prev) => prev + 1)
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
    setDesktopMoveActive(false)
  }

  // Wipe items but keep the user inside the annotation session. Used by the
  // in-editor toolbars where the expectation is "undo everything, let me
  // keep drawing", unlike the sidebar chip which also exits the mode.
  const clearAnnotationsInPlace = () => {
    if (!currentImage) return
    drawableRef.current?.clearAll()
    setEditItems(currentImage.id, [])
    setDrawableCounts({ annotate: 0, mask: 0 })
    setDrawRevision((prev) => prev + 1)
  }

  // Size helper — show approximate px
  const pxDim = currentMeta ? `${currentMeta.resolution} · ${currentMeta.aspectRatio}` : ''

  const stackInfo =
    currentImage &&
    (() => {
      const posInStack = stack.images.findIndex((img) => img.id === currentImage.id)
      return { pos: posInStack + 1, total: stack.images.length }
    })()
  const galleryBacksToDetail = viewMode === 'gallery' && galleryReturnTarget === 'detail'

  return createPortal(
    <div
      className="fixed top-0 left-0 w-full z-[100] flex flex-col fade-in"
      style={{
        // Track the dynamic viewport so the modal follows the iOS soft keyboard.
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
          boxShadow: 'inset 0 -1px 0 var(--ring-edge-soft)',
          background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
        }}
      >
        <button
          className="icon-btn shrink-0"
          onClick={galleryBacksToDetail ? () => setViewMode('detail') : onClose}
          title={galleryBacksToDetail ? '回到预览' : '关闭 (Esc)'}
          style={{ width: 32, height: 32 }}
        >
          <Icon name={galleryBacksToDetail ? 'chevron_left' : 'close'} size={13} strokeWidth={1.8} />
        </button>
        <div className="h-6 w-px shrink-0 bg-(--ring-edge-soft)" />

        {currentMeta ? (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
              {modelName}
            </span>
            <span className="mono shrink-0 text-sm leading-[1.25] text-(--color-text-4)">{pxDim}</span>
          </div>
        ) : (
          <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
            {currentSlot ? '生成任务' : '图片组'}
          </span>
        )}

        <div className="flex-1" />

        {viewMode === 'detail' && (
          <button
            className="chip hidden shrink-0 font-normal md:inline-flex"
            onClick={() => {
              setGalleryInitialMode('manage')
              setGalleryReturnTarget('detail')
              setViewMode('gallery')
            }}
            title="打开批量管理"
          >
            <Icon name="check_circle" size={12} strokeWidth={1.8} />
            <span className="hidden md:inline">批量管理</span>
          </button>
        )}
        {viewMode === 'detail' && (
          <button
            className="chip shrink-0 text-sm font-normal md:hidden"
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
            <button
              className="chip hidden shrink-0 font-normal md:inline-flex"
              onClick={handleAddRef}
              disabled={!currentImage}
              title="加为参考"
            >
              <Icon name="plus" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">参考</span>
            </button>
            {currentMeta?.prompt && (
              <button
                className="chip hidden shrink-0 font-normal md:inline-flex"
                onClick={handleRegenerateAction}
                title="还原参数"
              >
                <Icon name="refresh" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">还原参数</span>
              </button>
            )}
            <button
              className="chip shrink-0 text-sm font-normal md:hidden"
              onClick={handleDownload}
              disabled={!currentImage}
              title="下载 PNG"
              style={{ height: 36, padding: '0 12px' }}
            >
              <Icon name="download" size={14} strokeWidth={1.8} /> 下载
            </button>
            <button
              className="chip hidden shrink-0 font-normal md:inline-flex"
              onClick={handleDownload}
              disabled={!currentImage}
              title="下载 PNG"
            >
              <Icon name="download" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">PNG</span>
            </button>
          </>
        )}
        {viewMode === 'detail' && (
          <button
            className="chip hidden shrink-0 font-normal md:inline-flex"
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
          initialMode={galleryInitialMode}
          selectedId={selectedItem?.id ?? null}
          onSelect={(item) => {
            setSelection(toSelection(item))
            setRefDetailId(null)
            setGalleryReturnTarget('detail')
            setViewMode('detail')
          }}
          onRemove={onRemove}
        />
      ) : (
        <>
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden md:flex md:flex-col md:overflow-hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <StackStrip
              stack={stack}
              selectedId={selectedItem?.id ?? null}
              onSelect={(item) => {
                setSelection(toSelection(item))
                setRefDetailId(null)
              }}
              onCancelActiveJobs={() => {
                for (const job of stack.jobs) {
                  if (
                    job.slots.some(
                      (slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying',
                    )
                  ) {
                    onCancelGenerationJob(job.id)
                  }
                }
              }}
            />

            {/* ——— Body ——— */}
            <div className="flex flex-col md:flex-1 md:flex-row md:min-h-0">
              {/* Canvas with grid background */}
              <div
                className="relative min-h-0 min-w-0 overflow-hidden md:flex-1"
                style={{
                  flex: isMobileLayout ? '0 0 min(48dvh, 420px)' : '1 1 0%',
                  height: isMobileLayout ? 'min(48dvh, 420px)' : undefined,
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
                ) : currentImage ? (
                  <>
                    {!desktopDrawableLayerVisible && (
                      <ZoomableImageView
                        key="main-viewer"
                        src={displayImage?.src ?? currentSrc ?? ''}
                        alt={displayImage?.alt ?? currentMeta?.prompt ?? ''}
                        onSwipeLeft={hasNext ? goToNext : undefined}
                        onSwipeRight={hasPrev ? goToPrev : undefined}
                      />
                    )}
                    {drawableLayerVisible && (
                      <DrawableLayer
                        ref={drawableRef}
                        key={`${currentImage.id}:${drawRevision}`}
                        imageId={currentImage.id}
                        src={currentSrc ?? ''}
                        mode={activeDrawMode}
                        tool={drawTool}
                        brushSize={brushSize}
                        visibleModes={['mask', 'annotate']}
                        eraseAllModes
                        readOnly={editMode === 'view' || desktopMoveActive}
                        panEnabled={desktopMoveActive || (editMode === 'view' && hasDrawableMarks && !isMobileLayout)}
                        onItemsChange={setDrawableCounts}
                      />
                    )}
                    {desktopAnnotationActive && (
                      <DesktopAnnotationToolbar
                        drawTool={drawTool}
                        desktopMoveActive={desktopMoveActive}
                        brushPreset={brushPreset}
                        layerHasItems={hasDrawableMarks}
                        onChangeDrawTool={(tool) => {
                          setDesktopMoveActive(false)
                          setDrawTool(tool)
                        }}
                        onChangeDesktopMoveActive={setDesktopMoveActive}
                        onChangeBrushPreset={setBrushPreset}
                        onUndo={() => drawableRef.current?.undo()}
                        onClear={clearAnnotationsInPlace}
                        onFinish={finishAnnotation}
                      />
                    )}
                  </>
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
                    className="absolute top-4 left-1/2 z-20 -translate-x-1/2 text-sm font-medium fade-in"
                    style={{
                      background: 'var(--color-text)',
                      color: 'var(--color-bg)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      boxShadow: 'var(--shadow-float)',
                    }}
                  >
                    {toast}
                  </div>
                )}
              </div>

              {/* Right metadata panel */}
              <div
                className="w-full shadow-[inset_0_1px_0_var(--ring-edge-soft)] md:h-auto md:overflow-y-auto md:overflow-x-hidden md:shadow-[inset_1px_0_0_var(--ring-edge-soft)]"
                style={{
                  background: 'var(--color-bg)',
                  overscrollBehavior: 'contain',
                  ...(isMobileLayout
                    ? {
                        flex: '0 0 auto',
                        minHeight: 0,
                      }
                    : {
                        flexShrink: 0,
                        width: sidebarCollapsed ? 0 : 340,
                        minWidth: 0,
                        transition: 'width 280ms cubic-bezier(0.22, 0.8, 0.4, 1)',
                      }),
                }}
              >
                <div
                  className="px-[18px] pt-2.5 md:pt-4 pb-24 md:pb-10"
                  style={{ width: isMobileLayout ? undefined : 340 }}
                >
                  <div className="mb-[18px]">
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
                        onClick={(e) => {
                          e.stopPropagation()
                          exitEdit()
                        }}
                        data-active={!editing}
                      >
                        <span>详情</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
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
                      annotationActive={editMode !== 'view'}
                      hasAnnotations={hasDrawableMarks}
                      annotationToolsFloating={!isMobileLayout}
                      drawableCounts={drawableCounts}
                      drawableRef={drawableRef}
                      drawTool={drawTool}
                      desktopMoveActive={desktopMoveActive}
                      brushPreset={brushPreset}
                      onStartAnnotation={startAnnotation}
                      onFinishAnnotation={finishAnnotation}
                      onClearAnnotations={clearAnnotations}
                      onChangeDrawTool={(tool) => {
                        setDesktopMoveActive(false)
                        setDrawTool(tool)
                      }}
                      onChangeDesktopMoveActive={setDesktopMoveActive}
                      onChangeBrushPreset={setBrushPreset}
                    />
                  ) : (
                    <DetailSidebar
                      currentImage={currentImage}
                      currentMeta={currentMeta}
                      currentSlot={currentSlot}
                      currentJob={currentJob}
                      modelName={modelName}
                      modelApiId={modelApiId}
                      modelConfig={modelConfig}
                      actualCost={actualCost}
                      stackId={stack.id}
                      stackInfo={stackInfo}
                      canNavigate={canNavigate}
                      copiedPrompt={copiedPrompt}
                      refDetailId={refDetailId}
                      findRefImage={findRefImage}
                      onToggleRefDetail={(id) => setRefDetailId((prev) => (prev === id ? null : id))}
                      onAddRef={handleAddRef}
                      onRegenerate={handleRegenerateAction}
                      onCopyPrompt={handleCopyPrompt}
                      onRemove={onRemove}
                      onClose={onClose}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ——— Footer shortcuts ——— */}
          <div
            className="hidden shrink-0 items-center gap-3.5 px-3.5 text-sm text-(--color-text-4) md:flex"
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
