import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const PROVIDER_TARGETS: Record<string, string> = {
  google: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  'moonshot-cn': 'https://api.moonshot.cn',
  'moonshot-ai': 'https://api.moonshot.ai',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
}

const DEV_PROXY_TARGETS = [
  { prefix: '/api/exa', target: 'https://api.exa.ai' },
  { prefix: '/api/tavily', target: 'https://api.tavily.com' },
  { prefix: '/api/brave', target: 'https://api.search.brave.com' },
  { prefix: '/api/parallel', target: 'https://api.parallel.ai' },
]

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
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

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

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '')
  if (!normalized) return true
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true
  if (isPrivateIpv4(normalized)) return true
  return normalized.includes(':')
}

function parseProxyTarget(rawUrl: string, allowHttp = false): URL {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`)
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`Blocked target host: ${parsed.hostname}`)
  }
  return parsed
}

function resolveProxyTarget(segment: string): URL | null {
  if (segment in PROVIDER_TARGETS) return parseProxyTarget(PROVIDER_TARGETS[segment] ?? '')
  try {
    const decoded = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    return parseProxyTarget(decoded)
  } catch {
    return null
  }
}

function resolveFixedDevTarget(pathname: string, search: string): URL | null {
  for (const { prefix, target } of DEV_PROXY_TARGETS) {
    if (pathname.startsWith(`${prefix}/`)) return parseProxyTarget(`${target}${pathname.slice(prefix.length)}${search}`)
  }
  return null
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined
}

function filterRequestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (!REQUEST_HEADER_ALLOWLIST.has(key.toLowerCase())) continue
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
    else if (value) headers.set(key, value)
  }
  return headers
}

function applyResponseHeaders(response: Response, res: ServerResponse): void {
  response.headers.forEach((value, key) => {
    if (RESPONSE_HEADER_ALLOWLIST.has(key.toLowerCase())) res.setHeader(key, value)
  })
}

function waitForDrain(res: ServerResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', handleDrain)
      res.off('error', handleError)
      res.off('close', handleClose)
    }
    const handleDrain = () => {
      cleanup()
      resolve()
    }
    const handleError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const handleClose = () => {
      cleanup()
      reject(new Error('Response closed'))
    }
    res.once('drain', handleDrain)
    res.once('error', handleError)
    res.once('close', handleClose)
  })
}

async function sendProxyResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status
  res.statusMessage = response.statusText
  applyResponseHeaders(response, res)
  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done || res.destroyed) break
      if (value.byteLength === 0) continue
      if (!res.write(Buffer.from(value))) await waitForDrain(res)
    }
    if (!res.destroyed) res.end()
  } finally {
    reader.releaseLock()
  }
}

async function forwardRequest(targetUrl: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let currentUrl = targetUrl
  let method = req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req)
  const headers = filterRequestHeaders(req)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const requestBody = body && body.length > 0 && method !== 'GET' && method !== 'HEAD' ? body : undefined
    const response = await fetch(currentUrl, { method, headers, redirect: 'manual', body: requestBody })

    if (!REDIRECT_STATUSES.has(response.status)) {
      await sendProxyResponse(response, res)
      return
    }

    const location = response.headers.get('location')
    if (!location) {
      await sendProxyResponse(response, res)
      return
    }

    if (response.status === 303) method = 'GET'
    currentUrl = parseProxyTarget(new URL(location, currentUrl).toString())
  }

  res.statusCode = 508
  res.end(JSON.stringify({ error: 'Too many redirects' }))
}

async function fetchTextThroughProxy(
  url: URL,
): Promise<{ status: number; statusText: string; contentType: string; finalUrl: string; body: string }> {
  let currentUrl = url
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, { redirect: 'manual' })
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      if (!location) break
      currentUrl = parseProxyTarget(new URL(location, currentUrl).toString(), true)
      continue
    }

    const contentLength = Number(response.headers.get('content-length') ?? '0')
    if (contentLength > MAX_FETCH_BYTES) throw new Error('Response too large')

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > MAX_FETCH_BYTES) throw new Error('Response too large')
    return {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type') ?? '',
      finalUrl: response.url,
      body: bytes.toString('utf-8'),
    }
  }

  throw new Error('Too many redirects')
}

function devPagesProxy(): Plugin {
  return {
    name: 'dev-pages-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = new URL(req.url ?? '/', 'http://localhost')
        const { pathname, search } = reqUrl

        try {
          const fixedTarget = resolveFixedDevTarget(pathname, search)
          if (fixedTarget) {
            await forwardRequest(fixedTarget, req, res)
            return
          }

          if (pathname.startsWith('/api/llm/')) {
            const segments = pathname.slice('/api/llm/'.length).split('/').filter(Boolean)
            const [first, ...rest] = segments
            if (!first) {
              res.statusCode = 404
              res.end('Missing provider')
              return
            }
            const target = resolveProxyTarget(first)
            if (!target) {
              res.statusCode = 404
              res.end(`Unknown: ${first}`)
              return
            }
            await forwardRequest(
              parseProxyTarget(`${target.toString().replace(/\/+$/, '')}/${rest.join('/')}${search}`),
              req,
              res,
            )
            return
          }
          if (pathname === '/api/fetch') {
            const rawBody = await readRequestBody(req)
            const body = JSON.parse(rawBody?.toString('utf-8') ?? '{}') as { url?: string }
            if (!body.url) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing url' }))
              return
            }
            const result = await fetchTextThroughProxy(parseProxyTarget(body.url, true))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
            return
          }
        } catch (e) {
          res.statusCode = 502
          res.end(String(e))
          return
        }

        next()
      })
    },
  }
}

function packageChunkName(id: string): string | undefined {
  const marker = '/node_modules/'
  const normalized = id.replaceAll('\\', '/')
  const index = normalized.lastIndexOf(marker)
  if (index < 0) return undefined

  const packagePath = normalized.slice(index + marker.length)
  const parts = packagePath.split('/')
  const packageName = parts[0]?.startsWith('@') ? `${parts[0]}-${parts[1]}` : parts[0]
  return packageName ? `vendor-${packageName.replaceAll('@', '').replaceAll('.', '-')}` : undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devPagesProxy()],
  resolve: {
    alias: {
      'node:fs': fileURLToPath(new URL('./src/lib/nodeShims/fs.ts', import.meta.url)),
      'node:os': fileURLToPath(new URL('./src/lib/nodeShims/os.ts', import.meta.url)),
      'node:path': fileURLToPath(new URL('./src/lib/nodeShims/path.ts', import.meta.url)),
    },
  },
  build: {
    // heic2any is a lazy-loaded single-file HEIC fallback converter.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        manualChunks(id, { getModuleInfo }) {
          if (!id.includes('node_modules')) return undefined
          // lucide-react special handling:
          // - DynamicIcon imports 1500+ per-icon files via () => import(...).
          // - Naming all of them 'vendor-lucide' collapses every lazy split
          //   into a single ~680KB sync bundle.
          // - Splitting modules by whether they're statically vs dynamically
          //   imported keeps the static fast path small while the dynamic
          //   icon set stays a single lazy-loaded chunk.
          if (id.includes('/lucide-react/')) {
            // Split lucide-react by import kind: modules reachable only via
            // `() => import(...)` (the 1500+ per-icon files used by
            // DynamicIcon) go to vendor-lucide-dynamic, which loads lazily.
            // Statically-imported pieces (Icon.tsx subpaths, DynamicIcon,
            // dynamicIconImports map, shared utils) stay in vendor-lucide.
            const info = getModuleInfo(id)
            if (info && info.importers.length === 0 && info.dynamicImporters.length > 0) {
              return 'vendor-lucide-dynamic'
            }
            return 'vendor-lucide'
          }
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
          if (id.includes('/agentation/')) return 'vendor-agentation'
          if (id.includes('/@mariozechner+pi-agent') || id.includes('/@mariozechner/pi-agent/')) {
            return 'vendor-pi-agent'
          }
          if (id.includes('/@mariozechner+pi-ai') || id.includes('/@mariozechner/pi-ai/')) return 'vendor-pi-ai'
          if (id.includes('/streamdown/')) return 'vendor-markdown'
          if (id.includes('/@google+genai') || id.includes('/@google/genai/')) return 'vendor-google-genai'
          return packageChunkName(id)
        },
      },
    },
  },
})
