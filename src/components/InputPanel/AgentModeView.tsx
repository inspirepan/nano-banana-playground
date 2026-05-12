import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import type {
  AgentChatAttachment,
  AgentImageTask,
  AgentPendingQuestion,
  AgentQueuedUserMessage,
  AgentSessionStatusMap,
  AgentSessionSummary,
  AgentSkillSummary,
  AskUserQuestionAnswer,
} from '../../agent'
import type { AgentSessionMessageMetadata } from '../../agent/sessionTypes'
import type { AgentModelConfig, AgentThinkingLevel } from '../../config/agentModels'
import type { Provider } from '../../config/models'
import type { ApiKeyStatus } from '../../hooks/useApiKey'
import type { GenerationJob } from '../../hooks/usePlayground'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../lib/types'
import type { AgentImageTaskFocusHandler } from '../agent-chat/types'
import { AgentChatPanel } from '../AgentChatPanel'

type Props = {
  agentModels: AgentModelConfig[]
  agentModel: AgentModelConfig
  agentThinkingLevel: AgentThinkingLevel
  agentMessages: AgentMessage[]
  agentMessageMetadata: WeakMap<AgentMessage, AgentSessionMessageMetadata>
  agentStreamingMessage: AgentMessage | null
  agentQueuedMessages: AgentQueuedUserMessage[]
  agentIsStreaming: boolean
  agentError: string | null
  agentDraft: string
  agentAttachments: AgentChatAttachment[]
  agentAttachmentError: string | null
  agentSessions: AgentSessionSummary[]
  agentSessionStatuses: AgentSessionStatusMap
  currentAgentSessionId: string | null
  agentSessionsLoading: boolean
  autoApproveAgentImageTasks: boolean
  agentImageTasks: AgentImageTask[]
  agentPendingQuestions: AgentPendingQuestion[]
  agentSkills: AgentSkillSummary[]
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  keyStatuses: Record<Provider, ApiKeyStatus>
  onOpenApiKeys: () => void
  onAgentDraftChange: (v: string) => void
  onAddAgentAttachments: (files: File[]) => void
  onAddAgentImageAttachment: (image: PlaygroundImage | PlaygroundImageMeta) => void
  onRemoveAgentAttachment: (id: string) => void
  onClearAgentAttachmentError: () => void
  onCreateAgentSession: () => void
  onSwitchAgentSession: (sessionId: string) => void
  onDeleteAgentSession: (sessionId: string) => void
  onToggleAutoApproveAgentImageTasks: (value: boolean) => void
  onApproveAgentImageTask: (taskId: string) => void
  onCancelAgentImageTask: (taskId: string) => void
  onSubmitAgentQuestionAnswers: (toolCallId: string, answers: AskUserQuestionAnswer[]) => void
  onCancelAgentQuestion: (toolCallId: string) => void
  onFocusAgentImageTask?: AgentImageTaskFocusHandler
  onAgentModelChange: (id: string) => void
  onAgentThinkingLevelChange: (level: AgentThinkingLevel) => void
  onSendAgentMessage: () => boolean
  onStopAgentMessage: () => void
  onUpdateQueuedAgentMessage: (id: string, draft: string) => void
}

export function AgentModeView({
  agentModels,
  agentModel,
  agentThinkingLevel,
  agentMessages,
  agentMessageMetadata,
  agentStreamingMessage,
  agentQueuedMessages,
  agentIsStreaming,
  agentError,
  agentDraft,
  agentAttachments,
  agentAttachmentError,
  agentSessions,
  agentSessionStatuses,
  currentAgentSessionId,
  agentSessionsLoading,
  autoApproveAgentImageTasks,
  agentImageTasks,
  agentPendingQuestions,
  agentSkills,
  history,
  generationJobs,
  keyStatuses,
  onOpenApiKeys,
  onAgentDraftChange,
  onAddAgentAttachments,
  onAddAgentImageAttachment,
  onRemoveAgentAttachment,
  onClearAgentAttachmentError,
  onCreateAgentSession,
  onSwitchAgentSession,
  onDeleteAgentSession,
  onToggleAutoApproveAgentImageTasks,
  onApproveAgentImageTask,
  onCancelAgentImageTask,
  onSubmitAgentQuestionAnswers,
  onCancelAgentQuestion,
  onFocusAgentImageTask,
  onAgentModelChange,
  onAgentThinkingLevelChange,
  onSendAgentMessage,
  onStopAgentMessage,
  onUpdateQueuedAgentMessage,
}: Props) {
  return (
    <AgentChatPanel
      messages={agentMessages}
      messageMetadata={agentMessageMetadata}
      streamingMessage={agentStreamingMessage}
      queuedMessages={agentQueuedMessages}
      isStreaming={agentIsStreaming}
      error={agentError}
      draft={agentDraft}
      attachments={agentAttachments}
      attachmentError={agentAttachmentError}
      sessions={agentSessions}
      sessionStatuses={agentSessionStatuses}
      currentSessionId={currentAgentSessionId}
      sessionsLoading={agentSessionsLoading}
      autoApproveImageTasks={autoApproveAgentImageTasks}
      imageTasks={agentImageTasks}
      pendingQuestions={agentPendingQuestions}
      skills={agentSkills}
      history={history}
      generationJobs={generationJobs}
      model={agentModel}
      models={agentModels}
      thinkingLevel={agentThinkingLevel}
      keyStatuses={keyStatuses}
      onOpenApiKeys={onOpenApiKeys}
      onDraftChange={onAgentDraftChange}
      onAddAttachments={onAddAgentAttachments}
      onAddImageAttachment={onAddAgentImageAttachment}
      onRemoveAttachment={onRemoveAgentAttachment}
      onClearAttachmentError={onClearAgentAttachmentError}
      onNewSession={onCreateAgentSession}
      onSwitchSession={onSwitchAgentSession}
      onDeleteSession={onDeleteAgentSession}
      onToggleAutoApproveImageTasks={onToggleAutoApproveAgentImageTasks}
      onApproveImageTask={onApproveAgentImageTask}
      onCancelImageTask={onCancelAgentImageTask}
      onSubmitQuestionAnswers={onSubmitAgentQuestionAnswers}
      onCancelQuestion={onCancelAgentQuestion}
      onFocusImageTask={onFocusAgentImageTask}
      onModelChange={onAgentModelChange}
      onThinkingLevelChange={onAgentThinkingLevelChange}
      onSend={onSendAgentMessage}
      onStop={onStopAgentMessage}
      onUpdateQueuedMessage={onUpdateQueuedAgentMessage}
    />
  )
}
