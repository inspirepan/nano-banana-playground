import { useMemo, type Dispatch, type SetStateAction } from 'react'

import { AgentSessionStatusBadge } from './AgentSessionSidebar'
import type { AgentChatMenu } from './types'
import { formatSessionTime } from './utils'
import type { AgentSessionStatusMap, AgentSessionSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

type AgentChatHeaderProps = {
  sessions: AgentSessionSummary[]
  sessionStatuses: AgentSessionStatusMap
  currentSessionId: string | null
  sessionsLoading: boolean
  centeredTitle?: boolean
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
  openMenu,
  setOpenMenu,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: AgentChatHeaderProps) {
  const { t } = useI18n()
  const currentSession = useMemo(() => sessions.find((s) => s.id === currentSessionId), [sessions, currentSessionId])
  const centeredDisplayTitle = currentSession?.firstUserText.replace(/\s+/g, ' ').trim()
  const title = sessionsLoading
    ? t('agentChat.header.loadingSessions')
    : (currentSession?.title ?? t('agentChat.header.newConversation'))

  if (centeredTitle) {
    return (
      <div className="mb-1.5 flex min-h-[30px] items-center justify-center text-center">
        <div className="w-full min-w-0 max-w-[min(960px,100%)] truncate font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
          {centeredDisplayTitle || title}
        </div>
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
        className="group flex h-[28px] min-w-0 max-w-[calc(100%-86px)] shrink items-center gap-1.5 rounded-[var(--radius-sm)] bg-transparent text-left transition-colors duration-150"
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
      <button
        type="button"
        onClick={onNewSession}
        className="chip shrink-0 px-3 text-sm font-medium"
        style={{ height: 30, boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
      >
        {t('agentChat.header.newConversation')}
      </button>
      {openMenu === 'sessions' && (
        <div
          data-agent-menu
          className="absolute top-[40px] left-0 z-50 w-full rounded-[var(--radius-lg)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]"
        >
          <div className="px-2 py-1.5 text-sm font-medium text-(--color-text-3)">{t('agentChat.header.history')}</div>
          <div className="max-h-[260px] overflow-y-auto py-0.5">
            {sessions.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-(--color-text-3)">
                {t('agentChat.header.emptyHistory')}
              </div>
            ) : (
              sessions.map((session) => {
                const active = session.id === currentSessionId
                const status = sessionStatuses[session.id] ?? null
                const imageCount = session.imageCount ?? 0
                const imageCountLabel = t('agentChat.header.generatedImageCount', { count: imageCount })
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
                      <span className="mt-0.5 block truncate text-sm text-(--color-text-3)">
                        {session.previewText || session.firstUserText || t('agentChat.header.emptyConversation')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm text-(--color-text-3)">
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
                      <span>{formatSessionTime(session.updatedAt)}</span>
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
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-(--color-text-4) transition-colors hover:bg-(--color-surface-3) hover:text-(--color-danger)"
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
