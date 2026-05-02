import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { completeSimple, type Api, type Model, type Usage } from '@mariozechner/pi-ai'

import {
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  agentMessageThinking,
  agentMessageToolCalls,
  agentMessageToolResult,
  isLlmAgentMessage,
} from './agentChat'

export type CompactionSettings = {
  enabled: boolean
  reserveTokens: number
  keepRecentTokens: number
}

export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  enabled: true,
  reserveTokens: 8192,
  keepRecentTokens: 16384,
}

const TOOL_RESULT_MAX_CHARS = 2000
const IMAGE_TOKEN_ESTIMATE = 1200

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI image-generation assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`

const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user, e.g. style, model, ratio, content rules]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed image generations or decisions]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Generated Images
- [Notable generated image_id values and what they depict]
- [Or "(none)"]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any reference image_ids, prompts, or details needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact image_id values, prompts, and model names.`

const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact image_id values, prompts, and model names
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Generated Images
- [Preserve previous + add new]

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact image_id values, prompts, and model names.`

function truncateForSummary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n[... ${text.length - maxChars} more characters truncated]`
}

export function estimateTokens(message: AgentMessage): number {
  const role = agentMessageRole(message)
  if (role === 'unknown') return 0

  if (role === 'assistant') {
    let chars = agentMessageThinking(message).length + agentMessageText(message).length
    for (const call of agentMessageToolCalls(message)) {
      chars += call.name.length + JSON.stringify(call.arguments).length
    }
    return Math.ceil(chars / 4)
  }

  // user / toolResult: text + image blocks
  const chars = agentMessageText(message).length
  const imageCount = agentMessageImages(message).length
  return Math.ceil(chars / 4) + imageCount * IMAGE_TOKEN_ESTIMATE
}

export function calculateContextTokens(usage: Usage): number {
  return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite
}

/**
 * Find the latest assistant message we can trust for usage-based context size.
 * Skips aborted/error/no-usage assistants and any usage timestamped at or before
 * `minUsageTimestamp` (used to discard stale pre-compaction usage that still
 * lives on a kept assistant message).
 */
function findLatestUsableAssistant(
  messages: AgentMessage[],
  minUsageTimestamp: number,
): { usage: Usage; index: number } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!isLlmAgentMessage(message) || message.role !== 'assistant') continue
    const m = message as unknown as { stopReason?: unknown; timestamp?: unknown; usage?: unknown }
    if (m.stopReason === 'aborted' || m.stopReason === 'error') continue
    const timestamp = typeof m.timestamp === 'number' ? m.timestamp : 0
    if (timestamp <= minUsageTimestamp) continue
    if (!m.usage || typeof m.usage !== 'object') continue
    return { usage: m.usage as Usage, index: i }
  }
  return null
}

export type ContextUsageEstimate = {
  tokens: number
  usageTokens: number
  trailingTokens: number
  lastUsageIndex: number | null
}

export function estimateContextTokens(
  messages: AgentMessage[],
  options?: { minUsageTimestamp?: number },
): ContextUsageEstimate {
  const minUsageTimestamp = options?.minUsageTimestamp ?? 0
  const usageInfo = findLatestUsableAssistant(messages, minUsageTimestamp)

  if (!usageInfo) {
    let estimated = 0
    for (const message of messages) estimated += estimateTokens(message)
    return { tokens: estimated, usageTokens: 0, trailingTokens: estimated, lastUsageIndex: null }
  }

  const usageTokens = calculateContextTokens(usageInfo.usage)
  let trailingTokens = 0
  for (let i = usageInfo.index + 1; i < messages.length; i++) {
    trailingTokens += estimateTokens(messages[i])
  }
  return { tokens: usageTokens + trailingTokens, usageTokens, trailingTokens, lastUsageIndex: usageInfo.index }
}

export function shouldCompact(contextTokens: number, contextWindow: number, settings: CompactionSettings): boolean {
  if (!settings.enabled) return false
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return false
  return contextTokens > contextWindow - settings.reserveTokens
}

/**
 * Walk backwards accumulating tokens until >= keepRecentTokens, then snap to the
 * nearest valid cut point (user|assistant message; never toolResult, since tool
 * results must follow their tool call).
 */
export function findCutPoint(messages: AgentMessage[], startIndex: number, keepRecentTokens: number): number {
  if (messages.length === 0) return startIndex
  const validCuts: number[] = []
  for (let i = startIndex; i < messages.length; i++) {
    const role = agentMessageRole(messages[i])
    if (role === 'user' || role === 'assistant') validCuts.push(i)
  }
  if (validCuts.length === 0) return startIndex

  let accumulated = 0
  let cutIndex = validCuts[0]
  for (let i = messages.length - 1; i >= startIndex; i--) {
    accumulated += estimateTokens(messages[i])
    if (accumulated >= keepRecentTokens) {
      for (const c of validCuts) {
        if (c >= i) {
          cutIndex = c
          break
        }
      }
      break
    }
  }
  return cutIndex
}

