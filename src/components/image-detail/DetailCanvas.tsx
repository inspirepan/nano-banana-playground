import type { RefObject } from 'react'

import { DesktopAnnotationToolbar } from './annotationControls'
import type { BrushPresetId } from './annotationPresets'
import { DrawableLayer, type DrawableLayerHandle, type DrawMode, type DrawTool } from './DrawableLayer'
import { SlotHero } from './SlotHero'
import {
  ZoomableImageView,
  type ZoomableImageViewHandoffReason,
  type ZoomableImageViewState,
} from './ZoomableImageView'
import { useI18n } from '../../i18n'
import type { ItemCounts } from '../../lib/editStateCache'
import type { StackItem } from '../../lib/stacks'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'

type DetailCanvasProps = {
  selectedItem: StackItem | null
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSrc: string | null
  displayImage: { id: string; src: string; alt: string } | null
  mobilePreviewAnchorRef?: RefObject<HTMLDivElement | null>
  refDetailId: string | null
  refDetailSrc: string | null
  hasPrev: boolean
  hasNext: boolean
  isMobileLayout: boolean
  toast: string | null
  drawRevision: number
  activeDrawMode: DrawMode
  drawTool: DrawTool
  brushPreset: BrushPresetId
  brushSize: number
  desktopMoveActive: boolean
  hasDrawableMarks: boolean
  drawableLayerVisible: boolean
  desktopAnnotationActive: boolean
  drawableReadOnly: boolean
  drawablePanEnabled: boolean
  drawableRef: RefObject<DrawableLayerHandle | null>
  onGoPrev: () => void
  onGoNext: () => void
  onOpenMobilePreview: () => void
  onCloseRefDetail: () => void
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeDesktopMoveActive: (active: boolean) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
  onItemsChange: (counts: ItemCounts) => void
  onUndo: () => void
  onClearAnnotationsInPlace: () => void
  onFinishAnnotation: () => void
  onCancelGenerationSlot: (slotId: string) => void
  onCancelGenerationJob: (jobId: string) => void
  onDismissGenerationJob: (jobId: string) => void
  onRetryGenerationSlot: () => void
  onRequestFullscreen?: (view: ZoomableImageViewState, reason: ZoomableImageViewHandoffReason) => void
}

