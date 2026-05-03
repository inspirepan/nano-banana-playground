import { Type } from '@mariozechner/pi-ai'

import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import description from './webFetch.md?raw'
import { translate } from '../../i18n'

const MAX_RESULT_CHARS = 100_000
const JINA_READER_BASE_URL = 'https://r.jina.ai/'

type WebFetchSource = 'direct' | 'jina_reader'

export type WebFetchToolArgs = {
  url: string
}

export type WebFetchExecutor = (
  toolCallId: string,
  args: WebFetchToolArgs,
  signal?: AbortSignal,
) => Promise<AgentToolResult>

export function prepareWebFetchArgs(args: unknown): WebFetchToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  return {
    url: typeof record.url === 'string' ? record.url.trim() : '',
  }
}

export function createWebFetchTool({ webFetch }: { webFetch: WebFetchExecutor }): AgentRuntimeTool {
  return {
    name: 'WebFetch',
    label: translate('configLib.agent.tool.webFetch'),
    description: description.trim(),
    parameters: Type.Object({
      url: Type.String({ description: 'Absolute http(s) URL to fetch.' }),
    }),
    prepareArguments: prepareWebFetchArgs,
    execute: (toolCallId: string, args: WebFetchToolArgs, signal?: AbortSignal) =>
      webFetch(toolCallId, prepareWebFetchArgs(args), signal),
  } as AgentRuntimeTool
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(p|div|br|li|tr|h[1-6]|section|article|header|footer|nav|main|blockquote|pre)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeBasicEntities(stripped)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function looksLikeHtml(contentType: string, body: string): boolean {
  if (/text\/html|application\/xhtml/i.test(contentType)) return true
  return /^\s*<(?:!doctype\s+html|html\b)/i.test(body)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(
    signal?.aborted ||
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError'),
  )
}

function toJinaReaderUrl(url: string): string {
  return `${JINA_READER_BASE_URL}${url}`
}

function errorResult(text: string, details: Record<string, unknown>): AgentToolResult {
  return {
    content: [{ type: 'text', text: `<tool_use_error>${text}</tool_use_error>` }],
    details: { status: 'error', ...details },
  }
}

export async function runWebFetch(args: WebFetchToolArgs, signal?: AbortSignal): Promise<AgentToolResult> {
  const url = args.url
  if (!url) return errorResult('Missing url.', { reason: 'missing_url' })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return errorResult(`Invalid URL: ${url}`, { reason: 'invalid_url', url })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return errorResult(`Unsupported protocol: ${parsed.protocol}`, {
      reason: 'unsupported_protocol',
      url,
      protocol: parsed.protocol,
    })
  }

  const start = Date.now()
  let response: Response
  let fetchSource: WebFetchSource = 'direct'
  let fetchUrl = url
  let directFetchError: string | null = null
  try {
    response = await fetch(url, { signal, redirect: 'follow' })
  } catch (error) {
    if (isAbortError(error, signal)) {
      const message = getErrorMessage(error)
      return errorResult(`Fetch aborted: ${message}`, { reason: 'aborted', url, message })
    }

    directFetchError = getErrorMessage(error)
    fetchSource = 'jina_reader'
    fetchUrl = toJinaReaderUrl(url)
    try {
      response = await fetch(fetchUrl, { signal, redirect: 'follow' })
    } catch (fallbackError) {
      const fallbackMessage = getErrorMessage(fallbackError)
      if (isAbortError(fallbackError, signal)) {
        return errorResult(`Fetch aborted: ${fallbackMessage}`, { reason: 'aborted', url, message: fallbackMessage })
      }
      return errorResult(`Fetch failed: ${directFetchError}. Reader fallback failed: ${fallbackMessage}`, {
        reason: 'fetch_failed',
        url,
        message: directFetchError,
        fallback: {
          source: fetchSource,
          url: fetchUrl,
          message: fallbackMessage,
        },
      })
    }
  }

  const code = response.status
  const codeText = response.statusText
  const contentType = response.headers.get('content-type') ?? ''

  let body: string
  try {
    body = await response.text()
  } catch (error) {
    const message = getErrorMessage(error)
    return errorResult(`Failed to read response body: ${message}`, {
      reason: 'body_read_failed',
      url,
      fetchSource,
      fetchUrl,
      code,
      message,
    })
  }

  const processedRaw = looksLikeHtml(contentType, body) ? htmlToText(body) : body
  const truncated = processedRaw.length > MAX_RESULT_CHARS
  const processed = truncated ? processedRaw.slice(0, MAX_RESULT_CHARS) : processedRaw

  const headerLine = [
    `URL: ${url}`,
    `Fetch-Source: ${fetchSource}`,
    ...(response.url && response.url !== url ? [`Fetched-URL: ${response.url}`] : []),
    ...(directFetchError ? [`Direct-Fetch-Error: ${directFetchError}`] : []),
    `Status: ${code}${codeText ? ` ${codeText}` : ''}`,
    `Content-Type: ${contentType || 'unknown'}`,
    `Bytes: ${body.length}`,
  ].join('\n')
  const truncationNote = truncated
    ? `\n\n[Content truncated to ${MAX_RESULT_CHARS} characters out of ${processedRaw.length}.]`
    : ''
  const text = `${headerLine}\n\n${processed}${truncationNote}`

  return {
    content: [{ type: 'text', text }],
    details: {
      status: response.ok ? 'ready' : 'http_error',
      url,
      fetchSource,
      fetchUrl,
      directFetchError,
      code,
      codeText,
      contentType,
      bytes: body.length,
      truncated,
      durationMs: Date.now() - start,
    },
  }
}
