import { fetchTextThroughProxy, parseProxyTarget } from './_proxy'

type PagesFunctionContext = {
  request: Request
}

export async function onRequest({ request }: PagesFunctionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let parsedUrl: URL
  try {
    const body = (await request.json()) as { url?: unknown }
    if (typeof body.url !== 'string' || !body.url) throw new Error('Missing url')
    parsedUrl = parseProxyTarget(body.url, request.url, true)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 })
  }

  try {
    return Response.json(await fetchTextThroughProxy(parsedUrl, request.url))
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
