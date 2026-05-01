import { Icon, type IconName } from '../Icon'
import { BRUSH_PRESETS, type BrushPresetId } from './annotationPresets'
import type { DrawTool } from './DrawableLayer'
import { useI18n } from '../../i18n'

export function BrushPresetDot({ preset }: { preset: (typeof BRUSH_PRESETS)[number] }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
      <span className="rounded-full bg-current" style={{ width: preset.dot, height: preset.dot }} />
    </span>
  )
}

export function DesktopAnnotationToolbar({
  drawTool,
  desktopMoveActive,
  brushPreset,
  layerHasItems,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
  onUndo,
  onClear,
  onFinish,
}: {
  drawTool: DrawTool
  desktopMoveActive: boolean
  brushPreset: BrushPresetId
  layerHasItems: boolean
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeDesktopMoveActive: (active: boolean) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
  onUndo: () => void
  onClear: () => void
  onFinish: () => void
}) {
  const { t } = useI18n()
  const toolOptions: Array<{ id: DrawTool | 'move'; label: string; icon: IconName }> = [
    { id: 'move', label: t('imageDetail.annotation.tool.move'), icon: 'mouse_pointer' },
    { id: 'brush', label: t('imageDetail.annotation.tool.brush'), icon: 'brush' },
    { id: 'step', label: t('imageDetail.annotation.tool.step'), icon: 'map_pin' },
    { id: 'eraser', label: t('imageDetail.annotation.tool.eraser'), icon: 'eraser' },
  ]

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 hidden max-w-[calc(100%-24px)] -translate-x-1/2 md:block">
      <div className="annotation-toolbar-panel pointer-events-auto">
        <div className="annotation-toolbar-row">
          {toolOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="annotation-tool-btn shrink-0"
              data-active={item.id === 'move' ? desktopMoveActive : !desktopMoveActive && drawTool === item.id}
              onClick={() => {
                if (item.id === 'move') onChangeDesktopMoveActive(true)
                else onChangeDrawTool(item.id)
              }}
            >
              <Icon name={item.icon} size={13} strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="annotation-toolbar-row">
          {!desktopMoveActive && drawTool !== 'eraser' && (
            <>
              {BRUSH_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="annotation-dot-btn shrink-0"
                  data-active={brushPreset === item.id}
                  onClick={() => onChangeBrushPreset(item.id)}
                  title={t(item.labelKey)}
                  aria-label={t(item.labelKey)}
                >
                  <BrushPresetDot preset={item} />
                </button>
              ))}
              <div className="annotation-toolbar-divider mx-1 h-4 w-px shrink-0" />
            </>
          )}
          <button type="button" className="annotation-tool-btn shrink-0" onClick={onUndo} disabled={!layerHasItems}>
            <Icon name="undo" size={13} strokeWidth={1.8} />
            {t('imageDetail.footer.undo')}
          </button>
          <button
            type="button"
            className="annotation-tool-btn shrink-0"
            data-variant="danger"
            onClick={onClear}
            disabled={!layerHasItems}
          >
            {t('common.clear')}
          </button>
          <button type="button" className="annotation-finish-btn shrink-0" onClick={onFinish}>
            <Icon name="check" size={13} strokeWidth={1.8} />
            {t('imageDetail.action.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
