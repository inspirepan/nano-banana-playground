import { useMemo, type Dispatch, type SetStateAction } from 'react'

import { AgentSessionListItem } from './AgentSessionListItem'
import type { AgentChatMenu } from './types'
import type { AgentSessionStatusMap, AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

type AgentChatHeaderProps = {
  sessions: AgentSessionSummary[]
  sessionStatuses: AgentSessionStatusMap
  currentSessionId: string | null
  sessionsLoading: boolean
  centeredTitle?: boolean
  showNewSessionButton?: boolean
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}

export function AgentChatHeader({
  sessions,
  sessionStatuses,
  currentSessionId,
  sessionsLoading,
  centeredTitle = false,
  showNewSessionButton = true,
  openMenu,
  setOpenMenu,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: AgentChatHeaderProps) {
  const { t } = useI18n()
  const currentSession = useMemo(() => sessions.find((s) => s.id === currentSessionId), [sessions, currentSessionId])
  const title = sessionsLoading
    ? t('agentChat.header.loadingSessions')
    : (currentSession?.title ?? t('agentChat.header.newConversation'))

  if (centeredTitle) {
    // Wide-layout header strip. Match the InputPanelHeader switcher height +
    // bottom margin so this row aligns with the left/right rail headers.
    const showTitle = !sessionsLoading && Boolean(currentSession)
    return (
      <div className="mb-[var(--panel-header-mb)] flex min-h-[30px] items-center justify-center text-center">
        {showTitle ? (
          <div className="w-full min-w-0 max-w-[min(960px,100%)] truncate font-display text-base font-semibold text-(--color-text)">
            {title}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative mb-1.5 flex items-center gap-2">
      <button
        type="button"
        data-agent-menu-trigger
        onClick={() => setOpenMenu((prev) => (prev === 'sessions' ? null : 'sessions'))}
        aria-expanded={openMenu === 'sessions'}
        className={`group flex h-[30px] min-w-0 shrink items-center gap-1.5 rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 text-left shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-[background-color,box-shadow,color] duration-150 hover:bg-(--color-surface-2) hover:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] ${showNewSessionButton ? 'max-w-[calc(100%-86px)]' : 'max-w-full'}`}
        title={t('agentChat.header.switchTitle')}
      >
        <span className="min-w-0 flex-1 truncate text-base font-medium text-(--color-text-2) transition-colors group-hover:text-(--color-text)">
          {title}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-(--color-text-4) transition-colors group-hover:text-(--color-text-3)">
          <span>{t('agentChat.header.switchAction')}</span>
          <Icon
            name="chevron_down"
            size={13}
            className={`transition-transform duration-150 ${openMenu === 'sessions' ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      <div className="flex-1" />
      {showNewSessionButton ? (
        <button
          type="button"
          onClick={onNewSession}
          className="chip shrink-0 px-3 text-sm font-medium"
          style={{ height: 30, boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
        >
          {t('agentChat.header.newConversation')}
        </button>
      ) : null}
      {openMenu === 'sessions' && (
        <div
          data-agent-menu
          className="popover-pop absolute top-[40px] left-0 z-50 w-full origin-top rounded-[var(--radius-lg)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
        >
          <div className="px-2 py-1.5 text-sm font-medium text-(--color-text-3)">{t('agentChat.header.history')}</div>
          <div className="max-h-[260px] space-y-0.5 overflow-y-auto py-0.5">
            {sessions.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-(--color-text-3)">
                {t('agentChat.header.emptyHistory')}
              </div>
            ) : (
              sessions.map((session) => {
                const active = session.id === currentSessionId
                const status = sessionStatuses[session.id] ?? null
                const displayTitle = session.firstUserText.replace(/\s+/g, ' ').trim() || session.title
                return (
                  <AgentSessionListItem
                    key={session.id}
                    session={session}
                    active={active}
                    status={status}
                    title={displayTitle}
                    variant="menu"
                    onSwitchSession={() => {
                      onSwitchSession(session.id)
                      setOpenMenu(null)
                    }}
                    onDeleteSession={() => {
                      onDeleteSession(session.id)
                    }}
                  />
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
