import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../Icon'
import { BRUSH_PRESETS, type BrushPresetId } from './annotationPresets'
import { DetailCanvas } from './DetailCanvas'
import { DetailFooter } from './DetailFooter'
import { DetailHeader } from './DetailHeader'
import { DetailSidePanel } from './DetailSidePanel'
import type { DrawableLayerHandle, DrawMode, DrawTool } from './DrawableLayer'
import type { EditImageHandler } from './EditSidebar'
import { MobileDrawFullscreen } from './MobileDrawFullscreen'
import { MobilePreviewFullscreen } from './MobilePreviewFullscreen'
import { StackGallery, StackStrip } from './StackViews'
import { MODEL_CONFIGS } from '../../config/models'
import { ensureBlobLoaded, useImageSrc } from '../../hooks/useImageSrc'
import type { GenerationJob } from '../../hooks/usePlayground'
import { imageDownloadFileName } from '../../lib/downloadFileName'
import { computeItemCounts, copyEditState, getEditState, setEditItems, type ItemCounts } from '../../lib/editStateCache'
import { loadImageMetas } from '../../lib/history'
import { getActualCost } from '../../lib/pricing'
import type { ImageStack, StackItem } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

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
  onReroll: (image: PlaygroundImageMeta) => Promise<{ ok: boolean; message: string }>
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
  onReroll,
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
  const [editMode, setEditMode] = useState<EditMode>(() => {
    if (typeof window === 'undefined') return 'view'
    return initialEditing && !window.matchMedia('(max-width: 767px)').matches ? 'mask' : 'view'
  })
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

  const currentInlineData =
    currentImage && 'data' in currentImage && typeof currentImage.data === 'string' ? currentImage.data : undefined
  const { ref: imgRef, src: currentSrc } = useImageSrc(
    currentImage?.id ?? '',
    currentImage?.mimeType ?? 'image/png',
    currentInlineData,
  )
  const currentMeta = currentImage?.source.type === 'generated' ? currentImage.source : null
  const [displayImage, setDisplayImage] = useState<{ id: string; src: string; alt: string } | null>(null)
  const canNavigate = stack.items.length > 0 && currentIdx >= 0

  const [toast, setToast] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [refDetailId, setRefDetailId] = useState<string | null>(null)
  const detailScrollRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  // Tracked height of the floating strip on desktop. Drives the canvas
  // safe-area inset so a 100% image stays clear of the strip.
  const [stripHeight, setStripHeight] = useState(120)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const next = Math.round(entry.contentRect.height)
      setStripHeight((prev) => (prev === next ? prev : next))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
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

  const resetDetailTab = useCallback(() => {
    setEditing(false)
    setEditMode('view')
    setDrawTool('brush')
    setDesktopMoveActive(false)
    setMobileDrawOpen(false)
  }, [])

  const selectStackItem = useCallback(
    (item: StackItem | null) => {
      setSelection(toSelection(item))
      setRefDetailId(null)
      resetDetailTab()
    },
    [resetDetailTab, toSelection],
  )

  const goToPrev = useCallback(() => {
    const prev = stack.items[Math.max(0, currentIdx - 1)] ?? null
    selectStackItem(prev)
    // No explicit clear — DrawableLayer remounts under the new image's key
    // and restores that image's cached items (empty for never-edited ones).
  }, [currentIdx, selectStackItem, stack.items])

  const goToNext = useCallback(() => {
    const next = stack.items[Math.min(stack.items.length - 1, currentIdx + 1)] ?? null
    selectStackItem(next)
  }, [currentIdx, selectStackItem, stack.items])

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
      void img
        .decode()
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setDisplayImage(next)
        })
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
          void pre.decode().catch(() => {})
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [canNavigate, currentIdx, stack.items])

  const exitEdit = useCallback(() => {
    resetDetailTab()
    // Keep items — they're cached per-image so reopening the modal restores
    // whatever annotations were in progress. Counts stay for the dots.
  }, [resetDetailTab])

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

  const handleRerollAction = () => {
    if (!currentImage) return
    void onReroll(currentImage).then((result) => {
      flash(result.ok ? '已加入重新生成队列' : result.message)
    })
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

      <DetailHeader
        currentImage={currentImage}
        currentMeta={currentMeta}
        currentSlot={currentSlot}
        modelName={modelName}
        pxDim={pxDim}
        viewMode={viewMode}
        galleryBacksToDetail={galleryBacksToDetail}
        sidebarCollapsed={sidebarCollapsed}
        className={viewMode === 'detail' ? 'md:hidden' : undefined}
        onClose={onClose}
        onBackToDetail={() => setViewMode('detail')}
        onOpenManageGallery={() => {
          setGalleryInitialMode('manage')
          setGalleryReturnTarget('detail')
          setViewMode('gallery')
        }}
        onAddRef={handleAddRef}
        onRegenerate={handleRegenerateAction}
        onReroll={handleRerollAction}
        onDownload={handleDownload}
        onToggleSidebar={toggleSidebar}
      />

      {viewMode === 'gallery' ? (
        <StackGallery
          stack={stack}
          initialMode={galleryInitialMode}
          selectedId={selectedItem?.id ?? null}
          onSelect={(item) => {
            selectStackItem(item)
            setGalleryReturnTarget('detail')
            setViewMode('detail')
          }}
          onRemove={onRemove}
        />
      ) : (
        <>
          <div
            ref={detailScrollRef}
            className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden md:flex md:flex-col md:overflow-hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div ref={stripRef} className="md:absolute md:inset-x-0 md:top-0 md:z-20">
              <StackStrip
                stack={stack}
                selectedId={selectedItem?.id ?? null}
                onSelect={selectStackItem}
                floating={!isMobileLayout}
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
                leadingNode={
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={onClose}
                    title="关闭 (Esc)"
                    style={{ width: 32, height: 32 }}
                  >
                    <Icon name="close" size={13} strokeWidth={1.8} />
                  </button>
                }
                trailingNode={
                  <button
                    type="button"
                    className="chip ghost shrink-0 font-normal text-(--color-text-3)"
                    onClick={() => {
                      setGalleryInitialMode('manage')
                      setGalleryReturnTarget('detail')
                      setViewMode('gallery')
                    }}
                    title="打开批量管理"
                    style={{ height: 24, padding: '0 6px' }}
                  >
                    <Icon name="check_circle" size={12} strokeWidth={1.8} />
                    <span>批量管理</span>
                  </button>
                }
              />
            </div>

            <div className="flex flex-col md:relative md:flex-1 md:flex-row md:min-h-0">
              <button
                type="button"
                onClick={toggleSidebar}
                title={sidebarCollapsed ? '展开详情面板' : '收起详情面板'}
                aria-pressed={!sidebarCollapsed}
                className="sidebar-edge-toggle"
                data-collapsed={sidebarCollapsed || undefined}
                style={{ top: stripHeight + 12 }}
              >
                <Icon
                  name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'}
                  size={14}
                  strokeWidth={1.8}
                />
              </button>
              <DetailCanvas
                inset={!isMobileLayout ? { top: stripHeight } : undefined}
                selectedItem={selectedItem}
                currentImage={currentImage}
                currentMeta={currentMeta}
                currentSrc={currentSrc}
                displayImage={displayImage}
                refDetailId={refDetailId}
                refDetailSrc={refDetailSrc}
                hasPrev={hasPrev}
                hasNext={hasNext}
                isMobileLayout={isMobileLayout}
                toast={toast}
                drawRevision={drawRevision}
                activeDrawMode={activeDrawMode}
                drawTool={drawTool}
                brushPreset={brushPreset}
                brushSize={brushSize}
                desktopMoveActive={desktopMoveActive}
                hasDrawableMarks={hasDrawableMarks}
                drawableLayerVisible={drawableLayerVisible}
                desktopDrawableLayerVisible={desktopDrawableLayerVisible}
                desktopAnnotationActive={desktopAnnotationActive}
                drawableReadOnly={editMode === 'view' || desktopMoveActive}
                drawablePanEnabled={desktopMoveActive || (editMode === 'view' && hasDrawableMarks && !isMobileLayout)}
                drawableRef={drawableRef}
                onGoPrev={goToPrev}
                onGoNext={goToNext}
                onOpenMobilePreview={() => setMobilePreviewOpen(true)}
                onCloseRefDetail={() => setRefDetailId(null)}
                onChangeDrawTool={setDrawTool}
                onChangeDesktopMoveActive={setDesktopMoveActive}
                onChangeBrushPreset={setBrushPreset}
                onItemsChange={setDrawableCounts}
                onUndo={() => drawableRef.current?.undo()}
                onClearAnnotationsInPlace={clearAnnotationsInPlace}
                onFinishAnnotation={finishAnnotation}
                onCancelGenerationSlot={onCancelGenerationSlot}
                onCancelGenerationJob={onCancelGenerationJob}
                onDismissGenerationJob={onDismissGenerationJob}
              />

              <DetailSidePanel
                editing={editing}
                isMobileLayout={isMobileLayout}
                sidebarCollapsed={sidebarCollapsed}
                safeAreaTop={stripHeight}
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
                generationJobs={generationJobs}
                activeEditBatchId={activeEditBatchId}
                annotationActive={editMode !== 'view'}
                hasAnnotations={hasDrawableMarks}
                drawableCounts={drawableCounts}
                drawableRef={drawableRef}
                drawTool={drawTool}
                desktopMoveActive={desktopMoveActive}
                brushPreset={brushPreset}
                findRefImage={findRefImage}
                onExitEdit={exitEdit}
                onStartEdit={() => {
                  if (!currentImage) return
                  if (isMobileLayout) setEditing(true)
                  else startAnnotation()
                }}
                onEditImage={onEditImage}
                onSetActiveBatchId={setActiveEditBatch}
                onStartAnnotation={startAnnotation}
                onFinishAnnotation={finishAnnotation}
                onClearAnnotations={clearAnnotations}
                onChangeDrawTool={(tool) => {
                  setDesktopMoveActive(false)
                  setDrawTool(tool)
                }}
                onChangeDesktopMoveActive={setDesktopMoveActive}
                onChangeBrushPreset={setBrushPreset}
                onToggleRefDetail={(id) => setRefDetailId((prev) => (prev === id ? null : id))}
                onAddRef={handleAddRef}
                onRegenerate={handleRegenerateAction}
                onReroll={handleRerollAction}
                onDownload={handleDownload}
                onCopyPrompt={handleCopyPrompt}
                onRemove={onRemove}
                onClose={onClose}
              />
            </div>
          </div>

          <DetailFooter editing={editing} currentImage={currentImage} selectedItem={selectedItem} stackId={stack.id} />
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
              src={displayImage?.src ?? currentSrc ?? ''}
              alt={displayImage?.alt ?? currentMeta?.prompt ?? ''}
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
