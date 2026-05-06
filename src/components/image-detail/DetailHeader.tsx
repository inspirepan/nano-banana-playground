import type { GenerationSlot } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

type ModalViewMode = 'detail' | 'gallery'

type DetailHeaderProps = {
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSlot: GenerationSlot | null
  modelName: string | null
  pxDim: string
  viewMode: ModalViewMode
  gallerySummary?: string | null
  galleryBacksToDetail: boolean
  sidebarCollapsed: boolean
  className?: string
  onClose: () => void
  onBackToDetail: () => void
  onOpenManageGallery: () => void
  onAddRef: () => void
  onRegenerate: () => void
  onReroll: () => void
  onDownload: () => void
  onToggleSidebar: () => void
}

export function DetailHeader({
  currentImage,
  currentMeta,
  currentSlot,
  modelName,
  pxDim,
  viewMode,
  gallerySummary,
  galleryBacksToDetail,
  sidebarCollapsed,
  className,
  onClose,
  onBackToDetail,
  onOpenManageGallery,
  onAddRef,
  onRegenerate,
  onReroll,
  onDownload,
  onToggleSidebar,
}: DetailHeaderProps) {
  const { t } = useI18n()
  const pxDimParts = pxDim.split(' · ')

  return (
    <div
      className={`flex items-center gap-2 px-3.5 shrink-0 flex-nowrap${className ? ` ${className}` : ''}`}
      style={{
        height: 48,
        boxShadow: 'inset 0 -1px 0 var(--ring-edge-soft)',
        background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
      }}
    >
      <button
        className="icon-btn shrink-0"
        onClick={galleryBacksToDetail ? onBackToDetail : onClose}
        title={galleryBacksToDetail ? t('imageDetail.action.backToPreview') : t('imageDetail.action.closeEsc')}
        style={{ width: 32, height: 32 }}
      >
        <Icon name={galleryBacksToDetail ? 'chevron_left' : 'close'} size={13} strokeWidth={1.8} />
      </button>
      <div className="h-6 w-px shrink-0 bg-(--ring-edge-soft)" />

      {viewMode === 'gallery' ? (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
            {t('imageDetail.gallery.allImages')}
          </span>
          {gallerySummary && (
            <span className="shrink-0 text-sm leading-[1.25] text-(--color-text-3)">{gallerySummary}</span>
          )}
        </div>
      ) : currentMeta ? (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
            {modelName}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-sm leading-[1.25] text-(--color-text-3) tabular-nums">
            {pxDimParts.length >= 2 ? (
              <>
                <span>{pxDimParts[0]}</span>
                <span aria-hidden className="meta-dot" />
                <span>{pxDimParts.slice(1).join(' · ')}</span>
              </>
            ) : (
              pxDim
            )}
          </span>
        </div>
      ) : (
        <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
          {currentSlot ? t('imageDetail.header.generationTask') : t('imageDetail.header.imageGroup')}
        </span>
      )}

      <div className="flex-1" />

      {viewMode === 'detail' && (
        <Tooltip text={t('imageDetail.action.openBatchManage')}>
          <button
            type="button"
            className="icon-btn shrink-0 max-md:h-8 max-md:w-8"
            onClick={onOpenManageGallery}
            aria-label={t('imageDetail.action.manageBatch')}
          >
            <Icon name="list_checks" size={14} strokeWidth={1.8} />
          </button>
        </Tooltip>
      )}
      {viewMode === 'detail' && currentImage && (
        <>
          <button
            className="chip hidden shrink-0 font-normal md:inline-flex"
            onClick={onAddRef}
            title={t('imageDetail.action.addReferenceTitle')}
          >
            <Icon name="plus" size={12} strokeWidth={1.8} />
            <span className="hidden md:inline">{t('imageDetail.action.addReference')}</span>
          </button>
          {currentMeta?.prompt && (
            <>
              <button
                className="chip hidden shrink-0 font-normal md:inline-flex"
                onClick={onRegenerate}
                title={t('imageDetail.action.restoreParams')}
              >
                <Icon name="undo" size={12} strokeWidth={1.8} />
                <span className="hidden md:inline">{t('imageDetail.action.restoreParams')}</span>
              </button>
              <button
                className="chip hidden shrink-0 font-normal md:inline-flex"
                onClick={onReroll}
                title={t('imageDetail.action.regenerateOriginal')}
              >
                <Icon name="refresh" size={12} strokeWidth={1.8} />
                <span className="hidden md:inline">{t('imageDetail.action.redoOriginal')}</span>
              </button>
            </>
          )}
          <button
            className="chip hidden shrink-0 font-normal md:inline-flex"
            onClick={onDownload}
            title={t('imageDetail.action.downloadPng')}
          >
            <Icon name="download" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">PNG</span>
          </button>
        </>
      )}
      {viewMode === 'detail' && (
        <button
          className="chip hidden shrink-0 font-normal md:inline-flex"
          onClick={onToggleSidebar}
          title={
            sidebarCollapsed ? t('imageDetail.action.expandDetailsPanel') : t('imageDetail.action.collapseDetailsPanel')
          }
          aria-pressed={!sidebarCollapsed}
        >
          <Icon name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'} size={12} strokeWidth={1.8} />
          {sidebarCollapsed ? t('imageDetail.action.expandDetails') : t('imageDetail.action.collapseDetails')}
        </button>
      )}
    </div>
  )
}
