const KNOWN_INDEXED_DB_NAMES = [
  'nano-banana-playground',
  'nano-banana-playground-v1',
  'nano-banana-playground-v2',
  'nano-banana-playground-v3',
  'nano-banana-playground-v4',
]

type IndexedDBWithDatabases = IDBFactory & {
  databases?: () => Promise<{ name?: string | null }[]>
}

export type SiteDataUsageSection = {
  id: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cacheStorage' | 'cookies'
  label: string
  bytes: number
  detail?: string
}

export type SiteDataUsage = {
  totalBytes: number
  browserEstimateBytes: number | null
  quotaBytes: number | null
  sections: SiteDataUsageSection[]
}

const textEncoder = new TextEncoder()

function textBytes(value: string): number {
  return textEncoder.encode(value).byteLength
}

function storageBytes(storage: Storage): number {
  let bytes = 0
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key) continue
    bytes += textBytes(key) + textBytes(storage.getItem(key) ?? '')
  }
  return bytes
}

function cookieBytes(): number {
  return document.cookie ? textBytes(document.cookie) : 0
}

function valueBytes(value: unknown): number {
  if (typeof value === 'string') return textBytes(value)
  if (value instanceof Blob) return value.size
  if (value instanceof ArrayBuffer) return value.byteLength
  if (ArrayBuffer.isView(value)) return value.byteLength
  try {
    return textBytes(JSON.stringify(value) ?? '')
  } catch {
    return 0
  }
}

function openExistingIndexedDB(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    let created = false

    req.onupgradeneeded = () => {
      created = true
      req.transaction?.abort()
    }
    req.onsuccess = () => {
      const db = req.result
      if (created) {
        db.close()
        resolve(null)
        return
      }
      resolve(db)
    }
    req.onerror = () => {
      if (created) {
        resolve(null)
        return
      }
      reject(req.error)
    }
    req.onblocked = () => resolve(null)
  })
}

function estimateObjectStore(store: IDBObjectStore): Promise<number> {
  return new Promise((resolve) => {
    const req = store.openCursor()
    let bytes = 0

    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve(bytes)
        return
      }
      bytes += valueBytes(cursor.primaryKey) + valueBytes(cursor.value)
      cursor.continue()
    }
    req.onerror = () => resolve(bytes)
  })
}

async function indexedDBUsage(): Promise<{ bytes: number; databases: number }> {
  const names = await indexedDBNames()
  let bytes = 0
  let databases = 0

  for (const name of names) {
    const db = await openExistingIndexedDB(name).catch(() => null)
    if (!db) continue
    databases++
    const storeNames = Array.from(db.objectStoreNames)
    if (storeNames.length > 0) {
      const tx = db.transaction(storeNames, 'readonly')
      bytes += (
        await Promise.all(storeNames.map((storeName) => estimateObjectStore(tx.objectStore(storeName))))
      ).reduce((sum, storeBytesValue) => sum + storeBytesValue, 0)
    }
    db.close()
  }

  return { bytes, databases }
}

async function cacheStorageBytes(): Promise<number> {
  if (!('caches' in window)) return 0
  const names = await caches.keys()
  let bytes = 0
  for (const name of names) {
    const cache = await caches.open(name)
    const requests = await cache.keys()
    for (const request of requests) {
      bytes += textBytes(request.url)
      const response = await cache.match(request)
      if (response) bytes += (await response.clone().blob()).size
    }
  }
  return bytes
}

async function browserStorageEstimate(): Promise<{ usage: number | null; quota: number | null }> {
  if (!navigator.storage?.estimate) return { usage: null, quota: null }
  const estimate = await navigator.storage.estimate()
  return { usage: estimate.usage ?? null, quota: estimate.quota ?? null }
}

async function indexedDBNames(): Promise<string[]> {
  const dbFactory = indexedDB as IndexedDBWithDatabases
  const discovered = dbFactory.databases ? await dbFactory.databases() : []
  return [
    ...new Set([
      ...discovered.map((db) => db.name).filter((name): name is string => Boolean(name)),
      ...KNOWN_INDEXED_DB_NAMES,
    ]),
  ]
}

function clearIndexedDBStores(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)

    req.onsuccess = () => {
      const db = req.result
      const storeNames = Array.from(db.objectStoreNames)
      if (storeNames.length === 0) {
        db.close()
        resolve()
        return
      }

      const tx = db.transaction(storeNames, 'readwrite')
      for (const storeName of storeNames) tx.objectStore(storeName).clear()
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
      tx.onabort = () => {
        db.close()
        reject(tx.error)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

function deleteIndexedDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    let blockedTimer: number | null = null
    let settled = false

    const cleanup = () => {
      if (blockedTimer !== null) window.clearTimeout(blockedTimer)
    }

    const resolveOnce = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    const rejectOnce = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    req.onsuccess = () => resolveOnce()
    req.onerror = () => rejectOnce(req.error ?? new Error(`无法删除 IndexedDB: ${name}`))
    req.onblocked = () => {
      blockedTimer = window.setTimeout(() => resolveOnce(), 500)
    }
  })
}

async function clearIndexedDBData() {
  const names = await indexedDBNames()
  await Promise.all(
    names.map(async (name) => {
      await clearIndexedDBStores(name).catch(() => undefined)
      await deleteIndexedDB(name).catch(() => undefined)
    }),
  )
}

async function clearCacheStorage() {
  if (!('caches' in window)) return
  const names = await caches.keys()
  await Promise.all(names.map((name) => caches.delete(name)))
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

function clearWritableCookies() {
  const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
  const paths = ['/', window.location.pathname]
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name) continue
    for (const path of paths) {
      document.cookie = `${name}=; ${expires}; path=${path}; SameSite=Lax`
    }
  }
}

export async function clearCurrentSiteData() {
  await Promise.allSettled([clearIndexedDBData(), clearCacheStorage(), unregisterServiceWorkers()])
  localStorage.clear()
  sessionStorage.clear()
  clearWritableCookies()
}

export async function getCurrentSiteDataUsage(): Promise<SiteDataUsage> {
  const [idb, cacheBytes, browserEstimate] = await Promise.all([
    indexedDBUsage().catch(() => ({ bytes: 0, databases: 0 })),
    cacheStorageBytes().catch(() => 0),
    browserStorageEstimate().catch(() => ({ usage: null, quota: null })),
  ])
  const sections: SiteDataUsageSection[] = [
    {
      id: 'indexedDB',
      label: 'IndexedDB',
      bytes: idb.bytes,
      detail: idb.databases > 0 ? `${idb.databases} 个数据库` : undefined,
    },
    {
      id: 'localStorage',
      label: 'localStorage',
      bytes: storageBytes(localStorage),
      detail: `${localStorage.length} 项`,
    },
    {
      id: 'sessionStorage',
      label: 'sessionStorage',
      bytes: storageBytes(sessionStorage),
      detail: `${sessionStorage.length} 项`,
    },
    { id: 'cacheStorage', label: 'Cache Storage', bytes: cacheBytes },
    { id: 'cookies', label: 'Cookie', bytes: cookieBytes() },
  ]

  return {
    totalBytes: sections.reduce((sum, section) => sum + section.bytes, 0),
    browserEstimateBytes: browserEstimate.usage,
    quotaBytes: browserEstimate.quota,
    sections,
  }
}
