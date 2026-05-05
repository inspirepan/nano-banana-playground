import { useMemo, type ReactNode } from 'react'

import { AgentImageTaskCard } from './AgentImageTaskCard'
import { AskUserQuestionForm, AskUserQuestionResultCard } from './AskUserQuestionCards'
import { InlineToolDone, InlineToolNotice } from './CompactToolGroup'
import type { AgentImageTaskFocusHandler } from './types'
import { summarizeToolArgs, toolLabel } from './utils'
import type {
  AgentImageTask,
  AgentMessageToolCall,
  AgentMessageToolResult,
  AgentPendingQuestion,
  AskUserQuestionAnswer,
} from '../../agent'
import { useI18n, type Translate } from '../../i18n'
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

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function hasSkillDisplayString(args: Record<string, unknown>, snakeKey: string, camelKey: string): boolean {
  return hasNonEmptyString(args[snakeKey]) || hasNonEmptyString(args[camelKey])
}

function hasRenderableSkillFile(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecord(item) && hasNonEmptyString(item.path) && hasNonEmptyString(item.content))
  )
}

function hasCompleteToolArguments(call: AgentMessageToolCall): boolean {
  const args = call.arguments
  if (call.name === 'AskUserQuestion') return Array.isArray(args.questions) && args.questions.length > 0
  if (call.name === 'ReadImage') return hasNonEmptyString(args.image_id)
  if (call.name === 'ReadAgentFile') return hasNonEmptyString(args.path)
  if (call.name === 'Skill') return hasNonEmptyString(args.skill)
  if (call.name === 'ReadSkillFile') return hasNonEmptyString(args.skill) && hasNonEmptyString(args.path)
  if (call.name === 'CreateSkill') {
    return (
      hasNonEmptyString(args.name) &&
      hasSkillDisplayString(args, 'agent_description', 'agentDescription') &&
      hasSkillDisplayString(args, 'display_name_zh', 'displayNameZh') &&
      hasSkillDisplayString(args, 'display_name_en', 'displayNameEn') &&
      hasSkillDisplayString(args, 'display_description_zh', 'displayDescriptionZh') &&
      hasSkillDisplayString(args, 'display_description_en', 'displayDescriptionEn') &&
      hasRenderableSkillFile(args.files)
    )
  }
  if (call.name === 'WebFetch') return hasNonEmptyString(args.url)
  if (call.name === 'WebSearch') return hasNonEmptyString(args.query)
  return Object.keys(args).length > 0
}

function toolErrorText(result: AgentMessageToolResult, t: Translate): string {
  return result.text?.trim() || t('agentChat.tool.result.failed')
}

function toolPreparingLabel(call: AgentMessageToolCall, t: Translate): string {
  if (call.name === 'AskUserQuestion') return t('agentChat.tool.askUserQuestion.preparing')
  if (call.name === 'ReadImage') return t('agentChat.tool.readImage.preparing')
  if (call.name === 'ReadAgentFile') return t('agentChat.tool.readAgentFile.preparing')
  if (call.name === 'Skill') return t('agentChat.tool.skill.preparing')
  if (call.name === 'ReadSkillFile') return t('agentChat.tool.readSkillFile.preparing')
  if (call.name === 'CreateSkill') return t('agentChat.tool.createSkill.preparing')
  if (call.name === 'WebFetch') return t('agentChat.tool.webFetch.preparing')
  if (call.name === 'WebSearch') return t('agentChat.tool.webSearch.preparing')
  return t('agentChat.tool.preparing.generic')
}

function toolRunningLabel(call: AgentMessageToolCall, t: Translate): string {
  const args = summarizeToolArgs(call)
  if (call.name === 'ReadImage') return t('agentChat.tool.readImage.running', { id: args })
  if (call.name === 'ReadAgentFile') return t('agentChat.tool.readAgentFile.running', { path: args })
  if (call.name === 'Skill') return t('agentChat.tool.skill.running', { name: args })
  if (call.name === 'ReadSkillFile') return t('agentChat.tool.readSkillFile.running', { path: args })
  if (call.name === 'CreateSkill') return t('agentChat.tool.createSkill.running', { name: args })
  if (call.name === 'WebFetch') return t('agentChat.tool.webFetch.running', { url: args })
  if (call.name === 'WebSearch') return t('agentChat.tool.webSearch.running', { query: args })
  return `${toolLabel(call.name)}: ${args}`
}

