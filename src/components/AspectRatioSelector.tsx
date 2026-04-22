import { useState } from 'react'

type Props = {
  options: string[]
  value: string
  resolution: string
  onChange: (value: string) => void
}

const RESOLUTION_PX: Record<string, number> = {
  '512': 512,
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
}

const COMMON_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2']

function computePixels(ratio: string, resolution: string): [number, number] {
  const [w, h] = ratio.split(':').map(Number)
  const longerSide = RESOLUTION_PX[resolution] ?? 1024
  if (w >= h) {
    return [longerSide, Math.round(longerSide * h / w)]
  }
  return [Math.round(longerSide * w / h), longerSide]
}

const SHAPE_MAX = 20

function shapeSize(ratio: string): { w: number; h: number } {
  const [rw, rh] = ratio.split(':').map(Number)
  if (rw >= rh) {
    return { w: SHAPE_MAX, h: Math.max(3, Math.round(SHAPE_MAX * rh / rw)) }
  }
  return { w: Math.max(3, Math.round(SHAPE_MAX * rw / rh)), h: SHAPE_MAX }
}

export function AspectRatioSelector({ options, value, resolution, onChange }: Props) {
  // If the model exposes only a small number of ratios, skip the show-all/show-common
  // split entirely — there's nothing meaningful to collapse.
  const skipFiltering = options.length <= COMMON_RATIOS.length
  const [showAll, setShowAll] = useState(skipFiltering || !COMMON_RATIOS.includes(value))
  const [collapsed, setCollapsed] = useState(true)

  // collapsed: show common ratios + selected (if non-common), in original order
  const collapsedSet = new Set([...COMMON_RATIOS, value])
  const visibleOptions = showAll ? options : options.filter((o) => collapsedSet.has(o))
  const hiddenCount = options.length - visibleOptions.length

  const selectedShape = shapeSize(value)
  // scale down for the compact badge in the header
  const badgeW = Math.round(selectedShape.w * 0.65)
  const badgeH = Math.round(selectedShape.h * 0.65)

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        data-no-ripple
        className="flex items-center gap-2 group/header"
      >
        <span className="text-sm font-medium text-on-surface-variant">宽高比</span>
        <div className="flex items-center gap-2">
          {collapsed && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary-dim">
              <div className="flex items-center justify-center shrink-0" style={{ width: 13, height: 13 }}>
                <div className="rounded-sm bg-primary" style={{ width: badgeW, height: badgeH }} />
              </div>
              <span className="text-xs font-medium text-primary tabular-nums">{value}</span>
            </div>
          )}
          <span className={`material-symbols-rounded text-base text-on-surface-variant/70 group-hover/header:text-on-surface transition-[transform,color] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? '' : 'rotate-180'}`}>
            expand_more
          </span>
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
        <div className="overflow-hidden">
        <div className="grid grid-cols-2 gap-1 mt-3">
          {visibleOptions.map((option) => {
            const selected = value === option
            const [px, py] = computePixels(option, resolution)
            const shape = shapeSize(option)
            return (
              <div key={option} className="relative group">
                <button
                  type="button"
                  onClick={() => onChange(option)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl transition-colors text-left w-full
                    ${
                      selected
                        ? 'bg-primary-dim hover:bg-primary/15 active:bg-primary/20'
                        : 'bg-surface-container hover:bg-on-surface/8 active:bg-on-surface/12'
                    }`}
                >
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    <div
                      className={`rounded-sm ${selected ? 'bg-primary' : 'bg-on-surface/25'}`}
                      style={{ width: shape.w, height: shape.h }}
                    />
                  </div>
                  <div className={`text-xs font-medium leading-none tabular-nums ${selected ? 'text-primary' : 'text-on-surface'}`}>
                    {option}
                  </div>
                </button>
                {/* Pixel tooltip */}
                <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2
                                px-2 py-1 rounded-lg text-2xs font-mono leading-none whitespace-nowrap
                                bg-on-surface text-surface
                                opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                  {px}×{py}
                </div>
              </div>
            )
          })}

          {/* expand / collapse toggle — hidden when there's nothing to hide */}
          {!skipFiltering && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              data-no-ripple
              className="col-span-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-none focus:outline-none"
            >
              <span>{showAll ? '收起' : `+${hiddenCount} 更多`}</span>
              <span className={`material-symbols-rounded text-sm transition-transform ${showAll ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
