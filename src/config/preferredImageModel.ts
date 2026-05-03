import { MODEL_CONFIGS } from './models'
import {
  clearPreferredImageModelPreference,
  readPreferredImageModelPreference,
  writePreferredImageModelPreference,
} from '../lib/preferenceStore'

function readFromStorage(): string | null {
  const stored = readPreferredImageModelPreference()
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
  if (next) writePreferredImageModelPreference(next)
  else clearPreferredImageModelPreference()
  for (const listener of listeners) listener()
}

export function subscribePreferredImageModelId(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
