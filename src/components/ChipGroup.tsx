type Props = {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function ChipGroup({ label, options, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-on-surface-variant">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors
              ${
                value === option
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface border-outline-variant text-on-surface hover:bg-surface-container'
              }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
