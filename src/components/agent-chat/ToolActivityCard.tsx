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

export function ToolActivityCard({
  calls,
  results,
  imageTaskByToolCallId,
  stackItemByImageId,
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
    compactRows.push(<ToolCallRow key={call.id} call={call} result={resultByCallId.get(call.id)} />)
  }
  if (calls.length === 0) {
    for (const result of results) {
      compactRows.push(<StandaloneToolResultRow key={result.toolCallId} result={result} />)
    }
  }

  const showCompact =
    compactRows.length > 0 || (calls.length === 0 && results.length === 0 && inlineNotices.length === 0)

  return (
    <div className="space-y-2">
      {showCompact && (
        <CompactToolGroup
          rows={compactRows}
          isStreaming={isStreaming && richCards.length === 0 && inlineNotices.length === 0}
        />
      )}
      {richCards.length > 0 ? <div className="space-y-2">{richCards}</div> : null}
      {inlineNotices}
    </div>
  )
}
