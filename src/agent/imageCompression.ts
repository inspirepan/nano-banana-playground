import { translate } from '../i18n'
import { base64ToBlob } from '../lib/blobUtils'

export type AgentImageInput = {
  data: string
  mimeType: string
}

export type AgentImagePayload = AgentImageInput & {
  size: number
}

const AGENT_IMAGE_MAX_DIMENSION = 3072
const AGENT_IMAGE_MAX_BYTES = 4_500_000
const AGENT_IMAGE_MAX_BASE64_BYTES = 5 * 1024 * 1024
const AGENT_IMAGE_TARGET_BYTES = Math.min(AGENT_IMAGE_MAX_BYTES, Math.floor(AGENT_IMAGE_MAX_BASE64_BYTES / 4) * 3)
const JPEG_QUALITIES = [0.85, 0.7, 0.55, 0.4, 0.25] as const

const COMPRESSIBLE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif'])

function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

function cleanBase64(data: string): string {
  return data.replace(/\s+/g, '')
}

function base64ByteLength(data: string): number {
  const base64 = cleanBase64(data)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

function imageWithinAgentLimits(data: string, size: number): boolean {
  return size <= AGENT_IMAGE_TARGET_BYTES && cleanBase64(data).length <= AGENT_IMAGE_MAX_BASE64_BYTES
}

function targetDimensions(width: number, height: number, size: number): { width: number; height: number } {
  const dimScale = Math.min(1, AGENT_IMAGE_MAX_DIMENSION / Math.max(width, height))
  const byteScale = size > AGENT_IMAGE_TARGET_BYTES ? Math.sqrt(AGENT_IMAGE_TARGET_BYTES / size) * 0.9 : 1
  const scale = Math.min(dimScale, byteScale, 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function drawImageBitmap(bitmap: ImageBitmap, width: number, height: number, flatten: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(translate('configLib.agent.imageCompressionCanvasFailed'))
  if (flatten) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<AgentImagePayload | null> {
  const blob = await canvasToBlob(canvas, mimeType, quality)
  if (!blob) return null
  return {
    data: await blobToBase64(blob),
    mimeType: normalizeMimeType(blob.type || mimeType),
    size: blob.size,
  }
}

function preferSmaller(left: AgentImagePayload | null, right: AgentImagePayload | null): AgentImagePayload | null {
  if (!left) return right
  if (!right) return left
  return right.size < left.size ? right : left
}

async function encodeJpegFallbacks(
  canvas: HTMLCanvasElement,
): Promise<{ firstWithinLimit: AgentImagePayload | null; smallest: AgentImagePayload | null }> {
  let smallest: AgentImagePayload | null = null
  for (const quality of JPEG_QUALITIES) {
    const candidate = await encodeCanvas(canvas, 'image/jpeg', quality)
    smallest = preferSmaller(smallest, candidate)
    if (candidate && imageWithinAgentLimits(candidate.data, candidate.size)) {
      return { firstWithinLimit: candidate, smallest }
    }
  }
  return { firstWithinLimit: null, smallest }
}

async function compressDecodedImage(
  bitmap: ImageBitmap,
  sourceSize: number,
  sourceMimeType: string,
): Promise<AgentImagePayload | null> {
  let { width, height } = targetDimensions(bitmap.width, bitmap.height, sourceSize)
  let smallest: AgentImagePayload | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const transparentCanvas = drawImageBitmap(bitmap, width, height, false)
    const originalType = sourceMimeType === 'image/png' || sourceMimeType === 'image/webp' ? sourceMimeType : null
    if (originalType) {
      const original = await encodeCanvas(
        transparentCanvas,
        originalType,
        originalType === 'image/webp' ? 0.85 : undefined,
      )
      smallest = preferSmaller(smallest, original)
      if (original && imageWithinAgentLimits(original.data, original.size)) return original
    }

    const jpegCanvas = drawImageBitmap(bitmap, width, height, true)
    const jpeg = await encodeJpegFallbacks(jpegCanvas)
    smallest = preferSmaller(smallest, jpeg.smallest)
    if (jpeg.firstWithinLimit) return jpeg.firstWithinLimit

    width = Math.max(1, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * 0.8))
  }

  return smallest
}

export async function compressImageForAgentInput(image: AgentImageInput): Promise<AgentImagePayload> {
  const sourceMimeType = normalizeMimeType(image.mimeType)
  const sourceData = cleanBase64(image.data)
  const sourceSize = base64ByteLength(sourceData)
  const passthrough = { data: sourceData, mimeType: sourceMimeType || image.mimeType, size: sourceSize }

  if (!COMPRESSIBLE_MIME_TYPES.has(sourceMimeType)) return passthrough

  try {
    const blob = base64ToBlob(sourceData, sourceMimeType)
    const bitmap = await createImageBitmap(blob)
    try {
      const withinLimits = imageWithinAgentLimits(sourceData, blob.size)
      const withinDimensions = Math.max(bitmap.width, bitmap.height) <= AGENT_IMAGE_MAX_DIMENSION
      if (withinLimits && withinDimensions) return { ...passthrough, size: blob.size }

      const compressed = await compressDecodedImage(bitmap, blob.size, sourceMimeType)
      if (!compressed) return { ...passthrough, size: blob.size }
      if (!withinDimensions && imageWithinAgentLimits(compressed.data, compressed.size)) return compressed
      if (compressed.size >= blob.size) return { ...passthrough, size: blob.size }
      return compressed
    } finally {
      bitmap.close()
    }
  } catch {
    return passthrough
  }
}
