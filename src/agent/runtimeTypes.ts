import { Agent, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import type { AgentChatAttachment } from './agentChat'
import type { AgentImageRegistryEntry, AgentImageTask, AgentTurnCallbackState } from './imageTasks'
import type { AgentCompactionState, AgentSessionMessageMetadata, AgentSessionStatus } from './sessionTypes'
import type { AgentToolResult, AskUserQuestionItem } from './tools'
import type { AgentThinkingLevel, AgentThinkingRequestConfig } from '../config/agentModels'

export const AGENT_MAX_ATTACHMENTS = 8

export const AGENT_TASK_PROTOCOL_MESSAGES = {
  autoStarted: 'The task has been submitted and automatically started generation.',
  failedToStart: 'The task was submitted but could not start generation.',
  waitingDependencies: 'The task has been submitted and will start automatically after its reference images are ready.',
  pending: 'The task has been submitted and is waiting for user approval.',
  pendingWithReserved: (ids: string[]) =>
    `The task has been submitted and is waiting for user approval. image_id has been reserved as ${ids.join(', ')}.`,
} as const

export type ProviderCredentials = { apiKey: string; baseUrl: string }

export type AgentPendingQuestion = {
  toolCallId: string
  agentTurnId: string
  questions: AskUserQuestionItem[]
  createdAt: number
}

export type AgentQuestionResolver = {
  resolve: (result: AgentToolResult) => void
  reject: (reason: unknown) => void
  questions: AskUserQuestionItem[]
}

export type AgentQueuedUserMessage = {
  id: string
  message: AgentMessage
  draft: string
  attachments: AgentChatAttachment[]
  agentTurnId: string
  stackId: string
  stackTitle: string
}

export type AgentSessionRuntime = {
  sessionId: string
  persisted: boolean
  agent: Agent
  ready: boolean
  modelId: string
  thinkingLevel: AgentThinkingLevel
  transportThinkingConfigRef: { current: AgentThinkingRequestConfig }
  autoApproveImageTasks: boolean
  messages: AgentMessage[]
  streamingMessage: AgentMessage | null
  queuedUserMessages: AgentQueuedUserMessage[]
  isStreaming: boolean
  error: string | null
  draft: string
  attachments: AgentChatAttachment[]
  attachmentError: string | null
  imageTasks: AgentImageTask[]
  imageRegistry: Map<string, AgentImageRegistryEntry>
  turnCallbacks: Map<string, AgentTurnCallbackState>
  currentAgentTurnId: string | null
  currentAgentTurnStackId: string | null
  currentAgentTurnStackTitle: string | null
  leafEntryId: string | null
  pendingQuestions: AgentPendingQuestion[]
  questionResolvers: Map<string, AgentQuestionResolver>
  persistQueue: Promise<void>
  sidecarPersistQueue: Promise<void>
  sidecarDebounce: number
  promptPreparing: boolean
  messageEntryIds: WeakMap<AgentMessage, string>
  messageMetadata: WeakMap<AgentMessage, AgentSessionMessageMetadata>
  activeResponseMetadata: AgentSessionMessageMetadata | undefined
  queuedResponseMetadata: AgentSessionMessageMetadata[]
  lastCompaction: AgentCompactionState | undefined
  isCompacting: boolean
  compactionAbort: AbortController | null
  // Most recent LLM-generated session title for this runtime; passed as the
  // previousTitle hint so the next refresh refines instead of replacing.
  lastSessionTitle: string | null
}

export function getAgentSessionStatus(runtime: AgentSessionRuntime): AgentSessionStatus | null {
  if (runtime.pendingQuestions.length > 0) return 'waiting_for_question'
  if (runtime.isStreaming) return 'running'
  return runtime.imageTasks.some(
    (task) => task.status === 'waiting_dependencies' || task.status === 'queued' || task.status === 'running',
  )
    ? 'generating_images'
    : null
}
