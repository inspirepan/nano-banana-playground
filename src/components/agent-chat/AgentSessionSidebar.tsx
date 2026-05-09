import { AgentSessionListItem } from './AgentSessionListItem'
import type { AgentSessionStatusMap, AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { formatShortcut, getPrimaryModifierKeyLabel, getShiftKeyLabel } from '../../lib/keyboard'
import { Icon } from '../Icon'

export function AgentSessionSidebar({
  sessions,
  sessionStatuses,
  currentSessionId,
  sessionsLoading,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: {
  sessions: AgentSessionSummary[]
  sessionStatuses: AgentSessionStatusMap
  currentSessionId: string | null
  sessionsLoading: boolean
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}) {
  const { t } = useI18n()
  const newSessionShortcut = formatShortcut([getPrimaryModifierKeyLabel(), getShiftKeyLabel(), 'O'])

  return (
    <aside className="flex h-full min-h-0 flex-col bg-(--color-bg) pr-2 pb-6 pl-[18px]">
      <button
        type="button"
        onClick={onNewSession}
        className="mb-7 flex h-[34px] w-full items-center gap-2 rounded-[var(--radius-md)] bg-(--color-surface-2) px-3 text-left text-base font-medium text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] transition-[background-color,color] hover:bg-(--color-surface-3) hover:text-(--color-text) focus-visible:bg-(--color-surface-3) focus-visible:text-(--color-text) focus-visible:outline-none"
      >
        <Icon name="plus" size={13} />
        <span className="min-w-0 flex-1 truncate">{t('agentChat.header.newConversation')}</span>
        <kbd className="hidden shrink-0 md:inline-flex" aria-hidden="true">
          {newSessionShortcut}
        </kbd>
      </button>

      <div className="mb-2 flex items-center gap-2 px-1">
        <div className="label min-w-0 flex-1 truncate">{t('agentChat.header.allConversations')}</div>
        <span className="text-xs text-(--color-text-4) tabular-nums">{sessions.length}</span>
      </div>

      <div className="scroll-fade-y min-h-0 flex-1 overflow-y-auto pr-1 [--scroll-fade-end-size:1.5rem] [--scroll-fade-start-size:1.25rem]">
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
              const status = sessionStatuses[session.id] ?? null
              return (
                <AgentSessionListItem
                  key={session.id}
                  session={session}
                  active={active}
                  status={status}
                  title={session.title}
                  variant="sidebar"
                  onSwitchSession={onSwitchSession}
                  onDeleteSession={onDeleteSession}
                />
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
