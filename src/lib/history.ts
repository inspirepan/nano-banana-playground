import type { PlaygroundImage, PlaygroundImageMeta } from './types'

export type ImagePreviewRecord = {
  data: string
  mimeType?: string
}

const DB_NAME = 'nano-banana-playground'
const DB_VERSION = 4
const META_STORE = 'history'
const BLOB_STORE = 'blobs'
const PREVIEW_STORE = 'previews'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const tx = req.transaction!

      // v1: create history store
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // v2: create blobs store + migrate data out of history records
      if ((event.oldVersion ?? 0) < 2) {
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
        }

        // Migrate existing records: move `data` field to blobs store
        if (event.oldVersion >= 1) {
          const metaStore = tx.objectStore(META_STORE)
          const blobStore = tx.objectStore(BLOB_STORE)
          const cursorReq = metaStore.openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (cursor) {
              const record = cursor.value
              if (record.data) {
                blobStore.put({ id: record.id, data: record.data })
                const { data: _, ...meta } = record
                cursor.update(meta)
              }
              cursor.continue()
            }
          }
        }
      }

      // v3: store previews separately from original blobs
      if ((event.oldVersion ?? 0) < 3) {
        if (!db.objectStoreNames.contains(PREVIEW_STORE)) {
          db.createObjectStore(PREVIEW_STORE, { keyPath: 'id' })
        }
      }

      // v4: invalidate old low-res previews so they can be regenerated with updated size
      if ((event.oldVersion ?? 0) < 4) {
        if (db.objectStoreNames.contains(PREVIEW_STORE)) {
          tx.objectStore(PREVIEW_STORE).clear()
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveToHistory(image: PlaygroundImage): Promise<void> {
  const db = await openDB()
  const { data, ...meta } = image
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite')
    tx.objectStore(META_STORE).put(meta)
    tx.objectStore(BLOB_STORE).put({ id: image.id, data })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Load a page of metadata (no blob data), sorted by timestamp descending
export async function loadHistoryPage(
  offset: number,
  limit: number,
): Promise<{ items: PlaygroundImageMeta[]; hasMore: boolean }> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const index = tx.objectStore(META_STORE).index('timestamp')
    const req = index.openCursor(null, 'prev')
    const results: PlaygroundImageMeta[] = []
    let advanced = false

    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve({ items: results, hasMore: false })
        return
      }
      if (offset > 0 && !advanced) {
        advanced = true
        cursor.advance(offset)
        return
      }
      if (results.length < limit) {
        results.push(cursor.value as PlaygroundImageMeta)
        cursor.continue()
      } else {
        resolve({ items: results, hasMore: true })
      }
    }
    req.onerror = () => reject(req.error)
  })
}

// Load blob data for a single image
export async function loadImageBlob(id: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly')
    const req = tx.objectStore(BLOB_STORE).get(id)
    req.onsuccess = () => resolve(req.result?.data ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function loadImagePreview(id: string): Promise<ImagePreviewRecord | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREVIEW_STORE, 'readonly')
    const req = tx.objectStore(PREVIEW_STORE).get(id)
    req.onsuccess = () => {
      const result = req.result
      resolve(result?.data ? { data: result.data, mimeType: result.mimeType } : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveImagePreview(id: string, data: string, mimeType: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREVIEW_STORE, 'readwrite')
    tx.objectStore(PREVIEW_STORE).put({ id, data, mimeType })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteImagePreview(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREVIEW_STORE, 'readwrite')
    tx.objectStore(PREVIEW_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Load blob data for multiple images
export async function loadImageBlobs(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly')
    const store = tx.objectStore(BLOB_STORE)
    const result = new Map<string, string>()
    let pending = ids.length

    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = () => {
        if (req.result?.data) result.set(id, req.result.data)
        if (--pending === 0) resolve(result)
      }
      req.onerror = () => {
        if (--pending === 0) resolve(result)
      }
    }

    tx.onerror = () => reject(tx.error)
  })
}

// Load metadata for multiple images by ID
export async function loadImageMetas(ids: string[]): Promise<Map<string, PlaygroundImageMeta>> {
  if (ids.length === 0) return new Map()
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const store = tx.objectStore(META_STORE)
    const result = new Map<string, PlaygroundImageMeta>()
    let pending = ids.length

    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = () => {
        if (req.result) result.set(id, req.result as PlaygroundImageMeta)
        if (--pending === 0) resolve(result)
      }
      req.onerror = () => {
        if (--pending === 0) resolve(result)
      }
    }

    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteFromHistory(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE, PREVIEW_STORE], 'readwrite')
    tx.objectStore(META_STORE).delete(id)
    tx.objectStore(BLOB_STORE).delete(id)
    tx.objectStore(PREVIEW_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Count total items in history
export async function countHistory(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const req = tx.objectStore(META_STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// --- Draft reference images persistence ---
// Survives page refresh via sessionStorage (metadata) + IndexedDB (blobs).
const DRAFT_REFS_KEY = 'nano-banana-draft-refs'

type DraftRefMeta = { id: string; mimeType: string; source: PlaygroundImage['source']; timestamp: number }

export async function saveDraftRefs(images: PlaygroundImage[]): Promise<void> {
  if (images.length === 0) {
    clearDraftRefs()
    return
  }
  const db = await openDB()
  const metas: DraftRefMeta[] = []
  const tx = db.transaction(BLOB_STORE, 'readwrite')
  const blobStore = tx.objectStore(BLOB_STORE)
  for (const img of images) {
    blobStore.put({ id: img.id, data: img.data })
    metas.push({ id: img.id, mimeType: img.mimeType, source: img.source, timestamp: img.timestamp })
  }
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      try {
        sessionStorage.setItem(DRAFT_REFS_KEY, JSON.stringify(metas))
      } catch {
        // sessionStorage full or unavailable — silently skip
      }
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadDraftRefs(): Promise<PlaygroundImage[]> {
  try {
    const raw = sessionStorage.getItem(DRAFT_REFS_KEY)
    if (!raw) return []
    const metas: DraftRefMeta[] = JSON.parse(raw)
    if (!Array.isArray(metas) || metas.length === 0) return []

    const db = await openDB()
    const images: PlaygroundImage[] = []
    const tx = db.transaction(BLOB_STORE, 'readonly')
    const blobStore = tx.objectStore(BLOB_STORE)

    await new Promise<void>((resolve, reject) => {
      let pending = metas.length
      for (const meta of metas) {
        const req = blobStore.get(meta.id)
        req.onsuccess = () => {
          if (req.result?.data) {
            images.push({ ...meta, data: req.result.data })
          }
          if (--pending === 0) resolve()
        }
        req.onerror = () => {
          if (--pending === 0) resolve()
        }
      }
      tx.onerror = () => reject(tx.error)
    })

    const order = new Map(metas.map((m, i) => [m.id, i]))
    images.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    return images
  } catch {
    return []
  }
}

export function clearDraftRefs(): void {
  try {
    sessionStorage.removeItem(DRAFT_REFS_KEY)
  } catch {
    /* noop */
  }
}
