type Props = {
  options: string[]
  value: string
  resolution: string
  onChange: (value: string) => void
  pixelLabel?: (ratio: string, resolution: string) => string
  // When false, the "宽高比" header row is omitted. Useful when rendered
  // under an enclosing section that already labels the control.
  showLabel?: boolean
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
  if (w >= h) return [longerSide, Math.round(longerSide * h / w)]
  return [Math.round(longerSide * w / h), longerSide]
}

function defaultPixelLabel(ratio: string, resolution: string): string {
  const [px, py] = computePixels(ratio, resolution)
  return `${px}×${py}`
}

function glyphSize(ratio: string): { w: number; h: number } {
  const max = 14
  const [w, h] = ratio.split(':').map(Number)
  const r = w / h
  if (r >= 1) return { w: max, h: Math.max(3, Math.round(max / r)) }
  return { w: Math.max(3, Math.round(max * r)), h: max }
}

export function AspectRatioSelector({ options, value, resolution, onChange, pixelLabel = defaultPixelLabel, showLabel = true }: Props) {
  return (
    <div>
      {showLabel ? (
        <div className="flex items-center justify-between mb-1.5">
          <span className="label">宽高比</span>
          <span className="mono text-[11px] text-(--color-text-4)">{pixelLabel(value, resolution)}</span>
        </div>
      ) : (
        <div className="flex justify-end mb-1.5">
          <span className="mono text-[11px] text-(--color-text-4)">{pixelLabel(value, resolution)}</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((option, idx) => {
          const { w, h } = glyphSize(option)
          const [left, right] = option.split(':')
          const isActive = value === option
          const isBottomRow = Math.floor(idx / 4) === Math.floor((options.length - 1) / 4)
          return (
            <div key={option} className="relative group">
              <button
                type="button"
                onClick={() => onChange(option)}
                className="aspect-tile w-full"
                data-active={isActive}
              >
                {/* fixed 14x14 glyph slot — center the rectangle inside */}
                <span className="inline-flex items-center justify-center shrink-0" style={{ width: 14, height: 14 }}>
                  <span className="glyph" style={{ width: w, height: h }} />
                </span>
                {/* ratio digits — fixed 2ch slots keep every colon column-aligned */}
                <span className="inline-flex items-center">
                  <span className="inline-block text-right" style={{ width: '2ch' }}>{left}</span>
                  <span>:</span>
                  <span className="inline-block text-left" style={{ width: '2ch' }}>{right}</span>
                </span>
              </button>
              {/* Notion-style pixel tooltip */}
              <div
                className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 px-2 py-1 rounded-[5px] mono text-[11px] whitespace-nowrap opacity-0 translate-y-0.5 transition-[opacity,translate] duration-150 delay-100 group-hover:opacity-100 group-hover:translate-y-0 ${isBottomRow ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
                style={{
                  background: 'var(--color-text)',
                  color: 'var(--color-bg)',
                  boxShadow: '0 6px 16px -6px rgba(15,17,21,0.24), 0 2px 4px rgba(15,17,21,0.08)',
                }}
              >
                {pixelLabel(option, resolution)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
