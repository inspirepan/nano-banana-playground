import { readComposerSubmitModePreference, writeComposerSubmitModePreference } from '../lib/preferenceStore'

export type ComposerSubmitMode = 'cmdEnter' | 'enter'

export const DEFAULT_COMPOSER_SUBMIT_MODE: ComposerSubmitMode = 'cmdEnter'

function isComposerSubmitMode(value: string | null): value is ComposerSubmitMode {
  return value === 'cmdEnter' || value === 'enter'
}

function readFromStorage(): ComposerSubmitMode {
  const stored = readComposerSubmitModePreference()
  return isComposerSubmitMode(stored) ? stored : DEFAULT_COMPOSER_SUBMIT_MODE
}

let activeMode: ComposerSubmitMode = readFromStorage()
const listeners = new Set<() => void>()

export function getComposerSubmitMode(): ComposerSubmitMode {
  return activeMode
}

export function setComposerSubmitMode(next: ComposerSubmitMode): void {
  if (activeMode === next) return
  activeMode = next
  writeComposerSubmitModePreference(next)
  for (const listener of listeners) listener()
}

export function subscribeComposerSubmitMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
