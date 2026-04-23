import { Tooltip } from './Tooltip'

type Props = {
  label?: string
  options: string[]
  value: string
  mono?: boolean
  columns?: number
  renderOption?: (option: string) => React.ReactNode
  // Per-option hover tooltip. Return undefined for options without one.
  tooltipFor?: (option: string) => string | undefined
  onChange: (value: string) => void
}

export function ChipGroup({ label, options, value, mono = true, columns, renderOption, tooltipFor, onChange }: Props) {
  const grid = columns
    ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 6 }
    : { display: 'flex', gap: 6, flexWrap: 'wrap' as const }

  const buttons = (
    <div style={grid}>
      {options.map((option) => {
        const tooltip = tooltipFor?.(option)
        if (!tooltip) {
          return (
            <button
              key={option}
              type="button"
              data-active={value === option}
              onClick={() => onChange(option)}
              className="chip justify-center"
              style={columns ? { flex: 1 } : undefined}
            >
              {renderOption ? renderOption(option) : <span className={mono ? 'mono' : ''}>{option}</span>}
            </button>
          )
        }
        return (
          <Tooltip key={option} text={tooltip}>
            <button
              type="button"
              data-active={value === option}
              onClick={() => onChange(option)}
              className="chip justify-center w-full"
            >
              {renderOption ? renderOption(option) : <span className={mono ? 'mono' : ''}>{option}</span>}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )

  if (!label) return buttons
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {buttons}
    </div>
  )
}