export function DetailCanvas({
  selectedItem,
  currentImage,
  currentMeta,
  currentSrc,
  displayImage,
  mobilePreviewAnchorRef,
  refDetailId,
  refDetailSrc,
  hasPrev,
  hasNext,
  isMobileLayout,
  toast,
  drawRevision,
  activeDrawMode,
  drawTool,
  brushPreset,
  brushSize,
  desktopMoveActive,
  hasDrawableMarks,
  drawableLayerVisible,
  desktopAnnotationActive,
  drawableReadOnly,
  drawablePanEnabled,
  drawableRef,
  onGoPrev,
  onGoNext,
  onOpenMobilePreview,
  onCloseRefDetail,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
  onItemsChange,
  onUndo,
  onClearAnnotationsInPlace,
  onFinishAnnotation,
  onCancelGenerationSlot,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onRetryGenerationSlot,
  onRequestFullscreen,
}: DetailCanvasProps) {
  const { t } = useI18n()

  return (
    <div
      ref={mobilePreviewAnchorRef}
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
            <ZoomableImageView
              key={refDetailId ?? 'ref'}
              src={refDetailSrc}
              alt=""
              label={t('imageDetail.canvas.referenceImageLabel')}
            />
          </div>
          <div className="h-full flex-1 min-w-0 relative">
            <ZoomableImageView
              key={currentImage.id}
              src={currentSrc ?? ''}
              alt={currentMeta?.prompt ?? ''}
              label={t('imageDetail.canvas.generatedImageLabel')}
            />
          </div>
          <button
            type="button"
            onClick={onCloseRefDetail}
            className="absolute top-3 right-3 z-30 chip"
            style={{ height: 26 }}
            title={t('imageDetail.action.exitCompare')}
            aria-label={t('imageDetail.action.exitCompare')}
          >
            <Icon name="close" size={12} />
            <span className="hidden sm:inline">{t('imageDetail.action.exitCompare')}</span>
            <span className="sm:hidden">{t('imageDetail.action.exitShort')}</span>
          </button>
        </div>
      ) : currentImage ? (
        <>
          {/* Always-on base layer. Keeping the decoded picture mounted
              underneath the drawable overlay means entering/exiting
              annotation never blanks the canvas — the bottom view simply
              gets re-revealed when the drawable layer unmounts. */}
          {!isMobileLayout && (
            <ZoomableImageView
              src={displayImage?.src ?? currentSrc ?? ''}
              alt={displayImage?.alt ?? currentMeta?.prompt ?? ''}
              onSwipeLeft={hasNext ? onGoNext : undefined}
              onSwipeRight={hasPrev ? onGoPrev : undefined}
              onRequestFullscreen={onRequestFullscreen}
            />
          )}
          {!refDetailId && isMobileLayout && (
            <button
              type="button"
              onClick={onOpenMobilePreview}
              aria-label={t('imageDetail.action.fullscreenPreview')}
              title={t('imageDetail.action.fullscreenPreview')}
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-colors md:hidden"
              style={{
                background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
                color: 'var(--color-text-2)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 0 1px var(--ring-edge), var(--shadow-lift)',
              }}
            >
              <Icon name="maximize" size={14} strokeWidth={1.8} />
            </button>
          )}
          {drawableLayerVisible && (
            <DrawableLayer
              ref={drawableRef}
              // Don't include imageId in the key — that would force unmount
              // on every page through, defeating the previous-decoded-image
              // placeholder strategy. Internal state syncs via imageId
              // changes instead. drawRevision still re-keys for explicit
              // resets (clearAll, etc.).
              key={drawRevision}
              imageId={currentImage.id}
              src={currentSrc ?? ''}
              mode={activeDrawMode}
              tool={drawTool}
              brushSize={brushSize}
              visibleModes={['mask', 'annotate']}
              eraseAllModes
              readOnly={drawableReadOnly}
              panEnabled={drawablePanEnabled}
              onItemsChange={onItemsChange}
            />
          )}
          {desktopAnnotationActive && (
            <DesktopAnnotationToolbar
              drawTool={drawTool}
              desktopMoveActive={desktopMoveActive}
              brushPreset={brushPreset}
              layerHasItems={hasDrawableMarks}
              onChangeDrawTool={(tool) => {
                onChangeDesktopMoveActive(false)
                onChangeDrawTool(tool)
              }}
              onChangeDesktopMoveActive={onChangeDesktopMoveActive}
              onChangeBrushPreset={onChangeBrushPreset}
              onUndo={onUndo}
              onClear={onClearAnnotationsInPlace}
              onFinish={onFinishAnnotation}
            />
          )}
        </>
      ) : (
        <SlotHero
          item={selectedItem}
          onCancelSlot={onCancelGenerationSlot}
          onCancelJob={onCancelGenerationJob}
          onDismissJob={onDismissGenerationJob}
          onRetry={onRetryGenerationSlot}
        />
      )}

      {!refDetailId && hasPrev && (
        <button
          onClick={onGoPrev}
          aria-label={t('imageDetail.action.previousImage')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
            color: 'var(--color-text-2)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 0 1px var(--ring-edge), var(--shadow-lift)',
          }}
        >
          <Icon name="chevron_left" size={14} strokeWidth={1.8} />
        </button>
      )}
      {!refDetailId && hasNext && (
        <button
          onClick={onGoNext}
          aria-label={t('imageDetail.action.nextImage')}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
            color: 'var(--color-text-2)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 0 1px var(--ring-edge), var(--shadow-lift)',
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
  )
}
