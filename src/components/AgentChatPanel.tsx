import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { flushSync } from 'react-dom'

import {
  agentMessageError,
  agentMessageRole,
  agentMessageText,
  displayNameForLanguage,
  stripSystemDirectives,
  type AgentChatAttachment,
  type AgentImageTask,
  type AgentPendingQuestion,
  type AgentQueuedUserMessage,
  type AgentSessionStatus,
  type AgentSessionStatusMap,
  type AgentSessionSummary,
  type AgentSkillSummary,
  type AskUserQuestionAnswer,
} from '../agent'
import type { AgentSessionMessageMetadata } from '../agent/sessionTypes'
import { isNewConversationCommand } from '../agent/slashCommands'
import { resolveAgentModelConfig, type AgentModelConfig, type AgentThinkingLevel } from '../config/agentModels'
import type { Provider } from '../config/models'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/usePlayground'
import { useI18n } from '../i18n'
import { buildImageStacks, type StackItem } from '../lib/stacks'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { AgentChatComposer, type AgentChatComposerHandle } from './agent-chat/AgentChatComposer'
import { AgentChatHeader } from './agent-chat/AgentChatHeader'
import { isDrawingSkill } from './agent-chat/drawingSkills'
import { DrawingSkillStarters } from './agent-chat/DrawingSkillStarters'
import { MessageBubble } from './agent-chat/MessageBubble'
import { ToolActivityCard } from './agent-chat/ToolActivityCard'
import type { AgentChatMenu, AgentImageTaskFocusHandler } from './agent-chat/types'
import { buildChatRenderItems, isImageFile, parseDraggedPlaygroundImage } from './agent-chat/utils'
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
  sessionStatuses: AgentSessionStatusMap
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
  onFocusImageTask?: AgentImageTaskFocusHandler
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onSend: () => boolean
  onStop: () => void
  wideLayout?: boolean
}

function AgentRunningIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="mr-3 pl-3">
        <span className="agent-running-token" role="status" aria-label={label}>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </span>
      </div>
    </div>
  )
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
  sessionStatuses,
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
  wideLayout = false,
}: Props) {
  const { t, language } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<AgentChatComposerHandle>(null)
  const [openMenu, setOpenMenu] = useState<AgentChatMenu>(null)
  const [nearBottom, setNearBottom] = useState(true)
  const [optimisticRunning, setOptimisticRunning] = useState(false)

  const currentKeyStatus = keyStatuses[model.provider]
  const keyMissing = currentKeyStatus === 'empty'
  const hasComposerContent = draft.trim() !== '' || attachments.length > 0
  const canSend = isNewConversationCommand(draft) || (!keyMissing && hasComposerContent)
  const isAwaitingAgentResponse = isStreaming || optimisticRunning
  const isWaitingForQuestionAnswer = pendingQuestions.length > 0
  const isAgentActivelyRunning = isAwaitingAgentResponse && !isWaitingForQuestionAnswer
  const hasGeneratingImageTask = imageTasks.some((task) => task.status === 'queued' || task.status === 'running')
  const currentSessionSidebarStatus: AgentSessionStatus | null = isWaitingForQuestionAnswer
    ? 'waiting_for_question'
    : isAgentActivelyRunning
      ? 'running'
      : hasGeneratingImageTask
        ? 'generating_images'
        : null
  const visibleSessionStatuses = useMemo(() => {
    const next = { ...sessionStatuses }
    if (!currentSessionId) return next
    if (currentSessionSidebarStatus) {
      next[currentSessionId] = currentSessionSidebarStatus
    } else {
      delete next[currentSessionId]
    }
    return next
  }, [currentSessionId, currentSessionSidebarStatus, sessionStatuses])
  const showStop = isAgentActivelyRunning && !hasComposerContent
  const showRunningIndicator = isAgentActivelyRunning
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
      if (metadata?.modelId) return resolveAgentModelConfig(metadata.modelId).label
      return metadata?.modelTitle ?? (itemIsStreaming ? model.label : 'Agent')
    },
    [messageMetadata, model.label, titledAssistantMessages],
  )
  const latestMessageError = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index--) {
      const messageError = agentMessageError(visibleMessages[index])
      if (messageError) return messageError
    }
    return null
  }, [visibleMessages])
  const composerError = error && error === latestMessageError ? null : error
  const imageTaskByToolCallId = useMemo(() => {
    const map = new Map<string, AgentImageTask>()
    for (const task of imageTasks) map.set(task.toolCallId, task)
    return map
  }, [imageTasks])
  const imageStacks = useMemo(() => buildImageStacks(history, generationJobs), [generationJobs, history])
  const stackItemByImageId = useMemo(() => {
    const map = new Map<string, StackItem>()
    for (const stack of imageStacks) {
      for (const item of stack.items) {
        if (item.type === 'image') map.set(item.image.id, item)
      }
    }
    return map
  }, [imageStacks])
  const stackItemNumberByImageId = useMemo(() => {
    const map = new Map<string, number>()
    for (const stack of imageStacks) {
      stack.items.forEach((item, index) => {
        if (item.type === 'image') map.set(item.image.id, index + 1)
      })
    }
    return map
  }, [imageStacks])
  const pendingQuestionByToolCallId = useMemo(() => {
    const map = new Map<string, AgentPendingQuestion>()
    for (const question of pendingQuestions) map.set(question.toolCallId, question)
    return map
  }, [pendingQuestions])
  const drawingSkills = useMemo(() => skills.filter(isDrawingSkill), [skills])

  useExternalSync(() => {
    if (optimisticRunning && (isStreaming || error)) setOptimisticRunning(false)
  }, [error, isStreaming, optimisticRunning])

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

  // biome-ignore lint/correctness/useExhaustiveDependencies(nearBottom): intentionally excluded during smooth scroll
  useLayoutEffect(() => {
    if (!nearBottom) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    // Note: nearBottom is intentionally excluded from deps — flipping it true
    // mid-smooth-scroll would otherwise snap the animation to its end.
  }, [visibleMessages.length, queuedMessages.length, streamingMessage, showRunningIndicator])

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

  const handleNewSession = useCallback(() => {
    onNewSession()
    setOpenMenu(null)
    composerRef.current?.focus()
  }, [onNewSession])

  const handleSend = useCallback(() => {
    if (isNewConversationCommand(draft)) {
      onDraftChange('')
      handleNewSession()
      return
    }
    flushSync(() => setOptimisticRunning(true))
    const sent = onSend()
    if (!sent) {
      setOptimisticRunning(false)
      return
    }
    scrollToBottomAfterSend()
  }, [draft, handleNewSession, onDraftChange, onSend, scrollToBottomAfterSend])

  useWindowEvent('keydown', (event) => {
    if (!event.metaKey || !event.shiftKey || event.altKey || event.ctrlKey || event.key.toLowerCase() !== 'o') return
    if (event.repeat) return
    if (!controlsRef.current?.getClientRects().length) return
    event.preventDefault()
    handleNewSession()
  })

  useWindowEvent(
    'pointerdown',
    (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-agent-menu], [data-agent-menu-trigger]')) return
      setOpenMenu(null)
    },
    undefined,
    openMenu !== null,
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
  const contentRightPaddingClass = 'px-[var(--panel-pad-x)]'
  const headerPaddingClass = wideLayout ? 'pb-1.5' : 'pb-3'

  return (
    <div
      ref={controlsRef}
      className={`flex h-full flex-col md:h-auto md:min-h-[560px] md:flex-1 ${wideLayout ? 'md:pt-4 md:pb-3' : ''}`}
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={`${contentRightPaddingClass} ${headerPaddingClass}`}>
          <AgentChatHeader
            sessions={sessions}
            sessionStatuses={visibleSessionStatuses}
            currentSessionId={currentSessionId}
            sessionsLoading={sessionsLoading}
            centeredTitle={wideLayout}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            onNewSession={handleNewSession}
            onSwitchSession={onSwitchSession}
            onDeleteSession={onDeleteSession}
          />

          {keyMissing ? (
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
          ) : null}
        </div>

        <div
          ref={scrollRef}
          className="scroll-fade-y min-h-0 flex-1 overflow-y-auto pt-5 pb-8 md:[scrollbar-gutter:stable_both-edges] [--scroll-fade-end-size:2.25rem] [--scroll-fade-start-size:1.5rem]"
        >
          <div className={`space-y-4 ${contentRightPaddingClass}`}>
            {renderItems.length === 0 && queuedMessages.length === 0 && !showRunningIndicator ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                {drawingSkills.length > 0 ? (
                  <DrawingSkillStarters
                    skills={drawingSkills}
                    onPick={(skill) => {
                      flushSync(() => {
                        onDraftChange(
                          `/${skill.name} ${t('agentChat.empty.skillStarter.prompt', { skill: displayNameForLanguage(skill, language) })}`,
                        )
                      })
                      composerRef.current?.activate()
                    }}
                  />
                ) : (
                  <>
                    <div className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
                      {t('agentChat.empty.title')}
                    </div>
                    <div className="mx-auto mt-1 max-w-[32ch] text-sm leading-[1.5] text-pretty text-(--color-text-3)">
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
                      stackItemNumberByImageId={stackItemNumberByImageId}
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
                {queuedMessages.map((queued) => (
                  <MessageBubble key={queued.id} message={queued.message} isStreaming={false} isQueued />
                ))}
                {showRunningIndicator ? <AgentRunningIndicator label={t('agentChat.status.running')} /> : null}
              </>
            )}
          </div>
        </div>

        <div className={contentRightPaddingClass}>
          <AgentChatComposer
            ref={composerRef}
            error={composerError}
            attachmentError={attachmentError}
            draft={draft}
            attachments={attachments}
            skills={skills}
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
            isStreaming={isAwaitingAgentResponse}
            history={history}
            onDraftChange={onDraftChange}
            onAddAttachments={onAddAttachments}
            onAddImageAttachment={onAddImageAttachment}
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
