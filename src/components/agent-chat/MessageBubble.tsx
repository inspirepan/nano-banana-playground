import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useRef, useState } from 'react'

import { AgentThinking } from './AgentThinking'
import { formatAgentError } from './errorText'
import { MarkdownText } from './MarkdownText'
import { summarizeSystemEvent } from './SystemEvent'
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
  hideCopyAction = false,
}: {
  message: AgentMessage
  isStreaming: boolean
  isQueued?: boolean
  assistantTitle?: string
  hideCopyAction?: boolean
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copiedResetRef = useRef<number | null>(null)
  const role = agentMessageRole(message)
  const text = agentMessageText(message)
  const thinking = agentMessageThinking(message)
  const images = agentMessageImages(message)
  const error = agentMessageError(message)
  const displayError = error ? formatAgentError(error, t) : null
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'
  const hasToolCalls = agentMessageToolCalls(message).length > 0
  const trimmedText = text.trim()
  const visibleText = stripSystemDirectives(text)
  const copyText = isUser
    ? visibleText
    : [visibleText, displayError].filter((part): part is string => Boolean(part)).join('\n\n')
  const isSystemEvent = isUser && visibleText === '' && trimmedText.startsWith('<system>')
  const canCopy = isUser ? copyText.length > 0 : isAssistant && !hasToolCalls && !isStreaming && copyText.trim().length > 0
  const showAssistantMarkdown = visibleText.trim() !== ''
  const hasAssistantNonErrorContent =
    thinking.trim() !== '' || images.length > 0 || showAssistantMarkdown || hasToolCalls
  const hasAssistantInlineTrailingContent = showAssistantMarkdown || Boolean(displayError)
  const hasAssistantTrailingContent = hasAssistantInlineTrailingContent || hasToolCalls
  const showAssistantTitle = isAssistant && Boolean(assistantTitle) && hasAssistantNonErrorContent
  const hasAssistantBody = thinking.trim() !== '' || images.length > 0 || hasAssistantTrailingContent

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
    return (
      <div className="flex justify-start">
        <div className="mr-3 max-w-[94%] pl-3 text-(--color-text-3)">{summarizeSystemEvent(trimmedText)}</div>
      </div>
    )
  }

  return (
    <div className={`group/message flex ${isUser ? '' : 'justify-start'}`}>
      <div className={isUser ? 'w-full' : 'w-full pl-3'}>
        <div
          className={
            isUser
              ? `rounded-[12px] px-3 py-2.5 text-(--color-text) ${
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
                  maxHeight={220}
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
        {canCopy && (
          <div className="mt-1 flex justify-end pr-1">
            <button
              type="button"
              className={`inline-flex h-[26px] appearance-none items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent px-2 text-xs font-medium text-(--color-text-4) opacity-100 transition-[opacity,background-color,color] duration-150 hover:bg-(--color-surface-2) hover:text-(--color-text-3) md:pointer-events-none md:opacity-0 md:group-hover/message:pointer-events-auto md:group-hover/message:opacity-100 md:group-focus-within/message:pointer-events-auto md:group-focus-within/message:opacity-100 ${hideCopyAction ? 'pointer-events-none invisible' : ''}`}
              onClick={handleCopy}
              tabIndex={hideCopyAction ? -1 : undefined}
              aria-hidden={hideCopyAction || undefined}
              title={copied ? t('agentChat.message.copied') : t('agentChat.message.copy')}
              aria-label={copied ? t('agentChat.message.copied') : t('agentChat.message.copy')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name={copied ? 'check' : 'copy'} size={12} strokeWidth={copied ? 2.2 : 1.8} />
                {copied ? t('agentChat.message.copied') : t('agentChat.message.copy')}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
