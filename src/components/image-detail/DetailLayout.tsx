import type { Dispatch, RefObject, SetStateAction } from 'react'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import type { BrushPresetId } from './annotationPresets'
import { DetailCanvas } from './DetailCanvas'
import { DetailFooter } from './DetailFooter'
import { DetailHeader } from './DetailHeader'
import { DetailSidePanel } from './DetailSidePanel'
import type { DrawableLayerHandle, DrawMode, DrawTool } from './DrawableLayer'
import type { EditImageHandler } from './EditSidebar'
import { StackGallery, StackStrip } from './StackViews'
import type { EditMode, GalleryMode, GalleryReturnTarget, ModalViewMode } from './useImageDetailModalState'
import type { ZoomableImageViewState } from './ZoomableImageView'
import type { ModelConfig } from '../../config/models'
import type { GenerationJob, GenerationSlot } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import type { ItemCounts } from '../../lib/editStateCache'
import type { ImageStack, StackItem } from '../../lib/stacks'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'

type DisplayImage = { id: string; src: string; alt: string }

type DetailLayoutProps = {
  // Stack & navigation
  stack: ImageStack
  selectedItem: StackItem | null
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSlot: GenerationSlot | null
  currentJob: GenerationJob | null
  canNavigate: boolean
  hasPrev: boolean
  hasNext: boolean
  // View mode
  viewMode: ModalViewMode
  galleryInitialMode: GalleryMode
  galleryBacksToDetail: boolean
  setViewMode: (mode: ModalViewMode) => void
  setGalleryInitialMode: (mode: GalleryMode) => void
  setGalleryReturnTarget: (target: GalleryReturnTarget) => void
  detailScrollRef: RefObject<HTMLDivElement | null>
  // Sidebar collapsed
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  // Image data
  currentSrc: string | null
  displayImage: DisplayImage | null
  canvasInitialView?: ZoomableImageViewState | null
  refDetailId: string | null
  refDetailSrc: string | null
  setRefDetailId: Dispatch<SetStateAction<string | null>>
  // Mobile preview
  isMobileLayout: boolean
  openMobilePreview: (initialView?: ZoomableImageViewState | null) => void
  // Drawing / edit state
  editing: boolean
  setEditing: (editing: boolean) => void
  editMode: EditMode
  drawTool: DrawTool
  desktopMoveActive: boolean
  brushPreset: BrushPresetId
  brushSize: number
  activeDrawMode: DrawMode
  drawableCounts: ItemCounts
  setDrawableCounts: (counts: ItemCounts) => void
  drawRevision: number
  drawableRef: RefObject<DrawableLayerHandle | null>
  hasDrawableMarks: boolean
  drawableLayerVisible: boolean
  desktopAnnotationActive: boolean
  setDrawTool: (tool: DrawTool) => void
  setDesktopMoveActive: (active: boolean) => void
  setBrushPreset: (preset: BrushPresetId) => void
  // Edit batch
  activeEditBatchId: string | null
  setActiveEditBatch: (id: string | null, sourceImageId?: string) => void
  // Toast & prompt
  toast: string | null
  copiedPrompt: boolean
  // Model meta
  modelName: string | null
  modelApiId: string | null
  modelConfig: ModelConfig | null | undefined
  actualCost: number | null
  pxDim: string
  stackInfo: { pos: number; total: number } | null
  // Refs lookup
  findRefImage: (id: string) => PlaygroundImageMeta | undefined
  // Generation jobs
  generationJobs: GenerationJob[]
  // Action handlers
  onClose: () => void
  onAddRef: () => void
  onRegenerate: () => void
  onReroll: () => void
  onDownload: () => void
  onCopyPrompt: () => void
  onRemove: (id: string) => void | Promise<void>
  onRemoveCurrent: (id: string) => void
  onEditImage: EditImageHandler
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onCancelGenerationSlot: (slotId: string) => void
  onRetryGenerationSlot: () => void
  // Navigation
  selectStackItem: (item: StackItem | null) => void
  goToPrev: () => void
  goToNext: () => void
  exitEdit: () => void
  startAnnotation: () => void
  finishAnnotation: () => void
  clearAnnotations: () => void
  clearAnnotationsInPlace: () => void
}

