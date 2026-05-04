import { useMemo, type ReactNode } from 'react'

import { AgentImageTaskCard } from './AgentImageTaskCard'
import { AskUserQuestionForm, AskUserQuestionResultCard } from './AskUserQuestionCards'
import {
  CompactToolGroup,
  InlineToolDone,
  InlineToolNotice,
  StandaloneToolResultRow,
  ToolCallRow,
} from './CompactToolGroup'
import type {
  AgentImageTask,
  AgentMessageToolCall,
  AgentMessageToolResult,
  AgentPendingQuestion,
  AskUserQuestionAnswer,
} from '../../agent'
import { useI18n } from '../../i18n'
import type { StackItem } from '../../lib/stacks'

type WebSearchResultLink = {
  position: number
  title: string
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function textFromXmlElement(parent: Element, tagName: string): string {
  return parent.querySelector(tagName)?.textContent?.trim() ?? ''
}

function readSearchResultsFromDetails(details: unknown): WebSearchResultLink[] {
  if (!isRecord(details) || !Array.isArray(details.results)) return []
  return details.results.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.url !== 'string' || item.url.trim() === '') return []
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : item.url.trim()
    const position = typeof item.position === 'number' && Number.isFinite(item.position) ? item.position : index + 1
    return [{ position, title, url: item.url.trim() }]
  })
}

function readSearchResultsFromText(text: string): WebSearchResultLink[] {
  const match = text.match(/<search_results>[\s\S]*?<\/search_results>/)
  if (!match || typeof DOMParser === 'undefined') return []

  const doc = new DOMParser().parseFromString(match[0], 'text/xml')
  if (doc.querySelector('parsererror')) return []
  return Array.from(doc.querySelectorAll('result')).flatMap((item, index) => {
    const url = textFromXmlElement(item, 'url')
    if (!url) return []
    const title = textFromXmlElement(item, 'title') || url
    const rawPosition = Number(item.getAttribute('position'))
    return [{ position: Number.isFinite(rawPosition) ? rawPosition : index + 1, title, url }]
  })
}

function formatSearchResultDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function WebSearchResultLinks({ result }: { result: AgentMessageToolResult }) {
  if (result.isError) return null
  const links = readSearchResultsFromDetails(result.details)
  const results = links.length > 0 ? links : readSearchResultsFromText(result.text)
  if (results.length === 0) return null

  return (
    <div className="mt-1.5 pl-3.5">
      <ol className="space-y-0.5">
        {results.map((item) => (
          <li key={`${item.position}-${item.url}`} className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block min-w-0 truncate rounded-[var(--radius-sm)] px-1 py-0.5 text-sm font-normal text-(--color-text-3) transition-[background-color,color] duration-150 hover:bg-(--color-surface-2) hover:text-(--color-text-2)"
            >
              <span className="font-normal text-(--color-text-3)">{formatSearchResultDomain(item.url)}</span>
              <span className="mx-1 text-(--color-text-4)">·</span>
              <span className="font-normal text-(--color-text-3)">{item.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ToolActivityCard({
  calls,
  results,
  imageTaskByToolCallId,
  stackItemByImageId,
  stackItemNumberByImageId,
  pendingQuestionByToolCallId,
  isStreaming,
  autoApproveImageTasks,
  onApproveImageTask,
  onCancelImageTask,
  onToggleAutoApproveImageTasks,
  onSubmitQuestionAnswers,
  onCancelQuestion,
  onFocusImageTask,
}: {
  calls: AgentMessageToolCall[]
  results: AgentMessageToolResult[]
  imageTaskByToolCallId: Map<string, AgentImageTask>
  stackItemByImageId: Map<string, StackItem>
  stackItemNumberByImageId: Map<string, number>
  pendingQuestionByToolCallId: Map<string, AgentPendingQuestion>
  isStreaming: boolean
  autoApproveImageTasks: boolean
  onApproveImageTask: (taskId: string) => void
  onCancelImageTask: (taskId: string) => void
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onSubmitQuestionAnswers: (toolCallId: string, answers: AskUserQuestionAnswer[]) => void
  onCancelQuestion: (toolCallId: string) => void
  onFocusImageTask?: (task: AgentImageTask) => void
}) {
  const { t } = useI18n()
  const resultByCallId = useMemo(() => new Map(results.map((result) => [result.toolCallId, result])), [results])

  // GenImage calls render as standalone rich cards; AskUserQuestion renders a
  // form or result card; ReadImage / AskUserQuestion mid-stream collapse into a
  // single gray "system event" line; everything else falls into the compact
  // AGENT tool group.
  const compactRows: ReactNode[] = []
  const richCards: ReactNode[] = []
  const inlineNotices: ReactNode[] = []

  for (const call of calls) {
    if (call.name === 'GenImage') {
      richCards.push(
        <AgentImageTaskCard
          key={call.id}
          call={call}
          task={imageTaskByToolCallId.get(call.id)}
          stackItemByImageId={stackItemByImageId}
          stackItemNumberByImageId={stackItemNumberByImageId}
          result={resultByCallId.get(call.id)}
          isStreaming={isStreaming}
          autoApproveImageTasks={autoApproveImageTasks}
          onApprove={onApproveImageTask}
          onCancel={onCancelImageTask}
          onToggleAutoApproveImageTasks={onToggleAutoApproveImageTasks}
          onFocus={onFocusImageTask}
        />,
      )
      continue
    }
    if (call.name === 'AskUserQuestion') {
      const pending = pendingQuestionByToolCallId.get(call.id)
      const finished = resultByCallId.get(call.id)
      if (pending) {
        richCards.push(
          <AskUserQuestionForm
            key={call.id}
            toolCallId={pending.toolCallId}
            questions={pending.questions}
            onSubmit={onSubmitQuestionAnswers}
            onCancel={onCancelQuestion}
          />,
        )
      } else if (finished) {
        richCards.push(<AskUserQuestionResultCard key={call.id} call={call} result={finished} />)
      } else {
        inlineNotices.push(<InlineToolNotice key={call.id} label={t('agentChat.tool.askUserQuestion.preparing')} />)
      }
      continue
    }
    if (call.name === 'ReadImage') {
      const finished = resultByCallId.get(call.id)
      if (!finished) {
        inlineNotices.push(<InlineToolNotice key={call.id} label={t('agentChat.tool.readImage.reading')} />)
        continue
      }
      const imageId =
        typeof call.arguments.image_id === 'string' ? call.arguments.image_id : t('agentChat.tool.args.image')
      if (finished.isError) {
        const errText = finished.text?.trim() || t('agentChat.tool.result.failed')
        inlineNotices.push(
          <InlineToolDone
            key={call.id}
            label={t('agentChat.tool.readImage.failed', { id: imageId, error: errText })}
          />,
        )
      } else {
        inlineNotices.push(<InlineToolDone key={call.id} label={t('agentChat.tool.readImage.done', { id: imageId })} />)
      }
      continue
    }
    if (call.name === 'WebSearch') {
      const result = resultByCallId.get(call.id)
      compactRows.push(
        <ToolCallRow key={call.id} call={call} result={result}>
          {result ? <WebSearchResultLinks result={result} /> : null}
        </ToolCallRow>,
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

  const showCompact = compactRows.length > 0

  return (
    <div className="space-y-2">
      {showCompact && <CompactToolGroup rows={compactRows} />}
      {richCards.length > 0 ? <div className="space-y-2">{richCards}</div> : null}
      {inlineNotices}
    </div>
  )
}
