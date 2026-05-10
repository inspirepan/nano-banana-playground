import type { ReactNode } from 'react'

import { Icon, type IconName } from '../Icon'
import { Tooltip } from '../Tooltip'

export type SegmentedOption<T extends string | number> = {
  value: T
  label: ReactNode
  icon?: IconName
  disabled?: boolean
  /** Tooltip text shown on hover when disabled (e.g. "configure API key first"). */
  disabledTooltip?: string
}

type SegmentedProps<T extends string | number> = {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Hugs content width instead of stretching to fill the row. */
  fitContent?: boolean
  ariaLabel?: string
}

// Sliding-thumb single-select for short labels. Use this for any equal-weight
// enum picker (language, mode, concurrency, web backend). For options that need
// per-row descriptions, use CardChoice instead.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  fitContent,
  ariaLabel,
}: SegmentedProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  return (
    <div
      className={fitContent ? 'segmented w-fit' : 'segmented'}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        ['--seg-count' as string]: options.length,
        ['--seg-index' as string]: activeIndex,
      }}
    >
      {options.map((option) => {
        const active = value === option.value
        const isDisabled = option.disabled
        // aria-disabled (rather than the native `disabled` attribute) keeps
        // pointer events firing on the button so Tooltip can pick up hover.
        // The onClick guard prevents selection while disabled.
        const button = (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={isDisabled || undefined}
            onClick={() => {
              if (!isDisabled) onChange(option.value)
            }}
            data-active={active || undefined}
          >
            <span className="relative min-w-0">
              {option.icon && (
                <span className="pointer-events-none absolute top-1/2 right-full mr-1 -translate-y-1/2">
                  <Icon name={option.icon} size={12} />
                </span>
              )}
              <span className="block truncate">{option.label}</span>
            </span>
          </button>
        )
        // Wrap in flex slot so the segmented thumb math (which assumes
        // equal-width children) keeps working regardless of Tooltip wrapping.
        if (isDisabled && option.disabledTooltip) {
          return (
            <Tooltip
              key={String(option.value)}
              text={option.disabledTooltip}
              placement="top"
              className="flex min-w-0 flex-1"
            >
              {button}
            </Tooltip>
          )
        }
        return (
          <div key={String(option.value)} className="flex min-w-0 flex-1">
            {button}
          </div>
        )
      })}
    </div>
  )
}
