// --- Simple URL params: model/resolution/ratio/quality/batch/prompt ---

export type SimpleUrlParams = {
  modelId: string | null
  resolution: string | null
  aspectRatio: string | null
  quality: string | null
  batchCount: number | null
  prompt: string | null
}

export function readSimpleUrlParams(): SimpleUrlParams {
  const params = new URLSearchParams(window.location.search)
  const nRaw = params.get('n')
  const n = nRaw !== null ? parseInt(nRaw, 10) : null
  return {
    modelId: params.get('m'),
    resolution: params.get('r'),
    aspectRatio: params.get('a'),
    quality: params.get('q'),
    batchCount: n !== null && !isNaN(n) ? n : null,
    prompt: params.get('p'),
  }
}

// --- URL writer ---

// Updates a subset of URL params via replaceState (no history entry added)
export function updateUrl(updates: Record<string, string | null>): void {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const search = params.toString()
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
  window.history.replaceState(null, '', url)
}
