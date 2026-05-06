import type { Translate } from '../../i18n'

export function formatAgentError(error: string, t: Translate): string {
  const normalized = error.trim().toLowerCase()
  if (
    normalized === 'request was aborted' ||
    normalized === 'the operation was aborted' ||
    normalized === 'this operation was aborted'
  ) {
    return t('agentChat.error.requestAborted')
  }

  return error
}
