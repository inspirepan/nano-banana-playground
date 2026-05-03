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
const BRAVE_BASE_URL = isBrowserRuntime ? '/api/brave' : 'https://api.search.brave.com'
const PARALLEL_BASE_URL = isBrowserRuntime ? '/api/parallel' : 'https://api.parallel.ai'

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

async function getJson(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<JsonResponse> {
  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json', ...headers },
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

function parseBraveSearch(data: unknown): WebProviderSearchResult[] {
  const record = asRecord(data)
  const grounding = asRecord(record.grounding)
  const sources = asRecord(record.sources)
  return asArray(grounding.generic)
    .map((item, index) => {
      const result = asRecord(item)
      const url = asString(result.url)
      const source = asRecord(sources[url])
      return {
        title: firstString(asString(result.title), asString(source.title)),
        url,
        snippet: joinStrings(result.snippets),
        position: index + 1,
      }
    })
    .filter((result) => result.url)
}

function parseParallelSearch(data: unknown): WebProviderSearchResult[] {
  return asArray(asRecord(data).results)
    .map((item, index) => {
      const record = asRecord(item)
      return {
        title: asString(record.title),
        url: asString(record.url),
        snippet: joinStrings(record.excerpts),
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

  if (provider === 'brave') {
    const params = new URLSearchParams({ q: query, count: String(maxResults) })
    const response = await getJson(
      `${BRAVE_BASE_URL}/res/v1/llm/context?${params.toString()}`,
      { 'X-Subscription-Token': apiKey },
      signal,
    )
    return { ...response, results: parseBraveSearch(response.data), raw: response.data }
  }

  if (provider === 'parallel') {
    const response = await postJson(
      `${PARALLEL_BASE_URL}/v1/search`,
      { 'x-api-key': apiKey },
      {
        objective: query,
        search_queries: [query],
        mode: 'advanced',
        advanced_settings: {
          max_results: maxResults,
          excerpt_settings: { max_chars_per_result: 4000 },
        },
      },
      signal,
    )
    return { ...response, results: parseParallelSearch(response.data), raw: response.data }
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

function parseFirstParallelDocument(data: unknown, fallbackUrl: string): WebProviderFetchResult {
  const record = asRecord(data)
  const results = asArray(record.results)
  const result = asRecord(results.find((item) => asString(asRecord(item).url) === fallbackUrl) ?? results[0])
  if (!asString(result.url)) {
    const error = asRecord(asArray(record.errors)[0])
    const errorType = asString(error.error_type)
    const status = typeof error.http_status_code === 'number' ? ` ${error.http_status_code}` : ''
    const content = asString(error.content)
    const message = firstString(content, errorType, 'No extract result returned')
    throw new Error(`Parallel extract failed${errorType ? ` (${errorType}${status})` : ''}: ${message}`)
  }
  return {
    url: firstString(asString(result.url), fallbackUrl),
    title: asString(result.title),
    content: firstString(asString(result.full_content), joinStrings(result.excerpts)),
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

  if (provider === 'parallel') {
    const response = await postJson(
      `${PARALLEL_BASE_URL}/v1/extract`,
      { 'x-api-key': apiKey },
      {
        urls: [url],
        advanced_settings: { full_content: { max_chars_per_result: 100_000 } },
      },
      signal,
    )
    return {
      code: response.code,
      codeText: response.codeText,
      document: parseFirstParallelDocument(response.data, url),
    }
  }

  throw new Error('Unsupported web fetch provider.')
}
