import { base64ToBlob } from './blobUtils'
import { imageDownloadFileName } from './downloadFileName'
import { loadImageBlobs } from './history'
import type { PlaygroundImageMeta } from './types'
import { getStripDownloadMetadata } from '../config/downloadMetadata'
import { ensureBlobLoaded, getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'
import { translate } from '../i18n'

type DownloadImageOptions = {
  inlineData?: string
  src?: string
}

export type DownloadResult = 'downloaded' | 'shared' | 'skipped'

type ImageDownloadFormat = {
  extension: string
  mimeType: string
  reencodeMimeType?: 'image/png' | 'image/jpeg' | 'image/webp'
}

function imageDownloadFormat(image: PlaygroundImageMeta): ImageDownloadFormat {
  const mimeType = image.mimeType.trim().toLowerCase()
  if (mimeType === 'image/png') return { extension: 'png', mimeType: 'image/png', reencodeMimeType: 'image/png' }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return { extension: 'jpg', mimeType: 'image/jpeg', reencodeMimeType: 'image/jpeg' }
  }
  if (mimeType === 'image/webp') return { extension: 'webp', mimeType: 'image/webp', reencodeMimeType: 'image/webp' }
  if (mimeType === 'image/gif') return { extension: 'gif', mimeType: 'image/gif' }
  if (mimeType === 'image/avif') return { extension: 'avif', mimeType: 'image/avif' }
  return { extension: 'bin', mimeType: image.mimeType || 'application/octet-stream' }
}

async function ensureImagesInCache(images: PlaygroundImageMeta[]): Promise<void> {
  const needLoad = images.filter((img) => !getBlobFromCache(img.id)).map((img) => img.id)
  if (needLoad.length === 0) return

  const blobs = await loadImageBlobs(needLoad)
  for (const [id, data] of blobs) putBlobInCache(id, data)
}

function isMobileDevice(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  if (nav.userAgentData?.mobile) return true

  const userAgent = navigator.userAgent
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  )
}

function canUseNativeFileShare(): boolean {
  return isMobileDevice() && Boolean(navigator.share)
}

function triggerBrowserDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

async function blobFromSrc(src: string): Promise<Blob> {
  const response = await fetch(src)
  return response.blob()
}

async function reencodeImageBlob(blob: Blob, outputMimeType: 'image/png' | 'image/jpeg' | 'image/webp'): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas-context-unavailable')
    context.drawImage(bitmap, 0, 0)
    const quality = outputMimeType === 'image/jpeg' || outputMimeType === 'image/webp' ? 0.95 : undefined
    const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputMimeType, quality))
    if (!encoded) throw new Error('image-encode-failed')
    return encoded
  } finally {
    bitmap.close()
  }
}

async function strippedBlobFromBase64(
  data: string,
  sourceMimeType: string,
  outputMimeType: Exclude<ImageDownloadFormat['reencodeMimeType'], undefined>,
): Promise<Blob> {
  return reencodeImageBlob(base64ToBlob(data, sourceMimeType), outputMimeType)
}

async function shareFiles(files: File[], title: string): Promise<boolean> {
  if (!canUseNativeFileShare() || files.length === 0 || !navigator.canShare?.({ files })) return false

  try {
    await navigator.share({ files, title })
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return true
    return false
  }
}

async function shareImages(images: PlaygroundImageMeta[], stripMetadata: boolean): Promise<boolean> {
  if (!canUseNativeFileShare()) return false

  const files = (
    await Promise.all(
      images.map(async (img) => {
        const data = getBlobFromCache(img.id)
        if (!data) return null
        const format = imageDownloadFormat(img)
        const blob =
          stripMetadata && format.reencodeMimeType
            ? await strippedBlobFromBase64(data, format.mimeType, format.reencodeMimeType)
            : base64ToBlob(data, format.mimeType)
        return new File([blob], imageDownloadFileName(img, format.extension), { type: blob.type || format.mimeType })
      }),
    )
  ).filter((file): file is File => file !== null)

  return shareFiles(files, translate('configLib.exportImages.shareTitle'))
}

export async function downloadImagePng(
  image: PlaygroundImageMeta,
  options: DownloadImageOptions = {},
): Promise<DownloadResult> {
  const src =
    options.src ??
    (options.inlineData
      ? `data:${image.mimeType};base64,${options.inlineData}`
      : await ensureBlobLoaded(image.id, image.mimeType))
  if (!src) return 'skipped'

  const fileName = imageDownloadFileName(image, 'png')
  const stripMetadata = getStripDownloadMetadata()
  if (stripMetadata) {
    const blob = await reencodeImageBlob(await blobFromSrc(src), 'image/png')
    const file = new File([blob], fileName, { type: blob.type || 'image/png' })
    if (await shareFiles([file], fileName)) return 'shared'
    const url = URL.createObjectURL(blob)
    triggerBrowserDownload(url, fileName)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    return 'downloaded'
  }

  if (canUseNativeFileShare()) {
    try {
      const blob = await blobFromSrc(src)
      const file = new File([blob], fileName, { type: blob.type || image.mimeType || 'image/png' })
      if (await shareFiles([file], fileName)) return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared'
    }
  }

  triggerBrowserDownload(src, fileName)
  return 'downloaded'
}

export async function downloadImagesZip(images: PlaygroundImageMeta[], fileName: string): Promise<void> {
  if (images.length === 0) return

  await ensureImagesInCache(images)

  const stripMetadata = getStripDownloadMetadata()
  if (await shareImages(images, stripMetadata)) return

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const img of images) {
    const data = getBlobFromCache(img.id)
    if (!data) continue
    const format = imageDownloadFormat(img)
    if (stripMetadata && format.reencodeMimeType) {
      const blob = await strippedBlobFromBase64(data, format.mimeType, format.reencodeMimeType)
      zip.file(imageDownloadFileName(img, format.extension), blob)
    } else {
      zip.file(imageDownloadFileName(img, format.extension), data, { base64: true })
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  triggerBrowserDownload(url, fileName)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