function toolDoneLabel(call: AgentMessageToolCall, result: AgentMessageToolResult, t: Translate): string {
  const args = summarizeToolArgs(call)
  if (result.isError) {
    const error = toolErrorText(result, t)
    if (call.name === 'ReadImage') return t('agentChat.tool.readImage.failed', { id: args, error })
    if (call.name === 'ReadAgentFile') return t('agentChat.tool.readAgentFile.failed', { path: args, error })
    if (call.name === 'Skill') return t('agentChat.tool.skill.failed', { name: args, error })
    if (call.name === 'ReadSkillFile') return t('agentChat.tool.readSkillFile.failed', { path: args, error })
    if (call.name === 'CreateSkill') return t('agentChat.tool.createSkill.failed', { name: args, error })
    if (call.name === 'WebFetch') return t('agentChat.tool.webFetch.failed', { url: args, error })
    if (call.name === 'WebSearch') return t('agentChat.tool.webSearch.failed', { query: args, error })
    return `${toolLabel(call.name)} ${t('agentChat.tool.result.failed')}: ${error}`
  }
  if (call.name === 'ReadImage') return t('agentChat.tool.readImage.done', { id: args })
  if (call.name === 'ReadAgentFile') return t('agentChat.tool.readAgentFile.done', { path: args })
  if (call.name === 'Skill') return t('agentChat.tool.skill.done', { name: args })
  if (call.name === 'ReadSkillFile') return t('agentChat.tool.readSkillFile.done', { path: args })
  if (call.name === 'CreateSkill') return t('agentChat.tool.createSkill.done', { name: args })
  if (call.name === 'WebFetch') return t('agentChat.tool.webFetch.done', { url: args })
  if (call.name === 'WebSearch') return t('agentChat.tool.webSearch.done', { query: args })
  return `${toolLabel(call.name)} ${t('agentChat.tool.result.completed')}`
}

function standaloneResultLabel(result: AgentMessageToolResult, t: Translate): string {
  const label = toolLabel(result.toolName)
  if (result.isError) {
    return t('agentChat.tool.standalone.failed', { tool: label, error: toolErrorText(result, t) })
  }
  return t('agentChat.tool.standalone.done', { tool: label })
}

function formatSearchResultDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function TreeConnector({ isLast }: { isLast: boolean }) {
  return (
    <div className="relative w-4 shrink-0 self-stretch">
      <div
        className="absolute left-[7px] w-px bg-(--color-text-4)"
        style={isLast ? { top: 0, height: '50%' } : { top: 0, bottom: 0 }}
      />
      <div className="absolute left-[7px] top-1/2 h-px w-2 bg-(--color-text-4)" />
    </div>
  )
}

function WebSearchResultLinks({ result }: { result: AgentMessageToolResult }) {
  if (result.isError) return null
  const links = readSearchResultsFromDetails(result.details)
  const results = links.length > 0 ? links : readSearchResultsFromText(result.text)
  if (results.length === 0) return null

  return (
    <div className="mt-1.5">
      <ol>
        {results.map((item, index) => {
          const isLast = index === results.length - 1
          return (
            <li key={`${item.position}-${item.url}`} className="flex items-start">
              <TreeConnector isLast={isLast} />
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
          )
        })}
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
  onFocusImageTask?: AgentImageTaskFocusHandler
}) {
  const { t } = useI18n()
  const resultByCallId = useMemo(() => new Map(results.map((result) => [result.toolCallId, result])), [results])

  // GenImage and AskUserQuestion render as standalone rich cards because they
  // require user interaction (approval / form submission). All other tools use
  // lightweight inline rows to minimize card clutter.
  const richCards: ReactNode[] = []
  const inlineNotices: ReactNode[] = []

  for (const call of calls) {
    const result = resultByCallId.get(call.id)
    if (call.name === 'GenImage') {
      richCards.push(
        <AgentImageTaskCard
          key={call.id}
          call={call}
          task={imageTaskByToolCallId.get(call.id)}
          stackItemByImageId={stackItemByImageId}
          stackItemNumberByImageId={stackItemNumberByImageId}
          result={result}
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
    if (isStreaming && !result && !hasCompleteToolArguments(call)) {
      inlineNotices.push(<InlineToolNotice key={call.id} label={toolPreparingLabel(call, t)} />)
      continue
    }
    if (call.name === 'AskUserQuestion') {
      const pending = pendingQuestionByToolCallId.get(call.id)
      const finished = result
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

    // Unified inline treatment for all remaining tools.
    if (!result) {
      inlineNotices.push(<InlineToolNotice key={call.id} label={toolRunningLabel(call, t)} />)
      continue
    }
    if (call.name === 'WebSearch') {
      inlineNotices.push(
        <InlineToolDone key={call.id} label={toolDoneLabel(call, result, t)}>
          {!result.isError && <WebSearchResultLinks result={result} />}
        </InlineToolDone>,
      )
    } else {
      inlineNotices.push(<InlineToolDone key={call.id} label={toolDoneLabel(call, result, t)} />)
    }
  }
  if (calls.length === 0) {
    for (const result of results) {
      inlineNotices.push(<InlineToolDone key={result.toolCallId} label={standaloneResultLabel(result, t)} />)
    }
  }

  return (
    <div className="space-y-2">
      {richCards.length > 0 ? <div className="space-y-2">{richCards}</div> : null}
      {inlineNotices}
    </div>
  )
}
