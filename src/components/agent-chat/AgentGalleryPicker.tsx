import { useMemo } from 'react'
import { createPortal } from 'react-dom'

import { useWindowEvent } from '../../hooks/effects'
import { useImageSrc } from '../../hooks/useImageSrc'
import { useI18n } from '../../i18n'
import type { PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'

type Props = {
  open: boolean
  history: PlaygroundImageMeta[]
  attachedImageIds: Set<string>
  onPick: (image: PlaygroundImageMeta) => void
  onClose: () => void
}

export function AgentGalleryPicker({ open, history, attachedImageIds, onPick, onClose }: Props) {
  const { t } = useI18n()

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') onClose()
    },
    undefined,
    open,
  )

  const items = useMemo(
    () =>
      history
        .filter((image) => image.source.type !== 'generation-failure')
        .toSorted((a, b) => b.timestamp - a.timestamp),
    [history],
  )

  if (!open) return null

  return createPortal(
    <div data-agent-menu className="fade-in fixed inset-0 z-[120] flex flex-col bg-(--color-bg)">
      <div className="flex shrink-0 items-center justify-between px-4 py-3 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
        <h2 className="font-display text-base font-semibold tracking-[-0.01em]">
          {t('agentChat.galleryPicker.title')}
        </h2>
        <button type="button" onClick={onClose} className="icon-btn" aria-label={t('common.close')}>
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-(--color-text-3)">
            <Icon name="image_off" size={28} strokeWidth={1.4} />
            <span className="text-sm">{t('agentChat.galleryPicker.empty')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {items.map((image) => (
              <GalleryPickerItem
                key={image.id}
                image={image}
                attached={attachedImageIds.has(image.id)}
                onPick={() => {
                  if (attachedImageIds.has(image.id)) return
                  onPick(image)
                  onClose()
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function GalleryPickerItem({
  image,
  attached,
  onPick,
}: {
  image: PlaygroundImageMeta
  attached: boolean
  onPick: () => void
}) {
  const { t } = useI18n()
  const { ref, src } = useImageSrc(image.id, image.mimeType, undefined, { variant: 'preview' })
  const idLabel = image.source.type === 'generated' && image.source.imageIdSource === 'agent' ? image.id : undefined
  const titleSuffix = attached ? ` · ${t('agentChat.galleryPicker.alreadyAttached')}` : ''
  const title =
    image.source.type === 'generated'
      ? `${image.source.prompt}${titleSuffix}`
      : image.source.type === 'upload'
        ? `${image.source.fileName}${titleSuffix}`
        : image.id

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={attached}
      title={title}
      aria-label={title}
      className="group relative aspect-square overflow-hidden rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] disabled:cursor-not-allowed"
      style={{ background: 'var(--color-surface-2)' }}
    >
      <div ref={ref} className="absolute inset-0">
        {src ? (
          <img
            src={src}
            alt=""
            decoding="async"
            draggable={false}
            className={`h-full w-full object-cover transition-opacity ${attached ? 'opacity-40' : ''}`}
          />
        ) : (
          <div className="h-full w-full skeleton-animated" />
        )}
      </div>
      {idLabel && (
        <span
          className="pointer-events-none absolute bottom-1 left-1 mono max-w-[calc(100%-8px)] truncate rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[10px] leading-none"
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
          }}
        >
          {Array.from(idLabel).slice(0, 20).join('')}
        </span>
      )}
      {attached && (
        <span
          className="pointer-events-none absolute right-1 top-1 inline-flex h-[18px] items-center gap-1 rounded-[var(--radius-xs)] px-1.5 text-[10px] leading-none"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Icon name="check" size={10} strokeWidth={2.4} />
        </span>
      )}
    </button>
  )
}
