import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const originalFetch = globalThis.fetch

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url: URL
  try {
    url = input instanceof URL ? input : typeof input === 'string' ? new URL(input) : new URL(input.url)
  } catch {
    return originalFetch(input, init)
  }

  if (url.protocol === 'file:') {
    const body = await readFile(fileURLToPath(url))
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/wasm' },
    })
  }

  return originalFetch(input, init)
}
