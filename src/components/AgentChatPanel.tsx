import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Streamdown } from 'streamdown'

import { BrandIcon, Icon } from './Icon'
import {
  agentMessageError,
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  agentMessageThinking,
  agentMessageToolCalls,
  agentMessageToolResult,
  imageDataUrl,
  type AgentChatAttachment,
  type AgentImageTask,
  type AgentMessageToolCall,
  type AgentMessageToolResult,
  type AgentSessionSummary,
} from '../agent'
import { AGENT_THINKING_OPTIONS, type AgentModelConfig, type AgentThinkingLevel } from '../config/agentModels'
import { MODEL_CONFIGS } from '../config/models'
import { useExternalSync, useWindowEvent } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { useImageSrc } from '../hooks/useImageSrc'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

type Props = {
  messages: AgentMessage[]
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
  model: AgentModelConfig
  models: AgentModelConfig[]
  thinkingLevel: AgentThinkingLevel
  googleKeyStatus: ApiKeyStatus
  openaiKeyStatus: ApiKeyStatus
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
  onFocusImageTask?: (task: AgentImageTask) => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onSend: () => void
  onStop: () => void
}

type ChatRenderItem =
  | { type: 'message'; key: string; message: AgentMessage; isStreaming: boolean }
  | {
      type: 'tools'
      key: string
      calls: AgentMessageToolCall[]
      results: AgentMessageToolResult[]
      isStreaming: boolean
    }

const MAX_COMPOSER_HEIGHT = 150

function taskStatusLabel(status: AgentImageTask['status']): string {
  if (status === 'pending_approval') return '待审批'
  if (status === 'queued') return '排队中'
  if (status === 'running') return '生成中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'rejected') return '已取消'
  if (status === 'canceled') return '已取消'
  return '已通过'
}

function formatSessionTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function hasRenderableMessageContent(message: AgentMessage): boolean {
  return (
    agentMessageRole(message) === 'user' ||
    agentMessageText(message).trim() !== '' ||
    agentMessageThinking(message).trim() !== '' ||
    agentMessageImages(message).length > 0 ||
    Boolean(agentMessageError(message))
  )
}

function buildChatRenderItems(messages: AgentMessage[], streamingMessage: AgentMessage | null): ChatRenderItem[] {
  const items: ChatRenderItem[] = []

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index]
    const role = agentMessageRole(message)
    const isStreamingMessage = Boolean(streamingMessage && message === streamingMessage)
    if (role === 'assistant') {
      const calls = agentMessageToolCalls(message)
      if (hasRenderableMessageContent(message)) {
        items.push({ type: 'message', key: `message-${index}`, message, isStreaming: isStreamingMessage })
      }
      if (calls.length > 0) {
        const results: AgentMessageToolResult[] = []
        let nextIndex = index + 1
        while (nextIndex < messages.length) {
          const result = agentMessageToolResult(messages[nextIndex])
          if (!result || !calls.some((call) => call.id === result.toolCallId)) break
          results.push(result)
          nextIndex++
        }
        items.push({
          type: 'tools',
          key: `tools-${calls.map((call) => call.id).join('-')}`,
          calls,
          results,
          isStreaming: isStreamingMessage,
        })
        index = nextIndex - 1
      }
      continue
    }
    if (role === 'toolResult') {
      const result = agentMessageToolResult(message)
      if (result) {
        items.push({
          type: 'tools',
          key: `tool-result-${result.toolCallId}-${index}`,
          calls: [],
          results: [result],
          isStreaming: false,
        })
      }
      continue
    }
    items.push({ type: 'message', key: `message-${index}`, message, isStreaming: isStreamingMessage })
  }
  return items
}

function toolLabel(name: string): string {
  if (name === 'GenImage') return '创建生图任务'
  if (name === 'ReadImage') return '读取图片'
  return name
}

function summarizeToolArgs(call: AgentMessageToolCall): string {
  if (call.name === 'GenImage') {
    const imageId = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : '未命名'
    const count = typeof call.arguments.n === 'number' ? call.arguments.n : 1
    return `${imageId} · ${count} 张`
  }
  if (call.name === 'ReadImage') {
    return typeof call.arguments.image_id === 'string' ? call.arguments.image_id : '图片'
  }
  return Object.keys(call.arguments).slice(0, 3).join(' · ')
}

