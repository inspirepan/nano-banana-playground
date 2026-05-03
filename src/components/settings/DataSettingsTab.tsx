import { useI18n } from '../../i18n'
import type { SiteDataUsage, StorageBreakdown, StorageBreakdownItem } from '../../lib/siteData'
import { Icon } from '../Icon'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

type DataSettingsTabProps = {
  siteDataUsage: SiteDataUsage | null
  siteDataUsageLoading: boolean
  siteDataUsageError: string | null
  storageBreakdown: StorageBreakdown | null
  clearDataConfirm: boolean
  clearDataBusy: boolean
  clearDataError: string | null
  onRefreshSiteDataUsage: () => Promise<void>
  onClearSiteData: () => void
  onConfirmClearData: () => void
  onCancelClearData: () => void
}

export function DataSettingsTab({
  siteDataUsage,
  siteDataUsageLoading,
  siteDataUsageError,
  storageBreakdown,
  clearDataConfirm,
  clearDataBusy,
  clearDataError,
  onRefreshSiteDataUsage,
  onClearSiteData,
  onConfirmClearData,
  onCancelClearData,
}: DataSettingsTabProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="label mb-1">{t('settings.data.currentUsage')}</div>
          <div className="text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
            {siteDataUsage
              ? formatBytes(siteDataUsage.totalBytes)
              : siteDataUsageLoading
                ? t('settings.data.calculating')
                : t('common.unknown')}
          </div>
          {siteDataUsage?.browserEstimateBytes != null && (
            <div className="mt-0.5 text-sm text-(--color-text-3)">
              {t('settings.data.browserEstimate', {
                size: formatBytes(siteDataUsage.browserEstimateBytes),
              })}
              {siteDataUsage.quotaBytes
                ? t('settings.data.quota', { size: formatBytes(siteDataUsage.quotaBytes) })
                : ''}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRefreshSiteDataUsage().catch(() => undefined)}
          disabled={siteDataUsageLoading || clearDataBusy}
          className="chip shrink-0"
        >
          <Icon name="refresh" size={12} />{' '}
          {siteDataUsageLoading ? t('settings.data.calculatingShort') : t('common.refresh')}
        </button>
      </div>

      {siteDataUsageError && (
        <div className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {siteDataUsageError}
        </div>
      )}

      {storageBreakdown && <StorageBreakdownTable items={storageBreakdown.items} />}

      <div className="space-y-2 pt-4 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
        <p className="text-sm leading-relaxed text-(--color-text-3)">{t('settings.data.clearDescription')}</p>
        {clearDataError && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-danger)' }}>
            {clearDataError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {clearDataConfirm ? (
            <>
              <button type="button" onClick={onClearSiteData} disabled={clearDataBusy} className="chip danger">
                <Icon name="trash" size={12} />{' '}
                {clearDataBusy ? t('settings.data.clearing') : t('settings.data.confirmClear')}
              </button>
              <button type="button" onClick={onCancelClearData} disabled={clearDataBusy} className="chip">
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <button type="button" onClick={onConfirmClearData} disabled={clearDataBusy} className="chip danger">
              <Icon name="trash" size={12} /> {t('settings.data.clear')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StorageBreakdownTable({ items }: { items: StorageBreakdownItem[] }) {
  const { t } = useI18n()
  const nonZero = items.filter((item) => item.bytes > 0)
  if (nonZero.length === 0) return null

  return (
    <ul className="space-y-1.5 px-1">
      {nonZero.map((item) => (
        <li key={item.id} className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-(--color-text-2)">{t(item.labelKey)}</span>
          <span className="shrink-0 text-sm tabular-nums text-(--color-text-3)">{formatBytes(item.bytes)}</span>
        </li>
      ))}
    </ul>
  )
}
