import type { RefObject } from 'react'

import type { BrushPresetId } from './annotationPresets'
import { DrawableLayer, type DrawableLayerHandle, type DrawMode, type DrawTool } from './DrawableLayer'
import { EditSidebar, type EditImageHandler } from './EditSidebar'
import type { GenerationJob } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import type { ItemCounts } from '../../lib/editStateCache'
import type { PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

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
  onSubmitSuccess: () => void
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
  onSubmitSuccess,
  onStartAnnotation,
  onFinishAnnotation,
  onClearAnnotations,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
  onItemsChange,
}: MobileEditScreenProps) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--color-bg)">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
        <Tooltip text={t('imageDetail.action.backToDetail')} placement="bottom" className="inline-flex">
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t('imageDetail.action.backToDetail')}
          >
            <Icon name="chevron_left" size={15} strokeWidth={1.8} />
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-(--color-text)">{t('imageDetail.action.editImage')}</div>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-(--color-text-3)">
            <span className="truncate">{modelName ?? t('imageDetail.mobile.editFallbackImage')}</span>
            {pxDim && (
              <>
                <span aria-hidden className="meta-dot" />
                <span className="shrink-0 tabular-nums">{pxDim}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="relative h-[156px] overflow-hidden rounded-[var(--radius-md)] bg-(--color-bg-sunken) shadow-[inset_0_0_0_1px_var(--ring-edge)]">
          {currentSrc ? (
            <img
              src={currentSrc}
              alt={t('imageDetail.mobile.editImageAlt')}
              className="h-full w-full object-contain"
              draggable={false}
            />
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
          <Tooltip
            text={t('imageDetail.action.fullscreenPreview')}
            placement="bottom"
            className="absolute right-2 top-2"
          >
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenPreview}
              aria-label={t('imageDetail.action.fullscreenPreview')}
              style={{ width: 30, height: 30, background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)' }}
            >
              <Icon name="maximize" size={13} strokeWidth={1.8} />
            </button>
          </Tooltip>
        </div>

        <div className="pt-4">
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
            onSubmitSuccess={onSubmitSuccess}
            submitFooterClassName="pt-2.5 shadow-[inset_0_1px_0_var(--ring-edge-soft)]"
          />
        </div>
      </div>
    </div>
  )
}
