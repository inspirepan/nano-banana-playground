import { getStorageItem, removeStorageItem, setStorageItem } from './storage'
import type { PlaygroundImage } from './types'

const DRAFT_REFS_KEY = 'nano-banana-draft-refs'

export type DraftRefMeta = { id: string; mimeType: string; source: PlaygroundImage['source']; timestamp: number }

export function saveDraftRefMetas(metas: DraftRefMeta[]): boolean {
  return setStorageItem('sessionStorage', DRAFT_REFS_KEY, JSON.stringify(metas))
}

export function loadDraftRefMetas(): DraftRefMeta[] {
  try {
    const raw = getStorageItem('sessionStorage', DRAFT_REFS_KEY)
    if (!raw) return []
    const metas = JSON.parse(raw)
    return Array.isArray(metas) ? (metas as DraftRefMeta[]) : []
  } catch {
    return []
  }
}

export function clearDraftRefMetas(): void {
  removeStorageItem('sessionStorage', DRAFT_REFS_KEY)
}
