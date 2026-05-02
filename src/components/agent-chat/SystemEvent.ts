import { translate } from '../../i18n'

function systemStatusLabel(status: string): string {
  if (status === 'pending_approval') return translate('agentChat.taskStatus.pendingApproval')
  if (status === 'queued') return translate('agentChat.taskStatus.queued')
  if (status === 'running') return translate('agentChat.taskStatus.running')
  if (status === 'completed') return translate('agentChat.taskStatus.completed')
  if (status === 'failed') return translate('agentChat.taskStatus.failed')
  if (status === 'rejected') return translate('agentChat.taskStatus.rejected')
  if (status === 'canceled') return translate('agentChat.taskStatus.canceled')
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

type ParsedToolCallback = {
  tool: string
  fields: Record<string, string>
}

function parseToolCallbacks(text: string): ParsedToolCallback[] {
  const callbacks: ParsedToolCallback[] = []
  let current: ParsedToolCallback | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const tool = /^tool\s+(\w+)\s+call\b/.exec(line)?.[1]
    if (tool) {
      if (current) callbacks.push(current)
      current = { tool, fields: {} }
      continue
    }

    if (!current) continue
    const field = /^(\w+):\s*(.*)$/.exec(line)
    if (field) current.fields[field[1]] = field[2]
  }

  if (current) callbacks.push(current)
  return callbacks
}

function summarizeFailedGenImages(completedCount: number, failedCount: number): string {
  const parts: string[] = []
  if (completedCount > 0) parts.push(translate('agentChat.system.imageSucceededPart', { count: completedCount }))
  if (failedCount > 0) parts.push(translate('agentChat.system.imageFailedPart', { count: failedCount }))
  return parts.length > 0
    ? translate('agentChat.system.imageFailedWithParts', {
        parts: parts.join(translate('agentChat.system.partSeparator')),
      })
    : translate('agentChat.system.imageFailed')
}

export function summarizeSystemEvent(text: string): string {
  const callbacks = parseToolCallbacks(text)
  const tool = callbacks[0]?.tool
  const status = callbacks[0]?.fields.status
  const statusText = status ? systemStatusLabel(status) : undefined

  if (tool !== 'GenImage') {
    const toolName = tool ?? translate('agentChat.tool.unknown')
    return statusText
      ? translate('agentChat.system.toolCallbackWithStatus', { tool: toolName, status: statusText })
      : translate('agentChat.system.toolCallback', { tool: toolName })
  }

  const genImageCallbacks = callbacks.filter((callback) => callback.tool === 'GenImage')
  const statuses = genImageCallbacks.map((callback) => callback.fields.status).filter(Boolean)
  const reservedCount = genImageCallbacks.reduce(
    (sum, callback) => sum + countCommaList(callback.fields.reserved_image_ids),
    0,
  )
  const completedCount = genImageCallbacks.reduce((sum, callback) => sum + countCommaList(callback.fields.image_ids), 0)
  const failedCount = Math.max(0, reservedCount - completedCount)

  if (statuses.length > 0 && statuses.every((item) => item === 'completed')) {
    return translate('agentChat.system.imageCompleted', { count: completedCount })
  }
  if (statuses.includes('failed')) return summarizeFailedGenImages(completedCount, failedCount)
  if (statuses.length > 0 && statuses.every((item) => item === 'rejected'))
    return translate('agentChat.system.imageRejected')
  if (statuses.includes('canceled')) {
    return completedCount > 0
      ? translate('agentChat.system.imageCanceledWithCompleted', { count: completedCount })
      : translate('agentChat.system.imageCanceled')
  }
  return statusText
    ? translate('agentChat.system.imageTaskStatus', { status: statusText })
    : translate('agentChat.system.imageTask')
}
