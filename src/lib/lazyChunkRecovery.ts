const LAZY_RELOAD_STORAGE_KEY = 'nano-banana-playground:lazy-reload-attempted'

export function isLazyChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|failed to fetch|loading chunk|module script|mime type/i.test(message)
}

export function recoverFromLazyChunkLoadError(error: unknown, scope: string): never {
  if (isLazyChunkLoadError(error)) {
    try {
      const token = `${scope}:${import.meta.url}`
      if (window.sessionStorage.getItem(LAZY_RELOAD_STORAGE_KEY) !== token) {
        window.sessionStorage.setItem(LAZY_RELOAD_STORAGE_KEY, token)
        window.location.reload()
      }
    } catch {
      // Keep the original error path if sessionStorage is unavailable.
    }
  }
  throw error
}
