import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../Icon'
import { DetailCanvas } from './DetailCanvas'
import { DetailFooter } from './DetailFooter'
import { DetailHeader } from './DetailHeader'
import { DetailSidePanel } from './DetailSidePanel'
import type { DrawableLayerHandle } from './DrawableLayer'
import type { EditImageHandler } from './EditSidebar'
import { MobileDrawFullscreen } from './MobileDrawFullscreen'
import { MobileEditScreen } from './MobileEditScreen'
import { MobilePreviewFullscreen } from './MobilePreviewFullscreen'
import { StackGallery, StackStrip } from './StackViews'
import { useImageDetailModalState, type ModalViewMode } from './useImageDetailModalState'
import { MODEL_CONFIGS } from '../../config/models'
import { useExternalSync, useMediaQuery, useVisualViewport, useWindowEvent } from '../../hooks/effects'
import { ensureBlobLoaded, useImageSrc } from '../../hooks/useImageSrc'
import type { GenerationJob } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import { copyEditState, setEditItems } from '../../lib/editStateCache'
import { downloadImagePng } from '../../lib/exportImages'
import { loadImageMetas } from '../../lib/history'
import { getActualCost } from '../../lib/pricing'
import type { ImageStack, StackItem } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

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
  onRetryGenerationSlot: (jobId: string, slotId: string) => { ok: boolean; message: string }
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
  onRetryGenerationSlot,
  onRemove,
}: Props) {
  const { t } = useI18n()
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
  const isMobileLayout = useMediaQuery('(max-width: 767px)')

  const {
    editing,
    setEditing,
    mobileDrawOpen,
    setMobileDrawOpen,
    mobilePreviewOpen,
    setMobilePreviewOpen,
    viewMode,
    setViewMode,
    galleryInitialMode,
    setGalleryInitialMode,
    galleryReturnTarget,
    setGalleryReturnTarget,
    editMode,
    setEditMode,
    drawTool,
    setDrawTool,
    desktopMoveActive,
    setDesktopMoveActive,
    brushPreset,
    setBrushPreset,
    brushSize,
    activeDrawMode,
    drawableCounts,
    setDrawableCounts,
    drawRevision,
    setDrawRevision,
    resetDetailTab,
    exitEdit,
  } = useImageDetailModalState({
    initialViewMode,
    initialEditing,
    currentImageId: currentImage?.id ?? '',
    isMobileLayout,
  })
  const drawableRef = useRef<DrawableLayerHandle | null>(null)

  // After submit, we watch history for the first new image with this batchId
  // and auto-navigate the pager to it.
  const [activeEditBatchId, setActiveEditBatchId] = useState<string | null>(null)
  const activeEditSourceIdRef = useRef<string | null>(null)
  const setActiveEditBatch = useCallback((batchId: string | null, sourceImageId?: string) => {
    activeEditSourceIdRef.current = batchId ? (sourceImageId ?? activeEditSourceIdRef.current) : null
    setActiveEditBatchId(batchId)
  }, [])

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
  const [refSrcMap, setRefSrcMap] = useState<Map<string, string>>(new Map())
  const refDetailSrc = refDetailId ? (refSrcMap.get(refDetailId) ?? null) : null

  // Resolve missing refs from IndexedDB
  const [dbRefMetas, setDbRefMetas] = useState<Map<string, PlaygroundImageMeta>>(new Map())
  const missingRefIds = useMemo(() => {
    if (!currentMeta) return []
    return currentMeta.referenceImageIds.filter((id) => !history.find((h) => h.id === id))
  }, [currentMeta, history])

  useExternalSync(() => {
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

  useExternalSync(() => {
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

  useExternalSync(() => {
    if (!currentImage) return
    void ensureBlobLoaded(currentImage.id, currentImage.mimeType).catch(() => {})
  }, [currentImage])

  useExternalSync(() => {
    if (!currentImage || !currentSrc) return
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
  useExternalSync(() => {
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

  useWindowEvent('keydown', (e) => {
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
        if (galleryReturnTarget === 'detail') {
          setGalleryReturnTarget('detail')
          setViewMode('detail')
        } else onClose()
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
  })

  // Auto-select the new edit batch inside the stack strip. The selection starts
  // on the pending slot, then follows the same batch/order when it becomes an image.
  const navedBatchIdRef = useRef<string | null>(null)
  const copiedEditTargetIdsRef = useRef(new Set<string>())
  useExternalSync(() => {
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
    const result = await downloadImagePng(currentImage, { src: currentSrc })
    if (result === 'downloaded') flash(t('imageDetail.toast.downloadPngStarted'))
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
    flash(t('imageDetail.toast.addedReference'))
  }

  const handleRegenerateAction = () => {
    if (!currentImage) return
    onRegenerate(currentImage)
    onClose()
  }

  const handleRerollAction = () => {
    if (!currentImage) return
    void onReroll(currentImage).then((result) => {
      flash(result.ok ? t('imageDetail.toast.rerollQueued') : result.message)
    })
  }

  const handleRetrySlotAction = () => {
    if (!currentJob || !currentSlot) return
    const result = onRetryGenerationSlot(currentJob.id, currentSlot.id)
    flash(result.ok ? t('imageDetail.toast.retryQueued') : result.message)
  }

  const hasPrev = canNavigate && currentIdx > 0
  const hasNext = canNavigate && currentIdx < stack.items.length - 1
  const hasDrawableMarks = drawableCounts.annotate > 0 || drawableCounts.mask > 0
  const desktopAnnotationActive = editing && editMode !== 'view' && !isMobileLayout && !mobileDrawOpen
  const drawableLayerVisible = (editMode !== 'view' || hasDrawableMarks) && !mobileDrawOpen

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

  // Keep the backdrop covering the full layout viewport. iOS Safari shrinks
  // visualViewport when the keyboard opens, so only the content layer follows
  // it; otherwise the modal background gets clipped and the page underneath
  // peeks through.
  const { height: viewportHeight, offsetTop: viewportOffsetTop } = useVisualViewport()

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden fade-in"
      style={{
        background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div
        className="flex flex-col"
        style={{
          height: viewportHeight || '100dvh',
          transform: viewportOffsetTop ? `translateY(${viewportOffsetTop}px)` : undefined,
        }}
      >
        {/* Sentinel for preview loader */}
        <div ref={imgRef} className="fixed top-0 left-0 w-0 h-0 pointer-events-none" aria-hidden />

        {isMobileLayout && editing && currentImage ? (
          <MobileEditScreen
            sourceImage={currentImage}
            currentSrc={currentSrc}
            modelName={modelName}
            pxDim={pxDim}
            generationJobs={generationJobs}
            activeEditBatchId={activeEditBatchId}
            drawableVisible={drawableLayerVisible}
            drawableCounts={drawableCounts}
            drawableRef={drawableRef}
            activeDrawMode={activeDrawMode}
            drawTool={drawTool}
            brushPreset={brushPreset}
            brushSize={brushSize}
            hasAnnotations={hasDrawableMarks}
            onClose={exitEdit}
            onOpenPreview={() => setMobilePreviewOpen(true)}
            onEditImage={onEditImage}
            onSetActiveBatchId={setActiveEditBatch}
            onSubmitSuccess={exitEdit}
            onStartAnnotation={startAnnotation}
            onFinishAnnotation={finishAnnotation}
            onClearAnnotations={clearAnnotations}
            onChangeDrawTool={(tool) => {
              setDesktopMoveActive(false)
              setDrawTool(tool)
            }}
            onChangeDesktopMoveActive={setDesktopMoveActive}
            onChangeBrushPreset={setBrushPreset}
            onItemsChange={setDrawableCounts}
          />
        ) : (
          <>
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
              onBackToDetail={() => {
                setGalleryReturnTarget('detail')
                setViewMode('detail')
              }}
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
                  <StackStrip
                    stack={stack}
                    selectedId={selectedItem?.id ?? null}
                    onSelect={selectStackItem}
                    leadingNode={
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={onClose}
                        title={t('imageDetail.action.closeEsc')}
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
                        title={t('imageDetail.action.openBatchManage')}
                        style={{ height: 24, padding: '0 6px' }}
                      >
                        <Icon name="check_circle" size={12} strokeWidth={1.8} />
                        <span>{t('imageDetail.action.manageBatch')}</span>
                      </button>
                    }
                  />

                  <div className="flex flex-col md:relative md:flex-1 md:flex-row md:min-h-0">
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      title={
                        sidebarCollapsed
                          ? t('imageDetail.action.expandDetailsPanel')
                          : t('imageDetail.action.collapseDetailsPanel')
                      }
                      aria-pressed={!sidebarCollapsed}
                      className="sidebar-edge-toggle"
                      data-collapsed={sidebarCollapsed || undefined}
                    >
                      <Icon name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'} size={14} strokeWidth={1.8} />
                    </button>
                    <DetailCanvas
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
                      desktopAnnotationActive={desktopAnnotationActive}
                      drawableReadOnly={editMode === 'view' || desktopMoveActive}
                      drawablePanEnabled={
                        desktopMoveActive || (editMode === 'view' && hasDrawableMarks && !isMobileLayout)
                      }
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
                      onRetryGenerationSlot={handleRetrySlotAction}
                    />

                    <DetailSidePanel
                      editing={editing}
                      isMobileLayout={isMobileLayout}
                      sidebarCollapsed={sidebarCollapsed}
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

                <DetailFooter
                  editing={editing}
                  currentImage={currentImage}
                  selectedItem={selectedItem}
                  stackId={stack.id}
                />
              </>
            )}
          </>
        )}
        {isMobileLayout && editing && mobileDrawOpen && currentImage && (
          <MobileDrawFullscreen
            key={currentImage.id}
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
        {isMobileLayout && mobilePreviewOpen && currentImage && (
          <MobilePreviewFullscreen
            src={displayImage?.src ?? currentSrc ?? ''}
            alt={displayImage?.alt ?? currentMeta?.prompt ?? ''}
            onClose={() => setMobilePreviewOpen(false)}
            onSwipeLeft={hasNext ? goToNext : undefined}
            onSwipeRight={hasPrev ? goToPrev : undefined}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
