import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { flushSync } from 'react-dom'

import {
  agentMessageError,
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  displayNameForLanguage,
  imageDataUrl,
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
import { Tooltip } from './Tooltip'

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
  onUpdateQueuedMessage: (id: string, draft: string) => void
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

const QueuedMessagesCard = memo(function QueuedMessagesCard({
  queuedMessages,
  onUpdateQueuedMessage,
}: {
  queuedMessages: AgentQueuedUserMessage[]
  onUpdateQueuedMessage: (id: string, draft: string) => void
}) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const label =
    queuedMessages.length === 1
      ? t('agentChat.message.queued')
      : t('agentChat.message.queuedCount', { count: queuedMessages.length })

  const startEditing = (queued: AgentQueuedUserMessage) => {
    setEditingId(queued.id)
    setEditingDraft(queued.draft)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingDraft('')
  }

  const saveEditing = () => {
    if (!editingId) return
    onUpdateQueuedMessage(editingId, editingDraft)
    cancelEditing()
  }

  return (
    <div className="flex justify-end">
      <div className="max-h-[min(280px,calc(100svh-220px))] w-full overflow-y-auto rounded-[var(--radius-lg)] bg-(--bubble-user-bg) px-3 py-2.5 text-(--color-text) shadow-[var(--bubble-user-edge)]">
        <div className="mb-2 flex items-center justify-between gap-3 text-base font-semibold text-(--color-text-2)">
          <span>{label}</span>
        </div>
        <div className="space-y-2">
          {queuedMessages.map((queued, queuedIndex) => {
            const editing = editingId === queued.id
            const visibleText = stripSystemDirectives(agentMessageText(queued.message)).trim()
            const images = agentMessageImages(queued.message)
            return (
              <div
                key={queued.id}
                className={queuedIndex === 0 ? '' : 'pt-2 shadow-[inset_0_1px_0_var(--ring-edge-soft)]'}
              >
                {images.length > 0 ? (
                  <div className={`${visibleText ? 'mb-2' : ''} grid max-w-[360px] grid-cols-3 gap-1.5`}>
                    {images.map((image, imageIndex) => (
                      <img
                        key={imageIndex}
                        src={imageDataUrl(image)}
                        alt={t('agentChat.imageAlt.message', { index: imageIndex + 1 })}
                        className="aspect-square rounded-[var(--radius-sm)] object-cover shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
                      />
                    ))}
                  </div>
                ) : null}
                {editing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingDraft}
                      onChange={(event) => setEditingDraft(event.target.value)}
                      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                        if (event.nativeEvent.isComposing) return
                        if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
                          return
                        }
                        event.preventDefault()
                        if (editingDraft.trim() || images.length > 0) saveEditing()
                      }}
                      rows={Math.min(6, Math.max(2, editingDraft.split('\n').length))}
                      className="block max-h-[180px] min-h-[72px] w-full resize-none rounded-[var(--radius-sm)] bg-(--color-surface) px-2.5 py-2 text-base leading-[1.55] text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={cancelEditing} className="chip h-[26px] px-2 text-xs">
                        {t('agentChat.message.editCancel')}
                      </button>
                      <button
                        type="button"
                        onClick={saveEditing}
                        disabled={!editingDraft.trim() && images.length === 0}
                        className="chip selected h-[26px] px-2 text-xs disabled:pointer-events-none disabled:opacity-45"
                      >
                        {t('agentChat.message.editSave')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group/queued-item flex items-start gap-2">
                    {visibleText ? (
                      <div className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-[1.58]">{visibleText}</div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEditing(queued)}
                      className="mt-0.5 shrink-0 rounded-[var(--radius-sm)] bg-transparent px-1.5 py-0.5 text-xs font-medium text-(--color-text-4) opacity-100 transition-[background-color,color,opacity] duration-150 hover:bg-(--color-surface-2) hover:text-(--color-text-2) md:opacity-0 md:group-hover/queued-item:opacity-100 md:group-focus-within/queued-item:opacity-100"
                    >
                      {t('agentChat.message.edit')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

const AUTO_FOLLOW_DETACH_DISTANCE = 2
const AUTO_FOLLOW_REJOIN_DISTANCE = 16
const AUTO_FOLLOW_SCROLL_EPSILON = 0.5
const QUEUED_MESSAGES_FLOAT_GAP = 8
const HEIGHT_CHANGE_EPSILON = 0.5
const MAX_BOTTOM_RESERVE_VIEWPORT_RATIO = 0.82

function getScrollBottomDistance(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight)
}

function getMaxBottomReserveHeight(el: HTMLElement): number {
  return Math.max(0, Math.floor(el.clientHeight * MAX_BOTTOM_RESERVE_VIEWPORT_RATIO))
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
  onUpdateQueuedMessage,
  wideLayout = false,
}: Props) {
  const { t, language } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<AgentChatComposerHandle>(null)
  const nearBottomRef = useRef(true)
  const lastScrollTopRef = useRef(0)
  const lastTranscriptHeightRef = useRef<number | null>(null)
  const bottomReserveHeightRef = useRef(0)
  const floatingQueuedMessagesRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<AgentChatMenu>(null)
  const [nearBottom, setNearBottom] = useState(true)
  const [bottomReserveHeight, setBottomReserveHeightState] = useState(0)
  const [floatingQueuedMessagesHeight, setFloatingQueuedMessagesHeight] = useState(0)
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
  const hasFloatingQueuedMessages = queuedMessages.length > 0
  const floatingQueuedMessagesReserveHeight = hasFloatingQueuedMessages
    ? floatingQueuedMessagesHeight + QUEUED_MESSAGES_FLOAT_GAP
    : 0
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
  const stackItemByOutputId = useMemo(() => {
    const map = new Map<string, StackItem>()
    for (const stack of imageStacks) {
      for (const item of stack.items) {
        if (item.type === 'image') map.set(item.image.id, item)
        else if (item.slot.outputImageId) map.set(item.slot.outputImageId, item)
      }
    }
    return map
  }, [imageStacks])
  const stackItemNumberByOutputId = useMemo(() => {
    const map = new Map<string, number>()
    for (const stack of imageStacks) {
      stack.items.forEach((item, index) => {
        if (item.type === 'image') map.set(item.image.id, index + 1)
        else if (item.slot.outputImageId) map.set(item.slot.outputImageId, index + 1)
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
      if (!el || height <= HEIGHT_CHANGE_EPSILON) return false
      if (!nearBottomRef.current || getScrollBottomDistance(el) > AUTO_FOLLOW_REJOIN_DISTANCE) return false

      const maxReserve = getMaxBottomReserveHeight(el)
      const reserve = Math.min(Math.ceil(height), maxReserve)
      if (reserve <= 0) return false
      const currentReserve = Math.min(bottomReserveHeightRef.current, maxReserve)
      const nextReserve = Math.min(currentReserve + reserve, maxReserve)
      if (nextReserve !== bottomReserveHeightRef.current) setBottomReserveHeight(nextReserve)
      return true
    },
    [setBottomReserveHeight],
  )

  useLayoutEffect(() => {
    if (!hasFloatingQueuedMessages) {
      setFloatingQueuedMessagesHeight((height) => (height === 0 ? height : 0))
      return
    }

    const node = floatingQueuedMessagesRef.current
    if (!node) return

    const updateHeight = () => {
      const next = Math.ceil(node.getBoundingClientRect().height)
      setFloatingQueuedMessagesHeight((height) => (height === next ? height : next))
    }

    updateHeight()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasFloatingQueuedMessages])

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
    lastTranscriptHeightRef.current = null
    setNearBottomValue(true)
    const el = scrollRef.current
    if (!el || isEmpty) return
    el.scrollTop = el.scrollHeight
    lastScrollTopRef.current = el.scrollTop
  }, [currentSessionId, isEmpty, setBottomReserveHeight, setNearBottomValue])

  useLayoutEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript || isEmpty) {
      lastTranscriptHeightRef.current = null
      return
    }

    const measure = () => {
      const nextHeight = transcript.getBoundingClientRect().height
      const previousHeight = lastTranscriptHeightRef.current
      lastTranscriptHeightRef.current = nextHeight
      if (previousHeight === null) return

      const heightDelta = nextHeight - previousHeight
      if (heightDelta < -HEIGHT_CHANGE_EPSILON) {
        reserveBottomSpace(-heightDelta)
        return
      }
      if (heightDelta <= HEIGHT_CHANGE_EPSILON || bottomReserveHeightRef.current <= 0) return

      const consumed = Math.min(Math.ceil(heightDelta), bottomReserveHeightRef.current)
      if (consumed <= 0) return
      flushSync(() => setBottomReserveHeight(bottomReserveHeightRef.current - consumed))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(transcript)
    return () => observer.disconnect()
  }, [isEmpty, reserveBottomSpace, setBottomReserveHeight])

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

  const reattachBottomAnchorAfterSend = useCallback(() => {
    setNearBottomValue(true)
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
      lastScrollTopRef.current = el.scrollTop
    })
  }, [setNearBottomValue])

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
    reattachBottomAnchorAfterSend()
  }, [draft, handleNewSession, onDraftChange, onSend, reattachBottomAnchorAfterSend])

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
    : `${contentRightPaddingClass} ${nearBottom ? '[overflow-anchor:none]' : ''}`
  const scrollContentBottomSpacerHeight = bottomReserveHeight + floatingQueuedMessagesReserveHeight
  const chatItemOverflowAnchorClass = nearBottom ? '[overflow-anchor:none]' : undefined
  const transcriptOverflowAnchorClass = nearBottom ? '[overflow-anchor:none]' : undefined
  const bottomAnchorClass = nearBottom ? '[overflow-anchor:auto]' : '[overflow-anchor:none]'
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
      scrollButtonBottomOffset={floatingQueuedMessagesReserveHeight}
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
            <Tooltip text={t('agentChat.header.scrollToTop')} placement="bottom" className="pointer-events-auto block">
              <button
                type="button"
                onClick={scrollToTop}
                aria-label={t('agentChat.header.scrollToTop')}
                className={`block w-full cursor-pointer text-center transition-colors ${contentRightPaddingClass} group`}
                style={{
                  backdropFilter: 'saturate(140%) blur(8px)',
                  WebkitBackdropFilter: 'saturate(140%) blur(8px)',
                  background: 'color-mix(in srgb, var(--color-bg) 55%, transparent)',
                  paddingTop: '21px',
                  paddingBottom: '6px',
                }}
              >
                <span className="flex min-h-[30px] items-center justify-center">
                  <span
                    key={floatingTitleText}
                    className="title-fade-in inline-block max-w-[min(960px,100%)] min-w-0 truncate font-display text-base font-semibold text-(--color-text) group-hover:text-(--color-text-2)"
                  >
                    {floatingTitleText}
                  </span>
                </span>
              </button>
            </Tooltip>
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
          <div className={contentLayoutClass}>
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
              <div ref={transcriptRef} className={`space-y-4 ${transcriptOverflowAnchorClass ?? ''}`}>
                {renderItems.map((item) =>
                  item.type === 'message' ? (
                    <div key={item.key} className={chatItemOverflowAnchorClass}>
                      <MessageBubble
                        message={item.message}
                        isStreaming={item.isStreaming}
                        assistantTitle={assistantTitleFor(item.message, item.isStreaming)}
                        onOpenImageTaskImage={handleOpenImageTaskImage}
                      />
                    </div>
                  ) : (
                    <div key={item.key} className={chatItemOverflowAnchorClass}>
                      <ToolActivityCard
                        calls={item.calls}
                        results={item.results}
                        imageTaskByToolCallId={imageTaskByToolCallId}
                        stackItemByOutputId={stackItemByOutputId}
                        stackItemNumberByOutputId={stackItemNumberByOutputId}
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
                    </div>
                  ),
                )}
                {showRunningIndicator ? (
                  <div className={chatItemOverflowAnchorClass}>
                    <AgentRunningIndicator label={t('agentChat.status.running')} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
          {!isEmpty && scrollContentBottomSpacerHeight > 0 ? (
            <div
              aria-hidden
              className="shrink-0 [overflow-anchor:none]"
              style={{ height: scrollContentBottomSpacerHeight }}
            />
          ) : null}
          {!isEmpty ? <div aria-hidden className={`h-px shrink-0 ${bottomAnchorClass}`} /> : null}
        </div>

        <div className={`${contentRightPaddingClass} relative z-50`}>
          {!isEmpty ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-full z-0 h-8 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--color-bg)_72%,transparent)_0%,color-mix(in_srgb,var(--color-bg)_42%,transparent)_42%,transparent_100%)]"
            />
          ) : null}
          <div className={`relative z-10${isEmpty ? ' mx-auto w-full max-w-[980px]' : ''}`}>
            {hasFloatingQueuedMessages ? (
              <div ref={floatingQueuedMessagesRef} className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20">
                <QueuedMessagesCard queuedMessages={queuedMessages} onUpdateQueuedMessage={onUpdateQueuedMessage} />
              </div>
            ) : null}
            {composer}
          </div>
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
