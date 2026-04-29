import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'

import { Icon } from './Icon'
import {
  agentMessageError,
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  agentMessageThinking,
  imageDataUrl,
  type AgentChatAttachment,
} from '../agent'
import { AGENT_THINKING_OPTIONS, type AgentModelConfig, type AgentThinkingLevel } from '../config/agentModels'
import { useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'

type Props = {
  messages: AgentMessage[]
  streamingMessage: AgentMessage | null
  isStreaming: boolean
  error: string | null
  draft: string
  attachments: AgentChatAttachment[]
  attachmentError: string | null
  model: AgentModelConfig
  models: AgentModelConfig[]
  thinkingLevel: AgentThinkingLevel
  googleKeyStatus: ApiKeyStatus
  openaiKeyStatus: ApiKeyStatus
  onOpenApiKeys: () => void
  onDraftChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  onClearAttachmentError: () => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onSend: () => void
  onStop: () => void
  onClear: () => void
}

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }

const MAX_COMPOSER_HEIGHT = 150

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif|heics|heifs)$/i.test(file.name)
}

function autoResizeComposer(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 1, MAX_COMPOSER_HEIGHT)}px`
}

function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      i++
      continue
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'code', language, code: code.join('\n') })
      continue
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmed)
    const orderedMatch = /^\d+[.)]\s+(.+)$/.exec(trimmed)
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch)
      const items: string[] = []
      while (i < lines.length) {
        const itemTrimmed = lines[i].trim()
        const itemMatch = ordered ? /^\d+[.)]\s+(.+)$/.exec(itemTrimmed) : /^[-*]\s+(.+)$/.exec(itemTrimmed)
        if (!itemMatch) break
        items.push(itemMatch[1])
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length) {
      const current = lines[i]
      const currentTrimmed = current.trim()
      if (!currentTrimmed || currentTrimmed.startsWith('```')) break
      if (/^[-*]\s+/.test(currentTrimmed) || /^\d+[.)]\s+/.test(currentTrimmed)) break
      paragraph.push(currentTrimmed)
      i++
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }

  return blocks
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-[4px] bg-(--color-surface-2) px-1 py-0.5 mono text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-(--color-text)">
          {token.slice(2, -2)}
        </strong>,
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function MarkdownText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  if (!text.trim()) return <span className="text-(--color-text-4)">正在思考…</span>

  return (
    <div className="space-y-2.5 text-base leading-[1.62] text-(--color-text-2)">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <div
              key={index}
              className="overflow-hidden rounded-[8px] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
            >
              {block.language && <div className="mono px-3 py-1.5 text-sm text-(--color-text-4)">{block.language}</div>}
              <pre className="overflow-x-auto px-3 py-2.5 mono text-sm leading-[1.55] text-(--color-text)">
                <code>{block.code}</code>
              </pre>
            </div>
          )
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag key={index} className={`space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          )
        }
        return <p key={index}>{renderInline(block.text)}</p>
      })}
    </div>
  )
}

function MessageBubble({ message, isStreaming }: { message: AgentMessage; isStreaming: boolean }) {
  const role = agentMessageRole(message)
  const text = agentMessageText(message)
  const thinking = agentMessageThinking(message)
  const images = agentMessageImages(message)
  const error = agentMessageError(message)
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[94%] ${isUser ? 'ml-8' : 'mr-3'}`}>
        <div className={`mb-1.5 flex items-center gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="mono text-[11px] uppercase tracking-[0.12em] text-(--color-text-4)">
            {isUser ? '你' : 'Agent'}
          </span>
          {isStreaming && <span className="h-1.5 w-1.5 rounded-full bg-(--color-accent)" />}
        </div>

        <div
          className={
            isUser
              ? 'rounded-[12px] rounded-tr-[4px] bg-(--color-accent) px-3 py-2.5 text-(--color-accent-fg)'
              : 'rounded-[12px] rounded-tl-[4px] bg-(--color-surface) px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]'
          }
        >
          {images.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={imageDataUrl(image)}
                  alt="消息图片"
                  className="aspect-square rounded-[7px] object-cover shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
                />
              ))}
            </div>
          )}
          {thinking && !isUser && (
            <details className="mb-2 rounded-[7px] bg-(--color-surface-2) px-2.5 py-2 text-sm text-(--color-text-3)">
              <summary className="cursor-pointer select-none mono text-[11px] uppercase tracking-[0.12em] text-(--color-text-4)">
                Thinking
              </summary>
              <div className="mt-2 whitespace-pre-wrap leading-[1.55]">{thinking}</div>
            </details>
          )}
          {isUser ? (
            <div className="whitespace-pre-wrap text-base leading-[1.58]">{text}</div>
          ) : (
            <MarkdownText text={error ? `${text}\n\n${error}` : text} />
          )}
        </div>
      </div>
    </div>
  )
}

export function AgentChatPanel({
  messages,
  streamingMessage,
  isStreaming,
  error,
  draft,
  attachments,
  attachmentError,
  model,
  models,
  thinkingLevel,
  googleKeyStatus,
  openaiKeyStatus,
  onOpenApiKeys,
  onDraftChange,
  onAddAttachments,
  onRemoveAttachment,
  onClearAttachmentError,
  onModelChange,
  onThinkingLevelChange,
  onSend,
  onStop,
  onClear,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<'model' | 'thinking' | null>(null)
  const currentKeyStatus = model.provider === 'google' ? googleKeyStatus : openaiKeyStatus
  const keyMissing = currentKeyStatus === 'empty'
  const canSend = !isStreaming && !keyMissing && (draft.trim() !== '' || attachments.length > 0)
  const visibleMessages = streamingMessage ? [...messages, streamingMessage] : messages
  const effectiveThinkingLevel = model.supportsThinking ? thinkingLevel : 'off'

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeComposer(textareaRef.current)
  }, [draft])

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleMessages.length, streamingMessage, isStreaming])

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files ?? [])
    event.target.value = ''
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div
      className="flex min-h-[560px] flex-1 flex-col"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
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

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-4 [scrollbar-gutter:stable]">
        {visibleMessages.length === 0 ? (
          <div className="flex min-h-[300px] flex-col justify-center text-center">
            <div className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
              开始和 Agent 聊天
            </div>
            <div className="mx-auto mt-1 max-w-[260px] text-sm leading-[1.5] text-(--color-text-3)">
              可以讨论提示词、分析附加图片，后面再给它接入生成和编辑工具。
            </div>
          </div>
        ) : (
          visibleMessages.map((message, index) => (
            <MessageBubble
              key={`${agentMessageRole(message)}-${isStreaming && index === visibleMessages.length - 1 ? 'stream' : index}`}
              message={message}
              isStreaming={isStreaming && index === visibleMessages.length - 1}
            />
          ))
        )}
      </div>

      {(error || attachmentError) && (
        <div
          className="mb-2 rounded-[8px] px-3 py-2 text-sm leading-[1.45]"
          style={{ color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
        >
          <div className="flex items-start gap-2">
            <Icon name="alert_circle" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
            <div className="min-w-0 flex-1 whitespace-pre-wrap">{attachmentError ?? error}</div>
            {attachmentError && (
              <button
                type="button"
                onClick={onClearAttachmentError}
                className="text-sm opacity-75 transition-opacity hover:opacity-100"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}

      <div className="prompt-wrap relative rounded-[12px] bg-(--color-surface)">
        <div ref={controlsRef} className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5">
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpenMenu((prev) => (prev === 'model' ? null : 'model'))}
              className="chip w-full justify-between px-2.5"
              title="切换模型"
            >
              <span className="truncate">{model.label}</span>
              <Icon name="chevron_right" size={13} className={openMenu === 'model' ? '-rotate-90' : 'rotate-90'} />
            </button>

            {openMenu === 'model' && (
              <div className="absolute bottom-full left-0 z-50 mb-1.5 w-[280px] rounded-[10px] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
                {models.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onModelChange(item.id)
                      setOpenMenu(null)
                    }}
                    className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-base text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
                    data-active={model.id === item.id}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {model.id === item.id && <Icon name="check" size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenu((prev) => (prev === 'thinking' ? null : 'thinking'))}
              className="chip justify-between px-2.5"
              title={model.supportsThinking ? '切换思考等级' : '当前模型不支持思考等级'}
            >
              <span>
                {AGENT_THINKING_OPTIONS.find((item) => item.value === effectiveThinkingLevel)?.label ??
                  effectiveThinkingLevel}
              </span>
              <Icon name="chevron_right" size={13} className={openMenu === 'thinking' ? '-rotate-90' : 'rotate-90'} />
            </button>

            {openMenu === 'thinking' && (
              <div className="absolute bottom-full right-0 z-50 mb-1.5 w-[190px] rounded-[10px] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
                {AGENT_THINKING_OPTIONS.map((item) => {
                  const disabled = !model.supportsThinking && item.value !== 'off'
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        if (disabled) return
                        onThinkingLevelChange(item.value)
                        setOpenMenu(null)
                      }}
                      disabled={disabled}
                      className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-base text-(--color-text-2) transition-colors hover:bg-(--color-surface-2) disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {effectiveThinkingLevel === item.value && <Icon name="check" size={13} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-2.5 pb-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
              >
                <img src={imageDataUrl(attachment)} alt={attachment.fileName} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="移除图片"
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value)
            autoResizeComposer(event.target)
          }}
          onKeyDown={handleKeyDown}
          placeholder="给 Agent 发送消息…"
          rows={1}
          className="block max-h-[150px] min-h-[54px] w-full resize-none bg-transparent px-3 py-2.5 text-[16px] leading-[1.55] text-(--color-text) focus:outline-none md:text-base"
        />

        <div className="flex items-center gap-1.5 px-2.5 py-2 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="icon-btn"
            title="附加图片"
            aria-label="附加图片"
          >
            <Icon name="paperclip" size={14} />
          </button>
          {messages.length > 0 && !isStreaming && (
            <button type="button" onClick={onClear} className="chip text-sm" style={{ height: 28, padding: '0 9px' }}>
              清空
            </button>
          )}
          <div className="flex-1" />
          {isStreaming ? (
            <button type="button" onClick={onStop} className="chip text-sm" style={{ height: 28, padding: '0 9px' }}>
              <Icon name="stop_circle" size={13} />
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="cta"
              style={{ height: 30, padding: '0 11px' }}
            >
              <Icon name="send" size={13} />
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
