import { formatSessionTime } from './utils'
import type { AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

export function AgentSessionSidebar({
  sessions,
  currentSessionId,
  sessionsLoading,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onSwitchToGenerate,
  onOpenSettings,
}: {
  sessions: AgentSessionSummary[]
  currentSessionId: string | null
  sessionsLoading: boolean
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onSwitchToGenerate?: () => void
  onOpenSettings: () => void
}) {
  const { t } = useI18n()

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col bg-(--color-bg) px-4 py-6 shadow-[inset_-1px_0_0_var(--ring-edge-soft)] md:flex">
      <div className="mb-5 flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
          {t('app.name')}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn"
          title={t('common.settings')}
          aria-label={t('common.settings')}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>

      <div
        className="segmented mb-4 w-full"
        style={{ ['--seg-count' as string]: 2, ['--seg-index' as string]: 1 }}
        aria-label={t('input.mode.aria')}
      >
        <button type="button" data-active={false} onClick={onSwitchToGenerate} disabled={!onSwitchToGenerate}>
          <span>{t('input.mode.generate')}</span>
        </button>
        <button type="button" data-active>
          <span>{t('common.agent')}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onNewSession}
        className="mb-7 flex h-[34px] w-full items-center gap-2 rounded-[var(--radius-md)] bg-(--color-surface-2) px-3 text-left text-base font-medium text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] transition-[background-color,color] hover:bg-(--color-surface-3) hover:text-(--color-text) focus-visible:bg-(--color-surface-3) focus-visible:text-(--color-text) focus-visible:outline-none"
      >
        <Icon name="plus" size={13} />
        <span>{t('agentChat.header.newConversation')}</span>
      </button>

      <div className="mb-2 flex items-center gap-2 px-1">
        <div className="label min-w-0 flex-1 truncate">{t('agentChat.header.allConversations')}</div>
        <span className="text-xs text-(--color-text-4) tabular-nums">{sessions.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {sessionsLoading ? (
          <div className="px-2 py-3 text-sm text-(--color-text-3)">{t('agentChat.header.loadingSessions')}</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-[var(--radius-md)] px-2 py-3 text-sm text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
            {t('agentChat.header.emptyHistory')}
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => {
              const active = session.id === currentSessionId
              const imageCount = session.imageCount ?? 0
              const imageCountLabel = t('agentChat.header.generatedImageCount', { count: imageCount })
              return (
                <div
                  key={session.id}
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
                    title={session.title}
                  >
                    <span
                      className={`block truncate text-base ${active ? 'font-semibold text-(--color-text)' : 'text-(--color-text-2)'}`}
                    >
                      {session.title}
                    </span>
                  </button>
                  <span className="ml-2 flex shrink-0 items-center gap-1.5 text-sm text-(--color-text-3)">
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
                    <span>{formatSessionTime(session.updatedAt)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    className={`absolute right-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-(--color-text-4) opacity-0 transition-opacity hover:bg-(--color-surface-3) hover:text-(--color-danger) group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none ${
                      active
                        ? 'bg-(--color-accent-wash) shadow-[-10px_0_12px_var(--color-accent-wash)]'
                        : 'bg-(--color-surface-2) shadow-[-10px_0_12px_var(--color-surface-2)]'
                    }`}
                    aria-label={t('agentChat.header.deleteConversation')}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
