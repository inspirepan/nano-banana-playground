import { useStripDownloadMetadata } from '../../hooks/useStripDownloadMetadata'
import { useI18n } from '../../i18n'
import { SettingsSection } from './SettingsSection'

export function DownloadSettingsTab() {
  const { t } = useI18n()
  const { stripDownloadMetadata, setStripDownloadMetadata } = useStripDownloadMetadata()

  const handleStripMetadataChange = () => {
    setStripDownloadMetadata(!stripDownloadMetadata)
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <SettingsSection label={t('settings.download.title')} hint={t('settings.download.description')}>
        <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] bg-(--color-surface-2) p-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          <div className="min-w-0">
            <div className="text-sm font-medium text-(--color-text)">{t('settings.download.stripMetadata.label')}</div>
            <div className="mt-1 max-w-[60ch] text-sm leading-relaxed text-(--color-text-3)">
              {t('settings.download.stripMetadata.hint')}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={stripDownloadMetadata}
            aria-label={t('settings.download.stripMetadata.label')}
            onClick={handleStripMetadataChange}
            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-150 ${
              stripDownloadMetadata
                ? 'bg-(--color-accent) shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,#000_10%)]'
                : 'bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge)]'
            }`}
          >
            <span
              className={`pointer-events-none my-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                stripDownloadMetadata ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </SettingsSection>
    </div>
  )
}
