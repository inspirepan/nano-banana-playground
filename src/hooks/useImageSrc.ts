import { useRef, useState } from 'react'

import { useExternalSync } from './effects'
import { deleteImagePreview, loadImageBlob, loadImagePreview, saveImagePreview } from '../lib/history'

const PREVIEW_MAX_SIZE = 1024
const PREVIEW_EXPORT_MIME = 'image/jpeg'
const PREVIEW_JPEG_QUALITY = 0.86
const PREVIEW_SAMPLE_SIZE = 24

// Module-level caches: originals are base64; previews also carry their MIME.
const blobCache = new Map<string, string>()
const previewCache = new Map<string, PreviewData>()

type ImageSrcVariant = 'full' | 'preview'

type UseImageSrcOptions = {
  variant?: ImageSrcVariant
}

type PreviewData = {
  data: string
  mimeType: string
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

function toDataUrl(mimeType: string, data: string): string {
  return `data:${mimeType};base64,${data}`
}

function previewToDataUrl(preview: PreviewData): string {
  return toDataUrl(preview.mimeType, preview.data)
}

function cachedSrcFor(id: string, mimeType: string, variant: ImageSrcVariant, inlineData?: string): string | null {
  if (variant === 'preview') {
    const preview = previewCache.get(id)
    if (preview) return previewToDataUrl(preview)
  }

  const original = inlineData ?? blobCache.get(id)
  return original ? toDataUrl(mimeType, original) : null
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

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  if (isCanvasLikelyBrokenPreview(context, width, height)) return data

  const previewUrl = canvas.toDataURL(PREVIEW_EXPORT_MIME, PREVIEW_JPEG_QUALITY)
  return previewUrl.split(',')[1] ?? data
}

function isCanvasLikelyBrokenPreview(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return true

  const sampleWidth = Math.min(PREVIEW_SAMPLE_SIZE, width)
  const sampleHeight = Math.min(PREVIEW_SAMPLE_SIZE, height)
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight
  const sampleContext = sample.getContext('2d')
  if (!sampleContext) return false

  sampleContext.drawImage(context.canvas, 0, 0, width, height, 0, 0, sampleWidth, sampleHeight)
  const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data
  let opaqueCount = 0
  let luminanceSum = 0
  let luminanceSquaredSum = 0
  let maxLuminance = 0

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha < 8) continue
    opaqueCount++
    const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
    luminanceSum += luminance
    luminanceSquaredSum += luminance * luminance
    maxLuminance = Math.max(maxLuminance, luminance)
  }

  if (opaqueCount === 0) return true
  const average = luminanceSum / opaqueCount
  const variance = luminanceSquaredSum / opaqueCount - average * average

  return average < 3 && maxLuminance < 12 && variance < 6
}

async function isPreviewDataLikelyBroken(preview: PreviewData): Promise<boolean> {
  const image = await loadImageElement(previewToDataUrl(preview))
  const width = Math.max(1, image.naturalWidth)
  const height = Math.max(1, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(PREVIEW_SAMPLE_SIZE, width)
  canvas.height = Math.min(PREVIEW_SAMPLE_SIZE, height)
  const context = canvas.getContext('2d')
  if (!context) return false
  context.drawImage(image, 0, 0, width, height, 0, 0, canvas.width, canvas.height)
  return isCanvasLikelyBrokenPreview(context, canvas.width, canvas.height)
}

async function ensurePreviewLoaded(id: string, mimeType: string, inlineData?: string): Promise<PreviewData | null> {
  const cachedPreview = previewCache.get(id)
  if (cachedPreview) return cachedPreview

  const storedPreview = await loadImagePreview(id)
  if (storedPreview) {
    const preview = { data: storedPreview.data, mimeType: storedPreview.mimeType ?? mimeType }
    if (!(await isPreviewDataLikelyBroken(preview))) {
      previewCache.set(id, preview)
      return preview
    }
    await deleteImagePreview(id).catch(() => {})
  }

  const original = inlineData ?? blobCache.get(id) ?? (await loadImageBlob(id))
  if (!original) return null

  blobCache.set(id, original)
  const preview = await createPreviewData(original, mimeType)
  const next = preview === original ? { data: original, mimeType } : { data: preview, mimeType: PREVIEW_EXPORT_MIME }
  previewCache.set(id, next)

  if (preview !== original) {
    await saveImagePreview(id, preview, PREVIEW_EXPORT_MIME)
  }

  return next
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
    return cachedSrcFor(id, mimeType, variant, inlineData)
  })

  const ref = useRef<HTMLDivElement | null>(null)

  // Sync src from cache when inputs change (render-time state adjustment)
  const [prevInputs, setPrevInputs] = useState({ id, variant, mimeType, inlineData })
  if (
    prevInputs.id !== id ||
    prevInputs.variant !== variant ||
    prevInputs.mimeType !== mimeType ||
    prevInputs.inlineData !== inlineData
  ) {
    setPrevInputs({ id, variant, mimeType, inlineData })

    const cached = cachedSrcFor(id, mimeType, variant, inlineData)
    if (cached) {
      if (src !== cached) setSrc(cached)
    } else if (src !== null) {
      setSrc(null)
    }
  }

  useExternalSync(() => {
    // Skip if cache already has it (sync path handled it)
    const cached = variant === 'preview' ? previewCache.get(id) : (inlineData ?? blobCache.get(id))
    if (cached) return

    const element = ref.current
    if (!element) return

    let cancelled = false

    const load = async () => {
      const nextSrc =
        variant === 'preview'
          ? await ensurePreviewLoaded(id, mimeType, inlineData).then((preview) =>
              preview ? previewToDataUrl(preview) : null,
            )
          : await Promise.resolve(inlineData ?? blobCache.get(id) ?? (await loadImageBlob(id))).then((data) => {
              if (!data) return null
              blobCache.set(id, data)
              return toDataUrl(mimeType, data)
            })

      if (!nextSrc || cancelled) return
      setSrc(nextSrc)
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
