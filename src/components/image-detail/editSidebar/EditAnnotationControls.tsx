import { useI18n } from '../../../i18n'
import { Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'
import { BrushPresetDot } from '../annotationControls'
import { BRUSH_PRESETS, type BrushPresetId } from '../annotationPresets'
import type { DrawTool } from '../DrawableLayer'

type Props = {
  annotationActive: boolean
  hasAnnotations: boolean
  annotationToolsFloating: boolean
  drawTool: DrawTool
  desktopMoveActive: boolean
  brushPreset: BrushPresetId
  onStartAnnotation: () => void
  onFinishAnnotation: () => void
  onClearAnnotations: () => void
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeDesktopMoveActive: (active: boolean) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
}

export function EditAnnotationControls({
  annotationActive,
  hasAnnotations,
  annotationToolsFloating,
  drawTool,
  desktopMoveActive,
  brushPreset,
  onStartAnnotation,
  onFinishAnnotation,
  onClearAnnotations,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="mb-[18px]">
      <div className="label mb-1.5">{t('imageDetail.annotation.label')}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="chip flex-1 justify-center"
          onClick={annotationActive ? onFinishAnnotation : onStartAnnotation}
        >
          <Icon name={annotationActive ? 'check' : 'brush'} size={13} strokeWidth={1.8} />
          {annotationActive ? t('imageDetail.action.finishAnnotation') : t('imageDetail.action.startAnnotation')}
        </button>
        {hasAnnotations && (
          <button type="button" className="chip ghost shrink-0" onClick={onClearAnnotations}>
            {t('imageDetail.action.clearAnnotations')}
          </button>
        )}
      </div>
      {annotationActive && !annotationToolsFloating && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {[
              { id: 'move' as const, label: t('imageDetail.annotation.tool.move'), icon: 'mouse_pointer' as const },
              { id: 'brush' as const, label: t('imageDetail.annotation.tool.brush'), icon: 'brush' as const },
              { id: 'step' as const, label: t('imageDetail.annotation.tool.step'), icon: 'map_pin' as const },
              { id: 'eraser' as const, label: t('imageDetail.annotation.tool.eraser'), icon: 'eraser' as const },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip shrink-0"
                data-active={item.id === 'move' ? desktopMoveActive : !desktopMoveActive && drawTool === item.id}
                onClick={() => {
                  if (item.id === 'move') {
                    onChangeDesktopMoveActive(true)
                  } else {
                    onChangeDrawTool(item.id)
                  }
                }}
              >
                <Icon name={item.icon} size={13} strokeWidth={1.8} />
                {item.label}
              </button>
            ))}
          </div>
          {!desktopMoveActive && drawTool !== 'eraser' && (
            <div className="grid grid-cols-3 gap-1.5">
              {BRUSH_PRESETS.map((item) => {
                const label = t(item.labelKey)
                return (
                  <Tooltip key={item.id} text={label} placement="top" className="min-w-0">
                    <button
                      type="button"
                      className="chip w-full justify-center"
                      data-active={brushPreset === item.id}
                      onClick={() => onChangeBrushPreset(item.id)}
                      aria-label={label}
                    >
                      <BrushPresetDot preset={item} />
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
