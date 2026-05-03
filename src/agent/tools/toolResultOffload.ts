import type { AgentToolResult } from './shared'
import {
  readableTextLines,
  TEXT_SEGMENT_DEFAULT_LIMIT,
  TEXT_SEGMENT_MAX_CHARS,
  textSegmentLineCount,
} from '../textSegments'
import { agentToolOutputVirtualPath, saveAgentVirtualFile, type AgentVirtualFileKind } from '../virtualFiles'

export const TOOL_OUTPUT_MAX_CHARS = TEXT_SEGMENT_MAX_CHARS
export const TOOL_OUTPUT_DISPLAY_HEAD = 10_000
export const TOOL_OUTPUT_DISPLAY_TAIL = 10_000
export const TOOL_OUTPUT_MAX_LINES = TEXT_SEGMENT_DEFAULT_LIMIT
export const TOOL_OUTPUT_DISPLAY_HEAD_LINES = 900
export const TOOL_OUTPUT_DISPLAY_TAIL_LINES = 900

export type ToolResultOffloadParams = {
  sessionId: string
  toolCallId: string
  toolName: string
  kind?: AgentVirtualFileKind
  path?: string
  title?: string
  sourceUrl?: string
  contentType?: 'text/plain' | 'text/markdown' | 'application/json'
}

export function shouldOffloadText(text: string): boolean {
  return text.length > TOOL_OUTPUT_MAX_CHARS || textSegmentLineCount(text) > TOOL_OUTPUT_MAX_LINES
}

function previewHeadTail(text: string): { head: string; tail: string; omitted: number } {
  const lines = readableTextLines(text)
  if (lines.length > TOOL_OUTPUT_MAX_LINES) {
    const head = lines.slice(0, TOOL_OUTPUT_DISPLAY_HEAD_LINES).join('\n').slice(0, TOOL_OUTPUT_DISPLAY_HEAD)
    const tail = lines.slice(-TOOL_OUTPUT_DISPLAY_TAIL_LINES).join('\n').slice(-TOOL_OUTPUT_DISPLAY_TAIL)
    return { head, tail, omitted: Math.max(0, text.length - head.length - tail.length) }
  }

  const head = text.slice(0, TOOL_OUTPUT_DISPLAY_HEAD)
  const tail = text.slice(Math.max(TOOL_OUTPUT_DISPLAY_HEAD, text.length - TOOL_OUTPUT_DISPLAY_TAIL))
  return { head, tail, omitted: Math.max(0, text.length - head.length - tail.length) }
}

export function formatOffloadedTextPreview(text: string, path: string): string {
  const { head, tail, omitted } = previewHeadTail(text)
  return [
    '<system-reminder>',
    'Tool output truncated due to length.',
    `Full output saved to: ${path}`,
    `Showing first ${head.length} and last ${tail.length} characters of ${text.length} characters.`,
    'Use ReadAgentFile with offset/limit to inspect more.',
    '</system-reminder>',
    '',
    head,
    '',
    `… (${omitted} characters omitted)`,
    '',
    tail,
  ].join('\n')
}

function formatUnsavedTextPreview(text: string): string {
  const { head, tail, omitted } = previewHeadTail(text)
  return [
    '<system-reminder>',
    'Tool output truncated due to length, and the full output could not be saved to a virtual file.',
    `Showing first ${head.length} and last ${tail.length} characters of ${text.length} characters.`,
    '</system-reminder>',
    '',
    head,
    '',
    `… (${omitted} characters omitted)`,
    '',
    tail,
  ].join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isErrorResult(result: AgentToolResult, text: string): boolean {
  return (isRecord(result.details) && result.details.status === 'error') || text.includes('<tool_use_error>')
}

export async function offloadAgentToolResult(
  result: AgentToolResult,
  params: ToolResultOffloadParams,
): Promise<AgentToolResult> {
  const textParts = result.content.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
  if (textParts.length === 0 || textParts.length !== result.content.length) return result

  const fullText = textParts.map((part) => part.text).join('\n')
  if (isErrorResult(result, fullText)) return result
  if (!shouldOffloadText(fullText)) return result

  const path = params.path ?? agentToolOutputVirtualPath(params.toolCallId)
  let saved: Awaited<ReturnType<typeof saveAgentVirtualFile>>
  try {
    saved = await saveAgentVirtualFile({
      sessionId: params.sessionId,
      path,
      kind: params.kind ?? 'tool_output',
      content: fullText,
      contentType: params.contentType,
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      title: params.title,
      sourceUrl: params.sourceUrl,
    })
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatUnsavedTextPreview(fullText) }],
      details: isRecord(result.details)
        ? { ...result.details, offloadError: error instanceof Error ? error.message : String(error) }
        : { originalDetails: result.details, offloadError: error instanceof Error ? error.message : String(error) },
    }
  }
  const offloadDetails = {
    path: saved.path,
    originalChars: saved.originalChars,
    lineCount: saved.lineCount,
  }
  return {
    content: [{ type: 'text', text: formatOffloadedTextPreview(fullText, saved.path) }],
    details: isRecord(result.details)
      ? { ...result.details, offloaded: offloadDetails }
      : { originalDetails: result.details, offloaded: offloadDetails },
  }
}
