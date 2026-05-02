import { Icon } from '../components/Icon'
import { useI18n } from '../i18n'

export type MobileTab = 'generate' | 'agent' | 'gallery'

export function Topbar({
  mobileTab,
  onMobileTabChange,
  onOpenSettings,
}: {
  mobileTab: MobileTab
  onMobileTabChange: (tab: MobileTab) => void
  onOpenSettings: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="shrink-0 px-3 pt-3 pb-2">
      <div className="mb-2 flex min-h-[30px] items-center gap-2.5">
        <div className="min-w-0 font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
          {t('app.name')}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn"
          title={t('common.settings')}
          aria-label={t('common.settings')}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>
      <div
        className="segmented"
        style={{
          ['--seg-count' as string]: 3,
          ['--seg-index' as string]: mobileTab === 'generate' ? 0 : mobileTab === 'agent' ? 1 : 2,
        }}
        aria-label={t('app.mobilePanel')}
      >
        <button type="button" data-active={mobileTab === 'generate'} onClick={() => onMobileTabChange('generate')}>
          {t('common.generate')}
        </button>
        <button type="button" data-active={mobileTab === 'agent'} onClick={() => onMobileTabChange('agent')}>
          {t('common.agent')}
        </button>
        <button type="button" data-active={mobileTab === 'gallery'} onClick={() => onMobileTabChange('gallery')}>
          {t('common.gallery')}
        </button>
      </div>
    </div>
  )
}
