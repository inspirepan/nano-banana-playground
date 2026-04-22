import { useState } from 'react'
import { Icon } from './Icon'

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
          <Icon name="expand_more" className={`h-4 w-4 text-on-surface-variant/70 group-hover/header:text-on-surface transition-[transform,color] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
        <div className="overflow-hidden">
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`min-w-16 rounded-xl border px-3 py-2.5 text-sm font-medium tabular-nums transition-colors
                  ${
                    value === option
                      ? 'border-primary/20 bg-primary-dim text-primary hover:bg-primary/15 active:bg-primary/20'
                      : 'border-transparent bg-surface-container text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'
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
