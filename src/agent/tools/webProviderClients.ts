import type { WebApiProvider, WebFetchProvider } from '../../config/webProviders'

export type WebProviderSearchResult = {
  title: string
  url: string
  snippet: string
  position: number
}

export type WebProviderFetchResult = {
  url: string
  title: string
  content: string
  contentType: string
  raw: unknown
}

type JsonResponse = {
  code: number
  codeText: string
  data: unknown
}

const isBrowserRuntime = 'window' in globalThis
const EXA_BASE_URL = isBrowserRuntime ? '/api/exa' : 'https://api.exa.ai'
const TAVILY_BASE_URL = isBrowserRuntime ? '/api/tavily' : 'https://api.tavily.com'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function joinStrings(value: unknown): string {
  return asArray(value)
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .join('\n')
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : ''
    if (text) return text
  }
  return ''
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<JsonResponse> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data: unknown = text
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!response.ok) {
    const message = firstString(
      asRecord(asRecord(data).error).message,
      asRecord(asRecord(data).detail).error,
      asRecord(data).message,
      text,
    )
    throw new Error(
      `${response.status}${response.statusText ? ` ${response.statusText}` : ''}${message ? `: ${message}` : ''}`,
    )
  }
  return { code: response.status, codeText: response.statusText, data }
}

function parseExaSearch(data: unknown): WebProviderSearchResult[] {
  return asArray(asRecord(data).results)
    .map((item, index) => {
      const record = asRecord(item)
      return {
        title: asString(record.title),
        url: asString(record.url),
        snippet: firstString(joinStrings(record.highlights), asString(record.summary), asString(record.text)),
        position: index + 1,
      }
    })
    .filter((result) => result.url)
}

function parseTavilySearch(data: unknown): WebProviderSearchResult[] {
  return asArray(asRecord(data).results)
    .map((item, index) => {
      const record = asRecord(item)
      return {
        title: asString(record.title),
        url: asString(record.url),
        snippet: firstString(asString(record.content), asString(record.raw_content)),
        position: index + 1,
      }
    })
    .filter((result) => result.url)
}

export async function searchWithWebProvider(
  provider: WebApiProvider,
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<{ code: number; codeText: string; results: WebProviderSearchResult[]; raw: unknown }> {
  if (provider === 'exa') {
    const response = await postJson(
      `${EXA_BASE_URL}/search`,
      { 'x-api-key': apiKey },
      {
        query,
        type: 'auto',
        numResults: maxResults,
        contents: { highlights: { maxCharacters: 4000 } },
      },
      signal,
    )
    return { ...response, results: parseExaSearch(response.data), raw: response.data }
  }

  if (provider === 'tavily') {
    const response = await postJson(
      `${TAVILY_BASE_URL}/search`,
      { Authorization: `Bearer ${apiKey}` },
      {
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_raw_content: false,
        include_images: false,
      },
      signal,
    )
    return { ...response, results: parseTavilySearch(response.data), raw: response.data }
  }

  throw new Error('Unsupported web search provider.')
}

function parseFirstExaDocument(data: unknown, fallbackUrl: string): WebProviderFetchResult {
  const result = asRecord(asArray(asRecord(data).results)[0])
  return {
    url: firstString(asString(result.url), fallbackUrl),
    title: asString(result.title),
    content: firstString(asString(result.text), asString(result.summary), joinStrings(result.highlights)),
    contentType: 'text/markdown',
    raw: data,
  }
}

function parseFirstTavilyDocument(data: unknown, fallbackUrl: string): WebProviderFetchResult {
  const result = asRecord(asArray(asRecord(data).results)[0])
  return {
    url: firstString(asString(result.url), fallbackUrl),
    title: asString(result.title),
    content: firstString(asString(result.raw_content), asString(result.content)),
    contentType: 'text/markdown',
    raw: data,
  }
}

export async function fetchWithWebProvider(
  provider: Exclude<WebFetchProvider, 'default'>,
  apiKey: string,
  url: string,
  signal?: AbortSignal,
): Promise<{ code: number; codeText: string; document: WebProviderFetchResult }> {
  if (provider === 'exa') {
    const response = await postJson(
      `${EXA_BASE_URL}/contents`,
      { 'x-api-key': apiKey },
      { urls: [url], text: { maxCharacters: 100_000 }, livecrawl: 'fallback' },
      signal,
    )
    return { code: response.code, codeText: response.codeText, document: parseFirstExaDocument(response.data, url) }
  }

  if (provider === 'tavily') {
    const response = await postJson(
      `${TAVILY_BASE_URL}/extract`,
      { Authorization: `Bearer ${apiKey}` },
      { urls: url, extract_depth: 'basic', include_images: false, format: 'markdown' },
      signal,
    )
    return { code: response.code, codeText: response.codeText, document: parseFirstTavilyDocument(response.data, url) }
  }

  throw new Error('Unsupported web fetch provider.')
}
