import type { RefObject } from 'react'

import type { BrushPresetId } from './annotationPresets'
import { DetailSidebar } from './DetailSidebar'
import type { DrawableLayerHandle, DrawTool } from './DrawableLayer'
import { EditSidebar, type EditImageHandler } from './EditSidebar'
import type { ModelConfig } from '../../config/models'
import type { GenerationJob, GenerationSlot } from '../../hooks/usePlayground'
import type { ItemCounts } from '../../lib/editStateCache'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'

type DetailSidePanelProps = {
  editing: boolean
  isMobileLayout: boolean
  sidebarCollapsed: boolean
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSlot: GenerationSlot | null
  currentJob: GenerationJob | null
  modelName: string | null
  modelApiId: string | null
  modelConfig: ModelConfig | null | undefined
  actualCost: number | null
  stackId: string
  stackInfo: { pos: number; total: number } | false | null
  canNavigate: boolean
  copiedPrompt: boolean
  refDetailId: string | null
  generationJobs: GenerationJob[]
  activeEditBatchId: string | null
  annotationActive: boolean
  hasAnnotations: boolean
  drawableCounts: ItemCounts
  drawableRef: RefObject<DrawableLayerHandle | null>
  drawTool: DrawTool
  desktopMoveActive: boolean
  brushPreset: BrushPresetId
  findRefImage: (id: string) => PlaygroundImageMeta | undefined
  onExitEdit: () => void
  onStartEdit: () => void
  onEditImage: EditImageHandler
  onSetActiveBatchId: (id: string | null, sourceImageId?: string) => void
  onStartAnnotation: () => void
  onFinishAnnotation: () => void
  onClearAnnotations: () => void
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeDesktopMoveActive: (active: boolean) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
  onToggleRefDetail: (id: string) => void
  onAddRef: () => void
  onRegenerate: () => void
  onReroll: () => void
  onDownload: () => void
  onCopyPrompt: () => void
  onRemove: (id: string) => void | Promise<void>
  onClose: () => void
}

export function DetailSidePanel({
  editing,
  isMobileLayout,
  sidebarCollapsed,
  currentImage,
  currentMeta,
  currentSlot,
  currentJob,
  modelName,
  modelApiId,
  modelConfig,
  actualCost,
  stackId,
  stackInfo,
  canNavigate,
  copiedPrompt,
  refDetailId,
  generationJobs,
  activeEditBatchId,
  annotationActive,
  hasAnnotations,
  drawableCounts,
  drawableRef,
  drawTool,
  desktopMoveActive,
  brushPreset,
  findRefImage,
  onExitEdit,
  onStartEdit,
  onEditImage,
  onSetActiveBatchId,
  onStartAnnotation,
  onFinishAnnotation,
  onClearAnnotations,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
  onToggleRefDetail,
  onAddRef,
  onRegenerate,
  onReroll,
  onDownload,
  onCopyPrompt,
  onRemove,
  onClose,
}: DetailSidePanelProps) {
  return (
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
      <div className="px-[18px] pt-2.5 md:pt-4 pb-24 md:pb-10" style={{ width: isMobileLayout ? undefined : 340 }}>
        {currentImage && (
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
                  onExitEdit()
                }}
                data-active={!editing}
              >
                <span>详情</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEdit()
                }}
                data-active={editing}
              >
                <span>编辑</span>
              </button>
            </div>
          </div>
        )}
        {editing && currentImage ? (
          <div>
            <EditSidebar
              sourceImage={currentImage}
              generationJobs={generationJobs}
              activeEditBatchId={activeEditBatchId}
              onEditImage={onEditImage}
              onSetActiveBatchId={onSetActiveBatchId}
              annotationActive={annotationActive}
              hasAnnotations={hasAnnotations}
              annotationToolsFloating={!isMobileLayout}
              drawableCounts={drawableCounts}
              drawableRef={drawableRef}
              drawTool={drawTool}
              desktopMoveActive={desktopMoveActive}
              brushPreset={brushPreset}
              onStartAnnotation={onStartAnnotation}
              onFinishAnnotation={onFinishAnnotation}
              onClearAnnotations={onClearAnnotations}
              onChangeDrawTool={onChangeDrawTool}
              onChangeDesktopMoveActive={onChangeDesktopMoveActive}
              onChangeBrushPreset={onChangeBrushPreset}
            />
          </div>
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
            stackId={stackId}
            stackInfo={stackInfo}
            canNavigate={canNavigate}
            copiedPrompt={copiedPrompt}
            refDetailId={refDetailId}
            findRefImage={findRefImage}
            onToggleRefDetail={onToggleRefDetail}
            onAddRef={onAddRef}
            onRegenerate={onRegenerate}
            onReroll={onReroll}
            onDownload={onDownload}
            onCopyPrompt={onCopyPrompt}
            onRemove={onRemove}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