function summarizeToolResult(result: AgentMessageToolResult): string {
  if (result.isError) return result.text || '工具调用失败'
  try {
    const parsed = JSON.parse(result.text) as Record<string, unknown>
    if (result.toolName === 'GenImage') {
      const ids = Array.isArray(parsed.reserved_image_ids)
        ? parsed.reserved_image_ids.filter((id): id is string => typeof id === 'string')
        : []
      const status = typeof parsed.status === 'string' ? parsed.status : 'done'
      return ids.length > 0 ? `${status} · ${ids.join(', ')}` : status
    }
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    // Plain text tool result.
  }
  return result.text.trim().slice(0, 120) || '工具调用完成'
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif|heics|heifs)$/i.test(file.name)
}

function parseDraggedPlaygroundImage(value: string): PlaygroundImage | PlaygroundImageMeta | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<PlaygroundImage>
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.mimeType !== 'string' || !parsed.source) return null
    if (typeof parsed.timestamp !== 'number') return null
    return parsed as PlaygroundImage | PlaygroundImageMeta
  } catch {
    return null
  }
}

function autoResizeComposer(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 1, MAX_COMPOSER_HEIGHT)}px`
}

function AgentModelIcon({ model, size = 13 }: { model: AgentModelConfig; size?: number }) {
  return (
    <BrandIcon
      name={model.provider === 'google' ? 'gemini' : 'openai'}
      size={size}
      className="shrink-0 text-(--color-text-3)"
    />
  )
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
        <strong key={`${match.index}-strong`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function TruncatedText({
  text,
  className,
  fadeColor,
  maxHeight = 200,
}: {
  text: string
  className?: string
  fadeColor: string
  maxHeight?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflowing(el.scrollHeight > maxHeight + 4)
  }, [text, maxHeight])

  const collapsed = overflowing && !expanded

  return (
    <div>
      <div className="relative">
        <div ref={ref} className={className} style={collapsed ? { maxHeight, overflow: 'hidden' } : undefined}>
          {text}
        </div>
        {collapsed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{ background: `linear-gradient(to bottom, transparent, ${fadeColor})` }}
          />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((prev) => !prev)
          }}
          className="relative z-10 mt-1.5 bg-transparent p-0 text-sm text-(--color-text-3) transition-colors hover:text-(--color-text)"
        >
          {expanded ? '收起' : '展开'}
        </button>
      )}
    </div>
  )
}

const MARKDOWN_COMPONENTS = {
  p: (props: JSX.IntrinsicElements['p']) => <p {...props} />,
  strong: (props: JSX.IntrinsicElements['strong']) => <strong className="font-semibold" {...props} />,
  em: (props: JSX.IntrinsicElements['em']) => <em className="italic" {...props} />,
  a: (props: JSX.IntrinsicElements['a']) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="text-(--color-accent) underline decoration-(--color-accent-ring) underline-offset-2 hover:decoration-(--color-accent)"
    />
  ),
  ul: (props: JSX.IntrinsicElements['ul']) => <ul className="list-disc space-y-1.5 pl-5" {...props} />,
  ol: (props: JSX.IntrinsicElements['ol']) => <ol className="list-decimal space-y-1.5 pl-5" {...props} />,
  li: (props: JSX.IntrinsicElements['li']) => <li {...props} />,
  blockquote: (props: JSX.IntrinsicElements['blockquote']) => (
    <blockquote
      className="border-l-2 border-(--ring-edge-strong) pl-3 text-(--color-text-3) italic"
      {...props}
    />
  ),
  h1: (props: JSX.IntrinsicElements['h1']) => (
    <h1 className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)" {...props} />
  ),
  h2: (props: JSX.IntrinsicElements['h2']) => (
    <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-(--color-text)" {...props} />
  ),
  h3: (props: JSX.IntrinsicElements['h3']) => (
    <h3 className="font-display text-sm font-semibold text-(--color-text)" {...props} />
  ),
  hr: (props: JSX.IntrinsicElements['hr']) => <hr className="border-(--ring-edge-soft)" {...props} />,
  inlineCode: (props: JSX.IntrinsicElements['code']) => (
    <code className="rounded-[4px] bg-(--color-surface-2) px-1 py-0.5 mono text-[0.92em]" {...props} />
  ),
  pre: ({ children, ...props }: JSX.IntrinsicElements['pre']) => (
    <div className="overflow-hidden rounded-[8px] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <pre
        {...props}
        className="overflow-x-auto px-3 py-2.5 mono text-sm leading-[1.55] text-(--color-text)"
      >
        {children}
      </pre>
    </div>
  ),
  table: (props: JSX.IntrinsicElements['table']) => (
    <div className="overflow-x-auto rounded-[8px] shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: JSX.IntrinsicElements['th']) => (
    <th
      className="border-b border-(--ring-edge-soft) bg-(--color-surface-2) px-2.5 py-1.5 text-left font-medium text-(--color-text)"
      {...props}
    />
  ),
  td: (props: JSX.IntrinsicElements['td']) => (
    <td className="border-b border-(--ring-edge-soft) px-2.5 py-1.5 text-(--color-text-2)" {...props} />
  ),
}

function MarkdownText({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text.trim()) {
    return isStreaming ? <span className="text-(--color-text-4)">正在思考…</span> : null
  }

  return (
    <div className="space-y-2.5 text-base leading-[1.62] text-(--color-text-2) [&_>_*]:my-0">
      <Streamdown
        parseIncompleteMarkdown={isStreaming ?? false}
        isAnimating={isStreaming ?? false}
        animated={{ animation: 'fadeIn', sep: 'word', duration: 220, stagger: 12 }}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </Streamdown>
    </div>
  )
}

function countCommaList(value: string | undefined): number {
  if (!value) return 0
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length
}

function summarizeSystemEvent(text: string): string {
  const tool = /tool\s+(\w+)/.exec(text)?.[1]
  const status = /status:\s*(\w+)/.exec(text)?.[1]
  const reservedRaw = /reserved_image_ids:\s*(.*)/.exec(text)?.[1]
  const imagesRaw = /image_ids:\s*(.*)/.exec(text)?.[1]
  const reservedCount = countCommaList(reservedRaw)
  const completedCount = countCommaList(imagesRaw)
  const failedCount = Math.max(0, reservedCount - completedCount)

  if (tool !== 'GenImage') return `${tool ?? '工具'} 回调${status ? ` · ${status}` : ''}`

  switch (status) {
    case 'completed':
      return `生成任务完成，生成了 ${completedCount} 张`
    case 'failed': {
      const parts: string[] = []
      if (completedCount > 0) parts.push(`成功 ${completedCount} 张`)
      if (failedCount > 0) parts.push(`失败 ${failedCount} 张`)
      return parts.length > 0 ? `生成任务失败，${parts.join('，')}` : '生成任务失败'
    }
    case 'rejected':
      return '生成任务已拒绝'
    case 'canceled':
      return completedCount > 0 ? `生成任务已取消，已完成 ${completedCount} 张` : '生成任务已取消'
    default:
      return `生成任务 · ${status ?? ''}`.trim()
  }
}

function MessageBubble({ message, isStreaming }: { message: AgentMessage; isStreaming: boolean }) {
  const role = agentMessageRole(message)
  const text = agentMessageText(message)
  const thinking = agentMessageThinking(message)
  const images = agentMessageImages(message)
  const error = agentMessageError(message)
  const isUser = role === 'user'
  const [thinkingOpen, setThinkingOpen] = useState(true)
  const trimmedText = text.trim()
  const isSystemEvent = isUser && trimmedText.startsWith('<system>') && trimmedText.endsWith('</system>')

  if (isSystemEvent) {
    return (
      <div className="flex justify-start">
        <div className="mr-3 max-w-[94%] text-(--color-text-4)">{summarizeSystemEvent(trimmedText)}</div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? '' : 'justify-start'}`}>
      <div className={isUser ? 'w-full' : 'mr-3 max-w-[94%]'}>
        <div
          className={
            isUser
              ? 'rounded-[12px] bg-(--color-accent-soft) px-3 py-2.5 text-(--color-text) shadow-[inset_0_0_0_1px_var(--color-accent-ring),0_1px_0_var(--color-accent-ring),0_2px_3px_-1px_rgba(0,0,0,0.05)]'
              : ''
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
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setThinkingOpen((prev) => !prev)}
                aria-expanded={thinkingOpen}
                className="inline-flex cursor-pointer items-center gap-1.5 bg-transparent p-0 py-0.5 text-(--color-text-4) transition-colors duration-150 hover:text-(--color-text-3)"
              >
                <span>Thinking</span>
                <Icon
                  name="chevron_right"
                  size={13}
                  style={{
                    transform: thinkingOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
                  }}
                  className="motion-reduce:!transition-none"
                />
              </button>
              <div
                className="grid motion-reduce:!transition-none"
                style={{
                  gridTemplateRows: thinkingOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 220ms cubic-bezier(0.23, 1, 0.32, 1)',
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className="pt-3 whitespace-pre-wrap italic leading-[1.55] text-(--color-text-3)"
                    style={{ fontSynthesis: 'style' }}
                  >
                    {renderInline(thinking.replace(/\n{3,}/g, '\n\n'))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {isUser ? (
            <TruncatedText
              text={text}
              className="whitespace-pre-wrap text-base leading-[1.58]"
              fadeColor="var(--color-accent-soft)"
              maxHeight={220}
            />
          ) : (
            <MarkdownText text={error ? `${text}\n\n${error}` : text} isStreaming={isStreaming} />
          )}
        </div>
      </div>
    </div>
  )
}

function ToolCallRow({ call, result }: { call: AgentMessageToolCall; result: AgentMessageToolResult | undefined }) {
  const failed = result?.isError === true
  const done = Boolean(result)
  return (
    <div className="flex items-start gap-2 rounded-[7px] px-1.5 py-1">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px]"
        style={{
          background: failed ? 'var(--color-danger-soft)' : 'var(--color-surface-2)',
          color: failed ? 'var(--color-danger)' : 'var(--color-text-3)',
          boxShadow: 'inset 0 0 0 1px var(--ring-edge-soft)',
        }}
      >
        {done ? (
          <Icon name={failed ? 'alert_circle' : 'check'} size={11} />
        ) : (
          <span className="spinner" style={{ width: 10, height: 10 }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-(--color-text-2)">{toolLabel(call.name)}</span>
          <span className="mono shrink-0 text-[11px] text-(--color-text-4)">{call.name}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-(--color-text-4)">{summarizeToolArgs(call)}</span>
        {result && (
          <span className="mt-1 block truncate text-sm text-(--color-text-3)">{summarizeToolResult(result)}</span>
        )}
      </span>
    </div>
  )
}

function StandaloneToolResultRow({ result }: { result: AgentMessageToolResult }) {
  return (
    <div className="flex items-start gap-2 rounded-[7px] px-1.5 py-1">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-(--color-surface-2) text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
        <Icon name={result.isError ? 'alert_circle' : 'check'} size={11} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium text-(--color-text-2)">{toolLabel(result.toolName)}</span>
        <span className="mt-0.5 block truncate text-sm text-(--color-text-3)">{summarizeToolResult(result)}</span>
      </span>
    </div>
  )
}

function CompactToolGroup({ rows, isStreaming }: { rows: ReactNode[]; isStreaming: boolean }) {
  return (
    <div className="flex justify-start">
      <div className="mr-3 max-w-[88%]">
        <div className="mb-1.5 mono text-[11px] uppercase tracking-[0.12em] text-(--color-text-4)">Agent</div>
        <div className="rounded-[10px] bg-(--color-surface) px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          <div className="space-y-1.5">{rows}</div>
          {isStreaming && <div className="mt-1.5 text-sm text-(--color-text-4)">等待工具结果…</div>}
        </div>
      </div>
    </div>
  )
}

function GenImageResultThumb({ id }: { id: string }) {
  const { ref, src } = useImageSrc(id, 'image/png', undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      className="relative aspect-square w-full overflow-hidden rounded-[7px] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
    >
      {src ? (
        <img src={src} alt={id} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-(--color-text-4)">
          <span className="spinner" style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  )
}

function AgentImageTaskCard({
  call,
  task,
  result,
  onApprove,
  onCancel,
  onFocus,
}: {
  call: AgentMessageToolCall
  task: AgentImageTask | undefined
  result?: AgentMessageToolResult
  onApprove: (taskId: string) => void
  onCancel: (taskId: string) => void
  onFocus?: (task: AgentImageTask) => void
}) {
  const status: AgentImageTask['status'] = task?.status ?? (result?.isError ? 'failed' : 'pending_approval')
  const danger = status === 'failed' || status === 'rejected' || status === 'canceled'
  const active = status === 'queued' || status === 'running'
  const reservedIds = task?.request.reservedImageIds ?? []
  const modelName = task
    ? (MODEL_CONFIGS.find((item) => item.id === task.request.modelId)?.name ?? task.request.modelId)
    : null
  const requestedFromArgs = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : undefined
  const requestedCountFromArgs = typeof call.arguments.n === 'number' ? call.arguments.n : 1
  const promptFromArgs = typeof call.arguments.prompt === 'string' ? call.arguments.prompt : ''
  const headerIds = reservedIds.length > 0 ? reservedIds : requestedFromArgs ? [requestedFromArgs] : []
  const promptText = task?.request.prompt ?? promptFromArgs
  const referenceIds = task?.request.referenceImageIds ?? []
  const resultIds = task?.resultImageIds ?? []
  const showApprove = task ? task.status === 'pending_approval' : false
  const showCancel = task
    ? task.status === 'pending_approval' ||
      task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved'
    : false
  const statusColor = danger ? 'var(--color-danger)' : active ? 'var(--color-accent)' : 'var(--color-text-3)'
  const canFocus = Boolean(
    onFocus &&
    task &&
    (task.request.stackId || task.generationJobId) &&
    (task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'approved' ||
      task.status === 'completed'),
  )
  const handleCardClick = canFocus && task ? () => onFocus?.(task) : undefined

  return (
    <div
      role={canFocus ? 'button' : undefined}
      tabIndex={canFocus ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={
        canFocus
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleCardClick?.()
              }
            }
          : undefined
      }
      className={`rounded-[8px] bg-(--color-surface) px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${canFocus ? 'cursor-pointer transition-colors duration-150 hover:bg-(--color-surface-2)' : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-sm font-semibold text-(--color-text)">生成图片</span>
        <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: statusColor }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
          {taskStatusLabel(status)}
        </span>
        {active && <span className="spinner" style={{ width: 10, height: 10 }} />}
        {headerIds.length > 0 && (
          <span className="mono ml-auto min-w-0 truncate text-sm text-(--color-text-4)" title={headerIds.join(', ')}>
            {headerIds.join(', ')}
          </span>
        )}
      </div>

      {promptText && task?.status !== 'completed' && (
        <TruncatedText
          text={promptText}
          className="mt-2.5 whitespace-pre-wrap text-sm leading-[1.62] text-(--color-text-2)"
          fadeColor="var(--color-surface)"
          maxHeight={140}
        />
      )}

      {task?.status !== 'completed' && (task || requestedFromArgs) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {modelName && (
            <span className="min-w-0">
              <span className="text-(--color-text-3)">模型 </span>
              <span className="text-(--color-text)">{modelName}</span>
            </span>
          )}
          {task && (
            <>
              <span>
                <span className="text-(--color-text-3)">尺寸 </span>
                <span className="text-(--color-text)">
                  {task.request.resolution} · {task.request.aspectRatio}
                </span>
              </span>
              <span>
                <span className="text-(--color-text-3)">数量 </span>
                <span className="text-(--color-text)">{task.request.batchCount} 张</span>
              </span>
            </>
          )}
          {!task && (
            <>
              {requestedFromArgs && (
                <span className="min-w-0 truncate" title={requestedFromArgs}>
                  <span className="text-(--color-text-3)">目标 </span>
                  <span className="mono text-(--color-text)">{requestedFromArgs}</span>
                </span>
              )}
              <span>
                <span className="text-(--color-text-3)">数量 </span>
                <span className="text-(--color-text)">{requestedCountFromArgs} 张</span>
              </span>
            </>
          )}
          {referenceIds.length > 0 && (
            <span className="min-w-0 truncate" title={referenceIds.join(', ')}>
              <span className="text-(--color-text-3)">参考 </span>
              <span className="mono text-(--color-text)">{referenceIds.join(', ')}</span>
            </span>
          )}
        </div>
      )}

      {resultIds.length > 0 && (
        <div
          className="mt-3 grid gap-1.5"
          style={{
            gridTemplateColumns:
              task?.status === 'completed'
                ? `repeat(${Math.min(resultIds.length, 3)}, minmax(0, 1fr))`
                : 'repeat(auto-fill, minmax(72px, 1fr))',
          }}
        >
          {resultIds.map((id) => (
            <GenImageResultThumb key={id} id={id} />
          ))}
        </div>
      )}

      {task?.error && (
        <div className="mt-2.5 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {task.error}
        </div>
      )}
      {!task && result?.isError && (
        <div className="mt-2.5 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {summarizeToolResult(result)}
        </div>
      )}

      {(showApprove || showCancel) && task && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {showApprove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onApprove(task.id)
              }}
              className="chip text-sm"
              data-active
              style={{ height: 28, padding: '0 12px' }}
            >
              生成
            </button>
          )}
          {showCancel && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onCancel(task.id)
              }}
              className="chip danger text-sm"
              style={{ height: 28, padding: '0 12px' }}
            >
              取消
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ToolActivityCard({
  calls,
  results,
  imageTaskByToolCallId,
  isStreaming,
  onApproveImageTask,
  onCancelImageTask,
  onFocusImageTask,
}: {
  calls: AgentMessageToolCall[]
  results: AgentMessageToolResult[]
  imageTaskByToolCallId: Map<string, AgentImageTask>
  isStreaming: boolean
  onApproveImageTask: (taskId: string) => void
  onCancelImageTask: (taskId: string) => void
  onFocusImageTask?: (task: AgentImageTask) => void
}) {
  const resultByCallId = new Map(results.map((result) => [result.toolCallId, result]))

  // GenImage calls render as standalone rich cards; everything else collapses
  // into the compact tool group above.
  const compactRows: ReactNode[] = []
  const richCards: ReactNode[] = []

  for (const call of calls) {
    if (call.name === 'GenImage') {
      richCards.push(
        <AgentImageTaskCard
          key={call.id}
          call={call}
          task={imageTaskByToolCallId.get(call.id)}
          result={resultByCallId.get(call.id)}
          onApprove={onApproveImageTask}
          onCancel={onCancelImageTask}
          onFocus={onFocusImageTask}
        />,
      )
      continue
    }
    compactRows.push(<ToolCallRow key={call.id} call={call} result={resultByCallId.get(call.id)} />)
  }
  if (calls.length === 0) {
    for (const result of results) {
      compactRows.push(<StandaloneToolResultRow key={result.toolCallId} result={result} />)
    }
  }

  const showCompact = compactRows.length > 0 || (calls.length === 0 && results.length === 0)

  return (
    <div className="space-y-2">
      {showCompact && <CompactToolGroup rows={compactRows} isStreaming={isStreaming && richCards.length === 0} />}
      {richCards.length > 0 && (
        <div className="flex justify-start">
          <div className="mr-3 w-full max-w-[94%] space-y-2">{richCards}</div>
        </div>
      )}
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
  sessions,
  currentSessionId,
  sessionsLoading,
  autoApproveImageTasks,
  imageTasks,
  model,
  models,
  thinkingLevel,
  googleKeyStatus,
  openaiKeyStatus,
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
  onFocusImageTask,
  onModelChange,
  onThinkingLevelChange,
  onSend,
  onStop,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<'agentOptions' | 'sessions' | null>(null)
  const currentKeyStatus = model.provider === 'google' ? googleKeyStatus : openaiKeyStatus
  const keyMissing = currentKeyStatus === 'empty'
  const canSend = !isStreaming && !keyMissing && (draft.trim() !== '' || attachments.length > 0)
  const currentSession = sessions.find((session) => session.id === currentSessionId)
  const visibleMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage],
  )
  const renderItems = useMemo(
    () => buildChatRenderItems(visibleMessages, streamingMessage),
    [visibleMessages, streamingMessage],
  )
  const showThinkingPlaceholder =
    isStreaming &&
    (!streamingMessage ||
      (!hasRenderableMessageContent(streamingMessage) &&
        agentMessageToolCalls(streamingMessage).length === 0))
  const imageTaskByToolCallId = useMemo(() => {
    const map = new Map<string, AgentImageTask>()
    for (const task of imageTasks) map.set(task.toolCallId, task)
    return map
  }, [imageTasks])
  const effectiveThinkingLevel = model.supportsThinking ? thinkingLevel : 'off'
  const effectiveThinkingLabel =
    AGENT_THINKING_OPTIONS.find((item) => item.value === effectiveThinkingLevel)?.label ?? effectiveThinkingLevel

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeComposer(textareaRef.current)
  }, [draft])

  const [nearBottom, setNearBottom] = useState(true)

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
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

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

  const addDraggedImage = (event: React.DragEvent<HTMLDivElement>): boolean => {
    const image = parseDraggedPlaygroundImage(event.dataTransfer.getData('application/x-playground-image'))
    if (!image) return false
    onAddImageAttachment(image)
    return true
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
      ref={controlsRef}
      className="flex min-h-[calc(100dvh-126px)] flex-1 flex-col md:min-h-[560px]"
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
      <div className="relative mb-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'sessions' ? null : 'sessions'))}
          className="chip ghost min-w-0 max-w-[calc(100%-78px)] shrink justify-start gap-1.5 px-2.5 text-base"
          style={{ height: 30 }}
          title="切换 Agent 对话"
        >
          <span className="min-w-0 truncate text-left text-(--color-text-2)">
            {sessionsLoading ? '加载对话…' : (currentSession?.title ?? '新对话')}
          </span>
          <Icon name="chevron_right" size={13} className={openMenu === 'sessions' ? '-rotate-90' : 'rotate-90'} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onNewSession}
          disabled={isStreaming}
          className="chip shrink-0 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
          style={{ height: 30, boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
        >
          新对话
        </button>
        {openMenu === 'sessions' && (
          <div className="absolute top-[36px] left-0 z-50 w-full rounded-[10px] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
            <div className="px-2 py-1.5 text-sm font-medium text-(--color-text-4)">历史对话</div>
            <div className="max-h-[260px] overflow-y-auto py-0.5">
              {sessions.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-(--color-text-4)">暂无历史对话</div>
              ) : (
                sessions.map((session) => {
                  const active = session.id === currentSessionId
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        onSwitchSession(session.id)
                        setOpenMenu(null)
                      }}
                      disabled={isStreaming}
                      className="group flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left transition-colors hover:bg-(--color-surface-2) disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-(--color-text-2)">{session.title}</span>
                          {active && <Icon name="check" size={12} className="shrink-0 text-(--color-accent)" />}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-(--color-text-4)">
                          {session.previewText || session.firstUserText || '空对话'}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-(--color-text-4)">{formatSessionTime(session.updatedAt)}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteSession(session.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          onDeleteSession(session.id)
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-(--color-text-4) opacity-0 transition-opacity hover:bg-(--color-surface-3) hover:text-(--color-danger) group-hover:opacity-100"
                        aria-label="删除对话"
                      >
                        <Icon name="trash" size={12} />
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

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

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-5 pr-1 pb-8 [scrollbar-gutter:stable]"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 34px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 34px), transparent 100%)',
        }}
      >
        {renderItems.length === 0 ? (
          <div className="flex min-h-[300px] flex-col justify-center text-center">
            <div className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
              从一个想法开始
            </div>
            <div className="mx-auto mt-1 max-w-[250px] text-sm leading-[1.5] text-(--color-text-3)">
              输入需求、附加图片，或让它准备一组待审批的生图任务。
            </div>
          </div>
        ) : (
          <>
            {renderItems.map((item) =>
              item.type === 'message' ? (
                <MessageBubble key={item.key} message={item.message} isStreaming={item.isStreaming} />
              ) : (
                <ToolActivityCard
                  key={item.key}
                  calls={item.calls}
                  results={item.results}
                  imageTaskByToolCallId={imageTaskByToolCallId}
                  isStreaming={item.isStreaming}
                  onApproveImageTask={onApproveImageTask}
                  onCancelImageTask={onCancelImageTask}
                  onFocusImageTask={onFocusImageTask}
                />
              ),
            )}
            {showThinkingPlaceholder && (
              <div className="flex justify-start">
                <div className="mr-3 max-w-[94%]">
                  <span className="text-(--color-text-4)">正在思考…</span>
                </div>
              </div>
            )}
          </>
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

      <div className="relative">
        {!nearBottom && renderItems.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="滚动到底部"
            className="absolute bottom-[calc(100%+8px)] left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-(--color-surface) text-(--color-text-2) shadow-[0_2px_10px_rgba(0,0,0,0.08),inset_0_0_0_1px_var(--ring-edge)] transition-all duration-150 hover:bg-(--color-surface-2) hover:text-(--color-text)"
          >
            <Icon name="chevron_down" size={15} />
          </button>
        )}
        <div className="prompt-wrap relative rounded-[12px] bg-(--color-surface) focus-within:shadow-[inset_0_0_0_1px_var(--ring-edge)]">
          {openMenu === 'agentOptions' && (
            <div className="absolute right-2 bottom-[46px] z-50 w-[208px] rounded-[10px] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
              <button
                type="button"
                onClick={() => onToggleAutoApproveImageTasks(!autoApproveImageTasks)}
                className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
              >
                <span className="min-w-0 flex-1 truncate">自动通过生图任务</span>
                {autoApproveImageTasks && <Icon name="check" size={13} />}
              </button>
              <div className="my-1 h-px bg-(--ring-edge-soft)" />
              <div className="px-2 py-1 text-sm font-medium text-(--color-text-4)">深度思考</div>
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
                    className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2) disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {effectiveThinkingLevel === item.value && <Icon name="check" size={13} />}
                  </button>
                )
              })}
              <div className="my-1 h-px bg-(--ring-edge-soft)" />
              {models.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onModelChange(item.id)
                    setOpenMenu(null)
                  }}
                  className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
                  data-active={model.id === item.id}
                >
                  <AgentModelIcon model={item} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {model.id === item.id && <Icon name="check" size={13} />}
                </button>
              ))}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-(--color-surface-2) shadow-[0_0_0_1px_var(--ring-edge),0_2px_8px_-6px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--ring-edge-soft)]"
                >
                  <img
                    src={imageDataUrl(attachment)}
                    alt={attachment.fileName}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
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
            className="block max-h-[150px] min-h-[44px] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[16px] leading-[1.55] text-(--color-text) focus:outline-none md:text-base"
          />

          <div className="flex items-center gap-1.5 px-2 pt-0.5 pb-2">
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
              <Icon name="plus" size={17} />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setOpenMenu((prev) => (prev === 'agentOptions' ? null : 'agentOptions'))}
              className="chip ghost max-w-[170px] justify-between px-2.5 text-sm"
              style={{ height: 28 }}
              title="切换模型与思考等级"
            >
              <AgentModelIcon model={model} />
              <span className="min-w-0 truncate text-(--color-text-2)">{model.shortLabel}</span>
              {effectiveThinkingLevel !== 'off' && (
                <span className="shrink-0 text-(--color-text-4)">{effectiveThinkingLabel}</span>
              )}
              <Icon
                name="chevron_right"
                size={13}
                className={openMenu === 'agentOptions' ? '-rotate-90' : 'rotate-90'}
              />
            </button>
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="chip flex items-center justify-center rounded-full p-0"
                style={{ width: 30, height: 30 }}
                title="停止"
                aria-label="停止"
              >
                <Icon name="stop_circle" size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className="cta flex items-center justify-center rounded-full p-0"
                style={{ width: 30, height: 30 }}
                title="发送"
                aria-label="发送"
              >
                <Icon name="send" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
