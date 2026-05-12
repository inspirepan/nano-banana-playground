import { formatSessionTime } from './utils'
import type { AgentSessionStatus, AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

function AgentSessionStatusIcon({ status }: { status: AgentSessionStatus | null }) {
  const { t } = useI18n()

  if (status === 'waiting_for_question') {
    return (
      <span
        className="inline-flex h-5 w-4 shrink-0 items-center justify-center text-(--color-accent)"
        title={t('agentChat.status.waitingForQuestion')}
        aria-label={t('agentChat.status.waitingForQuestion')}
      >
        <Icon name="help_circle" size={12} strokeWidth={2.2} />
      </span>
    )
  }

  if (status === 'generating_images') {
    return (
      <span
        className="inline-flex h-5 w-4 shrink-0 items-center justify-center"
        title={t('agentChat.status.generatingImages')}
        aria-label={t('agentChat.status.generatingImages')}
      >
        <span className="agent-session-running-dot" />
      </span>
    )
  }

  if (status === 'running') {
    return (
      <span
        className="inline-flex h-5 w-4 shrink-0 items-center justify-center"
        title={t('agentChat.status.running')}
        aria-label={t('agentChat.status.running')}
      >
        <span className="agent-session-running-dot" />
      </span>
    )
  }

  return null
}

export function AgentSessionListItem({
  session,
  active,
  status,
  title,
  variant,
  onSwitchSession,
  onDeleteSession,
}: {
  session: AgentSessionSummary
  active: boolean
  status: AgentSessionStatus | null
  title: string
  variant: 'sidebar' | 'menu'
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}) {
  const { t } = useI18n()
  const imageCount = session.imageCount ?? 0
  const imageCountLabel = t('agentChat.header.generatedImageCount', { count: imageCount })
  const titleClass =
    variant === 'sidebar'
      ? `text-base ${active ? 'font-semibold text-(--color-text)' : 'text-(--color-text-2)'}`
      : `text-sm ${active ? 'font-semibold text-(--color-text)' : 'font-medium text-(--color-text-2)'}`

  return (
    <div
      className={`group relative flex h-[32px] items-center gap-1.5 rounded-[var(--radius-md)] px-2 transition-[background-color,box-shadow] ${
        active
          ? 'bg-(--color-accent-wash) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
          : 'hover:bg-(--color-surface-2)'
      }`}
    >
      <AgentSessionStatusIcon status={status} />
      <button
        type="button"
        onClick={() => onSwitchSession(session.id)}
        className="min-w-0 flex-1 bg-transparent text-left"
        aria-current={active ? 'true' : undefined}
        title={title}
      >
        <span className={`block truncate ${titleClass}`}>{title}</span>
      </button>
      {variant === 'menu' ? (
        <>
          <span className="ml-1 flex shrink-0 items-center gap-1 text-sm text-(--color-text-3) transition-opacity">
            {imageCount > 0 && (
              <span
                className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-(--color-surface-2) px-1.5 text-[11px] font-medium leading-none tabular-nums text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
                title={imageCountLabel}
                aria-label={imageCountLabel}
              >
                <Icon name="image" size={11} className="opacity-80" />
                <span>{imageCount}</span>
              </span>
            )}
            <span className="min-w-[2.5rem] text-right tabular-nums">{formatSessionTime(session.updatedAt)}</span>
          </span>
          <button
            type="button"
            onClick={() => onDeleteSession(session.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] opacity-50 text-(--color-text-4) transition-[opacity,background-color,color] hover:opacity-100 hover:text-(--color-danger) focus-visible:opacity-100 focus-visible:outline-none active:scale-90"
            aria-label={t('agentChat.header.deleteConversation')}
          >
            <Icon name="trash" size={12} />
          </button>
        </>
      ) : (
        <>
          <span className="ml-1 flex shrink-0 items-center gap-1 text-sm text-(--color-text-3) transition-opacity group-hover:opacity-0">
            {imageCount > 0 && (
              <span
                className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-(--color-surface-2) px-1.5 text-[11px] font-medium leading-none tabular-nums text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
                title={imageCountLabel}
                aria-label={imageCountLabel}
              >
                <Icon name="image" size={11} className="opacity-80" />
                <span>{imageCount}</span>
              </span>
            )}
            <span className="min-w-[2.5rem] text-right tabular-nums">{formatSessionTime(session.updatedAt)}</span>
          </span>
          <button
            type="button"
            onClick={() => onDeleteSession(session.id)}
            className={`absolute right-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] opacity-0 transition-[opacity,background-color,color,box-shadow] hover:text-(--color-danger) group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none ${
              active
                ? 'bg-[color-mix(in_srgb,var(--color-accent-wash)_76%,var(--color-surface)_24%)] text-(--color-text-3) shadow-[-7px_0_10px_color-mix(in_srgb,var(--color-accent-wash)_78%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-accent-wash)_58%,var(--color-surface)_42%)]'
                : 'bg-(--color-surface-2) text-(--color-text-4) shadow-[-8px_0_10px_var(--color-surface-2)] hover:bg-(--color-surface-3)'
            }`}
            aria-label={t('agentChat.header.deleteConversation')}
          >
            <Icon name="trash" size={12} />
          </button>
        </>
      )}
    </div>
  )
}
