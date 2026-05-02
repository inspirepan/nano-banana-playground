import { DynamicIcon, iconNames, type IconName as LucideIconName } from 'lucide-react/dynamic'
import { useMemo, useRef, useState } from 'react'

import { Icon } from './Icon'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import { useI18n } from '../i18n'

const ALL_ICON_NAMES = iconNames as readonly LucideIconName[]
const ICON_NAME_SET = new Set<string>(iconNames)
const RENDER_CAP = 240

type Props = {
  value: string
  onChange: (name: string) => void
}

export function IconPicker({ value, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo<readonly LucideIconName[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_ICON_NAMES.slice(0, RENDER_CAP)
    const matches: LucideIconName[] = []
    for (const name of ALL_ICON_NAMES) {
      if (name.includes(q)) {
        matches.push(name)
        if (matches.length >= RENDER_CAP) break
      }
    }
    return matches
  }, [query])

  useExternalSync(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') setOpen(false)
    },
    undefined,
    open,
  )

  const normalizedValue = ICON_NAME_SET.has(value) ? (value as LucideIconName) : ('sparkles' as LucideIconName)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2.5 py-2 text-left text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <DynamicIcon name={normalizedValue} size={14} className="shrink-0" />
        <span className="mono min-w-0 flex-1 truncate text-xs text-(--color-text-2)">{value || normalizedValue}</span>
        <Icon name="chevron_down" size={12} className="shrink-0 text-(--color-text-3)" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-[320px] rounded-[var(--radius-md)] bg-(--color-surface) p-2 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
          <div className="relative">
            <Icon
              name="search"
              size={12}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--color-text-4)"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('settings.agentSkills.iconSearchPlaceholder')}
              className="w-full rounded-[var(--radius-sm)] bg-(--color-surface-2) py-1.5 pr-2.5 pl-7 text-xs text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] outline-none placeholder:text-(--color-text-4) focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
            />
          </div>

          <div className="mt-2 grid max-h-[260px] grid-cols-8 gap-1 overflow-y-auto pr-1">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                }}
                data-active={value === name || undefined}
                className="flex aspect-square items-center justify-center rounded-[var(--radius-xs)] text-(--color-text-2) transition-colors hover:bg-(--color-surface-2) data-[active]:bg-(--color-accent-wash) data-[active]:text-(--color-accent)"
              >
                <DynamicIcon name={name} size={14} />
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="px-1 py-3 text-center text-xs text-(--color-text-4)">
              {t('settings.agentSkills.iconNoResults')}
            </div>
          )}

          {filtered.length === RENDER_CAP && (
            <div className="mt-1.5 px-1 text-[11px] text-(--color-text-4)">
              {t('settings.agentSkills.iconResultsCapped', { cap: RENDER_CAP })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
