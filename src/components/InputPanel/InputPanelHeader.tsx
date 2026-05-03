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
          className="segmented w-[172px] shrink-0"
          style={{
            ['--seg-count' as string]: 2,
            ['--seg-index' as string]: inputMode === 'generate' ? 0 : 1,
          }}
          aria-label={t('input.mode.aria')}
        >
          <button type="button" data-active={inputMode === 'generate'} onClick={() => onInputModeChange('generate')}>
            <span>{t('input.mode.generate')}</span>
          </button>
          <button type="button" data-active={inputMode === 'agent'} onClick={() => onInputModeChange('agent')}>
            <span>{t('common.agent')}</span>
          </button>
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
