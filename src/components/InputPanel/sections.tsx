import type { ReactNode } from 'react'

import type { ModelOption, ModelToggleOption } from '../../config/models'
import { ChipGroup } from '../ChipGroup'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

// Bool options render as a chip (same pattern as resolution / quality / ratio
// selectors around them). "Enabled" = chip's active state; no extra checkbox,
// no two-row card. The leading `icon` from ModelToggleOption gives each toggle
// a visual hook.
function ToggleChip({
  option,
  active,
  onToggle,
}: {
  option: ModelToggleOption
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      className="chip justify-center w-full"
      data-active={active}
      onClick={onToggle}
    >
      {option.icon && <Icon name={option.icon} size={13} />}
      <span>{option.label}</span>
    </button>
  )
}

export const INPUT_LABEL_CLASS = 'label'

export function Section({
  label,
  right,
  hint,
  children,
}: {
  label: string
  right?: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-[18px]">
      <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
        <div className="flex items-center gap-2">
          <span className={INPUT_LABEL_CLASS}>{label}</span>
          {hint && <span className="text-sm text-(--color-text-3)">{hint}</span>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function OptionSection({
  option,
  value,
  onChange,
}: {
  option: ModelOption
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (option.type === 'select') {
    const current = typeof value === 'string' ? value : option.default
    const values = option.choices.map((c) => c.value)
    const labelFor = (v: string) => option.choices.find((c) => c.value === v)?.label ?? v
    const tooltipFor = (v: string) => option.choices.find((c) => c.value === v)?.tooltip
    return (
      <Section label={option.label} hint={option.hint}>
        <ChipGroup
          options={values}
          value={current}
          onChange={onChange}
          mono={false}
          columns={values.length}
          renderOption={(v) => <span>{labelFor(v)}</span>}
          tooltipFor={tooltipFor}
        />
      </Section>
    )
  }

  const active = value === true
  const chip = <ToggleChip option={option} active={active} onToggle={() => onChange(!active)} />
  return (
    <Section label={option.label} hint={option.hint}>
      {option.tooltip ? <Tooltip text={option.tooltip}>{chip}</Tooltip> : chip}
    </Section>
  )
}

export function ToggleGroupSection({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string
  hint?: string
  options: ModelToggleOption[]
  values: Record<string, unknown>
  onChange: (id: string, v: unknown) => void
}) {
  return (
    <Section label={label} hint={hint}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((opt) => {
          const active = values[opt.id] === true
          const onToggle = () => onChange(opt.id, !active)
          if (opt.tooltip) {
            return (
              <Tooltip key={opt.id} text={opt.tooltip}>
                <ToggleChip option={opt} active={active} onToggle={onToggle} />
              </Tooltip>
            )
          }
          return <ToggleChip key={opt.id} option={opt} active={active} onToggle={onToggle} />
        })}
      </div>
    </Section>
  )
}
