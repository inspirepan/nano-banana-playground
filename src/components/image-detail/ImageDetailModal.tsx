import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DetailLayout } from './DetailLayout'
import type { DrawableLayerHandle } from './DrawableLayer'
import type { EditImageHandler } from './EditSidebar'
import { MobileDrawFullscreen } from './MobileDrawFullscreen'
import { MobileEditScreen } from './MobileEditScreen'
import { MobileUnifiedPreviewLayer } from './MobileUnifiedPreviewLayer'
import { useImageDetailBlobs } from './useImageDetailBlobs'
import { useImageDetailKeyboard } from './useImageDetailKeyboard'
import { useImageDetailModalState, type GalleryMode, type ModalViewMode } from './useImageDetailModalState'
import { useImageDetailNavigation, useImageDetailSelection } from './useImageDetailNavigation'
import type { ZoomableImageViewState } from './ZoomableImageView'
import { MODEL_CONFIGS } from '../../config/models'
import { useMediaQuery, useVisualViewport } from '../../hooks/effects'
import type { GenerationJob } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import { setEditItems } from '../../lib/editStateCache'
import { downloadImagePng } from '../../lib/exportImages'
import { readDetailSidebarCollapsedPreference, writeDetailSidebarCollapsedPreference } from '../../lib/preferenceStore'
import { getActualCost } from '../../lib/pricing'
import type { ImageStack } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

type StackNavigationTarget = { stackId: string; itemId: string }

type Props = {
  stack: ImageStack
  initialItemId?: string
  initialViewMode?: ModalViewMode
  initialGalleryMode?: GalleryMode
  initialEditing?: boolean
  previousStackTarget?: StackNavigationTarget | null
  nextStackTarget?: StackNavigationTarget | null
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  onNavigateToStackItem?: (target: StackNavigationTarget) => void
  onClose: () => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onReroll: (image: PlaygroundImageMeta) => Promise<{ ok: boolean; message: string }>
  onEditImage: EditImageHandler
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRetryGenerationSlot: (jobId: string, slotId: string) => { ok: boolean; message: string }
  onRetryFailedGenerationImage: (image: PlaygroundImageMeta) => Promise<{ ok: boolean; message: string }>
  onRemove: (id: string) => void | Promise<void>
}

