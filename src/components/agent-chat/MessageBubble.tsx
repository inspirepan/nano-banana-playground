import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useRef, useState } from 'react'

import { AgentThinking } from './AgentThinking'
import { formatAgentError } from './errorText'
import { MarkdownText } from './MarkdownText'
import { classifySystemEvent, summarizeSystemEventParts } from './SystemEvent'
import { TruncatedText } from './TruncatedText'
import {
  agentMessageError,
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  agentMessageThinking,
  agentMessageToolCalls,
  imageDataUrl,
  stripSystemDirectives,
} from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

export type AgentTaskUsageStats = {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  thinking: number
  contextTokens: number
  contextWindow: number
  cost: number
  costInput: number
  costCacheRead: number
  costCacheWrite: number
  costOutput: number
}

function formatTokenCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count < 1000) return Math.round(count).toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  if (count < 1000000) return `${Math.round(count / 1000)}k`
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`
  return `${Math.round(count / 1000000)}M`
}

function formatUsd(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return '$0'
  if (cost < 0.001) return '<$0.001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

function formatContextValue(tokens: number, contextWindow: number): string {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return formatTokenCount(tokens)
  return `${formatTokenCount(tokens)}/${formatTokenCount(contextWindow)}`
}

function formatContextPercent(tokens: number, contextWindow: number): string | null {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null
  const percent = Math.min(999, (tokens / contextWindow) * 100)
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent).toString()}%`
}

function UsageDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(3.5rem,max-content)_max-content] items-baseline gap-2 text-xs leading-5">
      <span className="text-right text-(--color-text-4)">{label}</span>
      <span className="text-left tabular-nums text-(--color-text-2)">{value}</span>
    </div>
  )
}

