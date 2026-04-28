import { Icon } from '../Icon'
import { ZoomableImageView } from './ZoomableImageView'

export function MobilePreviewFullscreen({
  src,
  alt,
  onClose,
  onSwipeLeft,
  onSwipeRight,
}: {
  src: string
  alt: string
  onClose: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-(--color-bg)">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-(--color-border) px-3">
        <button type="button" className="icon-btn" onClick={onClose} title="退出全屏预览">
          <Icon name="chevron_left" size={15} strokeWidth={1.8} />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-(--color-text)">全屏预览</div>
        <button type="button" className="chip text-xs" onClick={onClose} style={{ height: 28 }}>
          退出
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {src ? (
          <ZoomableImageView src={src} alt={alt} onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="spinner" />
          </div>
        )}
      </div>
    </div>
  )
}
