import JSZip from 'jszip'
import type { PlaygroundImageMeta } from './types'
import { loadImageBlobs } from './history'
import { imageDownloadFileName } from './downloadFileName'
import { ensureBlobLoaded, getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'

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

  const needLoad = images.filter((img) => !getBlobFromCache(img.id)).map((img) => img.id)
  if (needLoad.length > 0) {
    const blobs = await loadImageBlobs(needLoad)
    for (const [id, data] of blobs) putBlobInCache(id, data)
  }

  const zip = new JSZip()
  for (const img of images) {
    const data = getBlobFromCache(img.id)
    if (!data) continue
    const ext = img.mimeType === 'image/png' ? 'png' : 'jpg'
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
