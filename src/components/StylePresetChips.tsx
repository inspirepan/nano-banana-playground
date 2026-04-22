import { useMemo } from 'react'
import type { StylePreset } from '../config/styles'
import { getAllStylePresets } from '../lib/stylePresets'
import { Icon } from './Icon'

export const MAX_SELECTED_STYLES = 4

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onOpenManage: () => void
  // Increments whenever user presets change, so the list re-reads localStorage.
  revision?: number
  disabled?: boolean
}

// Group-aware multi-select chip list. No outer card wrapper — caller controls
// visual grouping. Caps selection at MAX_SELECTED_STYLES.
export function StylePresetChips({ selectedIds, onChange, onOpenManage, revision, disabled }: Props) {
  // `revision` busts the memo when user presets mutate via the manage dialog.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presets = useMemo(() => getAllStylePresets(), [revision])

  // Keep selectedIds that no longer exist pruned.
  const validSelected = useMemo(
    () => selectedIds.filter((id) => presets.some((p) => p.id === id)),
    [selectedIds, presets],
  )

  const groups = useMemo(() => {
    const map = new Map<string, StylePreset[]>()
    for (const p of presets) {
      const key = p.category ?? '其他'
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [presets])

  const atLimit = validSelected.length >= MAX_SELECTED_STYLES

  const toggle = (id: string) => {
    if (validSelected.includes(id)) {
      onChange(validSelected.filter((x) => x !== id))
      return
    }
    if (atLimit) return
    onChange([...validSelected, id])
  }

  const isFreePlay = validSelected.length === 0

  // Free-play chip — visualizes the implicit default "AI 自由发挥" state so the
  // user can tell at a glance what happens when no preset is selected. Click
  // clears any selection back to the default.
  const freePlayChip = (
    <button
      type="button"
      className="chip"
      data-active={isFreePlay}
      disabled={disabled}
      onClick={() => onChange([])}
      title="不选风格时，由 AI 自由发挥方向，产出 2-4 个方案"
      style={{ height: 24, fontSize: 11.5, padding: '0 8px' }}
    >
      <span>自由发挥</span>
    </button>
  )

  const singleGroup = groups.length === 1

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[11px] font-medium text-(--color-text-3) tracking-[0.02em]">风格</span>
        <span className="mono text-[11px] text-(--color-text-4)">{validSelected.length}/{MAX_SELECTED_STYLES}</span>
        <span className="text-[11px] text-(--color-text-4)">
          {isFreePlay ? '· 未选 → AI 自由发挥' : '· 每风格生成一个方案'}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onOpenManage}
          className="bg-transparent border-0 p-0 inline-flex items-center gap-1 text-[11px] text-(--color-text-3) hover:text-(--color-text) transition-colors"
          title="管理风格预设"
        >
          <Icon name="settings" size={11} />
          管理
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {singleGroup ? (
          // Single group: free-play chip inline with presets, one row
          <div className="flex flex-wrap gap-1.5">
            {freePlayChip}
            {groups[0][1].map((p) => renderChip(p, validSelected, atLimit, disabled, toggle))}
          </div>
        ) : (
          // Multiple groups: free-play chip on top row, category subheads below
          <>
            <div className="flex flex-wrap gap-1.5">{freePlayChip}</div>
            {groups.map(([category, list]) => (
              <div key={category} className="pt-0.5">
                <div className="text-[11.5px] font-semibold text-(--color-text-2) mb-1.5 tracking-[0.01em]">{category}</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((p) => renderChip(p, validSelected, atLimit, disabled, toggle))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function renderChip(
  p: StylePreset,
  validSelected: string[],
  atLimit: boolean,
  disabled: boolean | undefined,
  toggle: (id: string) => void,
) {
  const active = validSelected.includes(p.id)
  const locked = !active && (atLimit || disabled)
  return (
    <button
      key={p.id}
      type="button"
      className="chip"
      data-active={active}
      disabled={locked}
      onClick={() => toggle(p.id)}
      title={p.description || p.label}
      style={{ height: 24, fontSize: 11.5, padding: '0 8px', ...(locked ? { opacity: 0.4 } : undefined) }}
    >
      <span>{p.label}</span>
    </button>
  )
}
