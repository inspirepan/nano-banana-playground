import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useLayoutEffect, useRef } from 'react'

import type {
  AgentChatAttachment,
  AgentImageTask,
  AgentPendingQuestion,
  AgentQueuedUserMessage,
  AgentSessionStatusMap,
  AgentSessionSummary,
  AgentSkillSummary,
  AskUserQuestionAnswer,
} from '../agent'
import { AgentModeView } from './InputPanel/AgentModeView'
import { GenerateModeView } from './InputPanel/GenerateModeView'
import { InputPanelHeader } from './InputPanel/InputPanelHeader'
import { autoResizeTextarea } from './InputPanel/textarea'
import { usePanelDropAndPaste } from './InputPanel/usePanelDropAndPaste'
import { usePromptHistory } from './InputPanel/usePromptHistory'
import type { AgentSessionMessageMetadata } from '../agent/sessionTypes'
import type { AgentModelConfig, AgentThinkingLevel } from '../config/agentModels'
import { type ModelConfig, type Provider } from '../config/models'
import { useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import type { GenerationJob, InputMode } from '../hooks/usePlayground'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

type Props = {
  inputMode: InputMode
  model: ModelConfig
  resolution: string
  aspectRatio: string
  batchCount: number
  options: Record<string, unknown>
  prompt: string
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
  referenceImages: PlaygroundImage[]
  referenceImageError: string | null
  apiKey: string
  apiKeyStatus?: ApiKeyStatus
  keyStatuses: Record<Provider, ApiKeyStatus>
  showHeader?: boolean
  showInputModeSwitcher?: boolean
  showAgentSessionSidebar?: boolean
  onOpenApiKeys: () => void
  onInputModeChange: (mode: InputMode) => void
  onSwitchModel: (id: string) => void
  onResolutionChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
  onPromptChange: (v: string) => void
  onAgentModelChange: (id: string) => void
  onAgentThinkingLevelChange: (level: AgentThinkingLevel) => void
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
  onFocusAgentImageTask?: (task: AgentImageTask) => void
  onSendAgentMessage: () => boolean
  onStopAgentMessage: () => void
  onBatchCountChange: (v: number) => void
  onOptionChange: (id: string, value: unknown) => void
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
  onRemoveReferenceImage: (id: string) => void
  onClearAllReferences: () => void
  onClearReferenceImageError: () => void
  onGenerate: () => void
}

export function InputPanel({
  inputMode,
  model,
  resolution,
  aspectRatio,
  batchCount,
  options,
  prompt,
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
  referenceImages,
  referenceImageError,
  apiKey,
  keyStatuses,
  showHeader = true,
  showInputModeSwitcher = true,
  showAgentSessionSidebar = false,
  onOpenApiKeys,
  onInputModeChange,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
  onPromptChange,
  onAgentModelChange,
  onAgentThinkingLevelChange,
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
  onSendAgentMessage,
  onStopAgentMessage,
  onBatchCountChange,
  onOptionChange,
  onAddReferenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onClearAllReferences,
  onClearReferenceImageError,
  onGenerate,
}: Props) {
  const hasPrompt = prompt.trim() !== ''
  const canGenerate = apiKey.trim() !== '' && hasPrompt

  // Textarea ref lives here so the layout effect can keep its current timing.
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { canUndo, canRedo, pushHistory, handleHistoryUndo, handleHistoryRedo } = usePromptHistory({
    prompt,
    onPromptChange,
  })

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeTextarea(textareaRef.current)
  }, [prompt])

  // Cmd+Enter shortcut
  useWindowEvent(
    'keydown',
    (e) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault()
        if (inputMode === 'generate' && canGenerate) onGenerate()
      }
    },
    undefined,
    true,
  )

  // Drag-and-drop + paste plumbing for the generate panel.
  const { dragOver, panelDragHandlers, handlePanelPaste } = usePanelDropAndPaste({
    onAddReferenceImages,
    onAddReferenceImage,
  })

  const useWideAgentSidebar = inputMode === 'agent' && showAgentSessionSidebar

  return (
    <div
      ref={panelRef}
      onDragEnter={inputMode === 'generate' ? panelDragHandlers.onDragEnter : undefined}
      onDragLeave={inputMode === 'generate' ? panelDragHandlers.onDragLeave : undefined}
      onDragOver={inputMode === 'generate' ? panelDragHandlers.onDragOver : undefined}
      onDrop={inputMode === 'generate' ? panelDragHandlers.onDrop : undefined}
      onPaste={inputMode === 'generate' ? handlePanelPaste : undefined}
      className={
        inputMode === 'agent'
          ? useWideAgentSidebar
            ? 'relative flex h-full flex-col p-0 transition-[padding] duration-[220ms] ease-[cubic-bezier(0.22,0.8,0.4,1)] motion-reduce:transition-none'
            : 'relative flex h-full flex-col py-[18px] transition-[padding] duration-[220ms] ease-[cubic-bezier(0.22,0.8,0.4,1)] motion-reduce:transition-none'
          : 'relative px-[18px] py-[18px] pb-[120px]'
      }
    >
      {showHeader && !useWideAgentSidebar && (
        <InputPanelHeader
          inputMode={inputMode}
          showInputModeSwitcher={showInputModeSwitcher}
          onInputModeChange={onInputModeChange}
          onOpenApiKeys={onOpenApiKeys}
        />
      )}

      {inputMode === 'agent' ? (
        <AgentModeView
          agentModels={agentModels}
          agentModel={agentModel}
          agentThinkingLevel={agentThinkingLevel}
          agentMessages={agentMessages}
          agentMessageMetadata={agentMessageMetadata}
          agentStreamingMessage={agentStreamingMessage}
          agentQueuedMessages={agentQueuedMessages}
          agentIsStreaming={agentIsStreaming}
          agentError={agentError}
          agentDraft={agentDraft}
          agentAttachments={agentAttachments}
          agentAttachmentError={agentAttachmentError}
          agentSessions={agentSessions}
          agentSessionStatuses={agentSessionStatuses}
          currentAgentSessionId={currentAgentSessionId}
          agentSessionsLoading={agentSessionsLoading}
          autoApproveAgentImageTasks={autoApproveAgentImageTasks}
          agentImageTasks={agentImageTasks}
          agentPendingQuestions={agentPendingQuestions}
          agentSkills={agentSkills}
          history={history}
          generationJobs={generationJobs}
          keyStatuses={keyStatuses}
          showSessionSidebar={useWideAgentSidebar}
          onOpenApiKeys={onOpenApiKeys}
          onAgentDraftChange={onAgentDraftChange}
          onAddAgentAttachments={onAddAgentAttachments}
          onAddAgentImageAttachment={onAddAgentImageAttachment}
          onRemoveAgentAttachment={onRemoveAgentAttachment}
          onClearAgentAttachmentError={onClearAgentAttachmentError}
          onCreateAgentSession={onCreateAgentSession}
          onSwitchAgentSession={onSwitchAgentSession}
          onDeleteAgentSession={onDeleteAgentSession}
          onInputModeChange={onInputModeChange}
          onToggleAutoApproveAgentImageTasks={onToggleAutoApproveAgentImageTasks}
          onApproveAgentImageTask={onApproveAgentImageTask}
          onCancelAgentImageTask={onCancelAgentImageTask}
          onSubmitAgentQuestionAnswers={onSubmitAgentQuestionAnswers}
          onCancelAgentQuestion={onCancelAgentQuestion}
          onFocusAgentImageTask={onFocusAgentImageTask}
          onAgentModelChange={onAgentModelChange}
          onAgentThinkingLevelChange={onAgentThinkingLevelChange}
          onSendAgentMessage={onSendAgentMessage}
          onStopAgentMessage={onStopAgentMessage}
        />
      ) : (
        <GenerateModeView
          model={model}
          resolution={resolution}
          aspectRatio={aspectRatio}
          batchCount={batchCount}
          options={options}
          prompt={prompt}
          referenceImages={referenceImages}
          referenceImageError={referenceImageError}
          apiKey={apiKey}
          keyStatuses={keyStatuses}
          dragOver={dragOver}
          textareaRef={textareaRef}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenApiKeys={onOpenApiKeys}
          onSwitchModel={onSwitchModel}
          onResolutionChange={onResolutionChange}
          onAspectRatioChange={onAspectRatioChange}
          onPromptChange={onPromptChange}
          onBatchCountChange={onBatchCountChange}
          onOptionChange={onOptionChange}
          onAddReferenceImages={onAddReferenceImages}
          onRemoveReferenceImage={onRemoveReferenceImage}
          onClearAllReferences={onClearAllReferences}
          onClearReferenceImageError={onClearReferenceImageError}
          onGenerate={onGenerate}
          pushHistory={pushHistory}
          handleHistoryUndo={handleHistoryUndo}
          handleHistoryRedo={handleHistoryRedo}
        />
      )}

      {dragOver && (
        <div
          className="absolute inset-0 z-40 rounded-[var(--radius-md)] pointer-events-none"
          style={{ background: 'var(--color-accent-wash)', boxShadow: 'inset 0 0 0 2px var(--color-accent)' }}
        />
      )}
    </div>
  )
}
