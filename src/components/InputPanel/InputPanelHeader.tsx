import type { InputMode } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

type Props = {
  inputMode: InputMode
  showInputModeSwitcher: boolean
  onInputModeChange: (mode: InputMode) => void
  onOpenApiKeys: () => void
}

export function InputPanelHeader({ inputMode, showInputModeSwitcher, onInputModeChange, onOpenApiKeys }: Props) {
  const { t } = useI18n()
  return (
    <div
      className={`${inputMode === 'agent' ? 'mb-[10px]' : 'mb-[18px]'} flex min-h-[30px] items-center gap-2.5 px-[var(--agent-panel-padding-x,18px)]`}
    >
      <div className="min-w-0 font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
        {t('app.name')}
      </div>
      <div className="flex-1" />
      {showInputModeSwitcher && (
        <div
          role="tablist"
          aria-label={t('input.mode.aria')}
          className="flex w-[208px] shrink-0 items-center gap-1 rounded-[var(--radius-md)] bg-(--color-surface-3) p-[2px]"
        >
          {(
            [
              { mode: 'generate' as InputMode, label: t('input.mode.generate'), icon: 'wand' as const },
              { mode: 'agent' as InputMode, label: t('common.agent'), icon: 'bot' as const },
            ]
          ).map(({ mode, label, icon }) => {
            const active = inputMode === mode
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onInputModeChange(mode)}
                className={`inline-flex h-[26px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-base font-medium transition-[color,background-color,box-shadow] duration-150 ${
                  active
                    ? 'bg-(--color-surface) text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge)]'
                    : 'text-(--color-text-3) hover:text-(--color-text)'
                }`}
              >
                <Icon name={icon} size={13} className="shrink-0 opacity-80" />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onOpenApiKeys}
        className="icon-btn"
        title={t('common.settings')}
        aria-label={t('common.settings')}
      >
        <Icon name="settings" size={14} />
      </button>
    </div>
  )
}
