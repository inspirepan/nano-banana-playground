import { Icon, type IconName } from '../Icon'
import { BRUSH_PRESETS, type BrushPresetId } from './annotationPresets'
import type { DrawTool } from './DrawableLayer'

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
  const toolOptions: Array<{ id: DrawTool | 'move'; label: string; icon: IconName }> = [
    { id: 'move', label: '拖动', icon: 'mouse_pointer' },
    { id: 'brush', label: '涂抹', icon: 'brush' },
    { id: 'step', label: '编号', icon: 'map_pin' },
    { id: 'eraser', label: '橡皮', icon: 'eraser' },
  ]

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 hidden -translate-x-1/2 md:block">
      <div
        className="pointer-events-auto flex flex-nowrap items-center justify-start gap-0.5 overflow-x-auto rounded-[10px] p-1"
        style={{
          maxWidth: 'min(820px, calc(100vw - 420px))',
          background: 'var(--color-surface)',
          boxShadow: '0 0 0 1px var(--ring-edge), 0 14px 30px -22px rgba(0,0,0,0.32)',
        }}
      >
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

        {!desktopMoveActive && drawTool !== 'eraser' && (
          <>
            <div className="annotation-toolbar-divider mx-1 h-4 w-px shrink-0" />
            {BRUSH_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="annotation-dot-btn shrink-0"
                data-active={brushPreset === item.id}
                onClick={() => onChangeBrushPreset(item.id)}
                title={item.label}
                aria-label={item.label}
              >
                <BrushPresetDot preset={item} />
              </button>
            ))}
          </>
        )}

        <div className="annotation-toolbar-divider mx-1 h-4 w-px shrink-0" />
        <button type="button" className="annotation-tool-btn shrink-0" onClick={onUndo} disabled={!layerHasItems}>
          <Icon name="undo" size={13} strokeWidth={1.8} />
          撤销
        </button>
        <button type="button" className="annotation-tool-btn shrink-0" onClick={onClear} disabled={!layerHasItems}>
          清空
        </button>
        <div className="annotation-toolbar-divider mx-1 h-4 w-px shrink-0" />
        <button type="button" className="annotation-finish-btn shrink-0" onClick={onFinish}>
          <Icon name="check" size={13} strokeWidth={1.8} />
          完成
        </button>
      </div>
    </div>
  )
}
