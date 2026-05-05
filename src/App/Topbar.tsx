import { Icon, type IconName } from '../components/Icon'
import { useI18n } from '../i18n'

export type MobileTab = 'generate' | 'agent' | 'gallery'

const TAB_ICON: Record<MobileTab, IconName> = {
  generate: 'wand',
  agent: 'bot',
  gallery: 'images',
}

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

  const tabs: { key: MobileTab; label: string }[] = [
    { key: 'generate', label: t('common.generate') },
    { key: 'agent', label: t('common.agent') },
    { key: 'gallery', label: t('common.gallery') },
  ]

  return (
    <div className="shrink-0 px-3 pt-3 pb-2">
      <div className="flex min-h-[30px] items-center gap-2.5">
        <div
          role="tablist"
          aria-label={t('app.mobilePanel')}
          className="ml-3 flex min-w-0 w-[264px] max-w-[calc(100%-46px)] items-center gap-1 rounded-[var(--radius-md)] bg-(--color-surface-3) p-[2px] dark:bg-(--color-bg)"
        >
          {tabs.map((tab) => {
            const active = mobileTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onMobileTabChange(tab.key)}
                className={`inline-flex h-[26px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-base font-medium transition-[color,background-color,box-shadow] duration-150 ${
                  active
                    ? 'bg-(--color-surface) text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge)] dark:bg-(--color-surface-3)'
                    : 'text-(--color-text-3) hover:text-(--color-text)'
                }`}
              >
                <Icon name={TAB_ICON[tab.key]} size={13} className="shrink-0 opacity-80" />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn ml-auto shrink-0"
          title={t('common.settings')}
          aria-label={t('common.settings')}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>
    </div>
  )
}