function MessageTaskUsageStats({ stats }: { stats: AgentTaskUsageStats }) {
  const { t } = useI18n()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const contextPercent = formatContextPercent(stats.contextTokens, stats.contextWindow)
  const contextValue = [formatContextValue(stats.contextTokens, stats.contextWindow), contextPercent]
    .filter(Boolean)
    .join(' ')
  const outputValue =
    stats.thinking > 0
      ? t('agentChat.usage.outputWithThinking', {
          output: formatTokenCount(stats.output),
          thinking: formatTokenCount(stats.thinking),
        })
      : formatTokenCount(stats.output)
  const detailRows = [
    { label: t('agentChat.usage.input'), value: formatTokenCount(stats.input) },
    { label: t('agentChat.usage.cacheRead'), value: formatTokenCount(stats.cacheRead) },
    { label: t('agentChat.usage.cacheWrite'), value: formatTokenCount(stats.cacheWrite) },
    { label: t('agentChat.usage.output'), value: outputValue },
    { label: t('agentChat.usage.context'), value: contextValue },
    { label: t('agentChat.usage.cost'), value: formatUsd(stats.cost) },
  ]

  return (
    <div
      className="relative inline-flex min-w-0"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return
        setDetailsOpen(false)
      }}
    >
      <button
        type="button"
        aria-expanded={detailsOpen}
        aria-label={t('agentChat.usage.details')}
        onClick={() => setDetailsOpen((open) => !open)}
        className="inline-flex h-[26px] min-w-0 items-center rounded-[var(--radius-sm)] bg-transparent px-1.5 text-xs font-medium tabular-nums text-(--color-text-4) transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-(--color-surface-2) hover:text-(--color-text-3) active:scale-[0.98]"
      >
        <span className="truncate">
          {contextValue} · {formatUsd(stats.cost)}
        </span>
      </button>
      {detailsOpen ? (
        <div className="popover-pop absolute right-0 bottom-[calc(100%+6px)] z-50 w-max max-w-[calc(100vw-2rem)] origin-bottom-right rounded-[var(--radius-md)] bg-(--color-surface) px-2.5 py-2 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]">
          <div className="space-y-1">
            {detailRows.map((row) => (
              <UsageDetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

export function MessageBubble({
  message,
  isStreaming,
  isQueued = false,
  assistantTitle,
  taskUsageStats,
  hideCopyAction = false,
  onOpenImageTaskImage,
}: {
  message: AgentMessage
  isStreaming: boolean
  isQueued?: boolean
  assistantTitle?: string
  taskUsageStats?: AgentTaskUsageStats
  hideCopyAction?: boolean
  onOpenImageTaskImage?: (toolCallId: string, imageId: string) => void
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copiedResetRef = useRef<number | null>(null)
  const role = agentMessageRole(message)
  const text = agentMessageText(message)
  const thinking = agentMessageThinking(message)
  const images = agentMessageImages(message)
  const error = agentMessageError(message)
  const displayError = error ? `${t('agentChat.errorPrefix')}${formatAgentError(error, t)}` : null
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'
  const hasToolCalls = agentMessageToolCalls(message).length > 0
  const trimmedText = text.trim()
  const visibleText = stripSystemDirectives(text)
  const copyText = isUser
    ? visibleText
    : [visibleText, displayError].filter((part): part is string => Boolean(part)).join('\n\n')
  const isSystemEvent = isUser && visibleText === '' && trimmedText.startsWith('<system>')
  const canCopy = isUser
    ? copyText.length > 0
    : isAssistant && !hasToolCalls && !isStreaming && copyText.trim().length > 0
  const showAssistantMarkdown = visibleText.trim() !== ''
  const hasAssistantInlineTrailingContent = showAssistantMarkdown || Boolean(displayError)
  const hasAssistantTrailingContent = hasAssistantInlineTrailingContent || hasToolCalls
  const hasAssistantVisibleContent =
    thinking.trim() !== '' || images.length > 0 || showAssistantMarkdown || Boolean(displayError)
  const showUsageStats = canCopy && Boolean(taskUsageStats)
  const showAssistantTitle = isAssistant && Boolean(assistantTitle) && hasAssistantVisibleContent
  const hasAssistantBody = thinking.trim() !== '' || images.length > 0 || hasAssistantTrailingContent
  const showCopyAction = canCopy && !hideCopyAction
  const showActionRow = showCopyAction || showUsageStats

  const handleCopy = () => {
    if (!canCopy || hideCopyAction) return
    void writeClipboardText(copyText)
      .then(() => {
        setCopied(true)
        if (copiedResetRef.current !== null) window.clearTimeout(copiedResetRef.current)
        copiedResetRef.current = window.setTimeout(() => setCopied(false), 1400)
      })
      .catch(() => {})
  }

  if (isSystemEvent) {
    const systemVariant = classifySystemEvent(trimmedText)
    const isCompleted = systemVariant === 'completed'
    const isFailed = systemVariant === 'failed'
    const systemColorClass = isCompleted
      ? 'text-(--color-success)'
      : isFailed
        ? 'text-(--color-danger)'
        : 'text-(--color-text-3)'
    return (
      <div className="flex justify-start">
        <div className={`mr-3 flex max-w-[94%] items-start gap-2 pl-3 ${systemColorClass}`}>
          {isCompleted ? <Icon name="check_circle" size={14} className="shrink-0" style={{ marginTop: 3 }} /> : null}
          {isFailed ? <Icon name="alert_circle" size={14} className="shrink-0" style={{ marginTop: 3 }} /> : null}
          <div className="min-w-0">
            {summarizeSystemEventParts(trimmedText).map((part, index) => {
              const canOpen = Boolean(part.toolCallId && part.imageId && onOpenImageTaskImage)
              if (canOpen) {
                const label = t('agentChat.system.openImageTaskImage', { id: part.imageId ?? part.text })
                return (
                  <Tooltip key={index} text={label} placement="top" className="inline">
                    <button
                      type="button"
                      onClick={() => onOpenImageTaskImage?.(part.toolCallId!, part.imageId!)}
                      aria-label={label}
                      className="mono inline cursor-pointer appearance-none border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-(--color-text-4) underline-offset-[3px] transition-colors duration-150 hover:text-(--color-text-2) hover:decoration-(--color-text-3) focus-visible:text-(--color-text-2) focus-visible:decoration-(--color-text-3) focus-visible:outline-none"
                    >
                      {part.text}
                    </button>
                  </Tooltip>
                )
              }
              if (part.mono) {
                return (
                  <span key={index} className="mono">
                    {part.text}
                  </span>
                )
              }
              return <span key={index}>{part.text}</span>
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`group/message flex ${isUser ? '' : 'justify-start'}`}>
      <div className={isUser ? 'w-full' : 'w-full pl-3'}>
        <div
          className={
            isUser
              ? `rounded-[var(--radius-lg)] px-3 py-2.5 text-(--color-text) ${
                  isQueued
                    ? 'bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
                    : 'bg-(--bubble-user-bg) shadow-[var(--bubble-user-edge)]'
                }`
              : ''
          }
        >
          {showAssistantTitle && (
            <div className={`${hasAssistantBody ? 'mb-2' : ''} text-base font-semibold text-(--color-text)`}>
              {assistantTitle}
            </div>
          )}
          {images.length > 0 ? (
            <div className="mb-2 grid max-w-[360px] grid-cols-3 gap-1.5">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={imageDataUrl(image)}
                  alt={t('agentChat.imageAlt.message', { index: index + 1 })}
                  className="aspect-square rounded-[var(--radius-sm)] object-cover shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
                />
              ))}
            </div>
          ) : null}
          {thinking && !isUser ? (
            <AgentThinking
              thinking={thinking}
              isStreaming={isStreaming}
              hasTrailingContent={hasAssistantTrailingContent}
              hasInlineTrailingContent={hasAssistantInlineTrailingContent}
            />
          ) : null}
          {isUser ? (
            <div className={isQueued ? 'flex items-start gap-3' : undefined}>
              <div className={isQueued ? 'min-w-0 flex-1' : undefined}>
                <TruncatedText
                  text={visibleText}
                  className="whitespace-pre-wrap text-base leading-[1.58]"
                  fadeColor={isQueued ? 'var(--color-surface-2)' : 'var(--bubble-user-bg)'}
                  maxHeight={120}
                  expandedMaxHeight="min(420px, calc(100svh - 220px))"
                />
              </div>
              {isQueued && (
                <span className="mt-0.5 inline-flex h-[22px] shrink-0 items-center rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1.5 text-xs font-medium text-(--color-text-4)">
                  {t('agentChat.message.queued')}
                </span>
              )}
            </div>
          ) : (
            <>
              {showAssistantMarkdown && <MarkdownText text={visibleText} isStreaming={isStreaming} />}
              {displayError && (
                <div
                  className={`${showAssistantMarkdown ? 'mt-2.5' : ''} flex w-fit max-w-full items-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm leading-[1.45]`}
                  style={{
                    color: 'var(--color-danger)',
                    background: 'var(--color-danger-soft)',
                    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 18%, transparent)',
                  }}
                >
                  <Icon name="alert_circle" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <TruncatedText
                      text={displayError}
                      className="whitespace-pre-wrap"
                      fadeColor="var(--color-danger-soft)"
                      maxHeight={220}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {showActionRow && (
          <div className="mt-1 flex min-h-[26px] items-center justify-end gap-1.5 pr-1 opacity-100 transition-opacity duration-150 ease-[var(--ease-out)] md:pointer-events-none md:opacity-0 md:group-hover/message:pointer-events-auto md:group-hover/message:opacity-100 md:group-focus-within/message:pointer-events-auto md:group-focus-within/message:opacity-100">
            {showUsageStats && taskUsageStats ? <MessageTaskUsageStats stats={taskUsageStats} /> : null}
            {showCopyAction ? (
              <Tooltip text={copied ? t('agentChat.message.copied') : t('agentChat.message.copy')} placement="top">
                <button
                  type="button"
                  className="inline-flex h-[26px] shrink-0 appearance-none items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent px-2 text-xs font-medium text-(--color-text-4) transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-(--color-surface-2) hover:text-(--color-text-3) active:scale-[0.98]"
                  onClick={handleCopy}
                  aria-label={copied ? t('agentChat.message.copied') : t('agentChat.message.copy')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name={copied ? 'check' : 'copy'} size={12} strokeWidth={copied ? 2.2 : 1.8} />
                    {copied ? t('agentChat.message.copied') : t('agentChat.message.copy')}
                  </span>
                </button>
              </Tooltip>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
