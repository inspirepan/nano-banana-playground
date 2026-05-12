import { formatSessionTime } from './utils'
import type { AgentSessionStatus, AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

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
  const rowSpacingClass = variant === 'sidebar' ? 'gap-1 px-1.5' : 'gap-1 px-1.5'
  const sidebarTitlePaddingClass = imageCount > 0 ? 'pr-[4.5rem] group-hover:pr-8' : 'pr-10 group-hover:pr-8'
  const menuTitlePaddingClass = imageCount > 0 ? 'pr-[6.25rem] group-hover:pr-8' : 'pr-16 group-hover:pr-8'
  const titlePaddingClass = variant === 'sidebar' ? sidebarTitlePaddingClass : menuTitlePaddingClass
  const titleButton = (
    <button
      type="button"
      onClick={() => onSwitchSession(session.id)}
      className={`flex h-full w-full min-w-0 items-center bg-transparent text-left transition-[padding] ${titlePaddingClass}`}
      aria-current={active ? 'true' : undefined}
    >
      <span className={`block truncate ${titleClass}`}>{title}</span>
    </button>
  )

  return (
    <div
      className={`group relative flex h-[32px] items-center rounded-[var(--radius-md)] transition-[background-color,box-shadow] ${rowSpacingClass} ${
        active
          ? 'bg-(--color-accent-wash) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
          : 'hover:bg-(--color-surface-2)'
      }`}
    >
      <AgentSessionStatusIcon status={status} />
      <Tooltip text={title} placement="bottom" maxWidth={360} className="flex h-full min-w-0 flex-1 items-center">
        {titleButton}
      </Tooltip>
      {variant === 'menu' ? (
        <>
          <span className="pointer-events-none absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-xs text-(--color-text-3) transition-opacity group-hover:opacity-0">
            {imageCount > 0 && (
              <span
                className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full bg-(--color-surface-2) px-1 text-[10px] font-medium leading-none tabular-nums text-(--color-text-3)"
                title={imageCountLabel}
                aria-label={imageCountLabel}
              >
                <Icon name="image" size={10} className="opacity-80" />
                <span>{imageCount}</span>
              </span>
            )}
            <span className="min-w-8 text-right tabular-nums">{formatSessionTime(session.updatedAt)}</span>
          </span>
          <button
            type="button"
            onClick={() => onDeleteSession(session.id)}
            className="absolute right-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] opacity-50 text-(--color-text-4) transition-[opacity,background-color,color] hover:opacity-100 hover:text-(--color-danger) focus-visible:opacity-100 focus-visible:outline-none active:scale-90"
            aria-label={t('agentChat.header.deleteConversation')}
          >
            <Icon name="trash" size={12} />
          </button>
        </>
      ) : (
        <>
          <span className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-xs text-(--color-text-3) transition-opacity group-hover:opacity-0">
            {imageCount > 0 && (
              <span
                className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full bg-(--color-surface-2) px-1 text-[10px] font-medium leading-none tabular-nums text-(--color-text-3)"
                title={imageCountLabel}
                aria-label={imageCountLabel}
              >
                <Icon name="image" size={10} className="opacity-80" />
                <span>{imageCount}</span>
              </span>
            )}
            <span className="min-w-8 text-right tabular-nums">{formatSessionTime(session.updatedAt)}</span>
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
