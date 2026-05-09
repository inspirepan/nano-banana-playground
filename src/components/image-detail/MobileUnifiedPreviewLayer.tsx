import { useCallback, useState, type RefObject } from 'react'

import { ZoomableImageView, type ZoomableImageViewState } from './ZoomableImageView'
import { useExternalSync } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

type LayerRect = {
  left: number
  top: number
  width: number
  height: number
}

type MobileUnifiedPreviewLayerProps = {
  anchorRef: RefObject<HTMLDivElement | null>
  clipRef: RefObject<HTMLDivElement | null>
  fullscreen: boolean
  visible: boolean
  src: string
  alt: string
  hasPrev: boolean
  hasNext: boolean
  onOpenFullscreen: (view?: ZoomableImageViewState | null) => void
  onCloseFullscreen: () => void
  onGoPrev: () => void
  onGoNext: () => void
}

const fullscreenBackdropStyle = {
  backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
  backgroundSize: '28px 28px, 28px 28px',
  backgroundColor: 'var(--color-bg-sunken)',
}

export function MobileUnifiedPreviewLayer({
  anchorRef,
  clipRef,
  fullscreen,
  visible,
  src,
  alt,
  hasPrev,
  hasNext,
  onOpenFullscreen,
  onCloseFullscreen,
  onGoPrev,
  onGoNext,
}: MobileUnifiedPreviewLayerProps) {
  const { t } = useI18n()
  const [inlineRect, setInlineRect] = useState<{ frame: LayerRect; clip: LayerRect } | null>(null)
  const [inlineResetRevision, setInlineResetRevision] = useState(0)

  const closeFullscreen = useCallback(() => {
    setInlineResetRevision((revision) => revision + 1)
    onCloseFullscreen()
  }, [onCloseFullscreen])

  const updateAnchorRect = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      setInlineRect(null)
      return
    }
    const anchorRect = anchor.getBoundingClientRect()
    const clipRect = clipRef.current?.getBoundingClientRect()
    const left = Math.max(anchorRect.left, clipRect?.left ?? 0)
    const top = Math.max(anchorRect.top, clipRect?.top ?? 0)
    const right = Math.min(anchorRect.right, clipRect?.right ?? window.innerWidth)
    const bottom = Math.min(anchorRect.bottom, clipRect?.bottom ?? window.innerHeight)
    const width = Math.max(0, right - left)
    const height = Math.max(0, bottom - top)

    setInlineRect({
      frame: { left: anchorRect.left, top: anchorRect.top, width: anchorRect.width, height: anchorRect.height },
      clip: { left, top, width, height },
    })
  }, [anchorRef, clipRef])

  useExternalSync(() => {
    if (!visible) return
    updateAnchorRect()

    const anchor = anchorRef.current
    const resizeObserver = anchor ? new ResizeObserver(updateAnchorRect) : null
    if (anchor) resizeObserver?.observe(anchor)

    window.addEventListener('resize', updateAnchorRect)
    window.addEventListener('scroll', updateAnchorRect, true)
    window.visualViewport?.addEventListener('resize', updateAnchorRect)
    window.visualViewport?.addEventListener('scroll', updateAnchorRect)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateAnchorRect)
      window.removeEventListener('scroll', updateAnchorRect, true)
      window.visualViewport?.removeEventListener('resize', updateAnchorRect)
      window.visualViewport?.removeEventListener('scroll', updateAnchorRect)
    }
  }, [anchorRef, updateAnchorRect, visible])

  if (!visible || (!fullscreen && (!inlineRect || inlineRect.clip.width <= 0 || inlineRect.clip.height <= 0)))
    return null

  const layerStyle = fullscreen
    ? { inset: 0, zIndex: 130, ...fullscreenBackdropStyle }
    : {
        left: inlineRect?.clip.left ?? 0,
        top: inlineRect?.clip.top ?? 0,
        width: inlineRect?.clip.width ?? 0,
        height: inlineRect?.clip.height ?? 0,
        zIndex: 1,
      }

  const viewFrameStyle = fullscreen
    ? { inset: 0 }
    : {
        left: (inlineRect?.frame.left ?? 0) - (inlineRect?.clip.left ?? 0),
        top: (inlineRect?.frame.top ?? 0) - (inlineRect?.clip.top ?? 0),
        width: inlineRect?.frame.width ?? 0,
        height: inlineRect?.frame.height ?? 0,
      }

  return (
    <div className="fixed overflow-hidden" style={layerStyle}>
      <div className="absolute" style={viewFrameStyle}>
        <ZoomableImageView
          key={`${src}:${inlineResetRevision}`}
          src={src}
          alt={alt}
          onSwipeLeft={hasNext ? onGoNext : undefined}
          onSwipeRight={hasPrev ? onGoPrev : undefined}
          onRequestFullscreen={fullscreen ? undefined : () => onOpenFullscreen()}
          onRequestInline={fullscreen ? closeFullscreen : undefined}
          disableViewTransition
        />
      </div>

      {!fullscreen && (
        <button
          type="button"
          onClick={() => onOpenFullscreen()}
          title={t('imageDetail.action.fullscreenPreview')}
          aria-label={t('imageDetail.action.fullscreenPreview')}
          className="absolute right-3 top-3 z-[2] flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
            color: 'var(--color-text-2)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 0 0 1px var(--ring-edge), var(--shadow-lift)',
          }}
        >
          <Icon name="maximize" size={14} strokeWidth={1.8} />
        </button>
      )}

      {fullscreen && (
        <button
          type="button"
          onClick={closeFullscreen}
          title={t('imageDetail.action.closeFullscreenPreview')}
          aria-label={t('imageDetail.action.closeFullscreenPreview')}
          className="absolute left-3 top-3 z-[2] flex h-9 w-9 items-center justify-center rounded-full transition-colors"
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
      )}
    </div>
  )
}
