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
import { MessageBubble } from './agent-chat/MessageBubble'
import { ToolActivityCard } from './agent-chat/ToolActivityCard'
import type { AgentChatMenu } from './agent-chat/types'
import {
  buildChatRenderItems,
  formatSessionTime,
  hasRenderableMessageContent,
  isImageFile,
  parseDraggedPlaygroundImage,
} from './agent-chat/utils'
import { Icon } from './Icon'
import { SkillIcon } from './SkillIcon'

type Props = {
  messages: AgentMessage[]
  messageMetadata: WeakMap<AgentMessage, AgentSessionMessageMetadata>
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
  }, [visibleMessages.length, streamingMessage, isStreaming])

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
            {renderItems.length === 0 ? (
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
            renderItemCount={renderItems.length}
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

function AgentSessionSidebar({
  sessions,
  currentSessionId,
  sessionsLoading,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onSwitchToGenerate,
  onOpenSettings,
}: {
  sessions: AgentSessionSummary[]
  currentSessionId: string | null
  sessionsLoading: boolean
  onNewSession: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onSwitchToGenerate?: () => void
  onOpenSettings: () => void
}) {
  const { t } = useI18n()

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col bg-(--color-bg) px-4 py-6 shadow-[inset_-1px_0_0_var(--ring-edge-soft)] md:flex">
      <div className="mb-5 flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
          {t('app.name')}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn"
          title={t('common.settings')}
          aria-label={t('common.settings')}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>

      <div
        className="segmented mb-4 w-full"
        style={{ ['--seg-count' as string]: 2, ['--seg-index' as string]: 1 }}
        aria-label={t('input.mode.aria')}
      >
        <button type="button" data-active={false} onClick={onSwitchToGenerate} disabled={!onSwitchToGenerate}>
          <span>{t('input.mode.generate')}</span>
        </button>
        <button type="button" data-active>
          <span>{t('common.agent')}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onNewSession}
        className="mb-7 flex h-[34px] w-full items-center gap-2 rounded-[var(--radius-md)] bg-(--color-surface-2) px-3 text-left text-base font-medium text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] transition-[background-color,color] hover:bg-(--color-surface-3) hover:text-(--color-text) focus-visible:bg-(--color-surface-3) focus-visible:text-(--color-text) focus-visible:outline-none"
      >
        <Icon name="plus" size={13} />
        <span>{t('agentChat.header.newConversation')}</span>
      </button>

      <div className="mb-2 flex items-center gap-2 px-1">
        <div className="label min-w-0 flex-1 truncate">{t('agentChat.header.allConversations')}</div>
        <span className="text-xs text-(--color-text-4) tabular-nums">{sessions.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {sessionsLoading ? (
          <div className="px-2 py-3 text-sm text-(--color-text-3)">{t('agentChat.header.loadingSessions')}</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-[var(--radius-md)] px-2 py-3 text-sm text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
            {t('agentChat.header.emptyHistory')}
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => {
              const active = session.id === currentSessionId
              return (
                <div
                  key={session.id}
                  className={`group relative flex h-[32px] items-center rounded-[var(--radius-md)] px-2 transition-[background-color,box-shadow] ${
                    active
                      ? 'bg-(--color-accent-wash) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
                      : 'hover:bg-(--color-surface-2)'
                  }`}
                >
                  {active && (
                    <span className="absolute top-1.5 bottom-1.5 left-1 w-0.5 rounded-[var(--radius-xs)] bg-(--color-accent)" />
                  )}
                  <button
                    type="button"
                    onClick={() => onSwitchSession(session.id)}
                    className="min-w-0 flex-1 bg-transparent pl-2 text-left"
                    aria-current={active ? 'true' : undefined}
                    title={session.title}
                  >
                    <span
                      className={`block truncate text-base ${active ? 'font-semibold text-(--color-text)' : 'text-(--color-text-2)'}`}
                    >
                      {session.title}
                    </span>
                  </button>
                  <span
                    className={`ml-2 shrink-0 text-sm ${active ? 'text-(--color-text-3)' : 'text-(--color-text-4)'}`}
                  >
                    {formatSessionTime(session.updatedAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    className={`absolute right-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-(--color-text-4) opacity-0 transition-opacity hover:bg-(--color-surface-3) hover:text-(--color-danger) group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none ${
                      active
                        ? 'bg-(--color-accent-wash) shadow-[-10px_0_12px_var(--color-accent-wash)]'
                        : 'bg-(--color-surface-2) shadow-[-10px_0_12px_var(--color-surface-2)]'
                    }`}
                    aria-label={t('agentChat.header.deleteConversation')}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

function isDrawingSkill(skill: AgentSkillSummary): boolean {
  if (!skill.enabled) return false
  const text = [skill.name, skill.agentDescription, skill.displayDescription['zh-CN'], skill.displayDescription.en]
    .join(' ')
    .toLowerCase()
  return /image|generate|generation|cover|sketch|illustration|draw|drawing|visual|nano.?banana|生图|画图|绘图|插画|封面|视觉/.test(
    text,
  )
}

function DrawingSkillStarters({
  skills,
  onPick,
}: {
  skills: AgentSkillSummary[]
  onPick: (skill: AgentSkillSummary) => void
}) {
  const { t, language } = useI18n()
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="label mb-2 text-center">{t('agentChat.empty.skillStarter.title')}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {skills.map((skill) => {
          const description = skill.displayDescriptionKey
            ? t(skill.displayDescriptionKey)
            : skill.displayDescription[language] || skill.displayDescription['zh-CN'] || skill.displayDescription.en
          const hasDisplayName = Boolean(skill.displayNameKey)
          const displayName = hasDisplayName ? t(skill.displayNameKey!) : skill.name
          return (
            <button
              key={skill.name}
              type="button"
              onClick={() => onPick(skill)}
              className="group max-w-[250px] rounded-[var(--radius-md)] bg-(--color-surface) px-3 py-2 text-left shadow-[0_0_0_1px_var(--ring-edge-soft),var(--shadow-lift)] transition-[box-shadow,background-color,transform] hover:-translate-y-px hover:bg-(--color-surface-2) hover:shadow-[0_0_0_1px_var(--ring-edge-strong),var(--shadow-float)]"
            >
              <span className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-(--color-accent)"
                  style={{ background: 'var(--color-accent-wash-2)' }}
                >
                  <SkillIcon name={skill.icon} size={11} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[12px] ${hasDisplayName ? 'font-medium' : 'mono font-semibold'} text-(--color-text-2) group-hover:text-(--color-accent)`}
                  >
                    {displayName}
                  </span>
                  <span className="mt-0.5 block overflow-hidden text-[12px] leading-[1.35] text-(--color-text-3) [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {description}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
