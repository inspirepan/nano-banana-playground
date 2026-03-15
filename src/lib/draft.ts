import type { PromptScheme } from './types'

const SESSION_KEY = 'nb-session'
const TAB_KEY = 'nb-tab'
const INDEX_KEY = 'nb-draft-index'
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type DraftData = {
  prompt: string
  schemes: PromptScheme[] | null
  originalPrompt: string | null
  updatedAt: number
}

export type DraftEntry = {
  sessionId: string
  updatedAt: number
}

function getWindowTabId(): string {
  if (window.name.startsWith('nb-tab:')) return window.name.slice('nb-tab:'.length)
  const id = crypto.randomUUID()
  window.name = `nb-tab:${id}`
  return id
}

// Evaluated once at module load time — stable for the lifetime of this page.
// We only reuse a draft session if both sessionStorage and window.name belong to
// the same tab. Duplicate tabs often inherit sessionStorage, but they get a new
// browsing context, so window.name won't match and we rotate to a fresh ID.
const SESSION_ID: string = (() => {
  const tabId = getWindowTabId()
  const existing = sessionStorage.getItem(SESSION_KEY)
  const storedTabId = sessionStorage.getItem(TAB_KEY)
  if (existing && storedTabId === tabId) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(TAB_KEY, tabId)
  sessionStorage.setItem(SESSION_KEY, id)
  return id
})()

export function getSessionId(): string {
  return SESSION_ID
}

function draftKey(sessionId: string): string {
  return `nb-draft-${sessionId}`
}

function loadIndex(): Record<string, number> {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch { /* ignore */ }
  return {}
}

function saveIndex(index: Record<string, number>): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function loadDraft(sessionId: string): DraftData | null {
  try {
    const raw = localStorage.getItem(draftKey(sessionId))
    if (raw) return JSON.parse(raw) as DraftData
  } catch { /* ignore */ }
  return null
}

// Merge patch into existing draft and persist.
// Removes the draft entry if all fields are empty after the merge.
export function saveDraft(sessionId: string, patch: Partial<Omit<DraftData, 'updatedAt'>>): void {
  const existing = loadDraft(sessionId) ?? { prompt: '', schemes: null, originalPrompt: null }
  const merged = { ...existing, ...patch }

  if (!merged.prompt.trim() && !merged.schemes && !merged.originalPrompt) {
    // Draft is now empty — clean it up
    const index = loadIndex()
    if (index[sessionId] !== undefined) {
      localStorage.removeItem(draftKey(sessionId))
      delete index[sessionId]
      saveIndex(index)
    }
    return
  }

  const draft: DraftData = { ...merged, updatedAt: Date.now() }
  localStorage.setItem(draftKey(sessionId), JSON.stringify(draft))
  const index = loadIndex()
  index[sessionId] = draft.updatedAt
  saveIndex(index)
}

export function deleteDraft(sessionId: string): void {
  localStorage.removeItem(draftKey(sessionId))
  const index = loadIndex()
  delete index[sessionId]
  saveIndex(index)
}

// Drafts from sessions that are no longer in sessionStorage (i.e., closed tabs).
// Since we can't directly inspect other tabs' sessionStorage, we return all
// drafts except the current session and let the user decide which to restore.
export function getOtherDrafts(currentSessionId: string): DraftEntry[] {
  const index = loadIndex()
  return Object.entries(index)
    .filter(([id]) => id !== currentSessionId)
    .map(([sessionId, updatedAt]) => ({ sessionId, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// Move an orphaned draft into the current session, replacing current content.
export function adoptDraft(fromSessionId: string, toSessionId: string): DraftData | null {
  const data = loadDraft(fromSessionId)
  if (!data) return null
  deleteDraft(fromSessionId)
  saveDraft(toSessionId, { prompt: data.prompt, schemes: data.schemes, originalPrompt: data.originalPrompt })
  return data
}

// Remove drafts older than 7 days. Call once on app startup.
export function cleanupOldDrafts(): void {
  const index = loadIndex()
  const now = Date.now()
  let changed = false
  for (const [sessionId, updatedAt] of Object.entries(index)) {
    if (now - updatedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(draftKey(sessionId))
      delete index[sessionId]
      changed = true
    }
  }
  if (changed) saveIndex(index)
}
