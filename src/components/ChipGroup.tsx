import { useState } from 'react'

type Props = {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function ChipGroup({ label, options, value, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        data-no-ripple
        className="flex items-center gap-2 group/header"
      >
        <span className="text-base font-medium text-on-surface-variant">{label}</span>
        <div className="flex items-center gap-2">
          {collapsed && (
            <span className="rounded-md bg-primary-dim px-2 py-0.5 text-sm font-medium tabular-nums text-primary">
              {value}
            </span>
          )}
          <span className={`material-symbols-rounded text-base text-on-surface-variant/70 group-hover/header:text-on-surface transition-[transform,color] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? '' : 'rotate-180'}`}>
            expand_more
          </span>
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2 mt-3">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`px-3 py-3 text-base rounded-xl tabular-nums transition-colors
                  ${
                    value === option
                      ? 'bg-primary-dim text-primary font-medium hover:bg-primary/15 active:bg-primary/20'
                      : 'bg-surface-container text-on-surface font-medium hover:bg-on-surface/8 active:bg-on-surface/12'
                  }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
