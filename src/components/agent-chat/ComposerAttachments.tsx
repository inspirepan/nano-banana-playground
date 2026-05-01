import { imageDataUrl, type AgentChatAttachment } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

export function ComposerAttachments({
  attachments,
  onRemoveAttachment,
}: {
  attachments: AgentChatAttachment[]
  onRemoveAttachment: (id: string) => void
}) {
  const { t } = useI18n()

  if (attachments.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface-2) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)]"
        >
          <img src={imageDataUrl(attachment)} alt={attachment.fileName} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemoveAttachment(attachment.id)}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            aria-label={t('agentChat.composer.removeImage')}
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}