function serializeConversation(messages: AgentMessage[]): string {
  const parts: string[] = []
  for (const m of messages) {
    const role = agentMessageRole(m)
    if (role === 'user') {
      const text = agentMessageText(m)
      if (text) parts.push(`[User]: ${text}`)
      continue
    }
    if (role === 'assistant') {
      const thinking = agentMessageThinking(m)
      const text = agentMessageText(m)
      const toolCalls = agentMessageToolCalls(m)
      if (thinking) parts.push(`[Assistant thinking]: ${thinking}`)
      if (text) parts.push(`[Assistant]: ${text}`)
      if (toolCalls.length > 0) {
        const formatted = toolCalls
          .map(({ name, arguments: args }) => {
            const argsStr = Object.entries(args)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(', ')
            return `${name}(${argsStr})`
          })
          .join('; ')
        parts.push(`[Assistant tool calls]: ${formatted}`)
      }
      continue
    }
    if (role === 'toolResult') {
      const result = agentMessageToolResult(m)
      if (result?.text) {
        parts.push(`[${result.toolName} result]: ${truncateForSummary(result.text, TOOL_RESULT_MAX_CHARS)}`)
      }
    }
  }
  return parts.join('\n\n')
}

export type CompactionPreparation = {
  firstKeptIndex: number
  messagesToSummarize: AgentMessage[]
  tokensBefore: number
  previousSummary?: string
}

/**
 * Decide what to summarize. Returns null if nothing meaningful would be summarized.
 *
 * `ignoreLeadingCount` skips the first N messages (e.g. a previously synthesized
 * compaction summary message that should not itself be re-summarized; its text
 * content is passed via `previousSummary`).
 *
 * `tokensBefore` lets the caller supply a pre-computed boundary-aware estimate;
 * when omitted, falls back to `estimateContextTokens(messages)` which can pick
 * up stale pre-compaction usage from a kept assistant message.
 */
export function prepareCompaction(
  messages: AgentMessage[],
  settings: CompactionSettings,
  options?: { previousSummary?: string; ignoreLeadingCount?: number; tokensBefore?: number },
): CompactionPreparation | null {
  const ignoreLeadingCount = options?.ignoreLeadingCount ?? 0
  const startIndex = Math.min(ignoreLeadingCount, messages.length)
  const cutPoint = findCutPoint(messages, startIndex, settings.keepRecentTokens)
  if (cutPoint <= startIndex) return null
  const messagesToSummarize = messages.slice(startIndex, cutPoint)
  if (messagesToSummarize.length === 0) return null
  return {
    firstKeptIndex: cutPoint,
    messagesToSummarize,
    tokensBefore: options?.tokensBefore ?? estimateContextTokens(messages).tokens,
    previousSummary: options?.previousSummary,
  }
}

export type GenerateSummaryArgs = {
  messages: AgentMessage[]
  model: Model<Api>
  apiKey: string
  reserveTokens: number
  signal?: AbortSignal
  previousSummary?: string
}

export async function generateSummary(args: GenerateSummaryArgs): Promise<string> {
  const { messages, model, apiKey, reserveTokens, signal, previousSummary } = args
  const maxTokens = Math.max(1024, Math.floor(0.8 * reserveTokens))

  const conversationText = serializeConversation(messages)
  const basePrompt = previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT

  let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`
  if (previousSummary) promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`
  promptText += basePrompt

  const response = await completeSimple(
    model,
    {
      systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'text', text: promptText }], timestamp: Date.now() }],
    },
    { maxTokens, signal, apiKey },
  )

  if (response.stopReason === 'aborted') throw new Error('Summarization aborted')
  if (response.stopReason === 'error') {
    throw new Error(`Summarization failed: ${response.errorMessage || 'Unknown error'}`)
  }
  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

export type CompactionResult = {
  summary: string
  firstKeptIndex: number
  tokensBefore: number
}

export type CompactArgs = {
  messages: AgentMessage[]
  settings: CompactionSettings
  model: Model<Api>
  apiKey: string
  signal?: AbortSignal
  previousSummary?: string
  ignoreLeadingCount?: number
  tokensBefore?: number
}

export async function compact(args: CompactArgs): Promise<CompactionResult | null> {
  const { messages, settings, model, apiKey, signal, previousSummary, ignoreLeadingCount, tokensBefore } = args
  const preparation = prepareCompaction(messages, settings, { previousSummary, ignoreLeadingCount, tokensBefore })
  if (!preparation) return null
  const summary = await generateSummary({
    messages: preparation.messagesToSummarize,
    model,
    apiKey,
    reserveTokens: settings.reserveTokens,
    signal,
    previousSummary: preparation.previousSummary,
  })
  return {
    summary,
    firstKeptIndex: preparation.firstKeptIndex,
    tokensBefore: preparation.tokensBefore,
  }
}

export function buildCompactionSummaryMessage(summary: string, timestamp = Date.now()): AgentMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text: `<system>\nContext compacted. Previous conversation summary:\n\n${summary}\n</system>` },
    ],
    timestamp,
  } as unknown as AgentMessage
}
