import { base64ToBlob } from './blobUtils'
import { imageDownloadFileName } from './downloadFileName'
import { loadImageBlobs } from './history'
import type { PlaygroundImageMeta } from './types'
import { ensureBlobLoaded, getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'
import { translate } from '../i18n'

type DownloadImageOptions = {
  inlineData?: string
  src?: string
}

export type DownloadResult = 'downloaded' | 'shared' | 'skipped'

function imageExtension(image: PlaygroundImageMeta): 'png' | 'jpg' {
  return image.mimeType === 'image/png' ? 'png' : 'jpg'
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

async function shareImages(images: PlaygroundImageMeta[]): Promise<boolean> {
  if (!canUseNativeFileShare()) return false

  const files = images
    .map((img) => {
      const data = getBlobFromCache(img.id)
      if (!data) return null
      const ext = imageExtension(img)
      const mimeType = img.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg')
      return new File([base64ToBlob(data, mimeType)], imageDownloadFileName(img, ext), { type: mimeType })
    })
    .filter((file): file is File => file !== null)

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
  if (canUseNativeFileShare()) {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
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

  if (await shareImages(images)) return

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const img of images) {
    const data = getBlobFromCache(img.id)
    if (!data) continue
    const ext = imageExtension(img)
    zip.file(imageDownloadFileName(img, ext), data, { base64: true })
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  triggerBrowserDownload(url, fileName)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
