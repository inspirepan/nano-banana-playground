import { useI18n } from '../i18n'
import { Tooltip } from './Tooltip'

type Props = {
  options: string[]
  value: string
  resolution: string
  onChange: (value: string) => void
  pixelLabel?: (ratio: string, resolution: string) => string
  labelClassName?: string
  // When false, the aspect ratio header row is omitted. Useful when rendered
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
  if (w >= h) return [longerSide, Math.round((longerSide * h) / w)]
  return [Math.round((longerSide * w) / h), longerSide]
}

function defaultPixelLabel(ratio: string, resolution: string): string {
  const [px, py] = computePixels(ratio, resolution)
  return `${px}×${py}`
}

// Ratio glyphs are sized against a 14x14 slot. Shapes fall into three visual
// tiers so the chip row reads as a real ratio ladder instead of near-identical
// placeholders:
// - square (1:1) sits slightly inset from the slot for breathing room
// - standard portrait/landscape scales the long axis to 14 and derives the
//   short axis from the ratio
// - extreme ratios (>= 4:1 or <= 1:4) clamp to a 2px hairline bar so 1:4 vs
//   1:8 still read as "thin" rather than bloating back toward a rectangle
function glyphSize(ratio: string): { w: number; h: number } {
  const [w, h] = ratio.split(':').map(Number)
  const max = 14
  const r = w / h

  if (r === 1) return { w: 11, h: 11 }
  if (r >= 4) return { w: max, h: 2 }
  if (r <= 0.25) return { w: 2, h: max }
  if (r > 1) return { w: max, h: Math.max(4, Math.round(max / r)) }
  return { w: Math.max(4, Math.round(max * r)), h: max }
}

export function AspectRatioSelector({
  options,
  value,
  resolution,
  onChange,
  pixelLabel = defaultPixelLabel,
  labelClassName = 'label',
  showLabel = true,
}: Props) {
  const { t } = useI18n()

  return (
    <div>
      {showLabel ? (
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelClassName}>{t('input.aspectRatio.label')}</span>
          <span className="text-sm text-(--color-text-3) tabular-nums">{pixelLabel(value, resolution)}</span>
        </div>
      ) : (
        <div className="flex justify-end mb-1.5">
          <span className="text-sm text-(--color-text-3) tabular-nums">{pixelLabel(value, resolution)}</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((option, idx) => {
          const { w, h } = glyphSize(option)
          const isThin = w <= 2 || h <= 2
          const [left, right] = option.split(':')
          const isActive = value === option
          const pixelText = pixelLabel(option, resolution)
          const isBottomRow = Math.floor(idx / 4) === Math.floor((options.length - 1) / 4)
          return (
            <Tooltip key={option} text={pixelText} placement={isBottomRow ? 'top' : 'bottom'} className="w-full">
              <button
                type="button"
                onClick={() => onChange(option)}
                className="aspect-tile w-full"
                data-active={isActive}
                aria-label={t('input.aspectRatio.optionAria', { ratio: option, pixels: pixelText })}
              >
                {/* fixed 14x14 glyph slot — center the rectangle inside */}
                <span className="inline-flex items-center justify-center shrink-0" style={{ width: 14, height: 14 }}>
                  <span className="glyph" data-thin={isThin || undefined} style={{ width: w, height: h }} />
                </span>
                {/* ratio digits — fixed 2ch slots keep every colon column-aligned */}
                <span className="inline-flex items-center text-base">
                  <span className="inline-block text-right" style={{ width: '2ch' }}>
                    {left}
                  </span>
                  <span>:</span>
                  <span className="inline-block text-left" style={{ width: '2ch' }}>
                    {right}
                  </span>
                </span>
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
