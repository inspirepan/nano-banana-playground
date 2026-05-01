import { translate } from '../../i18n'

function systemStatusLabel(status: string): string {
  if (status === 'pending_approval') return translate('agentChat.taskStatus.pendingApproval')
  if (status === 'queued') return translate('agentChat.taskStatus.queued')
  if (status === 'running') return translate('agentChat.taskStatus.running')
  if (status === 'completed') return translate('agentChat.taskStatus.completed')
  if (status === 'failed') return translate('agentChat.taskStatus.failed')
  if (status === 'rejected' || status === 'canceled') return translate('agentChat.taskStatus.canceled')
  if (status === 'approved') return translate('agentChat.taskStatus.approved')
  return status
}

function countCommaList(value: string | undefined): number {
  if (!value) return 0
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length
}

export function summarizeSystemEvent(text: string): string {
  const tool = /tool\s+(\w+)/.exec(text)?.[1]
  const status = /status:\s*(\w+)/.exec(text)?.[1]
  const statusText = status ? systemStatusLabel(status) : undefined
  const reservedRaw = /reserved_image_ids:\s*(.*)/.exec(text)?.[1]
  const imagesRaw = /image_ids:\s*(.*)/.exec(text)?.[1]
  const reservedCount = countCommaList(reservedRaw)
  const completedCount = countCommaList(imagesRaw)
  const failedCount = Math.max(0, reservedCount - completedCount)

  if (tool !== 'GenImage') {
    const toolName = tool ?? translate('agentChat.tool.unknown')
    return statusText
      ? translate('agentChat.system.toolCallbackWithStatus', { tool: toolName, status: statusText })
      : translate('agentChat.system.toolCallback', { tool: toolName })
  }

  switch (status) {
    case 'completed':
      return translate('agentChat.system.imageCompleted', { count: completedCount })
    case 'failed': {
      const parts: string[] = []
      if (completedCount > 0) parts.push(translate('agentChat.system.imageSucceededPart', { count: completedCount }))
      if (failedCount > 0) parts.push(translate('agentChat.system.imageFailedPart', { count: failedCount }))
      return parts.length > 0
        ? translate('agentChat.system.imageFailedWithParts', {
            parts: parts.join(translate('agentChat.system.partSeparator')),
          })
        : translate('agentChat.system.imageFailed')
    }
    case 'rejected':
      return translate('agentChat.system.imageRejected')
    case 'canceled':
      return completedCount > 0
        ? translate('agentChat.system.imageCanceledWithCompleted', { count: completedCount })
        : translate('agentChat.system.imageCanceled')
    default:
      return statusText
        ? translate('agentChat.system.imageTaskStatus', { status: statusText })
        : translate('agentChat.system.imageTask')
  }
}
