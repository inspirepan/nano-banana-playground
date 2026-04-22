type Props = {
  label?: string
  options: string[]
  value: string
  mono?: boolean
  columns?: number
  renderOption?: (option: string) => React.ReactNode
  onChange: (value: string) => void
}

export function ChipGroup({ label, options, value, mono = true, columns, renderOption, onChange }: Props) {
  const grid = columns
    ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 6 }
    : { display: 'flex', gap: 6, flexWrap: 'wrap' as const }

  const buttons = (
    <div style={grid}>
      {options.map((option) => (
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
      ))}
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
