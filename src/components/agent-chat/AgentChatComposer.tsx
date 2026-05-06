import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'

import { AgentGalleryPicker } from './AgentGalleryPicker'
import { AgentOptionsMenu } from './AgentOptionsMenu'
import { ComposerActions } from './ComposerActions'
import { ComposerAttachments } from './ComposerAttachments'
import { ComposerError } from './ComposerError'
import { ComposerScrollButton } from './ComposerScrollButton'
import type { AgentChatMenu } from './types'
import { isImageFile } from './utils'
import { displayNameForLanguage, type AgentChatAttachment, type AgentSkillSummary } from '../../agent'
import {
  agentThinkingLabelKeyForLevel,
  effectiveAgentThinkingLevelForModel,
  type AgentModelConfig,
  type AgentThinkingLevel,
} from '../../config/agentModels'
import type { Provider } from '../../config/models'
import type { ApiKeyStatus } from '../../hooks/useApiKey'
import { useComposerSubmitMode } from '../../hooks/useComposerSubmitMode'
import { useI18n } from '../../i18n'
import { hasPrimaryModifier } from '../../lib/keyboard'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'
import { SkillIcon } from '../SkillIcon'

const MAX_COMPOSER_HEIGHT = 150
const MAX_COMPOSER_HEIGHT_NEW_SESSION = 420
const MOBILE_COMPOSER_AUTOFOCUS_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)'

type SlashCompletionContext = {
  start: number
  end: number
  query: string
}

type SlashSuggestion = {
  kind: 'command' | 'skill'
  name: string
  label: string
  icon?: AgentSkillSummary['icon']
}

