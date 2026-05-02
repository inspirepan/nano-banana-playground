import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useState, useRef, useCallback, useLayoutEffect, type ReactNode } from 'react'

import { AgentChatPanel } from './AgentChatPanel'
import { AspectRatioSelector } from './AspectRatioSelector'
import { ChipGroup } from './ChipGroup'
import { BrandIcon, Icon } from './Icon'
import { ReferenceImageUpload } from './ReferenceImageUpload'
import { Tooltip } from './Tooltip'
import type {
  AgentChatAttachment,
  AgentImageTask,
  AgentPendingQuestion,
  AgentSessionSummary,
  AskUserQuestionAnswer,
} from '../agent'
import type { AgentSessionMessageMetadata } from '../agent/sessionTypes'
import type { AgentModelConfig, AgentThinkingLevel } from '../config/agentModels'
import {
  MODEL_CONFIGS,
  getModelShortLabel,
  type ModelConfig,
  type ModelOption,
  type ModelToggleOption,
  type Provider,
} from '../config/models'
import { getProviderConfig } from '../config/providers'
import { useMountEffect, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import type { GenerationJob, InputMode } from '../hooks/usePlayground'
import { useI18n } from '../i18n'
import { isHeifFile } from '../lib/fileToImage'
import { openAISize } from '../lib/openai'
import { getPricePerImage } from '../lib/pricing'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

const INPUT_LABEL_CLASS = 'text-base font-semibold tracking-normal text-(--color-text-3)'

// ——— Section helper ———
function Section({
  label,
  right,
  hint,
  children,
}: {
  label: string
  right?: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-[18px]">
      <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
        <div className="flex items-center gap-2">
          <span className={INPUT_LABEL_CLASS}>{label}</span>
          {hint && <span className="text-sm text-(--color-text-3)">{hint}</span>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// --- Auto-resize textarea ---
const TEXTAREA_MIN_HEIGHT = 120
const TEXTAREA_MAX_HEIGHT = 360

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function autoResizeTextarea(el: HTMLTextAreaElement) {
  const scrollContainer = findScrollableAncestor(el)
  const prevScroll = scrollContainer?.scrollTop
  const borderHeight = el.offsetHeight - el.clientHeight
  el.style.height = 'auto'
  const target = Math.max(el.scrollHeight + borderHeight + 1, TEXTAREA_MIN_HEIGHT)
  const capped = Math.min(target, TEXTAREA_MAX_HEIGHT)
  el.style.height = `${capped}px`
  el.style.overflowY = target > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
  if (scrollContainer && prevScroll !== undefined) scrollContainer.scrollTop = prevScroll
}

// Group model options so adjacent toggle options sharing a `group` render
// inside one Section; select options and ungrouped toggles render alone.
type OptionsBlock =
  | { kind: 'single'; option: ModelOption }
  | { kind: 'toggles'; label: string; hint?: string; options: ModelToggleOption[] }

function buildOptionBlocks(opts: ModelOption[]): OptionsBlock[] {
  const blocks: OptionsBlock[] = []
  let i = 0
  while (i < opts.length) {
    const head = opts[i]
    if (head.type === 'toggle' && head.group) {
      const group: ModelToggleOption[] = [head]
      let j = i + 1
      while (j < opts.length) {
        const next = opts[j]
        if (next.type !== 'toggle' || next.group !== head.group) break
        group.push(next)
        j++
      }
      blocks.push({
        kind: 'toggles',
        label: head.groupLabel ?? head.label,
        hint: head.hint,
        options: group,
      })
      i = j
    } else {
      blocks.push({ kind: 'single', option: head })
      i++
    }
  }
  return blocks
}

function getOptionSummaryLabels(model: ModelConfig, values: Record<string, unknown>) {
  const labels: string[] = []

  for (const option of model.options ?? []) {
    const value = values[option.id]
    if (value === option.default) continue

    if (option.type === 'toggle') {
      if (value === true) labels.push(option.label)
      continue
    }

    if (typeof value !== 'string') continue
    const choice = option.choices.find((item) => item.value === value)
    if (!choice || choice.value === option.default) continue
    labels.push(`${option.label} ${choice.label}`)
  }

  return labels
}

function OptionSection({
  option,
  value,
  onChange,
}: {
  option: ModelOption
  value: unknown
  onChange: (v: unknown) => void
}) {
  const { t } = useI18n()

  if (option.type === 'select') {
    const current = typeof value === 'string' ? value : option.default
    const values = option.choices.map((c) => c.value)
    const labelFor = (v: string) => option.choices.find((c) => c.value === v)?.label ?? v
    const tooltipFor = (v: string) => option.choices.find((c) => c.value === v)?.tooltip
    return (
      <Section label={option.label} hint={option.hint}>
        <ChipGroup
          options={values}
          value={current}
          onChange={onChange}
          mono={false}
          columns={values.length}
          renderOption={(v) => <span>{labelFor(v)}</span>}
          tooltipFor={tooltipFor}
        />
      </Section>
    )
  }
  // Single ungrouped toggle: render as a one-chip row.
  const active = value === true
  const button = (
    <button type="button" className="chip justify-center w-full" data-active={active} onClick={() => onChange(!active)}>
      <span>{active ? t('input.option.enabled') : t('input.option.disabled')}</span>
    </button>
  )
  return (
    <Section label={option.label} hint={option.hint}>
      {option.tooltip ? <Tooltip text={option.tooltip}>{button}</Tooltip> : button}
    </Section>
  )
}

function ToggleGroupSection({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string
  hint?: string
  options: ModelToggleOption[]
  values: Record<string, unknown>
  onChange: (id: string, v: unknown) => void
}) {
  return (
    <Section label={label} hint={hint}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((opt) => {
          const active = values[opt.id] === true
          const button = (
            <button
              type="button"
              role="checkbox"
              aria-checked={active}
              className="chip justify-center w-full"
              data-active={active}
              onClick={() => onChange(opt.id, !active)}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-[var(--radius-xs)] transition-colors"
                style={{
                  background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                  boxShadow: active ? 'inset 0 0 0 1px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge)',
                }}
              >
                {active && <Icon name="check" size={9} strokeWidth={3} style={{ color: 'var(--color-accent-fg)' }} />}
              </span>
              <span>{opt.label}</span>
            </button>
          )
          return opt.tooltip ? (
            <Tooltip key={opt.id} text={opt.tooltip}>
              {button}
            </Tooltip>
          ) : (
            <div key={opt.id}>{button}</div>
          )
        })}
      </div>
    </Section>
  )
}

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
  agentIsStreaming: boolean
  agentError: string | null
  agentDraft: string
  agentAttachments: AgentChatAttachment[]
  agentAttachmentError: string | null
  agentSessions: AgentSessionSummary[]
  currentAgentSessionId: string | null
  agentSessionsLoading: boolean
  autoApproveAgentImageTasks: boolean
  agentImageTasks: AgentImageTask[]
  agentPendingQuestions: AgentPendingQuestion[]
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
  onSendAgentMessage: () => void
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
  agentIsStreaming,
  agentError,
  agentDraft,
  agentAttachments,
  agentAttachmentError,
  agentSessions,
  currentAgentSessionId,
  agentSessionsLoading,
  autoApproveAgentImageTasks,
  agentImageTasks,
  agentPendingQuestions,
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
  const { t } = useI18n()
  const maxRef = model.maxReferenceImages + model.maxCharacterImages
  const pricePerImage = getPricePerImage(model, resolution, aspectRatio, options)
  const optionBlocks = buildOptionBlocks(model.options ?? [])

  const hasPrompt = prompt.trim() !== ''
  const canGenerate = apiKey.trim() !== '' && hasPrompt

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // --- Undo/redo history ---
  const historyRef = useRef({ entries: [prompt], index: 0 })
  const debounceRef = useRef<number>(0)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const syncHistoryState = useCallback(() => {
    const h = historyRef.current
    setHistoryState({
      canUndo: h.index > 0,
      canRedo: h.index < h.entries.length - 1,
    })
  }, [])

  const pushHistory = useCallback(
    (value: string) => {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        const h = historyRef.current
        if (h.entries[h.index] === value) return
        h.entries = h.entries.slice(0, h.index + 1)
        h.entries.push(value)
        h.index = h.entries.length - 1
        syncHistoryState()
      }, 500)
    },
    [syncHistoryState],
  )

  const handleHistoryUndo = useCallback(() => {
    const h = historyRef.current
    if (h.index <= 0) return
    window.clearTimeout(debounceRef.current)
    if (h.entries[h.index] !== prompt) {
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(prompt)
      h.index = h.entries.length - 1
    }
    h.index--
    onPromptChange(h.entries[h.index])
    syncHistoryState()
  }, [prompt, onPromptChange, syncHistoryState])

  const handleHistoryRedo = useCallback(() => {
    const h = historyRef.current
    if (h.index >= h.entries.length - 1) return
    h.index++
    onPromptChange(h.entries[h.index])
    syncHistoryState()
  }, [onPromptChange, syncHistoryState])

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeTextarea(textareaRef.current)
  }, [prompt])

  useMountEffect(() => () => {
    window.clearTimeout(debounceRef.current)
  })

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

  // --- Drag-and-drop ---
  const [dragOver, setDragOver] = useState(false)
  const dragCountRef = useRef(0)

  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    if (dragCountRef.current === 1) setDragOver(true)
  }, [])

  const handlePanelDragLeave = useCallback(() => {
    dragCountRef.current--
    if (dragCountRef.current === 0) setDragOver(false)
  }, [])

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handlePanelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCountRef.current = 0
      setDragOver(false)

      const imageJson = e.dataTransfer.getData('application/x-playground-image')
      if (imageJson) {
        try {
          const img: PlaygroundImage = JSON.parse(imageJson)
          onAddReferenceImage(img)
          return
        } catch {
          /* fall through */
        }
      }

      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || isHeifFile(f))
      if (files.length > 0) onAddReferenceImages(files)
    },
    [onAddReferenceImages, onAddReferenceImage],
  )

  const handlePanelPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const imageFiles = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith('image/'))
        .map((item, index) => {
          const file = item.getAsFile()
          if (!file) return null
          if (file.name) return file
          const ext = file.type.split('/')[1] || 'png'
          return new File([file], `pasted-image-${Date.now()}-${index + 1}.${ext}`, {
            type: file.type,
            lastModified: Date.now(),
          })
        })
        .filter((file): file is File => file !== null)

      if (imageFiles.length === 0) return
      e.preventDefault()
      onAddReferenceImages(imageFiles)
    },
    [onAddReferenceImages],
  )

  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null
  const optionSummaryLabels = getOptionSummaryLabels(model, options)
  const optionSummary = optionSummaryLabels.join(t('input.summary.optionSeparator'))

  const currentKeyStatus = keyStatuses[model.provider]
  const isCurrentKeyMissing = currentKeyStatus === 'empty' || apiKey.trim() === ''
  const providerLabel = getProviderConfig(model.provider).shortLabel
  const useWideAgentSidebar = inputMode === 'agent' && showAgentSessionSidebar

  return (
    <div
      ref={panelRef}
      onDragEnter={inputMode === 'generate' ? handlePanelDragEnter : undefined}
      onDragLeave={inputMode === 'generate' ? handlePanelDragLeave : undefined}
      onDragOver={inputMode === 'generate' ? handlePanelDragOver : undefined}
      onDrop={inputMode === 'generate' ? handlePanelDrop : undefined}
      onPaste={inputMode === 'generate' ? handlePanelPaste : undefined}
      className={
        inputMode === 'agent'
          ? useWideAgentSidebar
            ? 'relative flex min-h-full flex-col p-0 transition-[padding] duration-[220ms] ease-[cubic-bezier(0.22,0.8,0.4,1)] motion-reduce:transition-none'
            : 'relative flex min-h-full flex-col px-[var(--agent-panel-padding-x,18px)] py-[18px] transition-[padding] duration-[220ms] ease-[cubic-bezier(0.22,0.8,0.4,1)] motion-reduce:transition-none'
          : 'relative px-[18px] py-[18px] pb-[120px]'
      }
    >
      {showHeader && !useWideAgentSidebar && (
        <div className="mb-[18px] flex min-h-[30px] items-center gap-2.5">
          <div className="min-w-0 font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
            {t('app.name')}
          </div>
          <div className="flex-1" />
          {showInputModeSwitcher && (
            <div
              className="segmented w-[172px] shrink-0"
              style={{
                ['--seg-count' as string]: 2,
                ['--seg-index' as string]: inputMode === 'generate' ? 0 : 1,
              }}
              aria-label={t('input.mode.aria')}
            >
              <button
                type="button"
                data-active={inputMode === 'generate'}
                onClick={() => onInputModeChange('generate')}
              >
                <span>{t('input.mode.generate')}</span>
              </button>
              <button type="button" data-active={inputMode === 'agent'} onClick={() => onInputModeChange('agent')}>
                <span>{t('common.agent')}</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onOpenApiKeys}
            className="icon-btn"
            title={t('common.settings')}
            aria-label={t('common.settings')}
          >
            <Icon name="settings" size={14} />
          </button>
        </div>
      )}

      {inputMode === 'agent' ? (
        <AgentChatPanel
          messages={agentMessages}
          messageMetadata={agentMessageMetadata}
          streamingMessage={agentStreamingMessage}
          isStreaming={agentIsStreaming}
          error={agentError}
          draft={agentDraft}
          attachments={agentAttachments}
          attachmentError={agentAttachmentError}
          sessions={agentSessions}
          currentSessionId={currentAgentSessionId}
          sessionsLoading={agentSessionsLoading}
          autoApproveImageTasks={autoApproveAgentImageTasks}
          imageTasks={agentImageTasks}
          pendingQuestions={agentPendingQuestions}
          history={history}
          generationJobs={generationJobs}
          model={agentModel}
          models={agentModels}
          thinkingLevel={agentThinkingLevel}
          keyStatuses={keyStatuses}
          showSessionSidebar={useWideAgentSidebar}
          onOpenApiKeys={onOpenApiKeys}
          onDraftChange={onAgentDraftChange}
          onAddAttachments={onAddAgentAttachments}
          onAddImageAttachment={onAddAgentImageAttachment}
          onRemoveAttachment={onRemoveAgentAttachment}
          onClearAttachmentError={onClearAgentAttachmentError}
          onNewSession={onCreateAgentSession}
          onSwitchSession={onSwitchAgentSession}
          onDeleteSession={onDeleteAgentSession}
          onSwitchToGenerate={() => onInputModeChange('generate')}
          onToggleAutoApproveImageTasks={onToggleAutoApproveAgentImageTasks}
          onApproveImageTask={onApproveAgentImageTask}
          onCancelImageTask={onCancelAgentImageTask}
          onSubmitQuestionAnswers={onSubmitAgentQuestionAnswers}
          onCancelQuestion={onCancelAgentQuestion}
          onFocusImageTask={onFocusAgentImageTask}
          onModelChange={onAgentModelChange}
          onThinkingLevelChange={onAgentThinkingLevelChange}
          onSend={onSendAgentMessage}
          onStop={onStopAgentMessage}
        />
      ) : (
        <>
          {isCurrentKeyMissing && (
            <button
              type="button"
              onClick={onOpenApiKeys}
              className="card mb-[18px] flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
              style={{
                color: 'var(--color-danger)',
                background: 'var(--color-danger-soft)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 24%, transparent)',
              }}
            >
              <Icon name="alert_circle" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span className="flex-1">
                <span className="block text-base font-medium">{t('input.apiKey.missingTitle')}</span>
                <span className="mt-0.5 block text-sm leading-[1.45] opacity-80">
                  {t('input.apiKey.missingBody', { model: model.name, provider: providerLabel })}
                </span>
              </span>
              <span className="chip danger shrink-0 text-sm" style={{ height: 22, padding: '0 7px' }}>
                {t('input.apiKey.configure')}
              </span>
            </button>
          )}

          {/* MODEL segmented */}
          <Section
            label={t('common.model')}
            right={<span className="mono text-sm text-(--color-text-4)">{model.apiModel}</span>}
          >
            <div
              className="segmented"
              style={{
                ['--seg-count' as string]: MODEL_CONFIGS.length,
                ['--seg-index' as string]: Math.max(
                  0,
                  MODEL_CONFIGS.findIndex((m) => m.id === model.id),
                ),
              }}
            >
              {MODEL_CONFIGS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-active={model.id === m.id}
                  onClick={() => onSwitchModel(m.id)}
                  title={m.name}
                >
                  <BrandIcon name={getProviderConfig(m.provider).brandIcon} size={12} />
                  <span>{getModelShortLabel(m)}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Prompt */}
          <Section
            label={t('input.prompt.label')}
            right={
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={handleHistoryUndo}
                  disabled={!historyState.canUndo}
                  title={t('input.prompt.undo')}
                  aria-label={t('input.prompt.undo')}
                  className="icon-btn"
                >
                  <Icon name="undo" size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleHistoryRedo}
                  disabled={!historyState.canRedo}
                  title={t('input.prompt.redo')}
                  aria-label={t('input.prompt.redo')}
                  className="icon-btn"
                >
                  <Icon name="redo" size={13} />
                </button>
              </div>
            }
          >
            <div className="prompt-wrap">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => {
                  onPromptChange(e.target.value)
                  pushHistory(e.target.value)
                  autoResizeTextarea(e.target)
                }}
                placeholder={t('input.prompt.placeholder')}
                rows={1}
                className="block w-full bg-transparent px-3 py-2.5 text-[16px] md:text-base leading-[1.55] resize-none focus:outline-none"
              />
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-(--color-text-3) shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
                <span className="text-sm text-(--color-text-3)">
                  {t('input.prompt.charCount', { count: prompt.length })}
                </span>
                <div className="flex-1" />
                {prompt.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onPromptChange('')
                      pushHistory('')
                      // Defer until after the textarea has shrunk so the scroll
                      // target reflects the final layout, not the pre-clear size.
                      requestAnimationFrame(() => {
                        const el = textareaRef.current
                        if (!el) return
                        el.focus({ preventScroll: true })
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      })
                    }}
                    title={t('input.prompt.clear')}
                    aria-label={t('input.prompt.clear')}
                    className="inline-flex items-center gap-1 bg-transparent border-0 p-0 text-sm text-(--color-text-4) hover:text-(--color-text-2) transition-colors"
                  >
                    <Icon name="close" size={11} />
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* Resolution chips */}
          <Section label={t('input.resolution.label')}>
            <div className="tabular-nums">
              <ChipGroup
                options={model.resolutions}
                value={resolution}
                onChange={onResolutionChange}
                mono={false}
                columns={model.resolutions.length}
              />
            </div>
          </Section>

          {/* Aspect ratio grid */}
          <AspectRatioSelector
            options={model.aspectRatios}
            value={aspectRatio}
            resolution={resolution}
            onChange={onAspectRatioChange}
            labelClassName={INPUT_LABEL_CLASS}
            pixelLabel={
              model.provider === 'openai' ? (ratio, res) => openAISize(res, ratio).replace('x', '×') : undefined
            }
          />

          <div className="h-[18px] " />

          {/* Model-declared options (quality, search tools, thinking level, ...) */}
          {optionBlocks.map((block, idx) => {
            if (block.kind === 'single') {
              return (
                <OptionSection
                  key={block.option.id}
                  option={block.option}
                  value={options[block.option.id]}
                  onChange={(v) => onOptionChange(block.option.id, v)}
                />
              )
            }
            return (
              <ToggleGroupSection
                key={`group-${idx}`}
                label={block.label}
                hint={block.hint}
                options={block.options}
                values={options}
                onChange={onOptionChange}
              />
            )
          })}

          {/* Reference images */}
          <div className="mb-[18px]">
            <ReferenceImageUpload
              images={referenceImages}
              maxTotal={maxRef}
              dragOver={dragOver}
              error={referenceImageError}
              labelClassName={INPUT_LABEL_CLASS}
              onAdd={onAddReferenceImages}
              onRemove={onRemoveReferenceImage}
              onClearAll={onClearAllReferences}
              onClearError={onClearReferenceImageError}
            />
          </div>

          {/* Batch count */}
          <Section label={t('input.count.label')}>
            <div
              className="grid gap-1.5 tabular-nums"
              style={{ gridTemplateColumns: `repeat(${model.maxBatchCount}, 1fr)` }}
            >
              {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip justify-center"
                  data-active={batchCount === n}
                  onClick={() => onBatchCountChange(n)}
                >
                  <span>×{n}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* CTA */}
          <div className="relative">
            <div className="mb-2.5 pt-2.5 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
              <div className="flex items-baseline justify-between mb-2">
                <span className={INPUT_LABEL_CLASS}>{t('input.summary.title')}</span>
                {estimatedCost !== null && (
                  <span className="text-base text-(--color-text-2) tabular-nums">≈ ${estimatedCost.toFixed(3)}</span>
                )}
              </div>
              <dl className="grid grid-cols-[52px_1fr] gap-x-3 gap-y-[5px] text-sm leading-[1.5]">
                <dt className="text-(--color-text-3)">{t('common.model')}</dt>
                <dd className="text-(--color-text-2)">{model.name}</dd>
                <dt className="text-(--color-text-3)">{t('input.summary.size')}</dt>
                <dd className="text-(--color-text-2) tabular-nums">
                  <span>{resolution}</span>
                  <span className="mx-1.5 text-(--color-text-4)">/</span>
                  <span>{aspectRatio}</span>
                </dd>
                <dt className="text-(--color-text-3)">{t('input.count.label')}</dt>
                <dd className="text-(--color-text-2) tabular-nums">
                  <span>×{batchCount}</span>
                </dd>
                {referenceImages.length > 0 && (
                  <>
                    <dt className="text-(--color-text-3)">{t('input.summary.referenceImages')}</dt>
                    <dd className="text-(--color-text-2) tabular-nums">
                      {t('input.summary.referenceImageCount', { count: referenceImages.length })}
                    </dd>
                  </>
                )}
                {optionSummaryLabels.length > 0 && (
                  <>
                    <dt className="text-(--color-text-3)">{t('input.summary.options')}</dt>
                    <dd className="text-(--color-text-2)">{optionSummary}</dd>
                  </>
                )}
              </dl>
            </div>
            <button type="button" onClick={() => onGenerate()} disabled={!canGenerate} className="cta w-full">
              <Icon name="wand" size={13} strokeWidth={1.8} />
              <span>{t('input.generateWithModel', { model: model.name, count: batchCount })}</span>
              <span className="flex-1" />
              <span className="flex gap-0.5">
                <kbd>⌘</kbd>
                <kbd>⏎</kbd>
              </span>
            </button>
            {!apiKey.trim() && (
              <div className="mt-1.5 text-sm text-(--color-text-3) text-center">{t('input.apiKey.required')}</div>
            )}
          </div>
        </>
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
