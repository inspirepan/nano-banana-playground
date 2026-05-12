import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
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
import { hasPrimaryModifier } from '../lib/keyboard'
import { buildImageStacks, type StackItem } from '../lib/stacks'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { AgentChatComposer, type AgentChatComposerHandle } from './agent-chat/AgentChatComposer'
import { AgentChatEmptyState, QuickCompletePanel } from './agent-chat/AgentChatEmptyState'
import { AgentChatHeader } from './agent-chat/AgentChatHeader'
import { isDrawingSkill } from './agent-chat/drawingSkills'
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

const QueuedMessageBubble = memo(function QueuedMessageBubble({ queued }: { queued: AgentQueuedUserMessage }) {
  return <MessageBubble message={queued.message} isStreaming={false} isQueued />
})

const AUTO_FOLLOW_DETACH_DISTANCE = 2
const AUTO_FOLLOW_REJOIN_DISTANCE = 16
const AUTO_FOLLOW_SCROLL_EPSILON = 0.5

function getScrollBottomDistance(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight)
}

function getOuterHeight(el: HTMLElement): number {
  const style = getComputedStyle(el)
  return (
    el.getBoundingClientRect().height +
    Number.parseFloat(style.marginTop || '0') +
    Number.parseFloat(style.marginBottom || '0')
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
  const nearBottomRef = useRef(true)
  const lastScrollTopRef = useRef(0)
  const lastScrollHeightRef = useRef<number | null>(null)
  const bottomReserveHeightRef = useRef(0)
  const runningIndicatorRef = useRef<HTMLDivElement>(null)
  const runningIndicatorHeightRef = useRef(0)
  const showRunningIndicatorRef = useRef(false)
  const [openMenu, setOpenMenu] = useState<AgentChatMenu>(null)
  const [nearBottom, setNearBottom] = useState(true)
  const [bottomReserveHeight, setBottomReserveHeightState] = useState(0)
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
  const visibleMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage],
  )
  const renderItems = useMemo(
    () => buildChatRenderItems(visibleMessages, streamingMessage),
    [visibleMessages, streamingMessage],
  )
  const streamingAssistantHasVisibleText = renderItems.some(
    (item) =>
      item.type === 'message' &&
      item.isStreaming &&
      agentMessageRole(item.message) === 'assistant' &&
      stripSystemDirectives(agentMessageText(item.message)).trim() !== '',
  )
  const showStop = isAgentActivelyRunning && !hasComposerContent
  const showRunningIndicator = isAgentActivelyRunning && !streamingAssistantHasVisibleText
  const scrollButtonBusy = isAgentActivelyRunning || hasGeneratingImageTask
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
  const isEmpty = renderItems.length === 0 && queuedMessages.length === 0 && !showRunningIndicator

  const setNearBottomValue = useCallback((next: boolean) => {
    if (nearBottomRef.current === next) return
    nearBottomRef.current = next
    setNearBottom(next)
  }, [])

  const setBottomReserveHeight = useCallback((height: number) => {
    const next = Math.max(0, Math.ceil(height))
    if (bottomReserveHeightRef.current === next) return
    bottomReserveHeightRef.current = next
    setBottomReserveHeightState(next)
  }, [])

  const handleOpenImageTaskImage = useCallback(
    (toolCallId: string, imageId: string) => {
      const task = imageTaskByToolCallId.get(toolCallId)
      if (!task) return
      onFocusImageTask?.(task, { behavior: 'open', itemId: imageId })
    },
    [imageTaskByToolCallId, onFocusImageTask],
  )

  const reserveBottomSpace = useCallback(
    (height: number): boolean => {
      const el = scrollRef.current
      if (!el || !nearBottomRef.current || height <= 0) return false
      if (getScrollBottomDistance(el) > AUTO_FOLLOW_REJOIN_DISTANCE) return false

      const reserve = Math.min(Math.ceil(height), el.clientHeight)
      if (reserve <= 0) return false
      const currentReserve = Math.min(bottomReserveHeightRef.current, el.clientHeight)
      const nextReserve = Math.min(currentReserve + reserve, el.clientHeight)
      if (nextReserve !== bottomReserveHeightRef.current) setBottomReserveHeight(nextReserve)
      return true
    },
    [setBottomReserveHeight],
  )

  const reserveThinkingCollapseSpace = reserveBottomSpace

  const handleInsertText = useCallback(
    (text: string) => {
      const trimmedAddition = text.trim()
      if (!trimmedAddition) return
      const needsLeadingSpace = draft.length > 0 && !/\s$/.test(draft)
      const next = `${draft}${needsLeadingSpace ? ' ' : ''}${trimmedAddition} `
      flushSync(() => onDraftChange(next))
      composerRef.current?.activate()
    },
    [draft, onDraftChange],
  )

  useExternalSync(() => {
    if (optimisticRunning && (isStreaming || error)) setOptimisticRunning(false)
  }, [error, isStreaming, optimisticRunning])

  useExternalSync(() => {
    const el = scrollRef.current
    if (!el) return
    const handle = () => {
      const scrollTop = el.scrollTop
      const dist = getScrollBottomDistance(el)
      const scrollingUp = scrollTop < lastScrollTopRef.current - AUTO_FOLLOW_SCROLL_EPSILON
      lastScrollTopRef.current = scrollTop

      if (scrollingUp && dist > AUTO_FOLLOW_DETACH_DISTANCE) {
        setNearBottomValue(false)
      } else if (dist <= AUTO_FOLLOW_REJOIN_DISTANCE) {
        setNearBottomValue(true)
      }
    }
    lastScrollTopRef.current = el.scrollTop
    handle()
    el.addEventListener('scroll', handle, { passive: true })
    return () => el.removeEventListener('scroll', handle)
  }, [setNearBottomValue])

  useLayoutEffect(() => {
    setBottomReserveHeight(0)
    lastScrollHeightRef.current = null
    runningIndicatorHeightRef.current = 0
    showRunningIndicatorRef.current = false
    setNearBottomValue(true)
  }, [currentSessionId, setBottomReserveHeight, setNearBottomValue])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const wasShowingRunningIndicator = showRunningIndicatorRef.current
    if (showRunningIndicator) {
      const indicator = runningIndicatorRef.current
      if (indicator) runningIndicatorHeightRef.current = getOuterHeight(indicator)
    } else if (wasShowingRunningIndicator) {
      const reserved = reserveBottomSpace(runningIndicatorHeightRef.current)
      runningIndicatorHeightRef.current = 0
      showRunningIndicatorRef.current = false
      if (reserved) {
        lastScrollHeightRef.current = null
        return
      }
    }
    showRunningIndicatorRef.current = showRunningIndicator

    bottomReserveHeightRef.current = bottomReserveHeight
    const previousScrollHeight = lastScrollHeightRef.current
    const currentScrollHeight = el.scrollHeight
    if (previousScrollHeight !== null) {
      const heightDelta = currentScrollHeight - previousScrollHeight
      if (heightDelta > 0 && bottomReserveHeight > 0) {
        const consumed = Math.min(heightDelta, bottomReserveHeight)
        setBottomReserveHeight(bottomReserveHeight - consumed)
        lastScrollHeightRef.current = currentScrollHeight - consumed
        return
      }
    }

    lastScrollHeightRef.current = currentScrollHeight
    if (!nearBottomRef.current) return
    el.scrollTop = el.scrollHeight
    lastScrollTopRef.current = el.scrollTop
  }, [
    bottomReserveHeight,
    currentSessionId,
    visibleMessages.length,
    queuedMessages.length,
    streamingMessage,
    showRunningIndicator,
    renderItems,
    reserveBottomSpace,
    setBottomReserveHeight,
  ])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setNearBottomValue(true)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [setNearBottomValue])

  const scrollToTop = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setNearBottomValue(false)
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setNearBottomValue])

  const scrollToBottomAfterSend = useCallback(() => {
    setNearBottomValue(true)
    requestAnimationFrame(() => {
      scrollToBottom()
      requestAnimationFrame(scrollToBottom)
    })
  }, [scrollToBottom, setNearBottomValue])

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
    if (!hasPrimaryModifier(event) || !event.shiftKey || event.altKey || event.key.toLowerCase() !== 'o') return
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
  const currentSessionForTitle = sessions.find((session) => session.id === currentSessionId)
  const floatingTitleText = sessionsLoading
    ? t('agentChat.header.loadingSessions')
    : (currentSessionForTitle?.title ?? t('agentChat.header.newConversation'))
  const showFloatingTitle = wideLayout && !isEmpty && !sessionsLoading && Boolean(currentSessionForTitle)
  // Wide layout has a floating frosted title overlay (~21+30+6 frosted +
  // 24 gradient = ~81px); reserve enough top padding so the first message
  // clears it when the scroll container is at its top.
  const scrollBodyClass = wideLayout
    ? 'flex-1 overflow-y-auto overscroll-y-none pt-[88px] pb-8 md:[scrollbar-gutter:stable_both-edges]'
    : 'flex-1 overflow-y-auto overscroll-y-none pt-14 pb-8 md:[scrollbar-gutter:stable_both-edges]'
  // `my-auto` inside a flex-column scroll container centers content when it
  // fits and collapses to 0 when content overflows, avoiding the phantom
  // scroll that `min-h-full` + scrollRef padding produces (min-height: 100%
  // resolves against parent box height, so scrollHeight exceeds clientHeight
  // by the padding amount even when there is nothing to scroll).
  const contentLayoutClass = isEmpty
    ? `flex min-w-0 flex-col my-auto md:my-0 ${contentRightPaddingClass}`
    : `space-y-4 ${contentRightPaddingClass}`
  const composer = (
    <AgentChatComposer
      ref={composerRef}
      error={composerError}
      attachmentError={attachmentError}
      draft={draft}
      attachments={attachments}
      skills={skills}
      pendingQuestionCount={pendingQuestions.length}
      renderItemCount={renderItems.length + queuedMessages.length}
      scrollButtonBusy={scrollButtonBusy}
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
      isNewSession={isEmpty}
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
  )

  return (
    <div
      ref={controlsRef}
      className={`flex h-full flex-col md:h-auto md:min-h-[560px] md:flex-1 ${wideLayout ? 'md:pb-3' : ''}`}
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
      {!wideLayout || keyMissing ? (
        <div className={`${contentRightPaddingClass} ${wideLayout ? 'pt-[21px] pb-3' : 'pb-3'}`}>
          {!wideLayout ? (
            <AgentChatHeader
              sessions={sessions}
              sessionStatuses={visibleSessionStatuses}
              currentSessionId={currentSessionId}
              sessionsLoading={sessionsLoading}
              showNewSessionButton={!isEmpty}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onNewSession={handleNewSession}
              onSwitchSession={onSwitchSession}
              onDeleteSession={onDeleteSession}
            />
          ) : null}

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
      ) : null}

      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col${isEmpty ? ' md:grid md:grid-cols-[minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)]' : ''}`}
      >
        {showFloatingTitle ? (
          <div aria-hidden="false" className="pointer-events-none absolute inset-x-0 top-0 z-40">
            <button
              type="button"
              onClick={scrollToTop}
              title={t('agentChat.header.scrollToTop')}
              aria-label={t('agentChat.header.scrollToTop')}
              className={`pointer-events-auto block w-full cursor-pointer text-center transition-colors ${contentRightPaddingClass} group`}
              style={{
                backdropFilter: 'saturate(140%) blur(8px)',
                WebkitBackdropFilter: 'saturate(140%) blur(8px)',
                background: 'color-mix(in srgb, var(--color-bg) 55%, transparent)',
                paddingTop: '21px',
                paddingBottom: '6px',
              }}
            >
              <span className="flex min-h-[30px] items-center justify-center">
                <span className="inline-block max-w-[min(960px,100%)] min-w-0 truncate font-display text-base font-semibold text-(--color-text) transition-colors group-hover:text-(--color-text-2)">
                  {floatingTitleText}
                </span>
              </span>
            </button>
            <div
              aria-hidden
              className="h-6 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-bg)_55%,transparent)_0%,transparent_100%)]"
            />
          </div>
        ) : !isEmpty ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-30 h-8 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-bg)_72%,transparent)_0%,color-mix(in_srgb,var(--color-bg)_42%,transparent)_42%,transparent_100%)]"
          />
        ) : null}
        <div
          ref={scrollRef}
          className={`min-h-0 ${
            isEmpty
              ? 'flex flex-1 flex-col overflow-y-auto pt-5 pb-4 md:mb-20 md:w-full md:self-end md:overflow-visible md:pt-0 md:pb-0 xl:mb-24'
              : scrollBodyClass
          }`}
        >
          <div
            className={contentLayoutClass}
            style={!isEmpty && bottomReserveHeight > 0 ? { paddingBottom: bottomReserveHeight } : undefined}
          >
            {isEmpty ? (
              <AgentChatEmptyState
                drawingSkills={drawingSkills}
                confirmSkillOverwrite={draft.trim().length > 0}
                onPickSkill={(skill) => {
                  flushSync(() => {
                    onDraftChange(
                      `/${skill.name} ${t('agentChat.empty.skillStarter.prompt', { skill: displayNameForLanguage(skill, language) })}`,
                    )
                  })
                  composerRef.current?.activate({ resetStarterExampleRotation: true })
                }}
                onInsertText={handleInsertText}
              />
            ) : (
              <>
                {renderItems.map((item) =>
                  item.type === 'message' ? (
                    <MessageBubble
                      key={item.key}
                      message={item.message}
                      isStreaming={item.isStreaming}
                      assistantTitle={assistantTitleFor(item.message, item.isStreaming)}
                      onOpenImageTaskImage={handleOpenImageTaskImage}
                      onThinkingAutoCollapseReserve={reserveThinkingCollapseSpace}
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
                  <QueuedMessageBubble key={queued.id} queued={queued} />
                ))}
                {showRunningIndicator ? (
                  <div ref={runningIndicatorRef}>
                    <AgentRunningIndicator label={t('agentChat.status.running')} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className={`${contentRightPaddingClass} relative z-50`}>
          {!isEmpty ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-full z-0 h-8 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--color-bg)_72%,transparent)_0%,color-mix(in_srgb,var(--color-bg)_42%,transparent)_42%,transparent_100%)]"
            />
          ) : null}
          <div className={`relative z-10${isEmpty ? ' mx-auto w-full max-w-[980px]' : ''}`}>{composer}</div>
        </div>

        {isEmpty ? (
          <div className={`${contentRightPaddingClass} hidden md:mt-4 md:block md:w-full md:self-start`}>
            <QuickCompletePanel onInsertText={handleInsertText} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
