import type { RefObject } from 'react'

import type { BrushPresetId } from './annotationPresets'
import { DrawableLayer, type DrawableLayerHandle, type DrawMode, type DrawTool } from './DrawableLayer'
import { EditSidebar, type EditImageHandler } from './EditSidebar'
import type { GenerationJob } from '../../hooks/usePlayground'
import type { ItemCounts } from '../../lib/editStateCache'
import type { PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'

type MobileEditScreenProps = {
  sourceImage: PlaygroundImageMeta
  currentSrc: string | null
  modelName: string | null
  pxDim: string
  generationJobs: GenerationJob[]
  activeEditBatchId: string | null
  drawableVisible: boolean
  drawableCounts: ItemCounts
  drawableRef: RefObject<DrawableLayerHandle | null>
  activeDrawMode: DrawMode
  drawTool: DrawTool
  brushPreset: BrushPresetId
  brushSize: number
  hasAnnotations: boolean
  onClose: () => void
  onOpenPreview: () => void
  onEditImage: EditImageHandler
  onSetActiveBatchId: (id: string | null, sourceImageId?: string) => void
  onStartAnnotation: () => void
  onFinishAnnotation: () => void
  onClearAnnotations: () => void
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeDesktopMoveActive: (active: boolean) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
  onItemsChange: (counts: ItemCounts) => void
}

export function MobileEditScreen({
  sourceImage,
  currentSrc,
  modelName,
  pxDim,
  generationJobs,
  activeEditBatchId,
  drawableVisible,
  drawableCounts,
  drawableRef,
  activeDrawMode,
  drawTool,
  brushPreset,
  brushSize,
  hasAnnotations,
  onClose,
  onOpenPreview,
  onEditImage,
  onSetActiveBatchId,
  onStartAnnotation,
  onFinishAnnotation,
  onClearAnnotations,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
  onItemsChange,
}: MobileEditScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--color-bg)">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="返回详情" title="返回详情">
          <Icon name="chevron_left" size={15} strokeWidth={1.8} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-(--color-text)">编辑图片</div>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-(--color-text-4)">
            <span className="truncate">{modelName ?? '图片'}</span>
            {pxDim && (
              <>
                <span aria-hidden className="meta-dot" />
                <span className="shrink-0">{pxDim}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-3.5 pb-3 pt-3 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
        <div className="relative h-[156px] overflow-hidden rounded-[8px] bg-(--color-bg-sunken) shadow-[inset_0_0_0_1px_var(--ring-edge)]">
          {currentSrc ? (
            <img src={currentSrc} alt="待编辑图片" className="h-full w-full object-contain" draggable={false} />
          ) : (
            <div className="absolute inset-0 skeleton-animated" />
          )}
          {drawableVisible && currentSrc && (
            <DrawableLayer
              key="mobile-edit-preview"
              ref={drawableRef}
              imageId={sourceImage.id}
              src={currentSrc}
              mode={activeDrawMode}
              tool={drawTool}
              brushSize={brushSize}
              visibleModes={['mask', 'annotate']}
              eraseAllModes
              readOnly
              onItemsChange={onItemsChange}
            />
          )}
          <div className="pointer-events-none absolute left-2 top-2 rounded-[5px] bg-black/55 px-1.5 py-1 text-sm font-medium leading-none text-white backdrop-blur-[4px]">
            {hasAnnotations ? `标注 ${drawableCounts.annotate + drawableCounts.mask}` : '原图'}
          </div>
          <button
            type="button"
            className="icon-btn absolute right-2 top-2"
            onClick={onOpenPreview}
            aria-label="全屏预览"
            title="全屏预览"
            style={{ width: 30, height: 30, background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)' }}
          >
            <Icon name="maximize" size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-6 pt-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <EditSidebar
          sourceImage={sourceImage}
          generationJobs={generationJobs}
          activeEditBatchId={activeEditBatchId}
          onEditImage={onEditImage}
          onSetActiveBatchId={onSetActiveBatchId}
          annotationActive={false}
          hasAnnotations={hasAnnotations}
          annotationToolsFloating={false}
          drawableCounts={drawableCounts}
          drawableRef={drawableRef}
          drawTool={drawTool}
          desktopMoveActive={false}
          brushPreset={brushPreset}
          onStartAnnotation={onStartAnnotation}
          onFinishAnnotation={onFinishAnnotation}
          onClearAnnotations={onClearAnnotations}
          onChangeDrawTool={onChangeDrawTool}
          onChangeDesktopMoveActive={onChangeDesktopMoveActive}
          onChangeBrushPreset={onChangeBrushPreset}
          autoFocusPrompt={false}
          showSubmitShortcut={false}
          submitFooterClassName="sticky bottom-0 z-10 -mx-3.5 bg-(--color-bg) px-3.5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 shadow-[inset_0_1px_0_var(--ring-edge-soft)]"
        />
      </div>
    </div>
  )
}
