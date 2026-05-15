import { translate } from '../i18n'
import { base64ToBlob } from './blobUtils'

export type ImageDataResult = { base64: string; mimeType: string; fileName: string }

const HEIF_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/x-heic',
  'image/x-heif',
])

const HEIF_EXT_RE = /\.(heic|heif|heics|heifs)$/i

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

const MIME_BY_EXT: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function normalizeImageMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

export function isHeifImageSource(mimeType: string, fileName?: string): boolean {
  return HEIF_MIME_TYPES.has(normalizeImageMimeType(mimeType)) || (fileName ? HEIF_EXT_RE.test(fileName) : false)
}

export function isHeifFile(file: File): boolean {
  return isHeifImageSource(file.type, file.name)
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end))
}

function bytesLookLikeHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== 'ftyp') return false
  if (HEIF_BRANDS.has(ascii(bytes, 8, 12))) return true
  for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
    if (HEIF_BRANDS.has(ascii(bytes, offset, offset + 4))) return true
  }
  return false
}

function base64LooksLikeHeif(data: string): boolean {
  try {
    const binary = globalThis.atob(data.replace(/\s+/g, '').slice(0, 96))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return bytesLookLikeHeif(bytes)
  } catch {
    return false
  }
}

async function blobLooksLikeHeif(blob: Blob): Promise<boolean> {
  try {
    return bytesLookLikeHeif(new Uint8Array(await blob.slice(0, 64).arrayBuffer()))
  } catch {
    return false
  }
}

function inferMimeType(file: File): string {
  if (file.type) return normalizeImageMimeType(file.type)
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? (MIME_BY_EXT[ext] ?? '') : ''
}

function pngFileName(fileName: string): string {
  return HEIF_EXT_RE.test(fileName) ? fileName.replace(HEIF_EXT_RE, '.png') : `${fileName}.png`
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function canvasToPngBlob(canvas: HTMLCanvasElement, fileName: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(translate('configLib.fileToImage.canvasToBlobFailed', { fileName })))
    }, 'image/png')
  })
}

async function convertWithCanvas(blob: Blob, fileName: string): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(translate('configLib.fileToImage.canvasContextFailed'))
    ctx.drawImage(bitmap, 0, 0)
    return await canvasToPngBlob(canvas, fileName)
  } finally {
    bitmap.close()
  }
}

async function convertHeifToPng(blob: Blob, fileName: string): Promise<Blob> {
  try {
    return await convertWithCanvas(blob, fileName)
  } catch {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob, toType: 'image/png' })
    const output = Array.isArray(converted) ? converted[0] : converted
    if (!output) throw new Error(translate('configLib.fileToImage.convertFailed', { fileName }))
    return output
  }
}

export async function convertImageDataToPng({
  base64,
  mimeType,
  fileName = 'image',
}: ImageDataResult): Promise<ImageDataResult> {
  const normalizedMimeType = normalizeImageMimeType(mimeType) || 'application/octet-stream'
  const sourceIsHeif = isHeifImageSource(normalizedMimeType, fileName) || base64LooksLikeHeif(base64)
  const blob = base64ToBlob(base64, normalizedMimeType)
  try {
    const png = sourceIsHeif ? await convertHeifToPng(blob, fileName) : await convertWithCanvas(blob, fileName)
    return {
      base64: await readBlobAsBase64(png),
      mimeType: 'image/png',
      fileName: pngFileName(fileName),
    }
  } catch {
    const key = sourceIsHeif ? 'configLib.fileToImage.heifConvertFailed' : 'configLib.fileToImage.convertFailed'
    throw new Error(translate(key, { fileName }))
  }
}

// Convert a File to base64 + normalized mime. HEIC/HEIF is transcoded to PNG
// because image generation APIs do not consistently accept it.
export async function readFileAsImageData(file: File): Promise<ImageDataResult | null> {
  const sourceIsHeif = isHeifFile(file) || (await blobLooksLikeHeif(file))
  if (!sourceIsHeif) {
    return {
      base64: await readBlobAsBase64(file),
      mimeType: inferMimeType(file),
      fileName: file.name,
    }
  }

  try {
    const png = await convertHeifToPng(file, file.name)
    return {
      base64: await readBlobAsBase64(png),
      mimeType: 'image/png',
      fileName: pngFileName(file.name),
    }
  } catch {
    throw new Error(translate('configLib.fileToImage.heifConvertFailed', { fileName: file.name }))
  }
}
