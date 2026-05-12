import { Agent, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import { agentMessageRole } from './agentChat'
import type { AgentImageTask, AgentImageTaskStatus } from './imageTasks'
import type { AgentSessionRuntime } from './runtimeTypes'
import type { AgentSessionMessageMetadata } from './sessionTypes'
import type { AgentToolResult } from './tools'
import { resolveAgentModelConfig } from '../config/agentModels'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import { translate } from '../i18n'

export function agentMessageMetadataForModel(modelId: string): AgentSessionMessageMetadata {
  const config = resolveAgentModelConfig(modelId)
  return { modelId: config.id, modelTitle: config.label }
}

function agentStateValue(agent: Agent, key: 'streamingMessage' | 'streamMessage' | 'errorMessage' | 'error'): unknown {
  return (agent.state as unknown as Record<string, unknown>)[key]
}

export function getAgentStreamingMessage(agent: Agent): AgentMessage | null {
  const value = agentStateValue(agent, 'streamingMessage') ?? agentStateValue(agent, 'streamMessage')
  return value && typeof value === 'object' ? (value as AgentMessage) : null
}

export function getAgentError(agent: Agent): string | null {
  const value = agentStateValue(agent, 'errorMessage') ?? agentStateValue(agent, 'error')
  return typeof value === 'string' ? value : null
}

export function agentTaskStatusFromGenerationJob(job: GenerationJob): AgentImageTaskStatus {
  if (job.status === 'completed') return 'completed'
  if (job.status === 'canceled') return 'canceled'
  if (job.status === 'failed' || job.status === 'partial_failed') return 'failed'
  if (job.slots.some((slot) => slot.status === 'running' || slot.status === 'retrying')) return 'running'
  return 'queued'
}

export function errorFromGenerationJob(job: GenerationJob): string | undefined {
  return job.slots.find((slot) => slot.error)?.error
}

function noteForAgentTaskStatus(status: AgentImageTask['status']): string | undefined {
  switch (status) {
    case 'rejected':
      return 'The human user manually clicked the Reject button in the approval UI to decline this image task before any generation began. This is purely a user decision — there was NO content policy violation, NO safety filter, and NO system-side rejection. Do not apologize for safety reasons or assume the prompt was problematic. Ask the user what they want to change (subject, style, parameters, etc.) before proposing another task.'
    case 'canceled':
      return 'The image generation was interrupted or canceled before all requested images were produced. This does NOT necessarily mean the human user clicked Cancel. If an error line is present, use it as the reason. Do not ask why the user canceled unless the error explicitly says it was a manual cancellation.'
    case 'failed':
      return 'The image generation failed due to a technical or service-side error (network, model API, etc.). The error message is included above. This is not a user rejection.'
    default:
      return undefined
  }
}

export function buildAgentTaskCallbackText(tasks: AgentImageTask[]): string {
  const lines = ['<system>']
  for (const task of tasks) {
    lines.push(`tool GenImage call ${task.toolCallId} has been finished.`)
    lines.push(`status: ${task.status}`)
    lines.push(`requested_image_id: ${task.request.requestedImageId}`)
    lines.push(`reserved_image_ids: ${task.request.reservedImageIds.join(', ')}`)
    lines.push(`image_ids: ${task.resultImageIds.join(', ')}`)
    if (task.error) lines.push(`error: ${task.error}`)
    const note = noteForAgentTaskStatus(task.status)
    if (note) lines.push(`note: ${note}`)
    lines.push('')
  }
  if (lines[lines.length - 1] === '') lines.pop()
  lines.push('</system>')
  return lines.join('\n')
}

export function toolTextResult(text: string, details: unknown): AgentToolResult {
  return { content: [{ type: 'text', text }], details }
}

export function activateAgentResponseMetadata(
  runtime: AgentSessionRuntime,
  modelId = runtime.modelId,
): AgentSessionMessageMetadata {
  const metadata = agentMessageMetadataForModel(modelId)
  runtime.activeResponseMetadata = metadata
  return metadata
}

export function queueAgentResponseMetadata(runtime: AgentSessionRuntime, modelId = runtime.modelId): void {
  runtime.queuedResponseMetadata.push(agentMessageMetadataForModel(modelId))
}

export function metadataForAgentMessage(
  runtime: AgentSessionRuntime,
  message: AgentMessage,
): AgentSessionMessageMetadata | undefined {
  if (agentMessageRole(message) !== 'assistant') return undefined
  const existing = runtime.messageMetadata.get(message)
  if (existing) return existing
  const metadata = runtime.activeResponseMetadata ?? agentMessageMetadataForModel(runtime.modelId)
  runtime.messageMetadata.set(message, metadata)
  return metadata
}

export function findDanglingToolCallIds(messages: AgentMessage[]): Set<string> {
  const fulfilled = new Set<string>()
  const all = new Set<string>()
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) continue
    const record = message as unknown as Record<string, unknown>
    if (record.role === 'assistant' && Array.isArray(record.content)) {
      for (const part of record.content) {
        if (typeof part !== 'object' || part === null) continue
        const partRecord = part as Record<string, unknown>
        if (partRecord.type === 'toolCall' && typeof partRecord.id === 'string') all.add(partRecord.id)
      }
    }
    if (record.role === 'toolResult' && typeof record.toolCallId === 'string') fulfilled.add(record.toolCallId)
  }
  for (const id of fulfilled) all.delete(id)
  return all
}

export function buildAbandonedToolResult(toolCallId: string, toolName: string): AgentMessage {
  return {
    role: 'toolResult',
    toolCallId,
    toolName,
    content: [
      {
        type: 'text',
        text: '<system>The user navigated away or refreshed before answering. Re-ask if still needed.</system>',
      },
    ],
    isError: false,
    timestamp: Date.now(),
  } as unknown as AgentMessage
}

export function injectAbandonedToolResults(messages: AgentMessage[], skipIds?: Set<string>): AgentMessage[] {
  const dangling = findDanglingToolCallIds(messages)
  if (skipIds) for (const id of skipIds) dangling.delete(id)
  if (dangling.size === 0) return messages

  const result: AgentMessage[] = []
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    result.push(message)
    if (typeof message !== 'object' || message === null) continue
    const record = message as unknown as Record<string, unknown>
    if (record.role !== 'assistant' || !Array.isArray(record.content)) continue
    for (const part of record.content) {
      if (typeof part !== 'object' || part === null) continue
      const partRecord = part as Record<string, unknown>
      if (partRecord.type !== 'toolCall') continue
      const id = typeof partRecord.id === 'string' ? partRecord.id : null
      const name = typeof partRecord.name === 'string' ? partRecord.name : null
      if (!id || !name || !dangling.has(id)) continue
      result.push(buildAbandonedToolResult(id, name))
    }
  }
  return result
}

export function restoreAgentImageTasks(tasks: AgentImageTask[]): AgentImageTask[] {
  return tasks.map((task) => {
    if (
      task.status !== 'approved' &&
      task.status !== 'waiting_dependencies' &&
      task.status !== 'queued' &&
      task.status !== 'running'
    )
      return task
    return {
      ...task,
      status: 'failed',
      error: task.error ?? translate('configLib.agent.taskInterrupted'),
    }
  })
}
