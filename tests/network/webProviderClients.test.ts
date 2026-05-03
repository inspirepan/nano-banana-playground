import { describe, expect, it } from 'vitest'

import { fetchWithWebProvider, searchWithWebProvider } from '../../src/agent/tools/webProviderClients'

const TEST_URL = 'https://jvns.ca/blog/2026/05/02/testing-vue-components-in-the-browser/'

function requireEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

describe('web provider clients real network', () => {
  const exaApiKey = requireEnv('EXA_API_KEY')
  const tavilyApiKey = requireEnv('TAVILY_API_KEY')

  ;(exaApiKey ? it : it.skip)('searches with Exa when EXA_API_KEY is set', async () => {
    const result = await searchWithWebProvider(
      'exa',
      exaApiKey as string,
      'Julia Evans Vue browser component testing',
      3,
    )

    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0]?.url).toMatch(/^https?:\/\//)
  })
  ;(exaApiKey ? it : it.skip)('fetches page content with Exa when EXA_API_KEY is set', async () => {
    const result = await fetchWithWebProvider('exa', exaApiKey as string, TEST_URL)

    expect(result.document.content).toContain('Testing Vue components in the browser')
    expect(result.document.url).toMatch(/^https?:\/\//)
  })
  ;(tavilyApiKey ? it : it.skip)('searches with Tavily when TAVILY_API_KEY is set', async () => {
    const result = await searchWithWebProvider(
      'tavily',
      tavilyApiKey as string,
      'Julia Evans Vue browser component testing',
      3,
    )

    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0]?.url).toMatch(/^https?:\/\//)
  })
  ;(tavilyApiKey ? it : it.skip)('fetches page content with Tavily when TAVILY_API_KEY is set', async () => {
    const result = await fetchWithWebProvider('tavily', tavilyApiKey as string, TEST_URL)

    expect(result.document.content).toContain('Testing Vue components in the browser')
    expect(result.document.url).toMatch(/^https?:\/\//)
  })
})
