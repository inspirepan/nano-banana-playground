const LAZY_CHUNK_ERROR_REGEX = /dynamically imported module|failed to fetch|loading chunk|module script|mime type/i

export function isLazyChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return LAZY_CHUNK_ERROR_REGEX.test(message)
}
