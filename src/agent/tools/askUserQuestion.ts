import { Type } from '@mariozechner/pi-ai'

import description from './askUserQuestion.md?raw'
import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import { translate } from '../../i18n'

export type AskUserQuestionOption = {
  label: string
  description: string
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

export type AskUserQuestionAnswer = {
  question: string
  selectedLabels: string[]
  note: string
}

export type AskUserQuestionExecutor = (
  toolCallId: string,
  args: AskUserQuestionToolArgs,
  signal?: AbortSignal,
) => Promise<AgentToolResult>

function normalizeOption(value: unknown): AskUserQuestionOption | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const desc = typeof record.description === 'string' ? record.description.trim() : ''
  if (!label) return null
  return { label, description: desc }
}

function normalizeQuestion(value: unknown): AskUserQuestionItem | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const question = typeof record.question === 'string' ? record.question.trim() : ''
  const header = typeof record.header === 'string' ? record.header.trim() : ''
  const rawOptions = Array.isArray(record.options) ? record.options : []
  const options = rawOptions.map(normalizeOption).filter((option): option is AskUserQuestionOption => option !== null)
  if (!question || options.length < 2) return null
  const multiSelect =
    record.multi_select === true || record.multiSelect === true || record.multi_select === 'true' ? true : false
  return { question, header: header || question.slice(0, 12), options, multi_select: multiSelect }
}

export function prepareAskUserQuestionArgs(args: unknown): AskUserQuestionToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const rawQuestions = Array.isArray(record.questions) ? record.questions : []
  const questions = rawQuestions.map(normalizeQuestion).filter((item): item is AskUserQuestionItem => item !== null)
  return { questions }
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
          header: Type.String({ description: 'Short chip label for the question (max 12 chars).' }),
          options: Type.Array(
            Type.Object({
              label: Type.String({ description: 'Concise option label (1-5 words).' }),
              description: Type.String({ description: 'One-sentence explanation of the option.' }),
            }),
            { minItems: 2, maxItems: 4, description: '2-4 mutually exclusive options.' },
          ),
          multi_select: Type.Boolean({ description: 'Allow multiple selections when true.' }),
        }),
        { minItems: 1, maxItems: 4, description: '1-4 questions to ask in a single form.' },
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
  options?: { cancelled?: boolean },
): string {
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
