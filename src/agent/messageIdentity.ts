import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import { agentMessageRole } from './agentChat'

export function agentMessageTimestamp(message: AgentMessage): number | null {
  if (typeof message !== 'object' || message === null) return null
  const value = (message as unknown as Record<string, unknown>).timestamp
  return typeof value === 'number' ? value : null
}

export function isSameQueuedUserMessage(message: AgentMessage, queuedMessage: AgentMessage): boolean {
  if (message === queuedMessage) return true
  if (agentMessageRole(message) !== 'user' || agentMessageRole(queuedMessage) !== 'user') return false

  const timestamp = agentMessageTimestamp(message)
  const queuedTimestamp = agentMessageTimestamp(queuedMessage)
  if (timestamp !== null && queuedTimestamp !== null && timestamp === queuedTimestamp) return true

  return false
}
