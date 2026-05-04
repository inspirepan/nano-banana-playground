import type { ComponentProps } from 'react'

import type { AgentImageTask } from '../agent'
import type { InputPanel } from '../components/InputPanel'
import type { InputMode, usePlayground } from '../hooks/usePlayground'

type InputPanelProps = ComponentProps<typeof InputPanel>

// Subset of InputPanel props that mobile + desktop share. Both layouts spread
// this and only override inputMode.
export type SharedInputPanelProps = Omit<InputPanelProps, 'inputMode'>

type Pg = ReturnType<typeof usePlayground>

type Params = {
  pg: Pg
  onOpenApiKeys: () => void
  onInputModeChange: (mode: InputMode) => void
  onFocusAgentImageTask: (task: AgentImageTask) => void
  onGenerate: () => void
}

export function buildSharedInputPanelProps({
  pg,
  onOpenApiKeys,
  onInputModeChange,
  onFocusAgentImageTask,
  onGenerate,
}: Params): SharedInputPanelProps {
  return {
    model: pg.model,
    resolution: pg.resolution,
    aspectRatio: pg.aspectRatio,
    batchCount: pg.batchCount,
    options: pg.options,
    prompt: pg.prompt,
    agentModels: pg.agentModels,
    agentModel: pg.agentModel,
    agentThinkingLevel: pg.agentThinkingLevel,
    agentMessages: pg.agentMessages,
    agentMessageMetadata: pg.agentMessageMetadata,
    agentStreamingMessage: pg.agentStreamingMessage,
    agentQueuedMessages: pg.agentQueuedMessages,
    agentIsStreaming: pg.agentIsStreaming,
    agentError: pg.agentError,
    agentDraft: pg.agentDraft,
    agentAttachments: pg.agentAttachments,
    agentAttachmentError: pg.agentAttachmentError,
    agentSessions: pg.agentSessions,
    agentSessionStatuses: pg.agentSessionStatuses,
    currentAgentSessionId: pg.currentAgentSessionId,
    agentSessionsLoading: pg.agentSessionsLoading,
    autoApproveAgentImageTasks: pg.autoApproveAgentImageTasks,
    agentImageTasks: pg.agentImageTasks,
    agentPendingQuestions: pg.agentPendingQuestions,
    agentSkills: pg.agentSkills,
    history: pg.history,
    generationJobs: pg.generationJobs,
    referenceImages: pg.referenceImages,
    referenceImageError: pg.referenceImageError,
    apiKey: pg.apiKey,
    apiKeyStatus: pg.apiKeyStatus,
    keyStatuses: pg.keyStatuses,
    onOpenApiKeys,
    onInputModeChange,
    onSwitchModel: pg.switchModel,
    onResolutionChange: pg.setResolution,
    onAspectRatioChange: pg.setAspectRatio,
    onPromptChange: pg.setPrompt,
    onAgentModelChange: pg.setAgentModelId,
    onAgentThinkingLevelChange: pg.setAgentThinkingLevel,
    onAgentDraftChange: pg.setAgentDraft,
    onAddAgentAttachments: pg.addAgentAttachments,
    onAddAgentImageAttachment: pg.addAgentImageAttachment,
    onRemoveAgentAttachment: pg.removeAgentAttachment,
    onClearAgentAttachmentError: pg.clearAgentAttachmentError,
    onCreateAgentSession: pg.createAgentSession,
    onSwitchAgentSession: pg.switchAgentSession,
    onDeleteAgentSession: pg.deleteAgentSession,
    onToggleAutoApproveAgentImageTasks: pg.setAutoApproveAgentImageTasks,
    onApproveAgentImageTask: pg.approveAgentImageTask,
    onCancelAgentImageTask: pg.cancelAgentImageTask,
    onSubmitAgentQuestionAnswers: pg.submitAgentQuestionAnswers,
    onCancelAgentQuestion: pg.cancelAgentQuestion,
    onFocusAgentImageTask,
    onSendAgentMessage: pg.sendAgentMessage,
    onStopAgentMessage: pg.stopAgentMessage,
    onBatchCountChange: pg.setBatchCount,
    onOptionChange: pg.setOption,
    onAddReferenceImages: pg.addReferenceImages,
    onAddReferenceImage: pg.addToReferences,
    onRemoveReferenceImage: pg.removeReferenceImage,
    onClearAllReferences: pg.clearAllReferences,
    onClearReferenceImageError: pg.clearReferenceImageError,
    onGenerate,
  }
}
