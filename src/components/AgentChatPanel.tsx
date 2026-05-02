import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'

import {
  agentMessageError,
  agentMessageRole,
  agentMessageText,
  agentMessageToolCalls,
  stripSystemDirectives,
  type AgentChatAttachment,
  type AgentImageTask,
  type AgentPendingQuestion,
  type AgentQueuedUserMessage,
  type AgentSessionSummary,
  type AgentSkillSummary,
  type AskUserQuestionAnswer,
} from '../agent'
import type { AgentSessionMessageMetadata } from '../agent/sessionTypes'
import type { AgentModelConfig, AgentThinkingLevel } from '../config/agentModels'
import type { Provider } from '../config/models'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/usePlayground'
import { useI18n } from '../i18n'
import { buildImageStacks, type StackItem } from '../lib/stacks'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { AgentChatComposer } from './agent-chat/AgentChatComposer'
import { AgentChatHeader } from './agent-chat/AgentChatHeader'
import { AgentSessionSidebar } from './agent-chat/AgentSessionSidebar'
import { isDrawingSkill } from './agent-chat/drawingSkills'
import { DrawingSkillStarters } from './agent-chat/DrawingSkillStarters'
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
  messageMetadata: WeakMap<AgentMessage, AgentSessionMessageMetadata>
  streamingMessage: AgentMessage | null
  queuedMessages: AgentQueuedUserMessage[]
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
  skills: AgentSkillSummary[]
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  model: AgentModelConfig
  models: AgentModelConfig[]
  thinkingLevel: AgentThinkingLevel
  keyStatuses: Record<Provider, ApiKeyStatus>
  showSessionSidebar?: boolean
  onOpenApiKeys: () => void
  onDraftChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onAddImageAttachment: (image: PlaygroundImage | PlaygroundImageMeta) => void
  onRemoveAttachment: (id: string) => void
  onClearAttachmentError: () => void
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onSwitchToGenerate?: () => void
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
  messageMetadata,
  streamingMessage,
  queuedMessages,
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
  skills,
  history,
  generationJobs,
  model,
  models,
  thinkingLevel,
  keyStatuses,
  showSessionSidebar = false,
  onOpenApiKeys,
  onDraftChange,
  onAddAttachments,
  onAddImageAttachment,
  onRemoveAttachment,
  onClearAttachmentError,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onSwitchToGenerate,
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
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<AgentChatMenu>(null)
  const [nearBottom, setNearBottom] = useState(true)

  useWindowEvent(
    'pointerdown',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-agent-menu], [data-agent-menu-trigger]')) return
      setOpenMenu(null)
    },
    undefined,
    openMenu !== null,
  )
  const currentKeyStatus = keyStatuses[model.provider]
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
  const titledAssistantMessages = useMemo(() => {
    const titled = new WeakSet<AgentMessage>()
    let nextVisibleAssistantStartsTurn = false
    for (const item of renderItems) {
      if (item.type !== 'message') continue
      const role = agentMessageRole(item.message)
      if (role === 'user') {
        if (stripSystemDirectives(agentMessageText(item.message)).trim()) nextVisibleAssistantStartsTurn = true
        continue
      }
      if (role !== 'assistant') continue
      if (nextVisibleAssistantStartsTurn) titled.add(item.message)
      nextVisibleAssistantStartsTurn = false
    }
    return titled
  }, [renderItems])
  const assistantTitleFor = useCallback(
    (message: AgentMessage, itemIsStreaming: boolean) => {
      if (!titledAssistantMessages.has(message)) return undefined
      const metadata = messageMetadata.get(message)
      return metadata?.modelTitle ?? (itemIsStreaming ? model.shortLabel : 'Agent')
    },
    [messageMetadata, model.shortLabel, titledAssistantMessages],
  )
  const latestMessageError = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index--) {
      const messageError = agentMessageError(visibleMessages[index])
      if (messageError) return messageError
    }
    return null
  }, [visibleMessages])
  const composerError = error && error === latestMessageError ? null : error
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
  const stackItemByImageId = useMemo(() => {
    const map = new Map<string, StackItem>()
    for (const stack of buildImageStacks(history, generationJobs)) {
      for (const item of stack.items) {
        if (item.type === 'image') map.set(item.image.id, item)
      }
    }
    return map
  }, [generationJobs, history])
  const pendingQuestionByToolCallId = useMemo(() => {
    const map = new Map<string, AgentPendingQuestion>()
    for (const question of pendingQuestions) map.set(question.toolCallId, question)
    return map
  }, [pendingQuestions])
  const drawingSkills = useMemo(() => skills.filter(isDrawingSkill), [skills])

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
  }, [visibleMessages.length, queuedMessages.length, streamingMessage, isStreaming])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setNearBottom(true)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  const scrollToBottomAfterSend = useCallback(() => {
    setNearBottom(true)
    requestAnimationFrame(() => {
      scrollToBottom()
      requestAnimationFrame(scrollToBottom)
    })
  }, [scrollToBottom])

  const handleSend = useCallback(() => {
    onSend()
    scrollToBottomAfterSend()
  }, [onSend, scrollToBottomAfterSend])

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
  const contentRightPaddingClass = showSessionSidebar ? 'pr-[192px]' : 'pr-[var(--agent-panel-padding-x,18px)]'

  return (
    <div
      ref={controlsRef}
      className={`flex h-full md:h-auto md:min-h-[560px] md:flex-1 ${showSessionSidebar ? 'min-h-0 flex-row gap-[168px]' : 'flex-col'}`}
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
      {showSessionSidebar && (
        <AgentSessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          sessionsLoading={sessionsLoading}
          onNewSession={onNewSession}
          onSwitchSession={onSwitchSession}
          onDeleteSession={onDeleteSession}
          onSwitchToGenerate={onSwitchToGenerate}
          onOpenSettings={onOpenApiKeys}
        />
      )}

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${showSessionSidebar ? 'pt-8 pb-[18px]' : ''}`}>
        <div className={contentRightPaddingClass}>
          <AgentChatHeader
            sessions={sessions}
            currentSessionId={currentSessionId}
            sessionsLoading={sessionsLoading}
            compactSessionControls={showSessionSidebar}
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
                <span className="block text-base font-medium">{t('agentChat.apiKeyMissing.title')}</span>
                <span className="mt-0.5 block text-sm leading-[1.45] opacity-80">
                  {t('agentChat.apiKeyMissing.description', { model: model.label, provider: model.providerLabel })}
                </span>
              </span>
              <span className="chip danger shrink-0 text-sm" style={{ height: 22, padding: '0 7px' }}>
                {t('agentChat.apiKeyMissing.action')}
              </span>
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto pt-5 pb-8 [scrollbar-gutter:stable]"
          style={{
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,0.45) 0, black 14px, black calc(100% - 18px), rgba(0,0,0,0.45) 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,0.45) 0, black 14px, black calc(100% - 18px), rgba(0,0,0,0.45) 100%)',
          }}
        >
          <div className={`space-y-4 ${contentRightPaddingClass}`}>
            {renderItems.length === 0 && queuedMessages.length === 0 && !showThinkingPlaceholder ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                {drawingSkills.length > 0 ? (
                  <DrawingSkillStarters
                    skills={drawingSkills}
                    onPick={(skill) => {
                      onDraftChange(t('agentChat.empty.skillStarter.prompt', { skill: skill.name }))
                    }}
                  />
                ) : (
                  <>
                    <div className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
                      {t('agentChat.empty.title')}
                    </div>
                    <div className="mx-auto mt-1 max-w-[250px] text-sm leading-[1.5] text-(--color-text-3)">
                      {t('agentChat.empty.description')}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {renderItems.map((item) =>
                  item.type === 'message' ? (
                    <MessageBubble
                      key={item.key}
                      message={item.message}
                      isStreaming={item.isStreaming}
                      assistantTitle={assistantTitleFor(item.message, item.isStreaming)}
                    />
                  ) : (
                    <ToolActivityCard
                      key={item.key}
                      calls={item.calls}
                      results={item.results}
                      imageTaskByToolCallId={imageTaskByToolCallId}
                      stackItemByImageId={stackItemByImageId}
                      pendingQuestionByToolCallId={pendingQuestionByToolCallId}
                      isStreaming={item.isStreaming}
                      autoApproveImageTasks={autoApproveImageTasks}
                      onApproveImageTask={onApproveImageTask}
                      onCancelImageTask={onCancelImageTask}
                      onToggleAutoApproveImageTasks={onToggleAutoApproveImageTasks}
                      onSubmitQuestionAnswers={onSubmitQuestionAnswers}
                      onCancelQuestion={onCancelQuestion}
                      onFocusImageTask={onFocusImageTask}
                    />
                  ),
                )}
                {showThinkingPlaceholder && (
                  <div className="flex justify-start">
                    <div className="mr-3 max-w-[94%] pl-3">
                      <span className="text-(--color-text-4)">{t('agentChat.status.thinking')}</span>
                    </div>
                  </div>
                )}
                {queuedMessages.map((queued) => (
                  <MessageBubble key={queued.id} message={queued.message} isStreaming={false} isQueued />
                ))}
              </>
            )}
          </div>
        </div>

        <div className={contentRightPaddingClass}>
          <AgentChatComposer
            error={composerError}
            attachmentError={attachmentError}
            draft={draft}
            attachments={attachments}
            pendingQuestionCount={pendingQuestions.length}
            renderItemCount={renderItems.length + queuedMessages.length}
            nearBottom={nearBottom}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            autoApproveImageTasks={autoApproveImageTasks}
            model={model}
            models={models}
            thinkingLevel={thinkingLevel}
            keyStatuses={keyStatuses}
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
            onOpenApiKeys={onOpenApiKeys}
            onSend={handleSend}
            onStop={onStop}
            scrollToBottom={scrollToBottom}
          />
        </div>
      </div>
    </div>
  )
}
