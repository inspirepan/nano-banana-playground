import { Icon } from '../Icon'
import { ZoomableImageView, type ZoomableImageViewState } from './ZoomableImageView'
import { useI18n } from '../../i18n'

export function MobilePreviewFullscreen({
  src,
  alt,
  initialView,
  onClose,
  onSwipeLeft,
  onSwipeRight,
  onViewChange,
}: {
  src: string
  alt: string
  initialView?: ZoomableImageViewState | null
  onClose: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onViewChange?: (view: ZoomableImageViewState) => void
}) {
  const { t } = useI18n()

  return (
    <div
      className="fixed inset-0 z-[130]"
      style={{
        backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: '28px 28px, 28px 28px',
        backgroundColor: 'var(--color-bg-sunken)',
      }}
    >
      {src ? (
        <ZoomableImageView
          src={src}
          alt={alt}
          initialView={initialView}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
          onZoomOutToFit={onClose}
          onViewChange={onViewChange}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="spinner" />
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        title={t('imageDetail.action.closeFullscreenPreview')}
        aria-label={t('imageDetail.action.closeFullscreenPreview')}
        className="fixed left-3 top-3 z-[2] flex h-9 w-9 items-center justify-center rounded-full transition-colors"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
          color: 'var(--color-text-2)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 0 0 1px var(--ring-edge), var(--shadow-lift)',
        }}
      >
        <Icon name="close" size={15} strokeWidth={1.8} />
      </button>
    </div>
  )
}
