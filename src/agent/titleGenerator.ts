import { completeSimple, type Api, type Model } from '@mariozechner/pi-ai'

import type { Language } from '../config/languages'

const STACK_TITLE_MAX_LENGTH = 56
const SESSION_TITLE_MAX_LENGTH = 80
const TITLE_GENERATION_MAX_TOKENS = 4096
const TITLE_GENERATION_ATTEMPTS = 2

function languageInstruction(language: Language): string {
  return language === 'en'
    ? 'Write the title in English.'
    : 'Write the title in Simplified Chinese (简体中文). Add spaces between Chinese characters and English words or letters.'
}

const STACK_TITLE_SYSTEM_PROMPT_BASE = [
  'You generate short, specific titles for image generation prompts.',
  'Reply with only the title, no quotes, no markdown, no explanation, no emoji.',
].join(' ')

const STACK_TITLE_USER_PROMPT = `Generate a short title that captures what this image is meant to depict.

Rules:
- be specific about the subject and key visual elements
- {language_instruction}
- maximum 30 characters; prefer concise phrasing
- single line, noun phrase, no filler words, no trailing punctuation

<prompt>
{prompt}
</prompt>`

const SESSION_TITLE_SYSTEM_PROMPT_BASE = [
  'You generate short, specific conversation titles from user messages.',
  'Reply with only the title, no quotes, no markdown, no explanation, no emoji.',
].join(' ')

const SESSION_TITLE_USER_PROMPT = `Generate a short session title that captures the specific task.

Rules:
- be specific: name the concrete thing being done, not the broad area
- reflect user intent, not tool usage or internal operations
- {language_instruction}
- maximum 60 characters; prefer concise phrasing
- single line, prefer a noun phrase over an imperative sentence
- omit generic request verbs like generate, create, write, introduce, summarize, or analyze unless they are part of the subject itself
- for Chinese titles, prefer the pattern “specific topic + task type”, for example “JetBrains 公司总结介绍” instead of “生成 JetBrains 公司总结介绍”
- if a previous title exists and the topic hasn't changed, refine it rather than replace it

{previous_title_block}<previous_user_messages>
{previous_user_messages}
</previous_user_messages>

<current_user_message>
{current_user_message}
</current_user_message>`

function withBaseUrl(model: Model<Api>, baseUrl: string | undefined): Model<Api> {
  const trimmed = baseUrl?.trim()
  if (!trimmed) return model
  if (trimmed.endsWith('#')) return { ...model, baseUrl: trimmed.slice(0, -1).replace(/\/+$/, '') }
  return { ...model, baseUrl: trimmed.replace(/\/+$/, '') }
}

function normalizeTitle(raw: string, maxLength: number): string | null {
  if (!raw) return null
  let text = raw.replace(/\s+/g, ' ').trim()
  text = text.replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g, '')
  text = text.replace(/[\s.。!?,，;；:：]+$/g, '')
  if (!text) return null
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

async function runTitleCall(args: {
  model: Model<Api>
  apiKey: string
  baseUrl: string | undefined
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}): Promise<string | null> {
  const model = withBaseUrl(args.model, args.baseUrl)
  for (let attempt = 1; attempt <= TITLE_GENERATION_ATTEMPTS; attempt++) {
    try {
      const response = await completeSimple(
        model,
        {
          systemPrompt: args.systemPrompt,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: args.userPrompt }],
              timestamp: Date.now(),
            },
          ],
        },
        { maxTokens: TITLE_GENERATION_MAX_TOKENS, signal: args.signal, apiKey: args.apiKey },
      )
      if (response.stopReason === 'aborted') return null
      if (response.stopReason === 'error') {
        if (attempt === TITLE_GENERATION_ATTEMPTS) return null
        continue
      }
      const text = response.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('')
      return text
    } catch {
      if (args.signal?.aborted) return null
      if (attempt === TITLE_GENERATION_ATTEMPTS) return null
    }
  }
  return null
}

export type GenerateStackTitleArgs = {
  prompt: string
  language: Language
  model: Model<Api>
  apiKey: string
  baseUrl?: string
  signal?: AbortSignal
}

export async function generateStackTitle(args: GenerateStackTitleArgs): Promise<string | null> {
  const prompt = args.prompt.replace(/\s+/g, ' ').trim()
  if (!prompt) return null
  const langInstruction = languageInstruction(args.language)
  const userPrompt = STACK_TITLE_USER_PROMPT.replace('{prompt}', prompt).replace(
    '{language_instruction}',
    langInstruction,
  )
  const raw = await runTitleCall({
    model: args.model,
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
    systemPrompt: `${STACK_TITLE_SYSTEM_PROMPT_BASE} ${langInstruction}`,
    userPrompt,
    signal: args.signal,
  })
  if (!raw) return null
  return normalizeTitle(raw, STACK_TITLE_MAX_LENGTH)
}

export type GenerateSessionTitleArgs = {
  currentUserMessage: string
  previousUserMessages: string[]
  previousTitle?: string
  language: Language
  model: Model<Api>
  apiKey: string
  baseUrl?: string
  signal?: AbortSignal
}

export async function generateSessionTitle(args: GenerateSessionTitleArgs): Promise<string | null> {
  const current = args.currentUserMessage.trim()
  if (!current) return null
  const previous = args.previousUserMessages.map((msg) => msg.trim()).filter((msg) => msg.length > 0)
  const renderedPrevious =
    previous.length > 0 ? previous.map((msg, idx) => `[${idx + 1}] ${msg}`).join('\n\n') : '(none)'
  const previousTitle = args.previousTitle?.trim()
  const previousTitleBlock = previousTitle ? `<previous_title>\n${previousTitle}\n</previous_title>\n\n` : ''
  const langInstruction = languageInstruction(args.language)
  const userPrompt = SESSION_TITLE_USER_PROMPT.replace('{previous_title_block}', previousTitleBlock)
    .replace('{previous_user_messages}', renderedPrevious)
    .replace('{current_user_message}', current)
    .replace('{language_instruction}', langInstruction)
  const raw = await runTitleCall({
    model: args.model,
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
    systemPrompt: `${SESSION_TITLE_SYSTEM_PROMPT_BASE} ${langInstruction}`,
    userPrompt,
    signal: args.signal,
  })
  if (!raw) return null
  return normalizeTitle(raw, SESSION_TITLE_MAX_LENGTH)
}
