import type { AppMessage as AgentMessage, Attachment } from '@mariozechner/pi-agent'

export type AgentChatAttachment = {
  id: string
  data: string
  mimeType: string
  fileName: string
  size: number
}

export type AgentMessageImage = {
  type: 'image'
  data: string
  mimeType: string
}

type AgentMessageRole = 'user' | 'assistant' | 'toolResult' | 'unknown'
type LlmLikeAgentMessage = AgentMessage & {
  role: 'user' | 'assistant' | 'toolResult'
  content?: unknown
  errorMessage?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isLlmAgentMessage(message: AgentMessage): message is LlmLikeAgentMessage {
  if (!isRecord(message)) return false
  return message.role === 'user' || message.role === 'assistant' || message.role === 'toolResult'
}

export function agentMessageRole(message: AgentMessage): AgentMessageRole {
  if (!isLlmAgentMessage(message)) return 'unknown'
  return message.role
}

export function agentMessageText(message: AgentMessage): string {
  if (!isLlmAgentMessage(message)) return ''
  const { content } = message
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .flatMap((part) => (isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
    .join('\n')
}

export function agentMessageThinking(message: AgentMessage): string {
  if (!isLlmAgentMessage(message) || message.role !== 'assistant') return ''
  if (!Array.isArray(message.content)) return ''
  return message.content
    .flatMap((part) =>
      isRecord(part) && part.type === 'thinking' && typeof part.thinking === 'string' ? [part.thinking] : [],
    )
    .join('\n')
}

export function agentMessageImages(message: AgentMessage): AgentMessageImage[] {
  if (!isLlmAgentMessage(message)) return []
  const { content } = message
  if (!Array.isArray(content)) return []
  return content.flatMap((part) =>
    isRecord(part) && part.type === 'image' && typeof part.data === 'string' && typeof part.mimeType === 'string'
      ? [{ type: 'image' as const, data: part.data, mimeType: part.mimeType }]
      : [],
  )
}

export function agentMessageError(message: AgentMessage): string | null {
  if (!isLlmAgentMessage(message) || message.role !== 'assistant') return null
  return typeof message.errorMessage === 'string' ? message.errorMessage : null
}

export function attachmentToAgentAttachment(attachment: AgentChatAttachment): Attachment {
  return {
    id: attachment.id,
    type: 'image',
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    content: attachment.data,
  }
}

export function imageDataUrl(image: Pick<AgentMessageImage, 'data' | 'mimeType'>): string {
  return `data:${image.mimeType};base64,${image.data}`
}
