import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

type DetailFooterProps = {
  editing: boolean
  currentImage: PlaygroundImageMeta | null
  selectedItem: StackItem | null
  stackId: string
}

export function DetailFooter({ editing, currentImage, selectedItem, stackId }: DetailFooterProps) {
  const { t } = useI18n()

  return (
    <div
      className="hidden shrink-0 items-center gap-3.5 px-3.5 text-sm text-(--color-text-3) md:flex"
      style={{
        height: 30,
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-sunken)',
      }}
    >
      {!editing && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <kbd>←</kbd>
            <kbd>→</kbd> {t('imageDetail.footer.switch')}
          </span>
          <span className="inline-flex items-center gap-1.5">{t('imageDetail.footer.wheelZoom')}</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd>0</kbd> / {t('imageDetail.footer.doubleClickReset')}
          </span>
        </>
      )}
      {editing && (
        <span className="inline-flex items-center gap-1.5">
          <kbd>⌘</kbd>
          <kbd>Z</kbd> {t('imageDetail.footer.undo')}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <kbd>Esc</kbd> {t('imageDetail.footer.close')}
      </span>
      <div className="flex-1" />
      <span className="mono">#{(currentImage?.id ?? selectedItem?.id ?? stackId).slice(0, 8)}</span>
    </div>
  )
}
