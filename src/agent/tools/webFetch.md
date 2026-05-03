Fetch a public web page over http(s) and return its text content.

Use it when the user gives you a specific URL, or when you need to read a public reference (article, brand page, documentation, color or style spec) before deciding how to generate. Do not use it as a search engine.

Limits:

- http(s) only. Authenticated or private resources (private GitHub, Confluence, Jira, Google Docs, Notion, etc.) will fail; tell the user instead of retrying.
- The user can configure Exa or Tavily as the WebFetch backend in Settings. If no fetch backend is configured, direct browser fetch is used first.
- In the default browser mode, direct cross-origin fetches can fail because of CORS. When that happens, the tool automatically retries public pages through Jina Reader and returns its text/markdown output.
- Redirects are followed automatically.
- HTML responses are stripped to plain text. Non-HTML responses (JSON, markdown, plain text) are returned as-is.
- Full fetched content is saved to an `agent://...` virtual file when the browser session is available. Long outputs return a preview plus the saved path; use `ReadAgentFile` with `offset`/`limit` to inspect the rest.
