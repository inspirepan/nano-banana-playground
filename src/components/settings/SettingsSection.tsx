import type { ReactNode } from 'react'

type SettingsSectionProps = {
  label?: ReactNode
  hint?: ReactNode
  /** Adds a 1px top divider to separate this section from the previous one. */
  divider?: boolean
  /** Custom content rendered to the right of the label, e.g. action buttons. */
  actions?: ReactNode
  children: ReactNode
}

// Section grouping for multiple controls. Children are stacked with `space-y-3`
// (no indent), and an optional top divider separates adjacent sections.
export function SettingsSection({ label, hint, divider, actions, children }: SettingsSectionProps) {
  return (
    <section className={divider ? 'space-y-3 pt-4 shadow-[inset_0_1px_0_var(--ring-edge-soft)]' : 'space-y-3'}>
      {(label || hint || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {label && <div className="label mb-1">{label}</div>}
            {hint && <p className="text-sm leading-relaxed text-(--color-text-3)">{hint}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
