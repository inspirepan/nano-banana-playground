import { useEffect, useRef, useState } from 'react'
import { loadImageBlob } from '../lib/history'

// Module-level blob cache: id -> base64
const blobCache = new Map<string, string>()

export function putBlobInCache(id: string, data: string) {
  blobCache.set(id, data)
}

export function getBlobFromCache(id: string): string | undefined {
  return blobCache.get(id)
}

export function removeBlobFromCache(id: string) {
  blobCache.delete(id)
}

export function clearBlobCache() {
  blobCache.clear()
}

function toDataUrl(mimeType: string, data: string): string {
  return `data:${mimeType};base64,${data}`
}

/**
 * Lazily loads image blob data via IntersectionObserver.
 * If `inlineData` is provided (e.g. freshly generated images), uses it immediately.
 * Otherwise loads from IndexedDB when the element enters the viewport.
 *
 * Returns { ref, src } — attach ref to the container element.
 */
export function useImageSrc(
  id: string,
  mimeType: string,
  inlineData?: string,
): { ref: React.RefObject<HTMLDivElement | null>; src: string | null } {
  // If inline data is provided, cache it
  if (inlineData) {
    blobCache.set(id, inlineData)
  }

  const [src, setSrc] = useState<string | null>(() => {
    const cached = inlineData ?? blobCache.get(id)
    return cached ? toDataUrl(mimeType, cached) : null
  })

  const ref = useRef<HTMLDivElement | null>(null)
  const loadedIdRef = useRef<string>(inlineData || blobCache.has(id) ? id : '')

  // When id changes (e.g. navigation in modal), update src from cache
  useEffect(() => {
    const cached = blobCache.get(id)
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSrc(toDataUrl(mimeType, cached))
      loadedIdRef.current = id
    } else if (loadedIdRef.current !== id) {
      setSrc(null)
      loadedIdRef.current = ''
    }
  }, [id, mimeType])

  // Lazy load via IntersectionObserver
  useEffect(() => {
    if (loadedIdRef.current === id) return // already loaded

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()

        loadImageBlob(id).then((data) => {
          if (data) {
            blobCache.set(id, data)
            setSrc(toDataUrl(mimeType, data))
            loadedIdRef.current = id
          }
        })
      },
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [id, mimeType])

  return { ref, src }
}

/**
 * Eagerly load a blob (e.g. for modal detail view).
 * Returns the data URL, or null if not found.
 */
export async function ensureBlobLoaded(id: string, mimeType: string): Promise<string | null> {
  const cached = blobCache.get(id)
  if (cached) return toDataUrl(mimeType, cached)

  const data = await loadImageBlob(id)
  if (data) {
    blobCache.set(id, data)
    return toDataUrl(mimeType, data)
  }
  return null
}
