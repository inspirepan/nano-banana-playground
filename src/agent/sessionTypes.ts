import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import type { AgentChatAttachment } from './agentChat'
import type { AgentImageRegistryEntry, AgentImageTask, AgentTurnCallbackState } from './imageTasks'
import type { AskUserQuestionItem } from './tools'
import type { AgentThinkingLevel } from '../config/agentModels'

export type PersistedAgentPendingQuestion = {
  toolCallId: string
  agentTurnId: string
  questions: AskUserQuestionItem[]
  createdAt: number
}

export type AgentSessionRecord = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  modelId: string
  thinkingLevel: AgentThinkingLevel
  autoApproveImageTasks: boolean
  leafEntryId: string | null
  messageCount: number
  imageCount: number
  firstUserText: string
  previewText: string
}

export type AgentSessionSummary = AgentSessionRecord

export type PersistedAgentMessage = Record<string, unknown>

export type AgentSessionMessageMetadata = {
  modelId?: string
  modelTitle?: string
}

export type AgentSessionMessageEntry = {
  type: 'message'
  id: string
  sessionId: string
  parentId: string | null
  timestamp: number
  message: PersistedAgentMessage
  metadata?: AgentSessionMessageMetadata
}

export type PersistedAgentChatAttachment = Omit<AgentChatAttachment, 'data'> & {
  dataRef: string
}

export type PersistedAgentImageRegistryEntry = Omit<AgentImageRegistryEntry, 'image'> & {
  attachment?: PersistedAgentChatAttachment
}

export type AgentCompactionState = {
  summary: string
  firstKeptEntryId: string
  tokensBefore: number
  createdAt: number
}

export type AgentSessionSidecarRecord = {
  sessionId: string
  updatedAt: number
  draft: string
  attachments: PersistedAgentChatAttachment[]
  imageTasks: AgentImageTask[]
  imageRegistry: PersistedAgentImageRegistryEntry[]
  turnCallbacks: AgentTurnCallbackState[]
  currentAgentTurnId: string | null
  pendingQuestions?: PersistedAgentPendingQuestion[]
  lastCompaction?: AgentCompactionState
}

export type HydratedAgentSessionSidecar = {
  draft: string
  attachments: AgentChatAttachment[]
  imageTasks: AgentImageTask[]
  imageRegistry: AgentImageRegistryEntry[]
  turnCallbacks: AgentTurnCallbackState[]
  currentAgentTurnId: string | null
  pendingQuestions: PersistedAgentPendingQuestion[]
  lastCompaction?: AgentCompactionState
}

export type HydratedAgentSession = {
  record: AgentSessionRecord
  messages: AgentMessage[]
  messageEntryIds: string[]
  messageMetadata: AgentSessionMessageMetadata[]
  sidecar: HydratedAgentSessionSidecar
}

export type CreateAgentSessionParams = {
  id?: string
  modelId: string
  thinkingLevel: AgentThinkingLevel
  autoApproveImageTasks: boolean
}

export type SaveAgentSessionSidecarParams = {
  sessionId: string
  draft: string
  attachments: AgentChatAttachment[]
  imageTasks: AgentImageTask[]
  imageRegistry: AgentImageRegistryEntry[]
  turnCallbacks: AgentTurnCallbackState[]
  currentAgentTurnId: string | null
  pendingQuestions: PersistedAgentPendingQuestion[]
  lastCompaction?: AgentCompactionState
}