function autoResizeComposer(el: HTMLTextAreaElement, maxHeight: number) {
  if (el.value === '') {
    el.style.height = ''
    return
  }

  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 1, maxHeight)}px`
}

function shouldSkipProgrammaticComposerFocus() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_COMPOSER_AUTOFOCUS_QUERY).matches
}

function getSlashCompletionContext(value: string, cursor: number): SlashCompletionContext | null {
  const beforeCursor = value.slice(0, cursor)
  const slashIndex = beforeCursor.lastIndexOf('/')
  if (slashIndex === -1) return null
  const previous = slashIndex === 0 ? '' : beforeCursor[slashIndex - 1]
  if (previous && !/\s/.test(previous)) return null
  const query = beforeCursor.slice(slashIndex + 1)
  if (!/^[A-Za-z0-9-]*$/.test(query)) return null
  return { start: slashIndex, end: cursor, query: query.toLowerCase() }
}

type AgentChatComposerProps = {
  error: string | null
  attachmentError: string | null
  draft: string
  attachments: AgentChatAttachment[]
  skills: AgentSkillSummary[]
  pendingQuestionCount: number
  renderItemCount: number
  nearBottom: boolean
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  autoApproveImageTasks: boolean
  model: AgentModelConfig
  models: AgentModelConfig[]
  thinkingLevel: AgentThinkingLevel
  keyStatuses: Record<Provider, ApiKeyStatus>
  canSend: boolean
  showStop: boolean
  isStreaming: boolean
  isNewSession: boolean
  history: PlaygroundImageMeta[]
  onDraftChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onAddImageAttachment: (image: PlaygroundImage | PlaygroundImageMeta) => void
  onRemoveAttachment: (id: string) => void
  onClearAttachmentError: () => void
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onOpenApiKeys: () => void
  onSend: () => void
  onStop: () => void
  scrollToBottom: () => void
}

export type AgentChatComposerHandle = {
  focus: () => void
  activate: () => void
}

export const AgentChatComposer = forwardRef<AgentChatComposerHandle, AgentChatComposerProps>(function AgentChatComposer(
  {
    error,
    attachmentError,
    draft,
    attachments,
    skills,
    pendingQuestionCount,
    renderItemCount,
    nearBottom,
    openMenu,
    setOpenMenu,
    autoApproveImageTasks,
    model,
    models,
    thinkingLevel,
    keyStatuses,
    canSend,
    showStop,
    isStreaming,
    isNewSession,
    history,
    onDraftChange,
    onAddAttachments,
    onAddImageAttachment,
    onRemoveAttachment,
    onClearAttachmentError,
    onToggleAutoApproveImageTasks,
    onModelChange,
    onThinkingLevelChange,
    onOpenApiKeys,
    onSend,
    onStop,
    scrollToBottom,
  }: AgentChatComposerProps,
  ref,
) {
  const { t, language } = useI18n()
  const { composerSubmitMode } = useComposerSubmitMode()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [composerFocused, setComposerFocused] = useState(false)
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)
  const [cursorOffset, setCursorOffset] = useState(draft.length)
  const maxComposerHeight = isNewSession ? MAX_COMPOSER_HEIGHT_NEW_SESSION : MAX_COMPOSER_HEIGHT
  const effectiveThinkingLevel = model.supportsThinking
    ? effectiveAgentThinkingLevelForModel(model, thinkingLevel)
    : 'off'
  const effectiveThinkingLabel = t(agentThinkingLabelKeyForLevel(model, effectiveThinkingLevel))
  const slashContext = getSlashCompletionContext(draft, Math.min(cursorOffset, draft.length))
  const slashSuggestions: SlashSuggestion[] = slashContext
    ? [
        {
          kind: 'command' as const,
          name: 'new',
          label: t('agentChat.header.newConversation'),
        },
        ...skills
          .filter((skill) => skill.enabled)
          .map((skill) => ({
            kind: 'skill' as const,
            name: skill.name,
            label: displayNameForLanguage(skill, language),
            icon: skill.icon,
          })),
      ].filter((suggestion) => {
        if (!slashContext.query) return true
        return (
          suggestion.name.toLowerCase().startsWith(slashContext.query) ||
          suggestion.label.toLowerCase().startsWith(slashContext.query)
        )
      })
    : []
  const showSlashSuggestions =
    composerFocused && openMenu === null && slashContext !== null && slashSuggestions.length > 0
  const activeSlashIndex = Math.min(slashActiveIndex, Math.max(0, slashSuggestions.length - 1))

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (shouldSkipProgrammaticComposerFocus()) return
        textareaRef.current?.focus({ preventScroll: true })
      },
      activate: () => {
        const textarea = textareaRef.current
        if (!textarea || shouldSkipProgrammaticComposerFocus()) return
        const cursor = textarea.value.length
        textarea.focus({ preventScroll: true })
        textarea.setSelectionRange(cursor, cursor)
        setCursorOffset(cursor)
      },
    }),
    [],
  )

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeComposer(textareaRef.current, maxComposerHeight)
  }, [draft, maxComposerHeight])

  useLayoutEffect(() => {
    const composer = composerRef.current
    const textarea = textareaRef.current
    if (!composer || !textarea || typeof ResizeObserver === 'undefined') return

    let frame = 0
    let previousWidth = composer.getBoundingClientRect().width
    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width
      if (Math.abs(nextWidth - previousWidth) < 0.5) return
      previousWidth = nextWidth
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => autoResizeComposer(textarea, maxComposerHeight))
    })

    resizeObserver.observe(composer)
    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  }, [maxComposerHeight])

  const addFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(isImageFile)
    if (imageFiles.length > 0) onAddAttachments(imageFiles)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files ?? [])
    event.target.value = ''
  }

  const applySlashSuggestion = (suggestion: SlashSuggestion) => {
    const textarea = textareaRef.current
    const context = getSlashCompletionContext(draft, textarea?.selectionStart ?? draft.length)
    if (!context) return
    const insertion = `/${suggestion.name} `
    const nextDraft = `${draft.slice(0, context.start)}${insertion}${draft.slice(context.end).replace(/^\s+/, '')}`
    const cursor = context.start + insertion.length
    onDraftChange(nextDraft)
    setSlashActiveIndex(0)
    setCursorOffset(cursor)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      if (!shouldSkipProgrammaticComposerFocus()) textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (showSlashSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashActiveIndex((index) => (index + 1) % slashSuggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashActiveIndex((index) => (index - 1 + slashSuggestions.length) % slashSuggestions.length)
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        applySlashSuggestion(slashSuggestions[activeSlashIndex])
        return
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        applySlashSuggestion(slashSuggestions[activeSlashIndex])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setComposerFocused(false)
        return
      }
    }
    if (event.key === 'Enter' && hasPrimaryModifier(event)) {
      event.preventDefault()
      if (canSend) onSend()
      return
    }
    if (
      composerSubmitMode === 'enter' &&
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
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
        <div
          ref={composerRef}
          className="prompt-wrap relative rounded-[12px] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge)] focus-within:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)]"
        >
          <AgentOptionsMenu
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            autoApproveImageTasks={autoApproveImageTasks}
            model={model}
            models={models}
            effectiveThinkingLevel={effectiveThinkingLevel}
            keyStatuses={keyStatuses}
            onToggleAutoApproveImageTasks={onToggleAutoApproveImageTasks}
            onModelChange={onModelChange}
            onThinkingLevelChange={onThinkingLevelChange}
            onOpenApiKeys={onOpenApiKeys}
          />

          <SlashCommandSuggestions
            open={showSlashSuggestions}
            suggestions={slashSuggestions}
            activeIndex={activeSlashIndex}
            onPick={applySlashSuggestion}
          />

          <ComposerAttachments attachments={attachments} onRemoveAttachment={onRemoveAttachment} />

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => {
                setSlashActiveIndex(0)
                setCursorOffset(event.target.selectionStart)
                onDraftChange(event.target.value)
                autoResizeComposer(event.target, maxComposerHeight)
              }}
              onKeyDown={handleKeyDown}
              onSelect={(event) => setCursorOffset(event.currentTarget.selectionStart)}
              onFocus={(event) => {
                setComposerFocused(true)
                setCursorOffset(event.currentTarget.selectionStart)
              }}
              onBlur={() => setComposerFocused(false)}
              placeholder={
                pendingQuestionCount > 0
                  ? t('agentChat.composer.placeholder.questionPending')
                  : isStreaming
                    ? t('agentChat.composer.placeholder.streaming')
                    : t('agentChat.composer.placeholder.default')
              }
              rows={1}
              style={{ maxHeight: `${maxComposerHeight}px` }}
              className="block min-h-[44px] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[16px] leading-[1.55] text-(--color-text) focus:outline-none md:text-base"
            />
          </div>

          <ComposerActions
            fileInputRef={fileInputRef}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            model={model}
            effectiveThinkingLevel={effectiveThinkingLevel}
            effectiveThinkingLabel={effectiveThinkingLabel}
            autoApproveImageTasks={autoApproveImageTasks}
            pendingQuestionCount={pendingQuestionCount}
            canSend={canSend}
            showStop={showStop}
            isStreaming={isStreaming}
            hasGalleryImages={history.length > 0}
            onFileChange={handleFileChange}
            onOpenGalleryPicker={() => setOpenMenu('galleryPicker')}
            onSend={onSend}
            onStop={onStop}
          />
        </div>
      </div>

      <AgentGalleryPicker
        open={openMenu === 'galleryPicker'}
        history={history}
        attachedImageIds={new Set(attachments.map((item) => item.id))}
        onPick={onAddImageAttachment}
        onClose={() => setOpenMenu(null)}
      />
    </>
  )
})

function SlashCommandSuggestions({
  open,
  suggestions,
  activeIndex,
  onPick,
}: {
  open: boolean
  suggestions: SlashSuggestion[]
  activeIndex: number
  onPick: (suggestion: SlashSuggestion) => void
}) {
  if (!open) return null
  return (
    <div
      data-agent-menu
      className="popover-pop absolute bottom-[calc(100%+8px)] left-2 z-50 w-[320px] max-w-[calc(100vw-32px)] origin-bottom-left rounded-[var(--radius-lg)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.kind}-${suggestion.name}`}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(suggestion)
          }}
          data-active={index === activeIndex || undefined}
          className="flex h-8 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-normal text-(--color-text-2) transition-colors hover:bg-(--color-surface-2) data-[active]:bg-(--color-surface-2) data-[active]:text-(--color-text)"
        >
          {suggestion.kind === 'skill' && suggestion.icon ? (
            <SkillIcon name={suggestion.icon} size={13} strokeWidth={2} className="shrink-0 text-(--color-accent)" />
          ) : (
            <Icon name="plus" size={13} className="shrink-0 text-(--color-accent)" />
          )}
          <span className="mono min-w-0 flex-1 truncate text-[12px] font-normal text-(--color-text)">
            /{suggestion.name}
          </span>
          <span className="max-w-[150px] shrink-0 truncate text-right text-sm font-normal text-(--color-text-4)">
            {suggestion.label}
          </span>
        </button>
      ))}
    </div>
  )
}
