import { memo, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon'
import { useWindowEvent } from '../hooks/effects'
import { ensureBlobLoaded, useImageSrc, getBlobFromCache } from '../hooks/useImageSrc'
import { useI18n } from '../i18n'
import { imageDownloadFileName } from '../lib/downloadFileName'
import type { PlaygroundImageMeta } from '../lib/types'

type Props = {
  image: PlaygroundImageMeta
  inlineData?: string
  index?: number
  actionMode?: 'full' | 'downloadOnly' | 'queue'
  onAddToRef: (image: PlaygroundImageMeta) => void
  onEdit?: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onRemove: (id: string) => void
  onOpen: (image: PlaygroundImageMeta) => void
}

export const ImageCard = memo(function ImageCard({
  image,
  inlineData,
  index,
  actionMode = 'full',
  onAddToRef,
  onEdit,
  onRegenerate,
  onRemove,
  onOpen,
}: Props) {
  const { t } = useI18n()
  const CONTEXT_MENU_WIDTH = 160
  const CONTEXT_MENU_ITEM_HEIGHT = 32
  const CONTEXT_MENU_PADDING = 8
  const { ref, src } = useImageSrc(image.id, image.mimeType, inlineData, { variant: 'preview' })
  const meta = image.source.type === 'generated' ? image.source : null
  const [toast, setToast] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const downloadOnly = actionMode === 'downloadOnly'
  const queueMode = actionMode === 'queue'

  const showCopiedToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 1500)
  }

  const resolveFullSrc = async () => {
    if (inlineData) return `data:${image.mimeType};base64,${inlineData}`
    return ensureBlobLoaded(image.id, image.mimeType)
  }

  const handleDownload = async () => {
    const fullSrc = await resolveFullSrc()
    if (!fullSrc) return
    const anchor = document.createElement('a')
    anchor.href = fullSrc
    anchor.download = imageDownloadFileName(image, 'png')
    anchor.click()
  }

  const handleCopyImage = async () => {
    const fullSrc = await resolveFullSrc()
    if (!fullSrc) return
    const response = await fetch(fullSrc)
    const sourceBlob = await response.blob()
    let clipboardBlob = sourceBlob

    if (sourceBlob.type !== 'image/png') {
      const bitmap = await createImageBitmap(sourceBlob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })
      if (!pngBlob) return
      clipboardBlob = pngBlob
    }

    await navigator.clipboard.write([new ClipboardItem({ [clipboardBlob.type]: clipboardBlob })])
    showCopiedToast()
  }

  const handleRegenerate = () => onRegenerate(image)
  const handleDelete = () => onRemove(image.id)

  const handleDragStart = (event: React.DragEvent) => {
    const data = getBlobFromCache(image.id)
    const payload = data ? { ...image, data } : image
    event.dataTransfer.setData('application/x-playground-image', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'copy'
  }

  useWindowEvent('mousedown', () => setMenu(null), undefined, Boolean(menu))
  useWindowEvent('scroll', () => setMenu(null), { capture: true }, Boolean(menu))
  useWindowEvent('resize', () => setMenu(null), undefined, Boolean(menu))
  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') setMenu(null)
    },
    undefined,
    Boolean(menu),
  )

  const actionItems: Array<{ id: string; label: string; onClick: () => void; danger?: boolean }> = downloadOnly
    ? [{ id: 'download', label: t('common.download'), onClick: handleDownload }]
    : [
        { id: 'add-reference', label: t('input.imageCard.addToReference'), onClick: () => onAddToRef(image) },
        { id: 'download', label: t('common.download'), onClick: handleDownload },
        { id: 'copy', label: t('input.imageCard.copy'), onClick: handleCopyImage },
        ...(meta?.prompt
          ? [{ id: 'restore', label: t('input.imageCard.restoreParams'), onClick: handleRegenerate }]
          : []),
        ...(queueMode ? [] : [{ id: 'delete', label: t('common.delete'), onClick: handleDelete, danger: true }]),
      ]

  return (
    <div
      ref={ref}
      role={downloadOnly ? undefined : 'button'}
      aria-label={downloadOnly ? undefined : t('input.imageCard.open')}
      tabIndex={downloadOnly ? undefined : 0}
      draggable={!downloadOnly}
      onContextMenu={(event) => {
        event.preventDefault()
        if (downloadOnly) return
        const menuHeight = actionItems.length * CONTEXT_MENU_ITEM_HEIGHT + CONTEXT_MENU_PADDING
        const x = Math.min(event.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 8)
        const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8)
        setMenu({ x: Math.max(8, x), y: Math.max(8, y) })
      }}
      onDragStart={downloadOnly ? undefined : handleDragStart}
      onClick={downloadOnly ? undefined : () => onOpen(image)}
      onKeyDown={(event) => {
        if (downloadOnly) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(image)
        }
      }}
      className={`img-card group relative h-full w-full ${downloadOnly ? '' : 'cursor-zoom-in'}`}
    >
      {src ? (
        <img
          src={src}
          alt={meta?.prompt ?? ''}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full skeleton-animated" />
      )}

      {/* Top meta chip */}
      <div
        className="pointer-events-none absolute top-2 left-2 right-2 flex justify-between items-center"
        style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
      >
        {index !== undefined ? (
          <span
            className="rounded-[var(--radius-xs)] px-1.5 py-0.5 text-base font-medium"
            style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}
          >
            #{index + 1}
          </span>
        ) : (
          <span />
        )}
        {meta && (
          <span className="tabular-nums" style={{ opacity: 0.85 }}>
            {meta.resolution} · {meta.aspectRatio}
          </span>
        )}
      </div>

      {/* Copied toast */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center transition-all duration-300 ${toast ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
      >
        <div
          className="rounded-[var(--radius-sm)] px-3 py-1.5 text-base font-medium"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', backdropFilter: 'blur(8px)' }}
        >
          {t('input.imageCard.copied')}
        </div>
      </div>

      {/* Hover overlay — action row */}
      <div className="overlay">
        <div className="flex gap-1.5 items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void handleDownload()
            }}
            className="media-action light"
            title={t('input.imageCard.downloadPng')}
            aria-label={t('input.imageCard.downloadPng')}
          >
            <Icon name="download" size={12} strokeWidth={1.6} /> PNG
          </button>
          {!downloadOnly && (
            <>
              {onEdit && (
                <OverlayButton
                  icon="wand"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(image)
                  }}
                  ariaLabel={t('common.edit')}
                >
                  {t('common.edit')}
                </OverlayButton>
              )}
              <span className="flex-1" />
              <OverlayButton
                icon="more"
                ariaLabel={t('input.imageCard.moreActions')}
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  // Open above-left of the button so it doesn't clip the card
                  const menuHeight = actionItems.length * CONTEXT_MENU_ITEM_HEIGHT + CONTEXT_MENU_PADDING
                  const x = Math.max(
                    8,
                    Math.min(rect.right - CONTEXT_MENU_WIDTH, window.innerWidth - CONTEXT_MENU_WIDTH - 8),
                  )
                  const y = Math.max(8, rect.top - menuHeight - 4)
                  setMenu({ x, y })
                }}
              />
            </>
          )}
        </div>
      </div>

      {!downloadOnly &&
        menu &&
        createPortal(
          <div
            style={{ top: menu.y, left: menu.x }}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-[120] min-w-[140px] rounded-[var(--radius-md)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
          >
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenu(null)
                  item.onClick()
                }}
                className={`flex w-full items-center rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-base transition-colors
                ${item.danger ? 'text-(--color-danger) hover:bg-(--color-danger-soft)' : 'text-(--color-text) hover:bg-(--color-surface-2)'}`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
})

function OverlayButton({
  icon,
  onClick,
  children,
  danger,
  ariaLabel,
}: {
  icon: 'plus' | 'refresh' | 'copy' | 'trash' | 'more' | 'wand'
  onClick: (e: React.MouseEvent) => void
  children?: React.ReactNode
  danger?: boolean
  ariaLabel?: string
}) {
  const hasText = Boolean(children)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`media-action ${hasText ? '' : 'icon-only'} ${danger ? 'danger' : ''}`}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <Icon name={icon} size={12} strokeWidth={1.6} />
      {children}
    </button>
  )
}
