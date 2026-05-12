import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { useI18n } from '../../i18n'
import { RerollModelMenu } from './RerollModelMenu'
import type { RerollModelOption } from './rerollModelOptions'

type RerollSplitButtonProps = {
  options: RerollModelOption[]
  disabled?: boolean
  variant?: 'chip' | 'mobile'
  menuPlacement?: 'top' | 'bottom'
  onReroll: (modelId?: string) => void
}

export function RerollSplitButton({
  options,
  disabled,
  variant = 'chip',
  menuPlacement = 'bottom',
  onReroll,
}: RerollSplitButtonProps) {
  const { t } = useI18n()

  if (variant === 'mobile') {
    return (
      <div className="detail-mobile-action-split">
        <Tooltip
          text={t('imageDetail.action.regenerateOriginal')}
          placement="top"
          className="flex h-full min-w-0 flex-1"
        >
          <button
            type="button"
            className="detail-mobile-action-split-main"
            onClick={() => onReroll()}
            disabled={disabled}
          >
            <Icon name="refresh" size={13} strokeWidth={1.8} className="action-soft-icon" />
            {t('imageDetail.action.redoOriginal')}
          </button>
        </Tooltip>
        <Tooltip text={t('imageDetail.rerollMenu.moreModels')} placement="top" className="inline-flex h-full shrink-0">
          <RerollModelMenu
            options={options}
            disabled={disabled}
            buttonClassName="detail-mobile-action-split-menu"
            menuPlacement={menuPlacement}
            onSelect={onReroll}
          />
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="split-chip h-7 text-sm font-normal">
      <Tooltip
        text={t('imageDetail.action.regenerateOriginal')}
        placement={menuPlacement}
        className="inline-flex h-full"
      >
        <button type="button" className="split-chip-main" onClick={() => onReroll()} disabled={disabled}>
          <Icon name="refresh" size={14} strokeWidth={1.8} />
          {t('imageDetail.action.redoOriginal')}
        </button>
      </Tooltip>
      <Tooltip text={t('imageDetail.rerollMenu.moreModels')} placement={menuPlacement} className="inline-flex h-full">
        <RerollModelMenu
          options={options}
          disabled={disabled}
          buttonClassName="split-chip-menu"
          menuPlacement={menuPlacement}
          onSelect={onReroll}
        />
      </Tooltip>
    </div>
  )
}
