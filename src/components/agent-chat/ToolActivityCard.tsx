import type { ReactNode } from 'react'

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

export function ToolActivityCard({
  calls,
  results,
  imageTaskByToolCallId,
  pendingQuestionByToolCallId,
  isStreaming,
  onApproveImageTask,
  onCancelImageTask,
  onSubmitQuestionAnswers,
  onCancelQuestion,
  onFocusImageTask,
}: {
  calls: AgentMessageToolCall[]
  results: AgentMessageToolResult[]
  imageTaskByToolCallId: Map<string, AgentImageTask>
  pendingQuestionByToolCallId: Map<string, AgentPendingQuestion>
  isStreaming: boolean
  onApproveImageTask: (taskId: string) => void
  onCancelImageTask: (taskId: string) => void
  onSubmitQuestionAnswers: (toolCallId: string, answers: AskUserQuestionAnswer[]) => void
  onCancelQuestion: (toolCallId: string) => void
  onFocusImageTask?: (task: AgentImageTask) => void
}) {
  const resultByCallId = new Map(results.map((result) => [result.toolCallId, result]))

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
          result={resultByCallId.get(call.id)}
          onApprove={onApproveImageTask}
          onCancel={onCancelImageTask}
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
        inlineNotices.push(<InlineToolNotice key={call.id} label="正在准备问卷…" />)
      }
      continue
    }
    if (call.name === 'ReadImage') {
      const finished = resultByCallId.get(call.id)
      if (!finished) {
        inlineNotices.push(<InlineToolNotice key={call.id} label="正在读取图片…" />)
        continue
      }
      const imageId = typeof call.arguments.image_id === 'string' ? call.arguments.image_id : '图片'
      if (finished.isError) {
        const errText = finished.text?.trim() || '读取失败'
        inlineNotices.push(<InlineToolDone key={call.id} label={`读取图片 ${imageId} 失败：${errText}`} />)
      } else {
        inlineNotices.push(<InlineToolDone key={call.id} label={`已读取图片 ${imageId}`} />)
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
      {richCards.length > 0 && (
        <div className="flex justify-start">
          <div className="mr-3 w-full max-w-[94%] space-y-2">{richCards}</div>
        </div>
      )}
      {inlineNotices}
    </div>
  )
}
