import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

export function ComposerScrollButton({
  busy,
  nearBottom,
  renderItemCount,
  bottomOffset = 0,
  onScrollToBottom,
}: {
  busy: boolean
  nearBottom: boolean
  renderItemCount: number
  bottomOffset?: number
  onScrollToBottom: () => void
}) {
  const { t } = useI18n()

  if (nearBottom || renderItemCount === 0) return null

  return (
    <button
      type="button"
      onClick={onScrollToBottom}
      aria-label={t('agentChat.composer.scrollToBottom')}
      className="absolute left-1/2 z-50 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-(--color-surface) text-(--color-text-2) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)] transition-all duration-150 hover:bg-(--color-surface-2) hover:text-(--color-text)"
      style={{ bottom: `calc(100% + ${8 + bottomOffset}px)` }}
    >
      {busy ? (
        <span
          className="spinner motion-reduce:animate-none"
          style={{ width: 14, height: 14, animationDuration: '1.35s' }}
        />
      ) : (
        <Icon name="chevron_down" size={15} />
      )}
    </button>
  )
}
