type Props = {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function ChipGroup({ label, options, value, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-on-surface-variant mb-3">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-3 py-3 text-sm rounded-xl tabular-nums transition-colors
              ${
                value === option
                  ? 'bg-primary-dim text-primary font-medium hover:bg-primary/15 active:bg-primary/20'
                  : 'bg-surface-container md:bg-surface-container-high text-on-surface font-medium hover:bg-surface-container-high md:hover:bg-on-surface/8 md:active:bg-on-surface/12'
              }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
