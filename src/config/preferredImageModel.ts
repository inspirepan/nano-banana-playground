import { MODEL_CONFIGS } from './models'

export const PREFERRED_IMAGE_MODEL_STORAGE_KEY = 'nano-banana-preferred-image-model'

function readFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(PREFERRED_IMAGE_MODEL_STORAGE_KEY)
    if (stored && MODEL_CONFIGS.some((m) => m.id === stored)) return stored
    return null
  } catch {
    return null
  }
}

let activeId: string | null = readFromStorage()
const listeners = new Set<() => void>()

export function getPreferredImageModelId(): string | null {
  return activeId
}

export function setPreferredImageModelId(next: string | null): void {
  if (next && !MODEL_CONFIGS.some((m) => m.id === next)) return
  if (activeId === next) return
  activeId = next
  try {
    if (next) window.localStorage.setItem(PREFERRED_IMAGE_MODEL_STORAGE_KEY, next)
    else window.localStorage.removeItem(PREFERRED_IMAGE_MODEL_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
  for (const listener of listeners) listener()
}

export function subscribePreferredImageModelId(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
