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
  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-3">宽高比</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = value === option
          const [px, py] = computePixels(option, resolution)
          const shape = shapeSize(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`flex items-center gap-2 px-2.5 py-2.5 rounded-2xl transition-colors text-left w-full
                ${
                  selected
                    ? 'bg-primary-dim'
                    : 'bg-surface-container hover:bg-surface-container-high'
                }`}
            >
              <div className="flex items-center justify-center w-5 h-5 shrink-0">
                <div
                  className={`rounded-sm ${selected ? 'bg-primary' : 'bg-on-surface/25'}`}
                  style={{ width: shape.w, height: shape.h }}
                />
              </div>
              <div className="min-w-0 overflow-hidden">
                <div className={`text-xs font-semibold leading-none ${selected ? 'text-primary' : 'text-on-surface'}`}>
                  {option}
                </div>
                <div className={`text-[9px] font-mono leading-none mt-1 truncate ${selected ? 'text-primary/70' : 'text-on-surface-variant/50'}`}>
                  {px}×{py}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
