import type { ReactNode } from 'react'

type SettingsFieldProps = {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}

// Single labeled control: eyebrow + optional hint + slightly indented control.
// Use SettingsSection instead when a section contains multiple unrelated controls.
export function SettingsField({ label, hint, children }: SettingsFieldProps) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {hint && <p className="mb-2.5 text-sm leading-relaxed text-(--color-text-3)">{hint}</p>}
      <div className="pl-1">{children}</div>
    </div>
  )
}
