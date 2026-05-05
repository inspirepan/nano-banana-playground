import { Type } from '@mariozechner/pi-ai'

import description from './askUserQuestion.md?raw'
import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import { translate } from '../../i18n'

export type AskUserQuestionOption = {
  label: string
  description?: string
}

export type AskUserQuestionItem = {
  question: string
  header: string
  options: AskUserQuestionOption[]
  multi_select: boolean
}

export type AskUserQuestionToolArgs = {
  questions: AskUserQuestionItem[]
}

export type PreparedAskUserQuestionToolArgs = AskUserQuestionToolArgs & {
  validationErrors: string[]
}

export type AskUserQuestionAnswer = {
  question: string
  selectedLabels: string[]
  note: string
}

export type AskUserQuestionResultDetails = {
  status: 'submitted' | 'cancelled' | 'decide_for_me'
  questions: AskUserQuestionItem[]
  answers: AskUserQuestionAnswer[]
  reason?: string
}

export type AskUserQuestionExecutor = (
  toolCallId: string,
  args: PreparedAskUserQuestionToolArgs,
  signal?: AbortSignal,
) => Promise<AgentToolResult>

function normalizeOption(value: unknown, path: string, errors: string[]): AskUserQuestionOption | null {
  if (typeof value !== 'object' || value === null) {
    errors.push(`${path} must be an object with a label.`)
    return null
  }
  const record = value as Record<string, unknown>
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const desc = typeof record.description === 'string' ? record.description.trim() : ''
  if (!label) {
    errors.push(`${path}.label is required.`)
    return null
  }
  return desc ? { label, description: desc } : { label }
}

function normalizeQuestion(value: unknown, index: number, errors: string[]): AskUserQuestionItem | null {
  const path = `questions[${index}]`
  if (typeof value !== 'object' || value === null) {
    errors.push(`${path} must be an object.`)
    return null
  }
  const record = value as Record<string, unknown>
  const question = typeof record.question === 'string' ? record.question.trim() : ''
  const header = typeof record.header === 'string' ? record.header.trim() : ''
  if (!question) errors.push(`${path}.question is required.`)
  if (header.length > 12) errors.push(`${path}.header must be 12 characters or fewer.`)

  if (!Array.isArray(record.options)) {
    errors.push(`${path}.options must be an array with at least 2 options.`)
    return null
  }
  if (record.options.length < 2) {
    errors.push(`${path}.options must contain at least 2 options.`)
  }
  const options = record.options
    .map((option, optionIndex) => normalizeOption(option, `${path}.options[${optionIndex}]`, errors))
    .filter((option): option is AskUserQuestionOption => option !== null)
  if (!question || options.length < 2) return null
  const multiSelect =
    record.multi_select === true || record.multiSelect === true || record.multi_select === 'true' ? true : false
  return { question, header: header || question.slice(0, 12), options, multi_select: multiSelect }
}

export function prepareAskUserQuestionArgs(args: unknown): PreparedAskUserQuestionToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const validationErrors: string[] = []
  if (!Array.isArray(record.questions)) {
    validationErrors.push('questions must be an array with 1-4 questions.')
    return { questions: [], validationErrors }
  }
  if (record.questions.length < 1 || record.questions.length > 4) {
    validationErrors.push('questions must contain 1-4 questions.')
  }
  const questions = record.questions
    .map((question, index) => normalizeQuestion(question, index, validationErrors))
    .filter((item): item is AskUserQuestionItem => item !== null)
  return { questions, validationErrors }
}

export function formatAskUserQuestionArgumentError(errors: string[]): string {
  const lines = [
    '<tool_use_error>',
    'AskUserQuestion argument validation failed. Fix the arguments and call AskUserQuestion again.',
    ...errors.map((error) => `- ${error}`),
    '',
    'Rules:',
    '- Every questions[i].options array must contain at least 2 options. A single "I will write in notes" option is invalid.',
    '- Use options for real choices. Use the free-text note field only for optional details after a choice.',
    '- If you mainly need open-ended text, ask in normal chat or provide meaningful choices such as "自由发挥" and "我补充细节".',
    '',
    '</tool_use_error>',
  ]
  return lines.join('\n')
}

