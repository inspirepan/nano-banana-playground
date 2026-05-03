import { Type } from '@mariozechner/pi-ai'

import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import { formatOffloadedTextPreview, shouldOffloadText } from './toolResultOffload'
import description from './webFetch.md?raw'
import { fetchWithWebProvider } from './webProviderClients'
import type { WebFetchProvider } from '../../config/webProviders'
import { translate } from '../../i18n'
import { readWebProviderSettings } from '../../lib/webProviderStore'
import { agentWebFetchVirtualPath, saveAgentVirtualFile } from '../virtualFiles'

type WebFetchSource = 'direct' | 'proxy' | Exclude<WebFetchProvider, 'default'>

export type WebFetchToolArgs = {
  url: string
}

export type WebFetchExecutor = (
  toolCallId: string,
  args: WebFetchToolArgs,
  signal?: AbortSignal,
) => Promise<AgentToolResult>

export type WebFetchRunOptions = {
  sessionId: string
  toolCallId: string
}

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

type NormalizedFetch = {
  source: WebFetchSource
  status: number
  statusText: string
  contentType: string
  body: string
  finalUrl: string
}

async function tryDirectFetch(url: string, signal?: AbortSignal): Promise<NormalizedFetch> {
  const response = await fetch(url, { signal, redirect: 'follow' })
  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()
  return { source: 'direct', status: response.status, statusText: response.statusText, contentType, body, finalUrl: response.url }
}

