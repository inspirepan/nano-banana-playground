type StorageKind = 'localStorage' | 'sessionStorage'

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window[kind]
  } catch {
    return null
  }
}

export function getStorageItem(kind: StorageKind, key: string): string | null {
  const storage = getStorage(kind)
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function setStorageItem(kind: StorageKind, key: string, value: string): boolean {
  const storage = getStorage(kind)
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    // Storage may be unavailable or full.
    return false
  }
}

export function removeStorageItem(kind: StorageKind, key: string): void {
  const storage = getStorage(kind)
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Storage may be unavailable.
  }
}

export function clearStorage(kind: StorageKind): void {
  const storage = getStorage(kind)
  if (!storage) return
  try {
    storage.clear()
  } catch {
    // Storage may be unavailable.
  }
}

export function getStorageLength(kind: StorageKind): number {
  const storage = getStorage(kind)
  if (!storage) return 0
  try {
    return storage.length
  } catch {
    return 0
  }
}

export function getStorageEntries(kind: StorageKind): [string, string][] {
  const storage = getStorage(kind)
  if (!storage) return []
  try {
    const entries: [string, string][] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key) continue
      entries.push([key, storage.getItem(key) ?? ''])
    }
    return entries
  } catch {
    return []
  }
}
