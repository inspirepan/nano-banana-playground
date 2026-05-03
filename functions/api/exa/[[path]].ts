import { forwardProxyRequest, getPathSegments, parseProxyTarget } from '../_proxy'

type PagesFunctionContext = {
  request: Request
  params: Record<string, string | string[]>
}

export async function onRequest({ request, params }: PagesFunctionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })

  const segments = getPathSegments(params.path)
  const originalUrl = new URL(request.url)
  const targetUrl = parseProxyTarget(`https://api.exa.ai/${segments.join('/')}`, request.url)
  targetUrl.search = originalUrl.search

  return forwardProxyRequest(request, targetUrl)
}
