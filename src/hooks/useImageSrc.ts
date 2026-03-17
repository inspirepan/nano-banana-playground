import { useEffect, useRef, useState } from 'react'
import { loadImageBlob, loadImagePreview, saveImagePreview } from '../lib/history'

const PREVIEW_MAX_SIZE = 1024

// Module-level caches: id -> base64
const blobCache = new Map<string, string>()
const previewCache = new Map<string, string>()

type ImageSrcVariant = 'full' | 'preview'

type UseImageSrcOptions = {
  variant?: ImageSrcVariant
}

export function putBlobInCache(id: string, data: string) {
  blobCache.set(id, data)
}

export function getBlobFromCache(id: string): string | undefined {
  return blobCache.get(id)
}

export function removeBlobFromCache(id: string) {
  blobCache.delete(id)
  previewCache.delete(id)
}

export function clearBlobCache() {
  blobCache.clear()
  previewCache.clear()
}

function toDataUrl(mimeType: string, data: string): string {
  return `data:${mimeType};base64,${data}`
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to decode image'))
    image.src = src
  })
}

async function createPreviewData(data: string, mimeType: string): Promise<string> {
  const image = await loadImageElement(toDataUrl(mimeType, data))
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight)
  if (maxSide <= PREVIEW_MAX_SIZE) return data

  const scale = PREVIEW_MAX_SIZE / maxSide
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return data

  context.drawImage(image, 0, 0, width, height)
  const previewUrl = canvas.toDataURL(mimeType)
  return previewUrl.split(',')[1] ?? data
}

async function ensurePreviewLoaded(id: string, mimeType: string, inlineData?: string): Promise<string | null> {
  const cachedPreview = previewCache.get(id)
  if (cachedPreview) return cachedPreview

  const storedPreview = await loadImagePreview(id)
  if (storedPreview) {
    previewCache.set(id, storedPreview)
    return storedPreview
  }

  const original = inlineData ?? blobCache.get(id) ?? await loadImageBlob(id)
  if (!original) return null

  blobCache.set(id, original)
  const preview = await createPreviewData(original, mimeType)
  previewCache.set(id, preview)

  if (preview !== original) {
    await saveImagePreview(id, preview)
  }

  return preview
}

/**
 * Lazily loads either the original image or a 512px preview via IntersectionObserver.
 * Returns { ref, src } — attach ref to the container element.
 */
export function useImageSrc(
  id: string,
  mimeType: string,
  inlineData?: string,
  options?: UseImageSrcOptions,
): { ref: React.RefObject<HTMLDivElement | null>; src: string | null } {
  const variant = options?.variant ?? 'full'

  if (inlineData) {
    blobCache.set(id, inlineData)
  }

  const [src, setSrc] = useState<string | null>(() => {
    const cached = variant === 'preview'
      ? previewCache.get(id)
      : (inlineData ?? blobCache.get(id))
    return cached ? toDataUrl(mimeType, cached) : null
  })

  const ref = useRef<HTMLDivElement | null>(null)
  const loadedIdRef = useRef('')

  useEffect(() => {
    loadedIdRef.current = ''
  }, [variant])

  useEffect(() => {
    const cached = variant === 'preview'
      ? previewCache.get(id)
      : (inlineData ?? blobCache.get(id))
    if (cached) {
      setSrc(toDataUrl(mimeType, cached))
      loadedIdRef.current = id
      return
    }

    if (loadedIdRef.current !== id) {
      setSrc(null)
      loadedIdRef.current = ''
    }
  }, [id, inlineData, mimeType, variant])

  useEffect(() => {
    if (loadedIdRef.current === id) return

    const element = ref.current
    if (!element) return

    let cancelled = false

    const load = async () => {
      const data = variant === 'preview'
        ? await ensurePreviewLoaded(id, mimeType, inlineData)
        : inlineData ?? blobCache.get(id) ?? await loadImageBlob(id)

      if (!data || cancelled) return

      if (variant === 'full') {
        blobCache.set(id, data)
      }

      setSrc(toDataUrl(mimeType, data))
      loadedIdRef.current = id
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        void load()
      },
      { rootMargin: '200px' },
    )

    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [id, inlineData, mimeType, variant])

  return { ref, src }
}

/**
 * Eagerly load a full blob (e.g. for modal detail view).
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