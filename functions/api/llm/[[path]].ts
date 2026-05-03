import { PROVIDER_TARGETS, decodeBase64Url, forwardProxyRequest, getPathSegments, parseProxyTarget } from '../_proxy'

type PagesFunctionContext = {
  request: Request
  params: Record<string, string | string[]>
}

function resolveTarget(firstSegment: string, requestUrl: string): URL | null {
  if (firstSegment in PROVIDER_TARGETS) return parseProxyTarget(PROVIDER_TARGETS[firstSegment] ?? '', requestUrl)
  try {
    return parseProxyTarget(decodeBase64Url(firstSegment), requestUrl)
  } catch {
    return null
  }
}

export async function onRequest({ request, params }: PagesFunctionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })

  const [firstSegment, ...rest] = getPathSegments(params.path)

  if (!firstSegment) {
    return Response.json({ error: 'Missing provider or target' }, { status: 404 })
  }

  const targetBase = resolveTarget(firstSegment, request.url)
  if (!targetBase) {
    return Response.json({ error: `Unknown provider or invalid encoded URL: ${firstSegment}` }, { status: 404 })
  }

  const originalUrl = new URL(request.url)
  const targetUrl = new URL(`${targetBase.toString().replace(/\/+$/, '')}/${rest.join('/')}`)
  targetUrl.search = originalUrl.search

  return forwardProxyRequest(request, targetUrl)
}
