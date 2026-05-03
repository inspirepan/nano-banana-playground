import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWithWebProvider } from '../webProviderClients'

describe('web provider clients', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('surfaces Parallel extract errors returned in a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              extract_id: 'extract_test',
              results: [],
              errors: [
                {
                  url: 'https://example.com/missing',
                  error_type: 'fetch_error',
                  http_status_code: 404,
                  content: 'Could not fetch page',
                },
              ],
              session_id: 'session_test',
            }),
            { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )

    await expect(fetchWithWebProvider('parallel', 'parallel-key', 'https://example.com/missing')).rejects.toThrow(
      'Parallel extract failed (fetch_error 404): Could not fetch page',
    )
  })
})