export function DetailLayout({
  stack,
  selectedItem,
  currentImage,
  currentMeta,
  currentSlot,
  currentJob,
  canNavigate,
  hasPrev,
  hasNext,
  viewMode,
  galleryInitialMode,
  galleryBacksToDetail,
  setViewMode,
  setGalleryInitialMode,
  setGalleryReturnTarget,
  detailScrollRef,
  sidebarCollapsed,
  toggleSidebar,
  currentSrc,
  displayImage,
  canvasInitialView,
  refDetailId,
  refDetailSrc,
  setRefDetailId,
  isMobileLayout,
  openMobilePreview,
  editing,
  setEditing,
  editMode,
  drawTool,
  desktopMoveActive,
  brushPreset,
  brushSize,
  activeDrawMode,
  drawableCounts,
  setDrawableCounts,
  drawRevision,
  drawableRef,
  hasDrawableMarks,
  drawableLayerVisible,
  desktopAnnotationActive,
  setDrawTool,
  setDesktopMoveActive,
  setBrushPreset,
  activeEditBatchId,
  setActiveEditBatch,
  toast,
  copiedPrompt,
  modelName,
  modelApiId,
  modelConfig,
  actualCost,
  pxDim,
  stackInfo,
  findRefImage,
  generationJobs,
  onClose,
  onAddRef,
  onRegenerate,
  onReroll,
  onDownload,
  onCopyPrompt,
  onRemove,
  onRemoveCurrent,
  onEditImage,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  selectStackItem,
  goToPrev,
  goToNext,
  exitEdit,
  startAnnotation,
  finishAnnotation,
  clearAnnotations,
  clearAnnotationsInPlace,
}: DetailLayoutProps) {
  const { t } = useI18n()

  return (
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
        onAddRef={onAddRef}
        onRegenerate={onRegenerate}
        onReroll={onReroll}
        onDownload={onDownload}
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
                  className="icon-btn h-8 w-8"
                  onClick={onClose}
                  title={t('imageDetail.action.closeEsc')}
                >
                  <Icon name="close" size={14} strokeWidth={1.8} />
                </button>
              }
              trailingNode={
                <Tooltip text={t('imageDetail.action.openBatchManage')}>
                  <button
                    type="button"
                    className="icon-btn h-8 w-8 shrink-0"
                    onClick={() => {
                      setGalleryInitialMode('manage')
                      setGalleryReturnTarget('detail')
                      setViewMode('gallery')
                    }}
                    aria-label={t('imageDetail.action.manageBatch')}
                  >
                    <Icon name="list_checks" size={14} strokeWidth={1.8} />
                  </button>
                </Tooltip>
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
                initialView={canvasInitialView}
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
                drawablePanEnabled={desktopMoveActive || (editMode === 'view' && hasDrawableMarks && !isMobileLayout)}
                drawableRef={drawableRef}
                onGoPrev={goToPrev}
                onGoNext={goToNext}
                onOpenMobilePreview={() => openMobilePreview()}
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
                onRetryGenerationSlot={onRetryGenerationSlot}
                onPinchZoom={isMobileLayout ? openMobilePreview : undefined}
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
                onAddRef={onAddRef}
                onRegenerate={onRegenerate}
                onReroll={onReroll}
                onDownload={onDownload}
                onCopyPrompt={onCopyPrompt}
                onRemove={onRemoveCurrent}
              />
            </div>
          </div>

          <DetailFooter editing={editing} currentImage={currentImage} selectedItem={selectedItem} stackId={stack.id} />
        </>
      )}
    </>
  )
}