async function tryProxyFetch(url: string, signal?: AbortSignal): Promise<NormalizedFetch> {
  const response = await fetch('/api/fetch', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(`Proxy error ${response.status}: ${data.error ?? response.statusText}`)
  }
  const data = await response.json() as { status: number; statusText: string; contentType: string; finalUrl: string; body: string }
  return {
    source: 'proxy',
    status: data.status,
    statusText: data.statusText ?? '',
    contentType: data.contentType ?? '',
    body: data.body ?? '',
    finalUrl: data.finalUrl ?? url,
  }
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

function errorResult(text: string, details: Record<string, unknown>): AgentToolResult {
  return {
    content: [{ type: 'text', text: `<tool_use_error>${text}</tool_use_error>` }],
    details: { status: 'error', ...details },
  }
}

function validateWebFetchUrl(url: string): AgentToolResult | null {
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
  return null
}

async function saveWebFetchContent(
  options: WebFetchRunOptions | undefined,
  params: {
    url: string
    content: string
    contentType: string
    title?: string
  },
): Promise<string | undefined> {
  if (!options) return undefined
  const path = agentWebFetchVirtualPath(options.toolCallId)
  try {
    const saved = await saveAgentVirtualFile({
      sessionId: options.sessionId,
      path,
      kind: 'web_fetch',
      content: params.content,
      contentType: /markdown/i.test(params.contentType) ? 'text/markdown' : 'text/plain',
      toolCallId: options.toolCallId,
      toolName: 'WebFetch',
      title: params.title,
      sourceUrl: params.url,
    })
    return saved.path
  } catch {
    return undefined
  }
}

function formatWebFetchText(headerLine: string, body: string, savedPath: string | undefined): string {
  const savedLine = savedPath ? `[Full content saved to ${savedPath}]\n\n` : ''
  if (!shouldOffloadText(body)) return `${savedLine}${headerLine}\n\n${body}`
  if (savedPath) return `${savedLine}${headerLine}\n\n${formatOffloadedTextPreview(body, savedPath)}`
  const fallback = body.slice(0, 40_000)
  return `${headerLine}\n\n${fallback}\n\n[Content truncated to 40000 characters out of ${body.length}.]`
}

async function formatProviderFetchResult({
  url,
  fetchSource,
  code,
  codeText,
  contentType,
  body,
  fetchedUrl,
  start,
  options,
}: {
  url: string
  fetchSource: Exclude<WebFetchProvider, 'default'>
  code: number
  codeText: string
  contentType: string
  body: string
  fetchedUrl: string
  start: number
  options?: WebFetchRunOptions
}): Promise<AgentToolResult> {
  const headerLine = [
    `URL: ${url}`,
    `Fetch-Source: ${fetchSource}`,
    ...(fetchedUrl && fetchedUrl !== url ? [`Fetched-URL: ${fetchedUrl}`] : []),
    `Status: ${code}${codeText ? ` ${codeText}` : ''}`,
    `Content-Type: ${contentType || 'unknown'}`,
    `Bytes: ${body.length}`,
  ].join('\n')
  const savedPath = await saveWebFetchContent(options, { url, content: body, contentType, title: url })
  return {
    content: [{ type: 'text', text: formatWebFetchText(headerLine, body, savedPath) }],
    details: {
      status: code >= 200 && code < 300 ? 'ready' : 'http_error',
      url,
      fetchSource,
      fetchUrl: fetchedUrl,
      code,
      codeText,
      contentType,
      bytes: body.length,
      savedPath,
      truncated: shouldOffloadText(body),
      durationMs: Date.now() - start,
    },
  }
}

async function runDefaultWebFetch(
  args: WebFetchToolArgs,
  signal?: AbortSignal,
  fallbackReason?: string,
  options?: WebFetchRunOptions,
): Promise<AgentToolResult> {
  const url = args.url
  const validationError = validateWebFetchUrl(url)
  if (validationError) return validationError

  const start = Date.now()
  let result: NormalizedFetch
  let directFetchError: string | null = null

  try {
    result = await tryDirectFetch(url, signal)
  } catch (directError) {
    if (isAbortError(directError, signal)) {
      const message = getErrorMessage(directError)
      return errorResult(`Fetch aborted: ${message}`, { reason: 'aborted', url, message })
    }
    directFetchError = getErrorMessage(directError)
    try {
      result = await tryProxyFetch(url, signal)
    } catch (proxyError) {
      if (isAbortError(proxyError, signal)) {
        const message = getErrorMessage(proxyError)
        return errorResult(`Fetch aborted: ${message}`, { reason: 'aborted', url, message })
      }
      const proxyMessage = getErrorMessage(proxyError)
      return errorResult(`Fetch failed: ${directFetchError}. Proxy fallback failed: ${proxyMessage}`, {
        reason: 'fetch_failed',
        url,
        message: directFetchError,
        fallback: { source: 'proxy', message: proxyMessage },
      })
    }
  }

  const { source: fetchSource, status: code, statusText: codeText, contentType, body, finalUrl } = result
  const processedRaw = looksLikeHtml(contentType, body) ? htmlToText(body) : body

  const headerLine = [
    `URL: ${url}`,
    `Fetch-Source: ${fetchSource}`,
    ...(finalUrl && finalUrl !== url ? [`Fetched-URL: ${finalUrl}`] : []),
    ...(fallbackReason ? [`Provider-Fallback-Reason: ${fallbackReason}`] : []),
    ...(directFetchError ? [`Direct-Fetch-Error: ${directFetchError}`] : []),
    `Status: ${code}${codeText ? ` ${codeText}` : ''}`,
    `Content-Type: ${contentType || 'unknown'}`,
    `Bytes: ${body.length}`,
  ].join('\n')
  const savedPath = await saveWebFetchContent(options, {
    url,
    content: processedRaw,
    contentType: looksLikeHtml(contentType, body) ? 'text/markdown' : contentType,
    title: url,
  })
  const text = formatWebFetchText(headerLine, processedRaw, savedPath)

  return {
    content: [{ type: 'text', text }],
    details: {
      status: code >= 200 && code < 300 ? 'ready' : 'http_error',
      url,
      fetchSource,
      fetchUrl: finalUrl,
      fallbackReason,
      directFetchError,
      code,
      codeText,
      contentType,
      bytes: body.length,
      savedPath,
      truncated: shouldOffloadText(processedRaw),
      durationMs: Date.now() - start,
    },
  }
}

export async function runWebFetch(
  args: WebFetchToolArgs,
  signal?: AbortSignal,
  options?: WebFetchRunOptions,
): Promise<AgentToolResult> {
  const url = args.url
  const validationError = validateWebFetchUrl(url)
  if (validationError) return validationError

  const settings = readWebProviderSettings()
  const provider = settings.fetchProvider
  if (provider === 'default') return runDefaultWebFetch(args, signal, undefined, options)

  const apiKey = settings.apiKeys[provider].trim()
  if (!apiKey)
    return runDefaultWebFetch(args, signal, `${provider} is selected but has no API key configured.`, options)

  const start = Date.now()
  try {
    const result = await fetchWithWebProvider(provider, apiKey, url, signal)
    return formatProviderFetchResult({
      url,
      fetchSource: provider,
      code: result.code,
      codeText: result.codeText,
      contentType: result.document.contentType,
      body: result.document.content,
      fetchedUrl: result.document.url,
      start,
      options,
    })
  } catch (error) {
    const message = getErrorMessage(error)
    if (isAbortError(error, signal)) {
      return errorResult(`Fetch aborted: ${message}`, { reason: 'aborted', url, provider, message })
    }
    return errorResult(`Fetch through ${provider} failed: ${message}`, {
      reason: 'provider_fetch_failed',
      url,
      provider,
      message,
      durationMs: Date.now() - start,
    })
  }
}
