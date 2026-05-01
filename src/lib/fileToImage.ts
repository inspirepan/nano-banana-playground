import { translate } from '../i18n'

type ImageDataResult = { base64: string; mimeType: string; fileName: string }

const HEIF_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/x-heic',
  'image/x-heif',
])

const HEIF_EXT_RE = /\.(heic|heif|heics|heifs)$/i

const MIME_BY_EXT: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function isHeifFile(file: File): boolean {
  const mimeType = file.type.toLowerCase()
  return HEIF_MIME_TYPES.has(mimeType) || HEIF_EXT_RE.test(file.name)
}

function inferMimeType(file: File): string {
  if (file.type) return file.type
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

async function convertWithCanvas(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(translate('configLib.fileToImage.canvasContextFailed'))
    ctx.drawImage(bitmap, 0, 0)
    return await canvasToPngBlob(canvas, file.name)
  } finally {
    bitmap.close()
  }
}

async function convertHeifToPng(file: File): Promise<Blob> {
  try {
    return await convertWithCanvas(file)
  } catch {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/png' })
    const blob = Array.isArray(converted) ? converted[0] : converted
    if (!blob) throw new Error(translate('configLib.fileToImage.convertFailed', { fileName: file.name }))
    return blob
  }
}

// Convert a File to base64 + normalized mime. HEIC/HEIF is transcoded to PNG
// because image generation APIs do not consistently accept it.
export async function readFileAsImageData(file: File): Promise<ImageDataResult | null> {
  if (!isHeifFile(file)) {
    return {
      base64: await readBlobAsBase64(file),
      mimeType: inferMimeType(file),
      fileName: file.name,
    }
  }

  try {
    const png = await convertHeifToPng(file)
    return {
      base64: await readBlobAsBase64(png),
      mimeType: 'image/png',
      fileName: pngFileName(file.name),
    }
  } catch {
    throw new Error(translate('configLib.fileToImage.heifConvertFailed', { fileName: file.name }))
  }
}
