import type { AgentChatAttachment } from './agentChat'
import type { ModelConfig } from '../config/models'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

export type AgentImageTaskStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'

export type AgentImageTask = {
  id: string
  toolCallId: string
  agentTurnId: string
  createdAt: number
  status: AgentImageTaskStatus
  request: {
    prompt: string
    requestedImageId: string
    reservedImageIds: string[]
    modelId: ModelConfig['id']
    resolution: string
    aspectRatio: string
    batchCount: number
    referenceImageIds: string[]
    options: Record<string, unknown>
    stackId?: string
    parentImageId?: string
  }
  generationJobId?: string
  resultImageIds: string[]
  renamedImageIds: boolean
  error?: string
}

export type AgentImageRegistryEntry = {
  id: string
  image?: PlaygroundImage | PlaygroundImageMeta | AgentChatAttachment
  source: 'agent_attachment' | 'reference' | 'history' | 'generated'
  status: 'ready' | 'reserved' | 'failed' | 'rejected'
  createdAt: number
}

export function countReadyGeneratedAgentImages(
  entries: Iterable<Pick<AgentImageRegistryEntry, 'source' | 'status'>>,
): number {
  let count = 0
  for (const entry of entries) {
    if (entry.source === 'generated' && entry.status === 'ready') count += 1
  }
  return count
}

export type AgentTurnCallbackState = {
  agentTurnId: string
  taskIds: string[]
  callbackQueued: boolean
}

export type ReserveAgentImageIdsResult = {
  requestedImageId: string
  reservedImageIds: string[]
  renamed: boolean
}

export const AGENT_PROMPT_DEFAULT_LINE_LIMIT = 2000
const AGENT_PROMPT_MAX_CHARS = 50_000

export function isTerminalAgentImageTaskStatus(status: AgentImageTaskStatus): boolean {
  return status === 'rejected' || status === 'canceled' || status === 'completed' || status === 'failed'
}

export function normalizeAgentImageId(value: string): string {
  const withoutControlChars = Array.from(value.trim())
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  const cleaned = withoutControlChars.replace(/\s+/g, '_')
  return cleaned || 'image'
}

function candidateImageId(base: string, index: number): string {
  return index === 1 ? base : `${base}_${index}`
}

function incrementImageId(id: string): string {
  const match = /^(.*)_(\d+)$/.exec(id)
  if (!match) return `${id}_2`
  return `${match[1]}_${Number.parseInt(match[2], 10) + 1}`
}

export async function reserveAgentImageIds(params: {
  requestedImageId: string
  count: number
  isReserved: (id: string) => boolean
  exists: (id: string) => Promise<boolean>
}): Promise<ReserveAgentImageIdsResult> {
  const requestedImageId = normalizeAgentImageId(params.requestedImageId)
  const count = Math.max(1, Math.floor(params.count))
  const reservedImageIds: string[] = []

  for (let i = 1; i <= count; i++) {
    let candidate = candidateImageId(requestedImageId, i)
    while (reservedImageIds.includes(candidate) || params.isReserved(candidate) || (await params.exists(candidate))) {
      candidate = incrementImageId(candidate)
    }
    reservedImageIds.push(candidate)
  }

  const expectedIds = Array.from({ length: count }, (_, index) => candidateImageId(requestedImageId, index + 1))
  return {
    requestedImageId,
    reservedImageIds,
    renamed: reservedImageIds.some((id, index) => id !== expectedIds[index]),
  }
}

export function formatPromptLines(prompt: string, offset = 1, limit = AGENT_PROMPT_DEFAULT_LINE_LIMIT): string {
  const lines = prompt.split('\n')
  const start = Math.max(1, Math.floor(offset))
  const lineLimit = Math.max(0, Math.floor(limit))

  if (start > lines.length) {
    return `<system-reminder>Warning: the prompt exists but is shorter than the provided offset (${start}). The prompt has ${lines.length} lines.</system-reminder>`
  }

  const output: string[] = []
  let truncatedByChars = false
  const endExclusive = Math.min(lines.length, start - 1 + lineLimit)
  for (let index = start - 1; index < endExclusive; index++) {
    const numbered = `${String(index + 1).padStart(6, ' ')}→${lines[index]}`
    const nextLength = output.join('\n').length + numbered.length + (output.length > 0 ? 1 : 0)
    if (nextLength > AGENT_PROMPT_MAX_CHARS) {
      truncatedByChars = true
      break
    }
    output.push(numbered)
  }

  const omittedByLines = Math.max(0, lines.length - (start - 1 + output.length))
  if (omittedByLines > 0 || truncatedByChars) {
    const reason = truncatedByChars ? `${AGENT_PROMPT_MAX_CHARS} character limit` : `${lineLimit} line limit`
    output.push(
      `… (${omittedByLines} more lines truncated due to ${reason}, prompt has ${lines.length} lines total, use offset/limit to read other parts)`,
    )
  }

  return output.join('\n')
}

export function promptLineCount(prompt: string): number {
  return prompt.split('\n').length
}
