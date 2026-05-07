import { formatSessionTime } from './utils'
import type { AgentSessionStatus, AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

export function AgentSessionStatusBadge({ status }: { status: AgentSessionStatus }) {
  const { t } = useI18n()
  if (status === 'waiting_for_question') {
    return (
      <span
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-(--color-surface-2) text-(--color-accent) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
        title={t('agentChat.question.title')}
        aria-label={t('agentChat.question.title')}
      >
        <Icon name="help_circle" size={12} strokeWidth={2.2} />
      </span>
    )
  }

  if (status === 'generating_images') {
    return (
      <span
        className="agent-session-running-dot"
        title={t('agentChat.status.generatingImages')}
        aria-label={t('agentChat.status.generatingImages')}
      />
    )
  }

  return (
    <span
      className="agent-session-running-dot"
      title={t('agentChat.status.running')}
      aria-label={t('agentChat.status.running')}
    />
  )
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
      className={`group relative flex h-[32px] items-center rounded-[var(--radius-md)] px-2 transition-[background-color,box-shadow] ${
        active
          ? 'bg-(--color-accent-wash) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
          : 'hover:bg-(--color-surface-2)'
      }`}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-1 w-0.5 rounded-[var(--radius-xs)] bg-(--color-accent)" />
      )}
      <button
        type="button"
        onClick={() => onSwitchSession(session.id)}
        className="min-w-0 flex-1 bg-transparent pl-2 text-left"
        aria-current={active ? 'true' : undefined}
        title={title}
      >
        <span className={`block truncate ${titleClass}`}>{title}</span>
      </button>
      <span className="ml-2 flex shrink-0 items-center gap-1.5 text-sm text-(--color-text-3)">
        {status && <AgentSessionStatusBadge status={status} />}
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
        <span className="tabular-nums">{formatSessionTime(session.updatedAt)}</span>
      </span>
      <button
        type="button"
        onClick={() => onDeleteSession(session.id)}
        className={`absolute right-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] opacity-0 transition-[opacity,background-color,color] hover:bg-(--color-surface-3) hover:text-(--color-danger) group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none ${
          active
            ? 'bg-(--color-surface) text-(--color-text-3) shadow-[-10px_0_12px_color-mix(in_srgb,var(--color-accent-wash)_72%,transparent)]'
            : 'bg-(--color-surface-2) text-(--color-text-4) shadow-[-10px_0_12px_var(--color-surface-2)]'
        }`}
        aria-label={t('agentChat.header.deleteConversation')}
      >
        <Icon name="trash" size={12} />
      </button>
    </div>
  )
}
