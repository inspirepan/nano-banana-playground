import type { CSSProperties, ReactNode } from 'react'

export type CardChoiceOption<T extends string | number> = {
  value: T
  title: ReactNode
  description?: ReactNode
  /** Inline style applied to the button element (e.g. `fontFamily` for previews). */
  style?: CSSProperties
  disabled?: boolean
}

type CardChoiceProps<T extends string | number> = {
  options: CardChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  /** 2-col on tablet+ for sparse choices; 3-col for denser lists like fonts. */
  columns?: 2 | 3
  ariaLabel?: string
}

// Card-grid single-select for choices that need per-option descriptions or
// previews. Selected state uses a tinted fill with a neutral inset ring.
export function CardChoice<T extends string | number>({
  options,
  value,
  onChange,
  columns = 2,
  ariaLabel,
}: CardChoiceProps<T>) {
  const gridClass = columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`grid gap-2 ${gridClass}`}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
            data-active={active || undefined}
            className={`flex flex-col items-start gap-1 rounded-[var(--radius-sm)] px-3 py-2 text-left transition-[box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-50 ${
              active ? 'bg-(--color-accent-wash)' : 'bg-(--color-surface) hover:bg-(--color-surface-2)'
            }`}
            style={{
              boxShadow: 'inset 0 0 0 1px var(--ring-edge-soft)',
              ...option.style,
            }}
          >
            <span className={`text-sm font-medium ${active ? 'text-(--color-accent-text)' : 'text-(--color-text)'}`}>
              {option.title}
            </span>
            {option.description && (
              <span className={`text-sm ${active ? 'text-(--color-text-2)' : 'text-(--color-text-3)'}`}>
                {option.description}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
