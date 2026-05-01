import type { Dispatch, SetStateAction } from 'react'

import type { AgentChatMenu } from './types'
import { formatSessionTime } from './utils'
import type { AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

type AgentChatHeaderProps = {
  sessions: AgentSessionSummary[]
  currentSessionId: string | null
  sessionsLoading: boolean
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}

export function AgentChatHeader({
  sessions,
  currentSessionId,
  sessionsLoading,
  openMenu,
  setOpenMenu,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: AgentChatHeaderProps) {
  const { t } = useI18n()
  const currentSession = sessions.find((session) => session.id === currentSessionId)

  return (
    <div className="relative mb-1.5 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpenMenu((prev) => (prev === 'sessions' ? null : 'sessions'))}
        className="chip ghost min-w-0 max-w-[calc(100%-78px)] shrink justify-start gap-1.5 px-2.5 text-base"
        style={{ height: 30 }}
        title={t('agentChat.header.switchTitle')}
      >
        <span className="min-w-0 truncate text-left text-(--color-text-2)">
          {sessionsLoading
            ? t('agentChat.header.loadingSessions')
            : (currentSession?.title ?? t('agentChat.header.newConversation'))}
        </span>
        <Icon name="chevron_right" size={13} className={openMenu === 'sessions' ? '-rotate-90' : 'rotate-90'} />
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onNewSession}
        className="chip shrink-0 px-3 text-sm font-medium"
        style={{ height: 30, boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
      >
        {t('agentChat.header.newConversation')}
      </button>
      {openMenu === 'sessions' && (
        <div className="absolute top-[36px] left-0 z-50 w-full rounded-[var(--radius-lg)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
          <div className="px-2 py-1.5 text-sm font-medium text-(--color-text-4)">{t('agentChat.header.history')}</div>
          <div className="max-h-[260px] overflow-y-auto py-0.5">
            {sessions.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-(--color-text-4)">
                {t('agentChat.header.emptyHistory')}
              </div>
            ) : (
              sessions.map((session) => {
                const active = session.id === currentSessionId
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      onSwitchSession(session.id)
                      setOpenMenu(null)
                    }}
                    className="group flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-(--color-surface-2)"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-(--color-text-2)">{session.title}</span>
                        {active && <Icon name="check" size={12} className="shrink-0 text-(--color-accent)" />}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-(--color-text-4)">
                        {session.previewText || session.firstUserText || t('agentChat.header.emptyConversation')}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-(--color-text-4)">
                      {formatSessionTime(session.updatedAt)}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        event.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-(--color-text-4) opacity-0 transition-opacity hover:bg-(--color-surface-3) hover:text-(--color-danger) group-hover:opacity-100"
                      aria-label={t('agentChat.header.deleteConversation')}
                    >
                      <Icon name="trash" size={12} />
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
