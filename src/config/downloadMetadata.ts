import { readStripDownloadMetadataPreference, writeStripDownloadMetadataPreference } from '../lib/preferenceStore'

let activeStripDownloadMetadata = readStripDownloadMetadataPreference()
const listeners = new Set<() => void>()

export function getStripDownloadMetadata(): boolean {
  return activeStripDownloadMetadata
}

export function setStripDownloadMetadata(next: boolean): void {
  if (activeStripDownloadMetadata === next) return
  activeStripDownloadMetadata = next
  writeStripDownloadMetadataPreference(next)
  for (const listener of listeners) listener()
}

export function subscribeStripDownloadMetadata(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
