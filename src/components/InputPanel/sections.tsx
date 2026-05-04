import type { ReactNode } from 'react'

import type { ModelOption, ModelToggleOption } from '../../config/models'
import { useI18n } from '../../i18n'
import { ChipGroup } from '../ChipGroup'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

export const INPUT_LABEL_CLASS = 'text-base font-semibold tracking-normal text-(--color-text-3)'

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
  const { t } = useI18n()

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
  const button = (
    <button type="button" className="chip justify-center w-full" data-active={active} onClick={() => onChange(!active)}>
      <span>{active ? t('input.option.enabled') : t('input.option.disabled')}</span>
    </button>
  )
  return (
    <Section label={option.label} hint={option.hint}>
      {option.tooltip ? <Tooltip text={option.tooltip}>{button}</Tooltip> : button}
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
          const button = (
            <button
              key={opt.id}
              type="button"
              role="checkbox"
              aria-checked={active}
              className="chip justify-center w-full"
              data-active={active}
              onClick={() => onChange(opt.id, !active)}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-[var(--radius-xs)] transition-colors"
                style={{
                  background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                  boxShadow: active ? 'inset 0 0 0 1px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge)',
                }}
              >
                {active && <Icon name="check" size={9} strokeWidth={3} style={{ color: 'var(--color-accent-fg)' }} />}
              </span>
              <span>{opt.label}</span>
            </button>
          )
          return opt.tooltip ? (
            <Tooltip key={opt.id} text={opt.tooltip}>
              {button}
            </Tooltip>
          ) : (
            <div key={opt.id}>{button}</div>
          )
        })}
      </div>
    </Section>
  )
}
