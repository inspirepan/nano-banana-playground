import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

export function ComposerScrollButton({
  nearBottom,
  renderItemCount,
  onScrollToBottom,
}: {
  nearBottom: boolean
  renderItemCount: number
  onScrollToBottom: () => void
}) {
  const { t } = useI18n()

  if (nearBottom || renderItemCount === 0) return null

  return (
    <button
      type="button"
      onClick={onScrollToBottom}
      aria-label={t('agentChat.composer.scrollToBottom')}
      className="absolute bottom-[calc(100%+8px)] left-1/2 z-50 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-(--color-surface) text-(--color-text-2) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)] transition-all duration-150 hover:bg-(--color-surface-2) hover:text-(--color-text)"
    >
      <Icon name="chevron_down" size={15} />
    </button>
  )
}
