import { translate } from '../../i18n'

export type SystemEventSummaryPart = {
  text: string
  mono?: boolean
  // When set, this part is an image id that should link back to the
  // GenImage task card identified by toolCallId.
  imageId?: string
  toolCallId?: string
}

const IMAGE_IDS_MARKER = '\uE000imageIds\uE000'

function textPart(text: string): SystemEventSummaryPart[] {
  return text ? [{ text }] : []
}

function systemStatusLabel(status: string): string {
  if (status === 'pending_approval') return translate('agentChat.taskStatus.pendingApproval')
  if (status === 'waiting_dependencies') return translate('agentChat.taskStatus.waitingDependencies')
  if (status === 'queued') return translate('agentChat.taskStatus.queued')
  if (status === 'running') return translate('agentChat.taskStatus.running')
  if (status === 'completed') return translate('agentChat.taskStatus.completed')
  if (status === 'failed') return translate('agentChat.taskStatus.failed')
  if (status === 'rejected') return translate('agentChat.taskStatus.rejected')
  if (status === 'canceled') return translate('agentChat.taskStatus.canceled')
  if (status === 'approved') return translate('agentChat.taskStatus.approved')
  return status
}

function parseCommaList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function countCommaList(value: string | undefined): number {
  return parseCommaList(value).length
}

type ParsedToolCallback = {
  tool: string
  toolCallId: string
  fields: Record<string, string>
}

function parseToolCallbacks(text: string): ParsedToolCallback[] {
  const callbacks: ParsedToolCallback[] = []
  let current: ParsedToolCallback | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const header = /^tool\s+(\w+)\s+call(?:\s+(\S+))?/.exec(line)
    if (header) {
      if (current) callbacks.push(current)
      current = { tool: header[1], toolCallId: header[2] ?? '', fields: {} }
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

export function summarizeSystemEventParts(text: string): SystemEventSummaryPart[] {
  const callbacks = parseToolCallbacks(text)
  const tool = callbacks[0]?.tool
  const status = callbacks[0]?.fields.status
  const statusText = status ? systemStatusLabel(status) : undefined

  if (tool !== 'GenImage') {
    const toolName = tool ?? translate('agentChat.tool.unknown')
    return textPart(
      statusText
        ? translate('agentChat.system.toolCallbackWithStatus', { tool: toolName, status: statusText })
        : translate('agentChat.system.toolCallback', { tool: toolName }),
    )
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
    const label = translate('agentChat.system.imageCompleted', { count: completedCount, ids: IMAGE_IDS_MARKER })
    const markerIndex = label.indexOf(IMAGE_IDS_MARKER)
    if (completedCount === 0) return textPart(label.replace(IMAGE_IDS_MARKER, ''))
    if (markerIndex === -1) return textPart(label)

    const idParts: SystemEventSummaryPart[] = []
    let first = true
    for (const callback of genImageCallbacks) {
      for (const id of parseCommaList(callback.fields.image_ids)) {
        if (!first) idParts.push({ text: ', ' })
        first = false
        idParts.push({
          text: id,
          mono: true,
          imageId: id,
          toolCallId: callback.toolCallId || undefined,
        })
      }
    }

    return [
      ...textPart(label.slice(0, markerIndex)),
      ...idParts,
      ...textPart(label.slice(markerIndex + IMAGE_IDS_MARKER.length)),
    ]
  }
  if (statuses.includes('failed')) return textPart(summarizeFailedGenImages(completedCount, failedCount))
  if (statuses.length > 0 && statuses.every((item) => item === 'rejected'))
    return textPart(translate('agentChat.system.imageRejected'))
  if (statuses.includes('canceled')) {
    return textPart(
      completedCount > 0
        ? translate('agentChat.system.imageCanceledWithCompleted', { count: completedCount })
        : translate('agentChat.system.imageCanceled'),
    )
  }
  return textPart(
    statusText
      ? translate('agentChat.system.imageTaskStatus', { status: statusText })
      : translate('agentChat.system.imageTask'),
  )
}

export function summarizeSystemEvent(text: string): string {
  return summarizeSystemEventParts(text)
    .map((part) => part.text)
    .join('')
}

export function isHiddenSystemEvent(text: string): boolean {
  const callbacks = parseToolCallbacks(text)
  return (
    callbacks.length > 0 &&
    callbacks.every((callback) => callback.tool === 'AskUserQuestion') &&
    /\btool\s+AskUserQuestion\s+call(?:\s+\S+)?\s+has been answered\./.test(text)
  )
}

export type SystemEventVariant = 'completed' | 'failed' | 'rejected' | 'canceled' | 'other'

// Classify a <system> event for UI treatment (e.g. decorating completed GenImage
// batches with a success icon). Mirrors the precedence in summarizeSystemEventParts.
export function classifySystemEvent(text: string): SystemEventVariant {
  const callbacks = parseToolCallbacks(text)
  if (callbacks[0]?.tool !== 'GenImage') return 'other'
  const statuses = callbacks
    .filter((callback) => callback.tool === 'GenImage')
    .map((callback) => callback.fields.status)
    .filter(Boolean)
  if (statuses.length > 0 && statuses.every((item) => item === 'completed')) return 'completed'
  if (statuses.includes('failed')) return 'failed'
  if (statuses.length > 0 && statuses.every((item) => item === 'rejected')) return 'rejected'
  if (statuses.includes('canceled')) return 'canceled'
  return 'other'
}
