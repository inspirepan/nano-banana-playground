import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'

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
} from '../agent'
import { AGENT_THINKING_OPTIONS, type AgentModelConfig, type AgentThinkingLevel } from '../config/agentModels'
import { MODEL_CONFIGS } from '../config/models'
import { useWindowEvent } from '../hooks/effects'
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
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onApproveImageTask: (taskId: string) => void
  onCancelImageTask: (taskId: string) => void
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
}: {
  call: AgentMessageToolCall
  task: AgentImageTask | undefined
  result?: AgentMessageToolResult
  onApprove: (taskId: string) => void
  onCancel: (taskId: string) => void
}) {
  const [promptOpen, setPromptOpen] = useState(false)
  const status: AgentImageTask['status'] = task?.status ?? (result?.isError ? 'failed' : 'pending_approval')
  const danger = status === 'failed' || status === 'rejected' || status === 'canceled'
  const active = status === 'queued' || status === 'running'
  const reservedIds = task?.request.reservedImageIds ?? []
  const modelName = task ? (MODEL_CONFIGS.find((item) => item.id === task.request.modelId)?.name ?? task.request.modelId) : null
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

  return (
    <div className="rounded-[10px] bg-(--color-surface) px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-(--color-text-2)">生成图片</span>
        <span
          className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[11px]"
          style={{
            color: danger ? 'var(--color-danger)' : active ? 'var(--color-accent)' : 'var(--color-text-2)',
            background: danger
              ? 'var(--color-danger-soft)'
              : active
                ? 'var(--color-accent-soft)'
                : 'var(--color-surface-2)',
          }}
        >
          {taskStatusLabel(status)}
        </span>
        {active && <span className="spinner" style={{ width: 10, height: 10 }} />}
        {headerIds.length > 0 && (
          <span className="mono min-w-0 truncate text-sm text-(--color-text-3)" title={headerIds.join(', ')}>
            {headerIds.join(', ')}
          </span>
        )}
      </div>

      {task && (
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <div className="text-(--color-text-4)">模型</div>
          <div className="min-w-0 truncate text-(--color-text-2)">{modelName}</div>
          <div className="text-(--color-text-4)">尺寸</div>
          <div className="text-(--color-text-2)">
            {task.request.resolution} · {task.request.aspectRatio} · {task.request.batchCount} 张
          </div>
          {referenceIds.length > 0 && (
            <>
              <div className="text-(--color-text-4)">参考</div>
              <div className="mono min-w-0 truncate text-(--color-text-2)" title={referenceIds.join(', ')}>
                {referenceIds.join(', ')}
              </div>
            </>
          )}
        </div>
      )}
      {!task && (
        <div className="mt-1.5 text-sm text-(--color-text-4)">
          {requestedFromArgs ? `${requestedFromArgs} · ${requestedCountFromArgs} 张` : `${requestedCountFromArgs} 张`}
        </div>
      )}

      {promptText && (
        <>
          <button
            type="button"
            onClick={() => setPromptOpen((prev) => !prev)}
            aria-expanded={promptOpen}
            className="mt-2 flex items-center gap-1 bg-transparent p-0 text-sm text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
          >
            <Icon
              name="chevron_right"
              size={12}
              className={`transition-transform duration-200 ${promptOpen ? 'rotate-90' : ''}`}
            />
            提示词
          </button>
          {promptOpen && (
            <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-[7px] bg-(--color-surface-2) px-2.5 py-2 text-sm leading-[1.55] text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
              {promptText}
            </div>
          )}
        </>
      )}

      {resultIds.length > 0 && (
        <div className="mt-2.5 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
          {resultIds.map((id) => (
            <GenImageResultThumb key={id} id={id} />
          ))}
        </div>
      )}

      {task?.error && (
        <div className="mt-2 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {task.error}
        </div>
      )}
      {!task && result?.isError && (
        <div className="mt-2 text-sm leading-[1.45]" style={{ color: 'var(--color-danger)' }}>
          {summarizeToolResult(result)}
        </div>
      )}

      {(showApprove || showCancel) && task && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {showApprove && (
            <button
              type="button"
              onClick={() => onApprove(task.id)}
              className="chip text-sm"
              data-active
              style={{ height: 26, padding: '0 10px' }}
            >
              生成
            </button>
          )}
          {showCancel && (
            <button
              type="button"
              onClick={() => onCancel(task.id)}
              className="chip danger text-sm"
              style={{ height: 26, padding: '0 10px' }}
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
}: {
  calls: AgentMessageToolCall[]
  results: AgentMessageToolResult[]
  imageTaskByToolCallId: Map<string, AgentImageTask>
  isStreaming: boolean
  onApproveImageTask: (taskId: string) => void
  onCancelImageTask: (taskId: string) => void
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
  onToggleAutoApproveImageTasks,
  onApproveImageTask,
  onCancelImageTask,
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
  const [openMenu, setOpenMenu] = useState<'agentOptions' | null>(null)
  const currentKeyStatus = model.provider === 'google' ? googleKeyStatus : openaiKeyStatus
  const keyMissing = currentKeyStatus === 'empty'
  const canSend = !isStreaming && !keyMissing && (draft.trim() !== '' || attachments.length > 0)
  const visibleMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage],
  )
  const renderItems = useMemo(
    () => buildChatRenderItems(visibleMessages, streamingMessage),
    [visibleMessages, streamingMessage],
  )
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
                />
              ),
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
        <div ref={controlsRef} className="prompt-wrap relative rounded-[12px] bg-(--color-surface)">
          {openMenu === 'agentOptions' && (
            <div className="absolute right-2 bottom-[46px] z-50 w-[196px] rounded-[10px] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
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
            className="block max-h-[150px] min-h-[78px] w-full resize-none bg-transparent px-3 py-3 text-[16px] leading-[1.55] text-(--color-text) focus:outline-none md:text-base"
          />

          <div className="flex items-center gap-1.5 px-2.5 py-2">
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
            <button
              type="button"
              onClick={() => onToggleAutoApproveImageTasks(!autoApproveImageTasks)}
              className="chip text-sm"
              data-active={autoApproveImageTasks}
              style={{ height: 28, padding: '0 9px' }}
              title="Agent 创建的生图任务自动通过审批"
            >
              自动通过 {autoApproveImageTasks ? '开' : '关'}
            </button>
            {messages.length > 0 && !isStreaming && (
              <button type="button" onClick={onClear} className="chip text-sm" style={{ height: 28, padding: '0 9px' }}>
                清空
              </button>
            )}
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
    </div>
  )
}