export function ImageDetailModal({
  stack,
  initialItemId,
  initialViewMode = 'detail',
  initialGalleryMode,
  initialEditing = false,
  previousStackTarget,
  nextStackTarget,
  history,
  generationJobs,
  onNavigateToStackItem,
  onClose,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  onRetryFailedGenerationImage,
  onRemove,
}: Props) {
  const { t } = useI18n()
  const isMobileLayout = useMediaQuery('(max-width: 767px)')

  const [refDetailId, setRefDetailId] = useState<string | null>(null)

  const { setSelection, selectedItem, currentIdx, currentImage, currentSlot, currentJob, canNavigate } =
    useImageDetailSelection({ stack, initialItemId })

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
    initialGalleryMode,
    initialEditing,
    currentImageId: currentImage?.id ?? '',
    isMobileLayout,
  })

  const {
    hasPrev,
    hasNext,
    selectStackItem,
    goToPrev,
    goToNext,
    handleRemoveCurrent,
    activeEditBatchId,
    setActiveEditBatch,
  } = useImageDetailNavigation({
    stack,
    setSelection,
    currentIdx,
    canNavigate,
    previousStackTarget,
    nextStackTarget,
    onNavigateToStackItem,
    onClose,
    onRemove,
    resetDetailTab,
    setRefDetailId,
  })

  const currentMeta = currentImage?.source.type === 'generated' ? currentImage.source : null

  const { imgRef, currentSrc, displayImage, findRefImage, refDetailSrc } = useImageDetailBlobs({
    currentImage,
    currentMeta,
    stack,
    history,
    canNavigate,
    currentIdx,
    refDetailId,
  })

  const drawableRef = useRef<DrawableLayerHandle | null>(null)

  const [toast, setToast] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const mobilePreviewAnchorRef = useRef<HTMLDivElement | null>(null)
  const detailScrollRef = useRef<HTMLDivElement | null>(null)

  const handleRemoveCurrentAndRevealImage = useCallback(
    (id: string) => {
      handleRemoveCurrent(id)
      detailScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [handleRemoveCurrent],
  )

  useImageDetailKeyboard({
    editing,
    editMode,
    viewMode,
    galleryReturnTarget,
    mobilePreviewOpen,
    mobileDrawOpen,
    canNavigate,
    drawableRef,
    setEditMode,
    setDrawRevision,
    setViewMode,
    setGalleryReturnTarget,
    setMobilePreviewOpen,
    setMobileDrawOpen,
    exitEdit,
    onClose,
    goToPrev,
    goToNext,
  })

  // Desktop-only: collapse the right metadata sidebar to give the canvas more room.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return readDetailSidebarCollapsedPreference()
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      writeDetailSidebarCollapsedPreference(next)
      return next
    })
  }, [])

  const modelConfig = currentMeta ? MODEL_CONFIGS.find((m) => m.id === currentMeta.modelId) : null
  const modelName = modelConfig?.name ?? currentMeta?.modelId ?? null
  const modelApiId = modelConfig?.apiModel ?? null

  const actualCost = useMemo(() => {
    if (!currentMeta || !modelConfig) return null
    return getActualCost(modelConfig, currentMeta.tokenUsage)
  }, [currentMeta, modelConfig])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }, [])

  const handleDownload = useCallback(async () => {
    if (!currentImage || !currentSrc) return
    const result = await downloadImagePng(currentImage, { src: currentSrc })
    if (result === 'downloaded') flash(t('imageDetail.toast.downloadPngStarted'))
  }, [currentImage, currentSrc, flash, t])

  const handleCopyPrompt = useCallback(() => {
    const promptToCopy = currentMeta?.prompt ?? currentJob?.request.prompt
    if (!promptToCopy) return
    void navigator.clipboard?.writeText(promptToCopy).catch(() => {})
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 1400)
  }, [currentMeta?.prompt, currentJob?.request.prompt])

  const handleAddRef = useCallback(() => {
    if (!currentImage) return
    onAddToRef(currentImage)
    flash(t('imageDetail.toast.addedReference'))
  }, [currentImage, onAddToRef, flash, t])

  const openMobilePreview = useCallback(
    (_initialView: ZoomableImageViewState | null = null) => {
      setMobilePreviewOpen(true)
    },
    [setMobilePreviewOpen],
  )

  const closeMobilePreviewFromButton = useCallback(() => {
    setMobilePreviewOpen(false)
  }, [setMobilePreviewOpen])

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
    if (selectedItem?.type === 'slot' && selectedItem.failureImage) {
      void onRetryFailedGenerationImage(selectedItem.failureImage).then((result) => {
        flash(result.ok ? t('imageDetail.toast.retryQueued') : result.message)
      })
      return
    }
    if (!currentJob || !currentSlot) return
    const result = onRetryGenerationSlot(currentJob.id, currentSlot.id)
    flash(result.ok ? t('imageDetail.toast.retryQueued') : result.message)
  }

  const handleDismissSlotJob = useCallback(
    (jobId: string) => {
      if (selectedItem?.type === 'slot' && selectedItem.failureImage && selectedItem.job.id === jobId) {
        void onRemove(selectedItem.failureImage.id)
        return
      }
      onDismissGenerationJob(jobId)
    },
    [onDismissGenerationJob, onRemove, selectedItem],
  )

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

  const stackInfo = useMemo(() => {
    if (!currentImage) return null
    const posInStack = stack.images.findIndex((img) => img.id === currentImage.id)
    return { pos: posInStack + 1, total: stack.images.length }
  }, [currentImage, stack.images])
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
            onOpenPreview={() => openMobilePreview()}
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
          <DetailLayout
            stack={stack}
            selectedItem={selectedItem}
            currentImage={currentImage}
            currentMeta={currentMeta}
            currentSlot={currentSlot}
            currentJob={currentJob}
            canNavigate={canNavigate}
            hasPrev={hasPrev}
            hasNext={hasNext}
            viewMode={viewMode}
            galleryInitialMode={galleryInitialMode}
            galleryBacksToDetail={galleryBacksToDetail}
            setViewMode={setViewMode}
            setGalleryInitialMode={setGalleryInitialMode}
            setGalleryReturnTarget={setGalleryReturnTarget}
            detailScrollRef={detailScrollRef}
            sidebarCollapsed={sidebarCollapsed}
            toggleSidebar={toggleSidebar}
            currentSrc={currentSrc}
            displayImage={displayImage}
            refDetailId={refDetailId}
            refDetailSrc={refDetailSrc}
            setRefDetailId={setRefDetailId}
            isMobileLayout={isMobileLayout}
            mobilePreviewAnchorRef={mobilePreviewAnchorRef}
            openMobilePreview={openMobilePreview}
            editing={editing}
            setEditing={setEditing}
            editMode={editMode}
            drawTool={drawTool}
            desktopMoveActive={desktopMoveActive}
            brushPreset={brushPreset}
            brushSize={brushSize}
            activeDrawMode={activeDrawMode}
            drawableCounts={drawableCounts}
            setDrawableCounts={setDrawableCounts}
            drawRevision={drawRevision}
            drawableRef={drawableRef}
            hasDrawableMarks={hasDrawableMarks}
            drawableLayerVisible={drawableLayerVisible}
            desktopAnnotationActive={desktopAnnotationActive}
            setDrawTool={setDrawTool}
            setDesktopMoveActive={setDesktopMoveActive}
            setBrushPreset={setBrushPreset}
            activeEditBatchId={activeEditBatchId}
            setActiveEditBatch={setActiveEditBatch}
            toast={toast}
            copiedPrompt={copiedPrompt}
            modelName={modelName}
            modelApiId={modelApiId}
            modelConfig={modelConfig}
            actualCost={actualCost}
            pxDim={pxDim}
            stackInfo={stackInfo}
            findRefImage={findRefImage}
            generationJobs={generationJobs}
            onClose={onClose}
            onAddRef={handleAddRef}
            onRegenerate={handleRegenerateAction}
            onReroll={handleRerollAction}
            onDownload={handleDownload}
            onCopyPrompt={handleCopyPrompt}
            onRemove={onRemove}
            onRemoveCurrent={handleRemoveCurrentAndRevealImage}
            onEditImage={onEditImage}
            onCancelGenerationJob={onCancelGenerationJob}
            onDismissGenerationJob={handleDismissSlotJob}
            onCancelGenerationSlot={onCancelGenerationSlot}
            onRetryGenerationSlot={handleRetrySlotAction}
            selectStackItem={selectStackItem}
            goToPrev={goToPrev}
            goToNext={goToNext}
            exitEdit={exitEdit}
            startAnnotation={startAnnotation}
            finishAnnotation={finishAnnotation}
            clearAnnotations={clearAnnotations}
            clearAnnotationsInPlace={clearAnnotationsInPlace}
          />
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
      </div>
      <MobileUnifiedPreviewLayer
        anchorRef={mobilePreviewAnchorRef}
        clipRef={detailScrollRef}
        fullscreen={mobilePreviewOpen}
        visible={Boolean(
          isMobileLayout &&
          currentImage &&
          !mobileDrawOpen &&
          !refDetailId &&
          (mobilePreviewOpen || (!editing && viewMode === 'detail')),
        )}
        src={displayImage?.src ?? currentSrc ?? ''}
        alt={displayImage?.alt ?? currentMeta?.prompt ?? ''}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onOpenFullscreen={openMobilePreview}
        onCloseFullscreen={closeMobilePreviewFromButton}
        onGoPrev={goToPrev}
        onGoNext={goToNext}
      />
    </div>,
    document.body,
  )
}
