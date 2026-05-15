// URL state: core playground params (model/resolution/ratio/batch/prompt) are
// typed; model-specific option values live in `rawParams` keyed by their
// `urlKey`, so `usePlayground` can coerce them against the active model's
// option descriptors without the URL layer knowing each option's shape.

// Sentinel for `?agent=` when the user is in agent mode but hasn't created a
// session yet — keeps the mode survivable across refresh without inventing a
// second URL param.
export const AGENT_MODE_SENTINEL = 'new'

export type SimpleUrlParams = {
  modelId: string | null
  resolution: string | null
  aspectRatio: string | null
  batchCount: number | null
  prompt: string | null
  galleryOpen: boolean
  agentMode: boolean
  agentSessionId: string | null
  // Every query param as a raw string, used by callers to look up by option.urlKey.
  rawParams: Record<string, string>
}

export function readSimpleUrlParams(): SimpleUrlParams {
  const params = new URLSearchParams(window.location.search)
  const nRaw = params.get('n')
  const n = nRaw !== null ? parseInt(nRaw, 10) : null
  const rawParams: Record<string, string> = {}
  for (const [k, v] of params.entries()) rawParams[k] = v
  const agentRaw = params.get('agent')
  const agentMode = agentRaw !== null && agentRaw !== ''
  const agentSessionId = agentMode ? agentRaw : null
  return {
    modelId: params.get('m'),
    resolution: params.get('r'),
    aspectRatio: params.get('a'),
    batchCount: n !== null && !isNaN(n) ? n : null,
    prompt: params.get('p'),
    galleryOpen: params.get('gallery') === '1',
    agentMode,
    agentSessionId,
    rawParams,
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
