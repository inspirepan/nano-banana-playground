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
  const [expanded, setExpanded] = useState(!COMMON_RATIOS.includes(value))

  // collapsed: show common ratios + selected (if non-common), in original order
  const collapsedSet = new Set([...COMMON_RATIOS, value])
  const visibleOptions = expanded ? options : options.filter((o) => collapsedSet.has(o))
  const hiddenCount = options.length - visibleOptions.length

  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-3">宽高比</label>
      <div className="grid grid-cols-2 gap-1">
        {visibleOptions.map((option) => {
          const selected = value === option
          const [px, py] = computePixels(option, resolution)
          const shape = shapeSize(option)
          return (
            <div key={option} className="relative group">
              <button
                type="button"
                onClick={() => onChange(option)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-colors text-left w-full
                  ${
                    selected
                      ? 'bg-primary-dim hover:bg-primary/15'
                      : 'bg-surface-container md:bg-surface-container-high hover:bg-surface-container-high md:hover:bg-on-surface/10'
                  }`}
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                  <div
                    className={`rounded-sm ${selected ? 'bg-primary' : 'bg-on-surface/25'}`}
                    style={{ width: shape.w, height: shape.h }}
                  />
                </div>
                <div className={`text-xs font-medium leading-none ${selected ? 'text-primary' : 'text-on-surface'}`}>
                  {option}
                </div>
              </button>
              {/* Pixel tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
                              px-2 py-1 rounded-lg text-[10px] font-mono leading-none whitespace-nowrap
                              bg-on-surface text-surface
                              opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                {px}×{py}
              </div>
            </div>
          )
        })}

        {/* expand / collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          data-no-ripple
          className="col-span-2 flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-on-surface-variant hover:text-on-surface transition-none focus:outline-none"
        >
          <span>{expanded ? '收起' : `+${hiddenCount} 更多`}</span>
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
