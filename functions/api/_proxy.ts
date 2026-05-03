export const PROVIDER_TARGETS: Record<string, string> = {
  google: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  'moonshot-cn': 'https://api.moonshot.cn',
  'moonshot-ai': 'https://api.moonshot.ai',
}

const REQUEST_HEADER_ALLOWLIST = new Set([
  'accept',
  'anthropic-beta',
  'anthropic-dangerous-direct-browser-access',
  'anthropic-version',
  'authorization',
  'content-type',
  'openai-organization',
  'openai-project',
  'parallel-beta',
  'x-api-key',
  'x-goog-api-key',
  'x-subscription-token',
])

const RESPONSE_HEADER_ALLOWLIST = new Set([
  'cache-control',
  'content-type',
  'etag',
  'expires',
  'last-modified',
  'openai-organization',
  'openai-processing-ms',
  'openai-version',
  'request-id',
  'x-request-id',
  'x-ratelimit-limit-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-requests',
  'x-ratelimit-reset-tokens',
])

const MAX_FETCH_BYTES = 2_000_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 30_000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export type ProxyFetchResponse = {
  status: number
  statusText: string
  contentType: string
  finalUrl: string
  body: string
}

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match) return false
  const octets = match.slice(1).map(Number)
  if (octets.some((octet) => octet < 0 || octet > 255)) return true
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isBlockedHostname(hostname: string, ownHostname?: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '')
  const normalizedOwnHostname = ownHostname?.replace(/\.+$/, '')
  const isIpv6Literal = normalized.includes(':')
  if (!normalized || normalized === normalizedOwnHostname) return true
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true
  if (isPrivateIpv4(normalized)) return true
  return isIpv6Literal
}

export function parseProxyTarget(rawUrl: string, requestUrl: string, allowHttp = false): URL {
  const parsed = new URL(rawUrl)
  const ownHostname = new URL(requestUrl).hostname.toLowerCase()
  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`)
  }
  if (isBlockedHostname(parsed.hostname, ownHostname)) {
    throw new Error(`Blocked target host: ${parsed.hostname}`)
  }
  return parsed
}

export function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return atob(padded)
}

export function getPathSegments(path: string | string[] | undefined): string[] {
  return Array.isArray(path) ? path : path ? [path] : []
}

export function filterRequestHeaders(headers: Headers): Headers {
  const filtered = new Headers()
  headers.forEach((value, key) => {
    if (REQUEST_HEADER_ALLOWLIST.has(key.toLowerCase())) filtered.set(key, value)
  })
  return filtered
}

export function filterResponseHeaders(headers: Headers): Headers {
  const filtered = new Headers()
  headers.forEach((value, key) => {
    if (RESPONSE_HEADER_ALLOWLIST.has(key.toLowerCase())) filtered.set(key, value)
  })
  return filtered
}

function proxyResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: filterResponseHeaders(response.headers),
  })
}

export async function fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url.toString(), { ...init, redirect: 'manual', signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function forwardProxyRequest(request: Request, targetUrl: URL): Promise<Response> {
  let currentUrl = targetUrl
  let method = request.method
  const requestBody = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
  const headers = filterRequestHeaders(request.headers)
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const body =
      requestBody && requestBody.byteLength > 0 && method !== 'GET' && method !== 'HEAD' ? requestBody : undefined
    const response = await fetchWithTimeout(currentUrl, { method, headers, body })

    if (!REDIRECT_STATUSES.has(response.status)) return proxyResponse(response)

    const location = response.headers.get('location')
    if (!location) return proxyResponse(response)

    if (response.status === 303) method = 'GET'
    currentUrl = parseProxyTarget(new URL(location, currentUrl).toString(), request.url)
  }

  return Response.json({ error: 'Too many redirects' }, { status: 508 })
}

export async function fetchTextThroughProxy(url: URL, requestUrl: string): Promise<ProxyFetchResponse> {
  let currentUrl = url
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchWithTimeout(currentUrl, { method: 'GET' })
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      if (!location) break
      currentUrl = parseProxyTarget(new URL(location, currentUrl).toString(), requestUrl, true)
      continue
    }

    const contentLength = Number(response.headers.get('content-length') ?? '0')
    if (contentLength > MAX_FETCH_BYTES) throw new Error('Response too large')

    const reader = response.body?.getReader()
    if (!reader) {
      return {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type') ?? '',
        finalUrl: response.url,
        body: '',
      }
    }

    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_FETCH_BYTES) throw new Error('Response too large')
      chunks.push(value)
    }

    const bytes = new Uint8Array(received)
    let offset = 0
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    })

    return {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type') ?? '',
      finalUrl: response.url,
      body: new TextDecoder().decode(bytes),
    }
  }

  throw new Error('Too many redirects')
}
