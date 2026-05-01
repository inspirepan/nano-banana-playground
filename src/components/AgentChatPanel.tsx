import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'

import {
  agentMessageToolCalls,
  type AgentChatAttachment,
  type AgentImageTask,
  type AgentPendingQuestion,
  type AgentSessionSummary,
  type AskUserQuestionAnswer,
} from '../agent'
import type { AgentModelConfig, AgentThinkingLevel } from '../config/agentModels'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { AgentChatComposer } from './agent-chat/AgentChatComposer'
import { AgentChatHeader } from './agent-chat/AgentChatHeader'
import { MessageBubble } from './agent-chat/MessageBubble'
import { ToolActivityCard } from './agent-chat/ToolActivityCard'
import type { AgentChatMenu } from './agent-chat/types'
import {
  buildChatRenderItems,
  hasRenderableMessageContent,
  isImageFile,
  parseDraggedPlaygroundImage,
} from './agent-chat/utils'
import { Icon } from './Icon'

type Props = {
  messages: AgentMessage[]
  streamingMessage: AgentMessage | null
  isStreaming: boolean
  error: string | null
  draft: string
  attachments: AgentChatAttachment[]
  attachmentError: string | null
  sessions: AgentSessionSummary[]
  currentSessionId: string | null
  sessionsLoading: boolean
  autoApproveImageTasks: boolean
  imageTasks: AgentImageTask[]
  pendingQuestions: AgentPendingQuestion[]
  model: AgentModelConfig
  models: AgentModelConfig[]
  thinkingLevel: AgentThinkingLevel
  googleKeyStatus: ApiKeyStatus
  openaiKeyStatus: ApiKeyStatus
  onOpenApiKeys: () => void
  onDraftChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onAddImageAttachment: (image: PlaygroundImage | PlaygroundImageMeta) => void
  onRemoveAttachment: (id: string) => void
  onClearAttachmentError: () => void
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onApproveImageTask: (taskId: string) => void
  onCancelImageTask: (taskId: string) => void
  onSubmitQuestionAnswers: (toolCallId: string, answers: AskUserQuestionAnswer[]) => void
  onCancelQuestion: (toolCallId: string) => void
  onFocusImageTask?: (task: AgentImageTask) => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onSend: () => void
  onStop: () => void
}

