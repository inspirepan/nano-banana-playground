import JSZip from 'jszip'

import { base64ToBlob } from './blobUtils'
import { imageDownloadFileName } from './downloadFileName'
import { loadImageBlobs } from './history'
import type { PlaygroundImageMeta } from './types'
import { ensureBlobLoaded, getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'

function imageExtension(image: PlaygroundImageMeta): 'png' | 'jpg' {
  return image.mimeType === 'image/png' ? 'png' : 'jpg'
}

async function ensureImagesInCache(images: PlaygroundImageMeta[]): Promise<void> {
  const needLoad = images.filter((img) => !getBlobFromCache(img.id)).map((img) => img.id)
  if (needLoad.length === 0) return

  const blobs = await loadImageBlobs(needLoad)
  for (const [id, data] of blobs) putBlobInCache(id, data)
}

async function shareImages(images: PlaygroundImageMeta[]): Promise<boolean> {
  if (!navigator.share) return false

  const files = images
    .map((img) => {
      const data = getBlobFromCache(img.id)
      if (!data) return null
      const ext = imageExtension(img)
      const mimeType = img.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg')
      return new File([base64ToBlob(data, mimeType)], imageDownloadFileName(img, ext), { type: mimeType })
    })
    .filter((file): file is File => file !== null)

  if (files.length === 0 || !navigator.canShare?.({ files })) return false

  try {
    await navigator.share({ files, title: 'Nano Banana 图片' })
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return true
    return false
  }
}

export async function downloadImagePng(image: PlaygroundImageMeta): Promise<void> {
  const src = await ensureBlobLoaded(image.id, image.mimeType)
  if (!src) return

  const fileName = imageDownloadFileName(image, 'png')
  try {
    const response = await fetch(src)
    const blob = await response.blob()
    const file = new File([blob], fileName, { type: blob.type || image.mimeType || 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName })
      return
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
  }

  const anchor = document.createElement('a')
  anchor.href = src
  anchor.download = fileName
  anchor.click()
}

export async function downloadImagesZip(images: PlaygroundImageMeta[], fileName: string): Promise<void> {
  if (images.length === 0) return

  await ensureImagesInCache(images)

  if (await shareImages(images)) return

  const zip = new JSZip()
  for (const img of images) {
    const data = getBlobFromCache(img.id)
    if (!data) continue
    const ext = imageExtension(img)
    zip.file(imageDownloadFileName(img, ext), data, { base64: true })
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
