Search the public web and return ranked result metadata.

Use it when you need to discover URLs or current public information before deciding what to fetch or how to answer. After search, use WebFetch on specific URLs when you need the full page content.

Limits:

- Requires a configured search backend and API key in Settings. If no backend is configured, report that web search is unavailable.
- Search only public web content. Authenticated/private resources will fail.
- Results contain titles, URLs, and snippets/excerpts. They are not a substitute for reading the page when exact details matter.
- `max_results` is clamped to 1-10.