export function AgentChatPanel({
  messages,
  streamingMessage,
  isStreaming,
  error,
  draft,
  attachments,
  attachmentError,
  sessions,
  currentSessionId,
  sessionsLoading,
  autoApproveImageTasks,
  imageTasks,
  pendingQuestions,
  model,
  models,
  thinkingLevel,
  googleKeyStatus,
  openaiKeyStatus,
  onOpenApiKeys,
  onDraftChange,
  onAddAttachments,
  onAddImageAttachment,
  onRemoveAttachment,
  onClearAttachmentError,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onToggleAutoApproveImageTasks,
  onApproveImageTask,
  onCancelImageTask,
  onSubmitQuestionAnswers,
  onCancelQuestion,
  onFocusImageTask,
  onModelChange,
  onThinkingLevelChange,
  onSend,
  onStop,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<AgentChatMenu>(null)
  const [nearBottom, setNearBottom] = useState(true)
  const currentKeyStatus = model.provider === 'google' ? googleKeyStatus : openaiKeyStatus
  const keyMissing = currentKeyStatus === 'empty'
  const hasComposerContent = draft.trim() !== '' || attachments.length > 0
  const canSend = !keyMissing && hasComposerContent
  const showStop = isStreaming && !hasComposerContent
  const visibleMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage],
  )
  const renderItems = useMemo(
    () => buildChatRenderItems(visibleMessages, streamingMessage),
    [visibleMessages, streamingMessage],
  )
  const showThinkingPlaceholder =
    isStreaming &&
    pendingQuestions.length === 0 &&
    (!streamingMessage ||
      (!hasRenderableMessageContent(streamingMessage) && agentMessageToolCalls(streamingMessage).length === 0))
  const imageTaskByToolCallId = useMemo(() => {
    const map = new Map<string, AgentImageTask>()
    for (const task of imageTasks) map.set(task.toolCallId, task)
    return map
  }, [imageTasks])
  const pendingQuestionByToolCallId = useMemo(() => {
    const map = new Map<string, AgentPendingQuestion>()
    for (const question of pendingQuestions) map.set(question.toolCallId, question)
    return map
  }, [pendingQuestions])

  useExternalSync(() => {
    const el = scrollRef.current
    if (!el) return
    const handle = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setNearBottom(dist <= 120)
    }
    handle()
    el.addEventListener('scroll', handle, { passive: true })
    return () => el.removeEventListener('scroll', handle)
  }, [])

  useLayoutEffect(() => {
    if (!nearBottom) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    // Note: nearBottom is intentionally excluded from deps — flipping it true
    // mid-smooth-scroll would otherwise snap the animation to its end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMessages.length, streamingMessage, isStreaming])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  useWindowEvent(
    'pointerdown',
    (event) => {
      if (!controlsRef.current?.contains(event.target as Node)) setOpenMenu(null)
    },
    undefined,
    true,
  )

  const addFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(isImageFile)
    if (imageFiles.length > 0) onAddAttachments(imageFiles)
  }

  const addDraggedImage = (event: DragEvent<HTMLDivElement>): boolean => {
    const image = parseDraggedPlaygroundImage(event.dataTransfer.getData('application/x-playground-image'))
    if (!image) return false
    onAddImageAttachment(image)
    return true
  }

  return (
    <div
      ref={controlsRef}
      className="flex min-h-[calc(100dvh-126px)] flex-1 flex-col md:min-h-[560px]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (addDraggedImage(event)) return
        addFiles(event.dataTransfer.files)
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.items)
          .filter((item) => item.type.startsWith('image/'))
          .map((item, index) => {
            const file = item.getAsFile()
            if (!file) return null
            if (file.name) return file
            const ext = file.type.split('/')[1] || 'png'
            return new File([file], `pasted-chat-image-${Date.now()}-${index + 1}.${ext}`, {
              type: file.type,
              lastModified: Date.now(),
            })
          })
          .filter((file): file is File => file !== null)
        if (files.length === 0) return
        event.preventDefault()
        onAddAttachments(files)
      }}
    >
      <AgentChatHeader
        sessions={sessions}
        currentSessionId={currentSessionId}
        sessionsLoading={sessionsLoading}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        onNewSession={onNewSession}
        onSwitchSession={onSwitchSession}
        onDeleteSession={onDeleteSession}
      />

      {keyMissing && (
        <button
          type="button"
          onClick={onOpenApiKeys}
          className="card mb-3 flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
          style={{
            color: 'var(--color-danger)',
            background: 'var(--color-danger-soft)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 24%, transparent)',
          }}
        >
          <Icon name="alert_circle" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span className="flex-1">
            <span className="block text-base font-medium">Agent 模型未配置 API 密钥</span>
            <span className="mt-0.5 block text-sm leading-[1.45] opacity-80">
              使用 {model.label} 需要先配置 {model.providerLabel} API Key。
            </span>
          </span>
          <span className="chip danger shrink-0 text-sm" style={{ height: 22, padding: '0 7px' }}>
            去配置
          </span>
        </button>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-5 pr-1 pb-8 [scrollbar-gutter:stable]"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 34px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 34px), transparent 100%)',
        }}
      >
        {renderItems.length === 0 ? (
          <div className="flex min-h-[300px] flex-col justify-center text-center">
            <div className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
              从一个想法开始
            </div>
            <div className="mx-auto mt-1 max-w-[250px] text-sm leading-[1.5] text-(--color-text-3)">
              输入需求、附加图片，或让它准备一组待审批的生图任务。
            </div>
          </div>
        ) : (
          <>
            {renderItems.map((item) =>
              item.type === 'message' ? (
                <MessageBubble key={item.key} message={item.message} isStreaming={item.isStreaming} />
              ) : (
                <ToolActivityCard
                  key={item.key}
                  calls={item.calls}
                  results={item.results}
                  imageTaskByToolCallId={imageTaskByToolCallId}
                  pendingQuestionByToolCallId={pendingQuestionByToolCallId}
                  isStreaming={item.isStreaming}
                  onApproveImageTask={onApproveImageTask}
                  onCancelImageTask={onCancelImageTask}
                  onSubmitQuestionAnswers={onSubmitQuestionAnswers}
                  onCancelQuestion={onCancelQuestion}
                  onFocusImageTask={onFocusImageTask}
                />
              ),
            )}
            {showThinkingPlaceholder && (
              <div className="flex justify-start">
                <div className="mr-3 max-w-[94%]">
                  <span className="text-(--color-text-4)">正在思考…</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AgentChatComposer
        error={error}
        attachmentError={attachmentError}
        draft={draft}
        attachments={attachments}
        pendingQuestionCount={pendingQuestions.length}
        renderItemCount={renderItems.length}
        nearBottom={nearBottom}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        autoApproveImageTasks={autoApproveImageTasks}
        model={model}
        models={models}
        thinkingLevel={thinkingLevel}
        canSend={canSend}
        showStop={showStop}
        isStreaming={isStreaming}
        onDraftChange={onDraftChange}
        onAddAttachments={onAddAttachments}
        onRemoveAttachment={onRemoveAttachment}
        onClearAttachmentError={onClearAttachmentError}
        onToggleAutoApproveImageTasks={onToggleAutoApproveImageTasks}
        onModelChange={onModelChange}
        onThinkingLevelChange={onThinkingLevelChange}
        onSend={onSend}
        onStop={onStop}
        scrollToBottom={scrollToBottom}
      />
    </div>
  )
}
