export const DB_NAME = 'nano-banana-playground'
export const DB_VERSION = 5

export const HISTORY_META_STORE = 'history'
export const IMAGE_BLOB_STORE = 'blobs'
export const IMAGE_PREVIEW_STORE = 'previews'
export const AGENT_SESSION_STORE = 'agent_sessions'
export const AGENT_SESSION_ENTRY_STORE = 'agent_session_entries'
export const AGENT_SESSION_SIDECAR_STORE = 'agent_session_sidecars'

export function openNanoBananaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const tx = req.transaction!

      if (!db.objectStoreNames.contains(HISTORY_META_STORE)) {
        const store = db.createObjectStore(HISTORY_META_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      if ((event.oldVersion ?? 0) < 2) {
        if (!db.objectStoreNames.contains(IMAGE_BLOB_STORE)) {
          db.createObjectStore(IMAGE_BLOB_STORE, { keyPath: 'id' })
        }

        if (event.oldVersion >= 1) {
          const metaStore = tx.objectStore(HISTORY_META_STORE)
          const blobStore = tx.objectStore(IMAGE_BLOB_STORE)
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

      if ((event.oldVersion ?? 0) < 3) {
        if (!db.objectStoreNames.contains(IMAGE_PREVIEW_STORE)) {
          db.createObjectStore(IMAGE_PREVIEW_STORE, { keyPath: 'id' })
        }
      }

      if ((event.oldVersion ?? 0) < 4) {
        if (db.objectStoreNames.contains(IMAGE_PREVIEW_STORE)) {
          tx.objectStore(IMAGE_PREVIEW_STORE).clear()
        }
      }

      if ((event.oldVersion ?? 0) < 5) {
        if (!db.objectStoreNames.contains(AGENT_SESSION_STORE)) {
          const store = db.createObjectStore(AGENT_SESSION_STORE, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
        if (!db.objectStoreNames.contains(AGENT_SESSION_ENTRY_STORE)) {
          const store = db.createObjectStore(AGENT_SESSION_ENTRY_STORE, { keyPath: 'id' })
          store.createIndex('sessionId', 'sessionId', { unique: false })
          store.createIndex('sessionUpdatedAt', ['sessionId', 'timestamp'], { unique: false })
          store.createIndex('sessionParent', ['sessionId', 'parentId'], { unique: false })
        }
        if (!db.objectStoreNames.contains(AGENT_SESSION_SIDECAR_STORE)) {
          db.createObjectStore(AGENT_SESSION_SIDECAR_STORE, { keyPath: 'sessionId' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
