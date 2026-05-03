import type { PlaygroundImageMeta } from './types'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDownloadTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(
    date.getMinutes(),
  )}${pad2(date.getSeconds())}`
}

function fileNameSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function modelSlug(image: PlaygroundImageMeta): string {
  const source = image.source
  if (source.type !== 'generated') return 'upload'

  return fileNameSlug(source.modelId) || 'image'
}

export function imageDownloadFileName(image: PlaygroundImageMeta, extension: string): string {
  return `${formatDownloadTimestamp(image.timestamp)}-${modelSlug(image)}-${image.id.slice(0, 8)}.${extension}`
}
