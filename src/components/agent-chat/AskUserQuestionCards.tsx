import { useCallback, useState, type CSSProperties } from 'react'

import type {
  AgentMessageToolCall,
  AgentMessageToolResult,
  AskUserQuestionAnswer,
  AskUserQuestionItem,
} from '../../agent'
import { Icon } from '../Icon'

type QuestionFormState = Record<number, { selected: string[]; note: string }>

function buildInitialQuestionFormState(questions: AskUserQuestionItem[]): QuestionFormState {
  const state: QuestionFormState = {}
  for (let index = 0; index < questions.length; index++) {
    state[index] = { selected: [], note: '' }
  }
  return state
}

export function AskUserQuestionForm({
  toolCallId,
  questions,
  onSubmit,
  onCancel,
}: {
  toolCallId: string
  questions: AskUserQuestionItem[]
  onSubmit: (toolCallId: string, answers: AskUserQuestionAnswer[]) => void
  onCancel: (toolCallId: string) => void
}) {
  const [form, setForm] = useState<QuestionFormState>(() => buildInitialQuestionFormState(questions))

  const toggleOption = useCallback((questionIndex: number, label: string, multi: boolean) => {
    setForm((prev) => {
      const current = prev[questionIndex] ?? { selected: [], note: '' }
      const exists = current.selected.includes(label)
      const nextSelected = multi
        ? exists
          ? current.selected.filter((item) => item !== label)
          : [...current.selected, label]
        : exists
          ? []
          : [label]
      return { ...prev, [questionIndex]: { ...current, selected: nextSelected } }
    })
  }, [])

  const setNote = useCallback((questionIndex: number, note: string) => {
    setForm((prev) => {
      const current = prev[questionIndex] ?? { selected: [], note: '' }
      return { ...prev, [questionIndex]: { ...current, note } }
    })
  }, [])

  const allAnswered = questions.every((_question, index) => {
    const entry = form[index]
    if (!entry) return false
    return entry.selected.length > 0 || entry.note.trim().length > 0
  })

  const handleSubmit = () => {
    const answers: AskUserQuestionAnswer[] = questions.map((question, index) => {
      const entry = form[index] ?? { selected: [], note: '' }
      return { question: question.question, selectedLabels: entry.selected, note: entry.note }
    })
    onSubmit(toolCallId, answers)
  }

  return (
    <div className="rounded-[8px] bg-(--color-surface) px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--color-text)">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
          关于
          {questions
            .map((q) => q.header)
            .filter((header): header is string => Boolean(header))
            .join('、') || '本次需求'}
          的问题
        </span>
        <span className="ml-auto text-sm text-(--color-text-4)">{questions.length} 个问题</span>
      </div>

      <div className="mt-3 space-y-4">
        {questions.map((question, index) => {
          const entry = form[index] ?? { selected: [], note: '' }
          return (
            <div key={index} className="space-y-2">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-(--color-text)">{question.question}</span>
                {question.multi_select && <span className="text-[11px] text-(--color-text-4)">可多选</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {question.options.map((option) => {
                  const checked = entry.selected.includes(option.label)
                  const shapeClass = question.multi_select ? 'rounded-[var(--radius-sm)] px-2.5' : 'rounded-full px-5'
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => toggleOption(index, option.label, question.multi_select)}
                      data-active={checked || undefined}
                      className={`group flex items-start gap-2 ${shapeClass} bg-(--color-surface) py-1 text-left shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-colors hover:bg-(--color-surface-2) hover:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] data-[active]:bg-(--color-accent-wash) data-[active]:shadow-[inset_0_0_0_1px_var(--color-accent-ring)]`}
                    >
                      {question.multi_select && (
                        <span
                          aria-hidden
                          className="mt-[3px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] transition-colors group-data-[active]:bg-(--color-accent) group-data-[active]:shadow-none"
                        >
                          <Icon
                            name="check"
                            className="h-3 w-3 text-(--color-accent-fg) opacity-0 transition-opacity group-data-[active]:opacity-100"
                          />
                        </span>
                      )}
                      <span className="flex flex-col items-start">
                        <span className="text-sm font-medium text-(--color-text-2) group-data-[active]:text-(--color-accent)">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="text-[12px] leading-[1.35] text-(--color-text-4)">{option.description}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                value={entry.note}
                onChange={(event) => setNote(index, event.target.value)}
                placeholder="补充说明（可选）"
                className={`h-7 min-w-[12em] max-w-full bg-(--color-surface) text-sm text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge)] placeholder:text-(--color-text-4) focus:shadow-[inset_0_0_0_1px_var(--color-accent-ring)] focus:outline-none ${
                  question.multi_select ? 'rounded-[var(--radius-sm)] px-2.5' : 'rounded-full px-5'
                }`}
                style={{ fieldSizing: 'content' } as CSSProperties}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onCancel(toolCallId)}
          className="chip ghost text-sm"
          style={{ height: 28, padding: '0 12px' }}
        >
          跳过
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="chip accent-active text-sm disabled:cursor-not-allowed disabled:opacity-45"
          style={{ height: 28, padding: '0 12px' }}
        >
          提交
        </button>
      </div>
    </div>
  )
}

export function AskUserQuestionResultCard({
  call,
  result,
}: {
  call: AgentMessageToolCall
  result: AgentMessageToolResult
}) {
  const questions = Array.isArray(call.arguments.questions) ? (call.arguments.questions as AskUserQuestionItem[]) : []
  const abandoned = result.text.includes('navigated away')
  const hasFormatted = /\nAnswer:/.test(result.text) || result.text.startsWith('Question:')

  return (
    <div className="rounded-[8px] bg-(--color-surface) px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      {!hasFormatted ? (
        <div className="space-y-2">
          <div className="text-sm leading-[1.55] text-(--color-text-3)">
            {abandoned ? '页面刷新或切换会话中断了这次问卷，没有作答内容。' : '没有作答内容。'}
          </div>
          {questions.length > 0 && (
            <ul className="space-y-1">
              {questions.map((question, index) => (
                <li key={index} className="text-sm text-(--color-text-2)">
                  {question.question}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {result.text.split(/\n---\n/).map((block, index) => {
            const trimmed = block.trim()
            if (!trimmed) return null
            const lines = trimmed.split('\n')
            const questionLine = lines.find((line) => line.startsWith('Question:')) ?? ''
            const answerStart = lines.findIndex((line) => line.startsWith('Answer:'))
            const noteLine = lines.find((line) => line.startsWith('Note:'))
            const questionText = questionLine.replace(/^Question:\s*/, '')
            const answerLines =
              answerStart >= 0
                ? lines
                    .slice(answerStart, noteLine ? lines.indexOf(noteLine) : lines.length)
                    .map((line, lineIndex) => (lineIndex === 0 ? line.replace(/^Answer:\s*/, '') : line))
                : []
            const answerText = answerLines.join('\n').trim()
            const isDismissed = /User dismissed the form|dismissed the form/i.test(answerText)
            const isEmpty = /^\(No (?:answer provided|option selected)\.\)$/i.test(answerText)
            const displayAnswer = isDismissed ? '已跳过' : isEmpty ? '未作答' : answerText
            return (
              <div key={index} className="space-y-0.5">
                <div className="text-sm font-semibold text-(--color-text)">{questionText}</div>
                <div className="whitespace-pre-wrap text-sm leading-[1.55] text-(--color-text-3)">{displayAnswer}</div>
                {noteLine && (
                  <div className="text-sm leading-[1.55] text-(--color-text-4)">
                    {noteLine.replace(/^Note:\s*/, '补充：')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
