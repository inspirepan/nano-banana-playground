import { MODEL_CONFIGS } from './models'
import { getStorageItem, removeStorageItem, setStorageItem } from '../lib/storage'

export const PREFERRED_IMAGE_MODEL_STORAGE_KEY = 'nano-banana-preferred-image-model'

function readFromStorage(): string | null {
  const stored = getStorageItem('localStorage', PREFERRED_IMAGE_MODEL_STORAGE_KEY)
  if (stored && MODEL_CONFIGS.some((m) => m.id === stored)) return stored
  return null
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
  if (next) setStorageItem('localStorage', PREFERRED_IMAGE_MODEL_STORAGE_KEY, next)
  else removeStorageItem('localStorage', PREFERRED_IMAGE_MODEL_STORAGE_KEY)
  for (const listener of listeners) listener()
}

export function subscribePreferredImageModelId(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
