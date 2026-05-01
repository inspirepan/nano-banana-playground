import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'

import { AgentOptionsMenu } from './AgentOptionsMenu'
import { ComposerActions } from './ComposerActions'
import { ComposerAttachments } from './ComposerAttachments'
import { ComposerError } from './ComposerError'
import { ComposerScrollButton } from './ComposerScrollButton'
import type { AgentChatMenu } from './types'
import { isImageFile } from './utils'
import type { AgentChatAttachment } from '../../agent'
import { AGENT_THINKING_OPTIONS, type AgentModelConfig, type AgentThinkingLevel } from '../../config/agentModels'

const MAX_COMPOSER_HEIGHT = 150

function autoResizeComposer(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 1, MAX_COMPOSER_HEIGHT)}px`
}

type AgentChatComposerProps = {
  error: string | null
  attachmentError: string | null
  draft: string
  attachments: AgentChatAttachment[]
  pendingQuestionCount: number
  renderItemCount: number
  nearBottom: boolean
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  autoApproveImageTasks: boolean
  model: AgentModelConfig
  models: AgentModelConfig[]
  thinkingLevel: AgentThinkingLevel
  canSend: boolean
  showStop: boolean
  isStreaming: boolean
  onDraftChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  onClearAttachmentError: () => void
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onSend: () => void
  onStop: () => void
  scrollToBottom: () => void
}

export function AgentChatComposer({
  error,
  attachmentError,
  draft,
  attachments,
  pendingQuestionCount,
  renderItemCount,
  nearBottom,
  openMenu,
  setOpenMenu,
  autoApproveImageTasks,
  model,
  models,
  thinkingLevel,
  canSend,
  showStop,
  isStreaming,
  onDraftChange,
  onAddAttachments,
  onRemoveAttachment,
  onClearAttachmentError,
  onToggleAutoApproveImageTasks,
  onModelChange,
  onThinkingLevelChange,
  onSend,
  onStop,
  scrollToBottom,
}: AgentChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const effectiveThinkingLevel = model.supportsThinking ? thinkingLevel : 'off'
  const effectiveThinkingLabel =
    AGENT_THINKING_OPTIONS.find((item) => item.value === effectiveThinkingLevel)?.label ?? effectiveThinkingLevel

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeComposer(textareaRef.current)
  }, [draft])

  const addFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(isImageFile)
    if (imageFiles.length > 0) onAddAttachments(imageFiles)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files ?? [])
    event.target.value = ''
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <>
      <ComposerError error={error} attachmentError={attachmentError} onClearAttachmentError={onClearAttachmentError} />

      <div className="relative">
        <ComposerScrollButton
          nearBottom={nearBottom}
          renderItemCount={renderItemCount}
          onScrollToBottom={scrollToBottom}
        />
        <div className="prompt-wrap relative rounded-[12px] bg-(--color-surface) focus-within:shadow-[inset_0_0_0_1px_var(--ring-edge)]">
          <AgentOptionsMenu
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            autoApproveImageTasks={autoApproveImageTasks}
            model={model}
            models={models}
            effectiveThinkingLevel={effectiveThinkingLevel}
            onToggleAutoApproveImageTasks={onToggleAutoApproveImageTasks}
            onModelChange={onModelChange}
            onThinkingLevelChange={onThinkingLevelChange}
          />

          <ComposerAttachments attachments={attachments} onRemoveAttachment={onRemoveAttachment} />

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              onDraftChange(event.target.value)
              autoResizeComposer(event.target)
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              pendingQuestionCount > 0 ? '跳过问卷并发送…' : isStreaming ? '追加消息…' : '给 Agent 发送消息…'
            }
            rows={1}
            className="block max-h-[150px] min-h-[44px] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[16px] leading-[1.55] text-(--color-text) focus:outline-none md:text-base"
          />

          <ComposerActions
            fileInputRef={fileInputRef}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            model={model}
            effectiveThinkingLevel={effectiveThinkingLevel}
            effectiveThinkingLabel={effectiveThinkingLabel}
            pendingQuestionCount={pendingQuestionCount}
            canSend={canSend}
            showStop={showStop}
            isStreaming={isStreaming}
            onFileChange={handleFileChange}
            onSend={onSend}
            onStop={onStop}
          />
        </div>
      </div>
    </>
  )
}