export function createAskUserQuestionTool({
  askUserQuestion,
}: {
  askUserQuestion: AskUserQuestionExecutor
}): AgentRuntimeTool {
  return {
    name: 'AskUserQuestion',
    label: translate('configLib.agent.tool.askUserQuestion'),
    description: description.trim(),
    parameters: Type.Object({
      questions: Type.Array(
        Type.Object({
          question: Type.String({ description: 'Full question text ending with a question mark.' }),
          header: Type.String({ description: 'Short chip label for the question (max 12 chars).', maxLength: 12 }),
          options: Type.Array(
            Type.Object({
              label: Type.String({ description: 'Concise option label (1-5 words).' }),
              description: Type.Optional(
                Type.String({ description: 'Optional short explanation. Omit it when the label is self-evident.' }),
              ),
            }),
            {
              description:
                'Required answer options. Provide at least 2 real choices; never provide only one note/free-text option.',
              minItems: 2,
            },
          ),
          multi_select: Type.Boolean({ description: 'Allow multiple selections when true; otherwise false.' }),
        }),
        { description: 'Required 1-4 questions to ask in a single form.', minItems: 1, maxItems: 4 },
      ),
    }),
    prepareArguments: prepareAskUserQuestionArgs,
    execute: (toolCallId: string, args: AskUserQuestionToolArgs, signal?: AbortSignal) =>
      askUserQuestion(toolCallId, prepareAskUserQuestionArgs(args), signal),
  } as AgentRuntimeTool
}

export function formatAskUserQuestionResult(
  questions: AskUserQuestionItem[],
  answers: AskUserQuestionAnswer[],
  options?: { cancelled?: boolean; decideForUser?: boolean },
): string {
  if (options?.decideForUser) {
    return questions
      .map(
        (item) =>
          `Question: ${item.question}\nAnswer: (User chose "Decide for me". Make a reasonable choice for this question on the user's behalf, use your creative judgment, and continue.)`,
      )
      .join('\n---\n')
  }

  if (options?.cancelled) {
    return questions
      .map((item) => `Question: ${item.question}\nAnswer: (User dismissed the form without answering.)`)
      .join('\n---\n')
  }

  const answerByQuestion = new Map(answers.map((answer) => [answer.question, answer]))
  return questions
    .map((item) => {
      const answer = answerByQuestion.get(item.question)
      if (!answer || (answer.selectedLabels.length === 0 && !answer.note.trim())) {
        return `Question: ${item.question}\nAnswer: (No answer provided.)`
      }
      const lines: string[] = [`Question: ${item.question}`]
      if (answer.selectedLabels.length > 0) {
        if (item.multi_select) {
          lines.push('Answer:')
          for (const label of answer.selectedLabels) lines.push(`- ${label}`)
        } else {
          lines.push(`Answer: ${answer.selectedLabels[0]}`)
        }
      } else {
        lines.push('Answer: (No option selected.)')
      }
      if (answer.note.trim()) lines.push(`Note: ${answer.note.trim()}`)
      return lines.join('\n')
    })
    .join('\n---\n')
}

export function createAskUserQuestionResult(
  questions: AskUserQuestionItem[],
  answers: AskUserQuestionAnswer[],
  options?: { cancelled?: boolean; decideForUser?: boolean; reason?: string },
): AgentToolResult {
  const details: AskUserQuestionResultDetails = {
    status: options?.decideForUser ? 'decide_for_me' : options?.cancelled ? 'cancelled' : 'submitted',
    questions,
    answers,
    ...(options?.reason ? { reason: options.reason } : {}),
  }

  return {
    content: [{ type: 'text', text: formatAskUserQuestionResult(questions, answers, options) }],
    details,
  }
}
