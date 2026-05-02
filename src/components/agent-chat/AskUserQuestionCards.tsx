import { useCallback, useState, type CSSProperties } from 'react'

import type {
  AgentMessageToolCall,
  AgentMessageToolResult,
  AskUserQuestionAnswer,
  AskUserQuestionItem,
} from '../../agent'
import { useI18n } from '../../i18n'
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
  const { t } = useI18n()
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

  const topics = questions.map((q) => q.header).filter((header): header is string => Boolean(header))
  const topicText = topics.join(t('agentChat.question.topicSeparator'))

  return (
    <div
      className="rounded-[var(--radius-lg)] p-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
      style={{ background: 'var(--color-bg-sunken)' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-(--color-accent-fg)"
          style={{ background: 'var(--color-accent)' }}
        >
          <Icon name="help_circle" className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <span className="text-base font-semibold text-(--color-text)">{t('agentChat.question.title')}</span>
        <span
          className="ml-auto rounded-full bg-(--color-surface) px-2 py-0.5 text-[11px] font-medium text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {t('agentChat.question.count', { count: questions.length })}
        </span>
      </div>

      {topics.length > 0 && (
        <div className="mt-1 text-[12px] text-(--color-text-3)">
          {t('agentChat.question.topics', { topics: topicText })}
        </div>
      )}

      <div className="mt-3">
        {questions.map((question, index) => {
          const entry = form[index] ?? { selected: [], note: '' }
          return (
            <div key={index} className={index > 0 ? 'mt-3 pt-3 shadow-[inset_0_1px_0_var(--ring-edge-soft)]' : ''}>
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[var(--radius-xs)] px-1 text-[11px] font-semibold text-(--color-text)"
                  style={{ background: 'var(--color-bg)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-(--color-text)">{question.question}</span>
                {question.multi_select && (
                  <span className="ml-auto text-[11px] text-(--color-text-4)">
                    {t('agentChat.question.multiSelect')}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {question.options.map((option) => {
                  const checked = entry.selected.includes(option.label)
                  const shapeClass = question.multi_select ? 'rounded-[var(--radius-sm)] px-2.5' : 'rounded-full px-5'
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => toggleOption(index, option.label, question.multi_select)}
                      data-active={checked || undefined}
                      className={`group flex items-start gap-2 ${shapeClass} bg-(--color-surface) py-1 text-left shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-[background,box-shadow,color] hover:bg-(--color-surface-2) hover:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] data-[active]:bg-(--color-accent-wash) data-[active]:shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] data-[active]:hover:bg-(--color-accent-wash-2) data-[active]:hover:shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]`}
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
                          <span className="text-[12px] leading-[1.35] text-(--color-text-3) group-data-[active]:text-(--color-text-2)">
                            {option.description}
                          </span>
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
                placeholder={t('agentChat.question.notePlaceholder')}
                data-active={entry.note.trim().length > 0 || undefined}
                className={`mt-2 h-7 min-w-[12em] max-w-full bg-(--color-surface) text-sm font-medium text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-[background,box-shadow,color] placeholder:font-normal placeholder:text-(--color-text-4) focus:shadow-[inset_0_0_0_1px_var(--color-accent)] focus:outline-none data-[active]:bg-(--color-accent-wash) data-[active]:text-(--color-accent) data-[active]:shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] ${
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
          {t('agentChat.question.skip')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="chip accent-active text-sm disabled:cursor-not-allowed disabled:opacity-45"
          style={{ height: 28, padding: '0 12px' }}
        >
          {t('agentChat.question.submit')}
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
  const { t } = useI18n()
  const questions = Array.isArray(call.arguments.questions) ? (call.arguments.questions as AskUserQuestionItem[]) : []
  const abandoned = result.text.includes('navigated away')
  const hasFormatted = /\nAnswer:/.test(result.text) || result.text.startsWith('Question:')

  return (
    <div
      className="rounded-[var(--radius-md)] px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
      style={{ background: 'var(--color-accent-soft)' }}
    >
      {!hasFormatted ? (
        <div className="space-y-2">
          <div className="text-sm leading-[1.55] text-(--color-text-3)">
            {abandoned ? t('agentChat.question.noAnswerAfterNavigation') : t('agentChat.question.noAnswer')}
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
            const displayAnswer = isDismissed
              ? t('agentChat.question.dismissed')
              : isEmpty
                ? t('agentChat.question.emptyAnswer')
                : answerText
            return (
              <div key={index} className="space-y-0.5">
                <div className="text-sm font-semibold text-(--color-text)">{questionText}</div>
                <div className="whitespace-pre-wrap text-sm leading-[1.55] text-(--color-text-3)">{displayAnswer}</div>
                {noteLine && (
                  <div className="text-sm leading-[1.55] text-(--color-text-3)">
                    {t('agentChat.question.notePrefix', { note: noteLine.replace(/^Note:\s*/, '') })}
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
