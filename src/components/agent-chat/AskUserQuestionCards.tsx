import { useCallback, useState, type CSSProperties } from 'react'

import type {
  AgentMessageToolCall,
  AgentMessageToolResult,
  AskUserQuestionAnswer,
  AskUserQuestionItem,
  AskUserQuestionResultDetails,
} from '../../agent'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

type QuestionFormState = Record<number, { selected: string[]; note: string }>

type RenderedQuestionAnswer = {
  question: string
  answer: string
  note?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAskUserQuestionResultStatus(value: unknown): value is AskUserQuestionResultDetails['status'] {
  return value === 'submitted' || value === 'cancelled' || value === 'decide_for_me'
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function readQuestionResultDetails(details: unknown): AskUserQuestionResultDetails | null {
  if (!isRecord(details) || !isAskUserQuestionResultStatus(details.status)) return null
  if (!Array.isArray(details.questions) || !Array.isArray(details.answers)) return null

  const questions = details.questions.flatMap((item) => {
    if (!isRecord(item) || typeof item.question !== 'string') return []
    const header = typeof item.header === 'string' ? item.header : item.question.slice(0, 12)
    const options = Array.isArray(item.options) ? item.options : []
    return [
      {
        question: item.question,
        header,
        options: options.flatMap((option) => {
          if (!isRecord(option) || typeof option.label !== 'string') return []
          return [
            typeof option.description === 'string'
              ? { label: option.label, description: option.description }
              : { label: option.label },
          ]
        }),
        multi_select: item.multi_select === true,
      },
    ]
  })

  const answers = details.answers.flatMap((item) => {
    if (!isRecord(item) || typeof item.question !== 'string') return []
    return [
      {
        question: item.question,
        selectedLabels: readStringArray(item.selectedLabels),
        note: typeof item.note === 'string' ? item.note : '',
      },
    ]
  })

  return {
    status: details.status,
    questions,
    answers,
    ...(typeof details.reason === 'string' ? { reason: details.reason } : {}),
  }
}

function extractToolUseError(text: string): string | null {
  const match = text.match(/<tool_use_error>\s*([\s\S]*?)\s*<\/tool_use_error>/)
  return match ? match[1].trim() : null
}

function removeExpectedShape(text: string): string {
  return text
    .replace(/\n\s*Expected shape:\s*[\s\S]*$/i, '')
    .replace(/\n\s*Received arguments:\s*[\s\S]*$/i, '')
    .trim()
}

function renderAnsweredQuestions(items: RenderedQuestionAnswer[]) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="space-y-0.5">
          <div className="text-sm font-semibold text-(--color-text)">{item.question}</div>
          <div className="whitespace-pre-wrap text-sm leading-[1.55] text-(--color-text-3)">{item.answer}</div>
          {item.note ? <div className="text-sm leading-[1.55] text-(--color-text-3)">{item.note}</div> : null}
        </div>
      ))}
    </div>
  )
}

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
      className="m-1 rounded-[var(--radius-lg)] p-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
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
        <span className="min-w-0 flex-1 text-base font-semibold text-(--color-text)">
          {t('agentChat.question.title')}
        </span>
        <button
          type="button"
          onClick={() => onCancel(toolCallId)}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] bg-(--color-accent-wash) px-2.5 text-[12px] font-semibold text-(--color-accent) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] transition-[background,box-shadow,color] hover:bg-(--color-accent-wash-2) hover:shadow-[inset_0_0_0_1px_var(--ring-edge)]"
        >
          <Icon name="circle_play" className="h-3.5 w-3.5" strokeWidth={2} />
          {t('agentChat.question.decideForMe')}
        </button>
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
                  const description = option.description?.trim()
                  const shapeClass = question.multi_select ? 'rounded-[var(--radius-sm)] px-2.5' : 'rounded-full px-5'
                  const alignClass = description ? 'items-start py-1' : 'items-center py-1.5'
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => toggleOption(index, option.label, question.multi_select)}
                      data-active={checked || undefined}
                      className={`group flex gap-2 ${shapeClass} ${alignClass} bg-(--color-surface) text-left shadow-[inset_0_0_0_1px_var(--ring-edge)] transition-[background,box-shadow,color] hover:bg-(--color-surface-2) hover:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] data-[active]:bg-(--color-accent-wash) data-[active]:shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] data-[active]:hover:bg-(--color-accent-wash-2) data-[active]:hover:shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]`}
                    >
                      {question.multi_select && (
                        <span
                          aria-hidden
                          className={`${description ? 'mt-[3px]' : ''} inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-strong)] transition-colors group-data-[active]:bg-(--color-accent) group-data-[active]:shadow-none`}
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
                        {description && (
                          <span className="text-[12px] leading-[1.35] text-(--color-text-3) group-data-[active]:text-(--color-text-2)">
                            {description}
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
  const [detailsOpen, setDetailsOpen] = useState(false)
  const questions = Array.isArray(call.arguments.questions) ? (call.arguments.questions as AskUserQuestionItem[]) : []
  const toolUseError = extractToolUseError(result.text)
  const toolUseErrorDetail = toolUseError ? removeExpectedShape(toolUseError) : null
  const abandoned = result.text.includes('navigated away')
  const structuredResult = readQuestionResultDetails(result.details)
  const hasFormatted = /\nAnswer:/.test(result.text) || result.text.startsWith('Question:')
  const structuredAnswers = structuredResult
    ? structuredResult.questions.map((question) => {
        const answer = structuredResult.answers.find((item) => item.question === question.question)
        const selected = answer?.selectedLabels ?? []
        const answerText =
          structuredResult.status === 'cancelled'
            ? t('agentChat.question.dismissed')
            : structuredResult.status === 'decide_for_me'
              ? t('agentChat.question.decidedByAgent')
              : selected.length > 0
                ? question.multi_select || selected.length > 1
                  ? selected.map((label) => `- ${label}`).join('\n')
                  : selected[0]
                : t('agentChat.question.emptyAnswer')
        return {
          question: question.question,
          answer: answerText,
          note: answer?.note.trim() ? t('agentChat.question.notePrefix', { note: answer.note.trim() }) : undefined,
        }
      })
    : []

  if (toolUseErrorDetail) {
    return (
      <div
        className="m-1 w-fit max-w-full rounded-[var(--radius-md)] px-3.5 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-danger)_24%,transparent)]"
        style={{ background: 'var(--color-danger-soft)' }}
      >
        <div className="text-sm font-semibold text-(--color-danger)">{t('agentChat.question.toolErrorTitle')}</div>
        <div className="mt-1 text-sm leading-[1.55] text-(--color-text-2)">
          {t('agentChat.question.toolErrorDescription')}
        </div>
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((prev) => !prev)}
          className="mt-2 inline-flex items-center gap-1 bg-transparent p-0 text-sm font-medium text-(--color-text-3) transition-colors hover:text-(--color-text)"
        >
          {detailsOpen ? t('agentChat.question.collapseDetails') : t('agentChat.question.expandDetails')}
          <Icon name={detailsOpen ? 'keyboard_arrow_up' : 'expand_more'} className="h-3.5 w-3.5" />
        </button>
        {detailsOpen && (
          <pre className="mt-2 max-w-full whitespace-pre-wrap break-words font-sans text-[12px] leading-[1.5] text-(--color-text-3)">
            {toolUseErrorDetail}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div
      className="m-1 w-fit max-w-full rounded-[var(--radius-md)] px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
      style={{ background: 'var(--color-accent-soft)' }}
    >
      {structuredAnswers.length > 0 ? (
        renderAnsweredQuestions(structuredAnswers)
      ) : !hasFormatted ? (
        <div className="space-y-2">
          <div className="text-sm leading-[1.55] text-(--color-text-3)">
            {abandoned ? t('agentChat.question.noAnswerAfterNavigation') : t('agentChat.question.noAnswer')}
          </div>
          {questions.length > 0 ? (
            <ul className="space-y-1">
              {questions.map((question, index) => (
                <li key={index} className="text-sm text-(--color-text-2)">
                  {question.question}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        renderAnsweredQuestions(
          result.text.split(/\n---\n/).flatMap((block) => {
            const trimmed = block.trim()
            if (!trimmed) return []
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
            const isDecideForMe = /User chose "Decide for me"|Decide for me/i.test(answerText)
            const isEmpty = /^\(No (?:answer provided|option selected)\.\)$/i.test(answerText)
            return [
              {
                question: questionText,
                answer: isDismissed
                  ? t('agentChat.question.dismissed')
                  : isDecideForMe
                    ? t('agentChat.question.decidedByAgent')
                    : isEmpty
                      ? t('agentChat.question.emptyAnswer')
                      : answerText,
                note: noteLine
                  ? t('agentChat.question.notePrefix', { note: noteLine.replace(/^Note:\s*/, '') })
                  : undefined,
              },
            ]
          }),
        )
      )}
    </div>
  )
}
