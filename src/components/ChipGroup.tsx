type Props = {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function ChipGroup({ label, options, value, onChange }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-3">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-3 py-1 text-xs rounded-full transition-colors
              ${
                value === option
                  ? 'bg-primary-dim text-primary font-semibold'
                  : 'bg-surface-container text-on-surface font-semibold hover:bg-surface-container-high'
              }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
