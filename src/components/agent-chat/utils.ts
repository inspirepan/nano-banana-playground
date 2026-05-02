import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import {
  agentMessageError,
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  agentMessageThinking,
  agentMessageToolCalls,
  agentMessageToolResult,
  type AgentImageTask,
  type AgentMessageToolCall,
  type AgentMessageToolResult,
} from '../../agent'
import { translate } from '../../i18n'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../lib/types'

export type ChatRenderItem =
  | { type: 'message'; key: string; message: AgentMessage; isStreaming: boolean }
  | {
      type: 'tools'
      key: string
      calls: AgentMessageToolCall[]
      results: AgentMessageToolResult[]
      isStreaming: boolean
    }

export function taskStatusLabel(status: AgentImageTask['status']): string {
  if (status === 'pending_approval') return translate('agentChat.taskStatus.pendingApproval')
  if (status === 'queued') return translate('agentChat.taskStatus.queued')
  if (status === 'running') return translate('agentChat.taskStatus.running')
  if (status === 'completed') return translate('agentChat.taskStatus.completed')
  if (status === 'failed') return translate('agentChat.taskStatus.failed')
  if (status === 'rejected') return translate('agentChat.taskStatus.rejected')
  if (status === 'canceled') return translate('agentChat.taskStatus.canceled')
  return translate('agentChat.taskStatus.approved')
}

export function formatSessionTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  if (sameDay) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function hasRenderableMessageContent(message: AgentMessage): boolean {
  return (
    agentMessageRole(message) === 'user' ||
    agentMessageText(message).trim() !== '' ||
    agentMessageThinking(message).trim() !== '' ||
    agentMessageImages(message).length > 0 ||
    Boolean(agentMessageError(message))
  )
}

export function buildChatRenderItems(
  messages: AgentMessage[],
  streamingMessage: AgentMessage | null,
): ChatRenderItem[] {
  const items: ChatRenderItem[] = []

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index]
    const role = agentMessageRole(message)
    const isStreamingMessage = Boolean(streamingMessage && message === streamingMessage)
    if (role === 'assistant') {
      const calls = agentMessageToolCalls(message)
      if (hasRenderableMessageContent(message)) {
        items.push({ type: 'message', key: `message-${index}`, message, isStreaming: isStreamingMessage })
      }
      if (calls.length > 0) {
        const results: AgentMessageToolResult[] = []
        let nextIndex = index + 1
        while (nextIndex < messages.length) {
          const result = agentMessageToolResult(messages[nextIndex])
          if (!result || !calls.some((call) => call.id === result.toolCallId)) break
          results.push(result)
          nextIndex++
        }
        items.push({
          type: 'tools',
          key: `tools-${calls.map((call) => call.id).join('-')}`,
          calls,
          results,
          isStreaming: isStreamingMessage,
        })
        index = nextIndex - 1
      }
      continue
    }
    if (role === 'toolResult') {
      const result = agentMessageToolResult(message)
      if (result) {
        items.push({
          type: 'tools',
          key: `tool-result-${result.toolCallId}-${index}`,
          calls: [],
          results: [result],
          isStreaming: false,
        })
      }
      continue
    }
    items.push({ type: 'message', key: `message-${index}`, message, isStreaming: isStreamingMessage })
  }
  return items
}

export function toolLabel(name: string): string {
  if (name === 'GenImage') return translate('agentChat.tool.label.genImage')
  if (name === 'ReadImage') return translate('agentChat.tool.label.readImage')
  if (name === 'AskUserQuestion') return translate('agentChat.tool.label.askUserQuestion')
  if (name === 'Skill') return translate('agentChat.tool.label.skill')
  if (name === 'ReadSkillFile') return translate('agentChat.tool.label.readSkillFile')
  if (name === 'CreateSkill') return translate('agentChat.tool.label.createSkill')
  if (name === 'WebFetch') return translate('agentChat.tool.label.webFetch')
  return name
}

export function summarizeToolArgs(call: AgentMessageToolCall): string {
  if (call.name === 'GenImage') {
    const imageId =
      typeof call.arguments.image_id === 'string' ? call.arguments.image_id : translate('agentChat.tool.args.unnamed')
    const count = typeof call.arguments.n === 'number' ? call.arguments.n : 1
    return translate('agentChat.tool.args.imageCount', { id: imageId, count })
  }
  if (call.name === 'ReadImage') {
    return typeof call.arguments.image_id === 'string'
      ? call.arguments.image_id
      : translate('agentChat.tool.args.image')
  }
  if (call.name === 'Skill' || call.name === 'CreateSkill') {
    return typeof call.arguments.skill === 'string'
      ? call.arguments.skill
      : typeof call.arguments.name === 'string'
        ? call.arguments.name
        : translate('agentChat.tool.args.skill')
  }
  if (call.name === 'ReadSkillFile') {
    const skill =
      typeof call.arguments.skill === 'string' ? call.arguments.skill : translate('agentChat.tool.args.skill')
    const path = typeof call.arguments.path === 'string' ? call.arguments.path : 'file'
    return `${skill} · ${path}`
  }
  if (call.name === 'WebFetch') {
    const url = typeof call.arguments.url === 'string' ? call.arguments.url : ''
    if (!url) return 'URL'
    return url
  }
  return Object.keys(call.arguments).slice(0, 3).join(' · ')
}

function toolResultStatusLabel(status: string): string {
  if (status === 'pending_approval') return translate('agentChat.taskStatus.pendingApproval')
  if (status === 'queued') return translate('agentChat.taskStatus.queued')
  if (status === 'running') return translate('agentChat.taskStatus.running')
  if (status === 'completed') return translate('agentChat.taskStatus.completed')
  if (status === 'failed') return translate('agentChat.taskStatus.failed')
  if (status === 'rejected') return translate('agentChat.taskStatus.rejected')
  if (status === 'canceled') return translate('agentChat.taskStatus.canceled')
  if (status === 'approved') return translate('agentChat.taskStatus.approved')
  if (status === 'done') return translate('agentChat.tool.result.status.done')
  return status
}

export function summarizeToolResult(result: AgentMessageToolResult): string {
  if (result.isError) return result.text || translate('agentChat.tool.result.failed')
  try {
    const parsed = JSON.parse(result.text) as Record<string, unknown>
    if (result.toolName === 'GenImage') {
      const ids = Array.isArray(parsed.reserved_image_ids)
        ? parsed.reserved_image_ids.filter((id): id is string => typeof id === 'string')
        : []
      const status = toolResultStatusLabel(typeof parsed.status === 'string' ? parsed.status : 'done')
      return ids.length > 0 ? `${status} · ${ids.join(', ')}` : status
    }
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    // Plain text tool result.
  }
  return result.text.trim().slice(0, 120) || translate('agentChat.tool.result.completed')
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif|heics|heifs)$/i.test(file.name)
}

export function parseDraggedPlaygroundImage(value: string): PlaygroundImage | PlaygroundImageMeta | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<PlaygroundImage>
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.mimeType !== 'string' || !parsed.source) return null
    if (typeof parsed.timestamp !== 'number') return null
    return parsed as PlaygroundImage | PlaygroundImageMeta
  } catch {
    return null
  }
}
