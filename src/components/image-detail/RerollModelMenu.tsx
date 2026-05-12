import { useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../Icon'
import { useWindowEvent } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import type { RerollModelOption } from './rerollModelOptions'

const MENU_WIDTH = 380
const MENU_MARGIN = 8

type MenuState = {
  x: number
  y: number
  originClassName: string
}

type RerollModelMenuProps = {
  options: RerollModelOption[]
  disabled?: boolean
  buttonClassName?: string
  menuPlacement?: 'top' | 'bottom'
  onSelect: (modelId: string) => void
}

export function RerollModelMenu({
  options,
  disabled,
  buttonClassName = 'chip px-2',
  menuPlacement = 'bottom',
  onSelect,
}: RerollModelMenuProps) {
  const { t } = useI18n()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const enabled = Boolean(menu)

  useWindowEvent('mousedown', () => setMenu(null), undefined, enabled)
  useWindowEvent('scroll', () => setMenu(null), { capture: true }, enabled)
  useWindowEvent('resize', () => setMenu(null), undefined, enabled)
  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') setMenu(null)
    },
    undefined,
    enabled,
  )

  const openMenu = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    const estimatedHeight = Math.max(1, options.length) * 38 + 8
    const opensUp = menuPlacement === 'top' || rect.bottom + estimatedHeight + MENU_MARGIN > window.innerHeight
    const x = Math.max(MENU_MARGIN, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MENU_MARGIN))
    const y = opensUp
      ? Math.max(MENU_MARGIN, rect.top - estimatedHeight - 6)
      : Math.min(rect.bottom + 6, window.innerHeight - estimatedHeight - MENU_MARGIN)
    setMenu({ x, y, originClassName: opensUp ? 'origin-bottom-right' : 'origin-top-right' })
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation()
          if (menu) setMenu(null)
          else openMenu(event.currentTarget)
        }}
        disabled={disabled || options.length === 0}
        aria-label={t('imageDetail.rerollMenu.moreModels')}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
      >
        <Icon name="more_vertical" size={13} strokeWidth={1.8} />
      </button>

      {menu &&
        createPortal(
          <div
            role="menu"
            style={{ top: menu.y, left: menu.x, width: MENU_WIDTH }}
            onMouseDown={(event) => event.stopPropagation()}
            className={`popover-pop fixed z-[140] ${menu.originClassName} rounded-[var(--radius-md)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]`}
          >
            {options.map((option) => (
              <button
                key={option.modelId}
                type="button"
                role="menuitem"
                disabled={option.disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  setMenu(null)
                  onSelect(option.modelId)
                }}
                className={`flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-(--color-surface-2) disabled:cursor-not-allowed disabled:text-(--color-text-4) disabled:hover:bg-transparent ${option.isCurrent ? 'text-(--color-text-2)' : 'text-(--color-text)'}`}
              >
                <span className="min-w-0 truncate">
                  {t('imageDetail.rerollMenu.useModel', { model: option.modelName })}
                </span>
                {option.isCurrent && (
                  <span className="shrink-0 text-xs text-(--color-text-3)">
                    ({t('imageDetail.rerollMenu.currentModel')})
                  </span>
                )}
                <span className="mono ml-auto shrink-0 text-xs text-(--color-text-3)">
                  {option.resolution} {option.aspectRatio}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
