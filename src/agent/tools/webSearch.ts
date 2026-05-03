import { Type } from '@mariozechner/pi-ai'

import { type AgentRuntimeTool, type AgentToolResult } from './shared'
import { searchWithWebProvider, type WebProviderSearchResult } from './webProviderClients'
import description from './webSearch.md?raw'
import { isWebApiProvider } from '../../config/webProviders'
import { translate } from '../../i18n'
import { readWebProviderSettings } from '../../lib/webProviderStore'

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 10

export type WebSearchToolArgs = {
  query: string
  max_results?: number
}

export type WebSearchExecutor = (
  toolCallId: string,
  args: WebSearchToolArgs,
  signal?: AbortSignal,
) => Promise<AgentToolResult>

export function prepareWebSearchArgs(args: unknown): WebSearchToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const rawMaxResults = record.max_results ?? record.maxResults
  return {
    query: typeof record.query === 'string' ? record.query.trim() : '',
    max_results:
      typeof rawMaxResults === 'number' && Number.isFinite(rawMaxResults) ? rawMaxResults : DEFAULT_MAX_RESULTS,
  }
}

export function createWebSearchTool({ webSearch }: { webSearch: WebSearchExecutor }): AgentRuntimeTool {
  return {
    name: 'WebSearch',
    label: translate('configLib.agent.tool.webSearch'),
    description: description.trim(),
    parameters: Type.Object({
      query: Type.String({ description: 'The search query to use.' }),
      max_results: Type.Optional(
        Type.Number({
          description: `Maximum number of results to return. Default ${DEFAULT_MAX_RESULTS}, max ${MAX_RESULTS_LIMIT}.`,
        }),
      ),
    }),
    prepareArguments: prepareWebSearchArgs,
    execute: (toolCallId: string, args: WebSearchToolArgs, signal?: AbortSignal) =>
      webSearch(toolCallId, prepareWebSearchArgs(args), signal),
  } as AgentRuntimeTool
}

function clampMaxResults(value: number | undefined): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : DEFAULT_MAX_RESULTS
  return Math.min(Math.max(number, 1), MAX_RESULTS_LIMIT)
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

function escapeResultText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function errorResult(text: string, details: Record<string, unknown>): AgentToolResult {
  return {
    content: [{ type: 'text', text: `<tool_use_error>${text}</tool_use_error>` }],
    details: { status: 'error', ...details },
  }
}

function formatSearchResults(results: WebProviderSearchResult[]): string {
  if (results.length === 0) return '<search_results>\n</search_results>'
  const items = results.map(
    (result) => `<result position="${result.position}">
<title>${escapeResultText(result.title)}</title>
<url>${escapeResultText(result.url)}</url>
<snippet>${escapeResultText(result.snippet)}</snippet>
</result>`,
  )
  return `<search_results>\n${items.join('\n')}\n</search_results>`
}

export async function runWebSearch(args: WebSearchToolArgs, signal?: AbortSignal): Promise<AgentToolResult> {
  const query = args.query.trim()
  if (!query) return errorResult('Missing query.', { reason: 'missing_query' })

  const settings = readWebProviderSettings()
  const provider = settings.searchProvider
  if (provider === 'none' || !isWebApiProvider(provider)) {
    return errorResult('Web search is not configured. Choose a search backend and add its API key in Settings.', {
      reason: 'not_configured',
      provider,
    })
  }

  const apiKey = settings.apiKeys[provider].trim()
  if (!apiKey) {
    return errorResult(`Web search provider ${provider} has no API key configured.`, {
      reason: 'missing_api_key',
      provider,
    })
  }

  const maxResults = clampMaxResults(args.max_results)
  const start = Date.now()
  try {
    const result = await searchWithWebProvider(provider, apiKey, query, maxResults, signal)
    const text = [
      `Query: ${query}`,
      `Search-Provider: ${provider}`,
      `Status: ${result.code}${result.codeText ? ` ${result.codeText}` : ''}`,
      `Results: ${result.results.length}`,
      '',
      formatSearchResults(result.results),
    ].join('\n')
    return {
      content: [{ type: 'text', text }],
      details: {
        status: 'ready',
        provider,
        query,
        maxResults,
        resultCount: result.results.length,
        results: result.results.map((item) => ({
          position: item.position,
          title: item.title,
          url: item.url,
          snippet: item.snippet,
        })),
        code: result.code,
        codeText: result.codeText,
        durationMs: Date.now() - start,
      },
    }
  } catch (error) {
    const message = getErrorMessage(error)
    if (isAbortError(error, signal)) {
      return errorResult(`Search aborted: ${message}`, { reason: 'aborted', provider, query, message })
    }
    return errorResult(`Search through ${provider} failed: ${message}`, {
      reason: 'provider_search_failed',
      provider,
      query,
      message,
      durationMs: Date.now() - start,
    })
  }
}
