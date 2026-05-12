import type { GenerationSlot } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { RerollSplitButton } from './RerollSplitButton'
import type { RerollModelOption } from './rerollModelOptions'

type DetailHeaderProps = {
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSlot: GenerationSlot | null
  modelName: string | null
  pxDim: string
  sidebarCollapsed: boolean
  rerollModelOptions: RerollModelOption[]
  className?: string
  onClose: () => void
  onAddRef: () => void
  onRegenerate: () => void
  onReroll: (modelId?: string) => void
  onDownload: () => void
  onToggleSidebar: () => void
}

export function DetailHeader({
  currentImage,
  currentMeta,
  currentSlot,
  modelName,
  pxDim,
  sidebarCollapsed,
  rerollModelOptions,
  className,
  onClose,
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
      <Tooltip text={t('imageDetail.action.closeEsc')} placement="bottom" className="inline-flex shrink-0">
        <button className="icon-btn" onClick={onClose} style={{ width: 32, height: 32 }}>
          <Icon name="close" size={13} strokeWidth={1.8} />
        </button>
      </Tooltip>
      <div className="h-6 w-px shrink-0 bg-(--ring-edge-soft)" />

      {currentMeta ? (
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

      {currentImage && (
        <>
          <Tooltip
            text={t('imageDetail.action.addReferenceTitle')}
            placement="bottom"
            className="hidden shrink-0 md:inline-flex"
          >
            <button className="chip font-normal" onClick={onAddRef}>
              <Icon name="plus" size={12} strokeWidth={1.8} />
              <span className="hidden md:inline">{t('imageDetail.action.addReference')}</span>
            </button>
          </Tooltip>
          <Tooltip
            text={t('imageDetail.action.downloadPng')}
            placement="bottom"
            className="hidden shrink-0 md:inline-flex"
          >
            <button className="chip font-normal" onClick={onDownload}>
              <Icon name="download" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">PNG</span>
            </button>
          </Tooltip>
          {currentMeta?.prompt && (
            <>
              <Tooltip
                text={t('imageDetail.action.restoreParams')}
                placement="bottom"
                className="hidden shrink-0 md:inline-flex"
              >
                <button className="chip font-normal" onClick={onRegenerate}>
                  <Icon name="file_sliders" size={12} strokeWidth={1.8} />
                  <span className="hidden md:inline">{t('imageDetail.action.applyParams')}</span>
                </button>
              </Tooltip>
              <div className="hidden shrink-0 md:inline-flex">
                <RerollSplitButton options={rerollModelOptions} menuPlacement="bottom" onReroll={onReroll} />
              </div>
            </>
          )}
        </>
      )}
      <Tooltip
        text={
          sidebarCollapsed ? t('imageDetail.action.expandDetailsPanel') : t('imageDetail.action.collapseDetailsPanel')
        }
        placement="bottom"
        className="hidden shrink-0 md:inline-flex"
      >
        <button className="chip font-normal" onClick={onToggleSidebar} aria-pressed={!sidebarCollapsed}>
          <Icon name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'} size={12} strokeWidth={1.8} />
          {sidebarCollapsed ? t('imageDetail.action.expandDetails') : t('imageDetail.action.collapseDetails')}
        </button>
      </Tooltip>
    </div>
  )
}
