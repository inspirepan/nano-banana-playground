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
  if (status === 'pending_approval') return '待审批'
  if (status === 'queued') return '排队中'
  if (status === 'running') return '生成中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'rejected') return '已取消'
  if (status === 'canceled') return '已取消'
  return '已通过'
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
  if (name === 'GenImage') return '创建生图任务'
  if (name === 'ReadImage') return '读取图片'
  if (name === 'AskUserQuestion') return '提问用户'
  return name
}

export function summarizeToolArgs(call: AgentMessageToolCall): string {
  if (call.name === 'GenImage') {
    const imageId = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : '未命名'
    const count = typeof call.arguments.n === 'number' ? call.arguments.n : 1
    return `${imageId} · ${count} 张`
  }
  if (call.name === 'ReadImage') {
    return typeof call.arguments.image_id === 'string' ? call.arguments.image_id : '图片'
  }
  return Object.keys(call.arguments).slice(0, 3).join(' · ')
}

export function summarizeToolResult(result: AgentMessageToolResult): string {
  if (result.isError) return result.text || '工具调用失败'
  try {
    const parsed = JSON.parse(result.text) as Record<string, unknown>
    if (result.toolName === 'GenImage') {
      const ids = Array.isArray(parsed.reserved_image_ids)
        ? parsed.reserved_image_ids.filter((id): id is string => typeof id === 'string')
        : []
      const status = typeof parsed.status === 'string' ? parsed.status : 'done'
      return ids.length > 0 ? `${status} · ${ids.join(', ')}` : status
    }
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    // Plain text tool result.
  }
  return result.text.trim().slice(0, 120) || '工具调用完成'
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
