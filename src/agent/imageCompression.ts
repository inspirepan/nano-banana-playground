import { translate } from '../i18n'
import { base64ToBlob } from '../lib/blobUtils'

export type AgentImageInput = {
  data: string
  mimeType: string
}

export type AgentImagePayload = AgentImageInput & {
  size: number
}

const AGENT_IMAGE_MAX_DIMENSION = 2560
const AGENT_IMAGE_MAX_BYTES = 3_000_000
const AGENT_IMAGE_MAX_BASE64_BYTES = Math.floor(3.5 * 1024 * 1024)
const AGENT_IMAGE_TARGET_BYTES = Math.min(AGENT_IMAGE_MAX_BYTES, Math.floor(AGENT_IMAGE_MAX_BASE64_BYTES / 4) * 3)
const JPEG_QUALITIES = [0.8, 0.65, 0.5, 0.35, 0.25] as const

const GENERATION_REFERENCE_MAX_DIMENSION = 4096
const GENERATION_REFERENCE_MAX_BYTES = 8_000_000
const GENERATION_REFERENCE_MAX_BASE64_BYTES = 10 * 1024 * 1024
const GENERATION_REFERENCE_TARGET_BYTES = Math.min(
  GENERATION_REFERENCE_MAX_BYTES,
  Math.floor(GENERATION_REFERENCE_MAX_BASE64_BYTES / 4) * 3,
)
const GENERATION_REFERENCE_JPEG_QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.6] as const
const GENERATION_REFERENCE_WEBP_QUALITIES = [0.92, 0.85, 0.78, 0.7] as const

type CompressionProfile = {
  maxDimension: number
  targetBytes: number
  maxBase64Bytes: number
  jpegQualities: readonly number[]
  webpQualities?: readonly number[]
}

const AGENT_INPUT_PROFILE: CompressionProfile = {
  maxDimension: AGENT_IMAGE_MAX_DIMENSION,
  targetBytes: AGENT_IMAGE_TARGET_BYTES,
  maxBase64Bytes: AGENT_IMAGE_MAX_BASE64_BYTES,
  jpegQualities: JPEG_QUALITIES,
}

const GENERATION_REFERENCE_PROFILE: CompressionProfile = {
  maxDimension: GENERATION_REFERENCE_MAX_DIMENSION,
  targetBytes: GENERATION_REFERENCE_TARGET_BYTES,
  maxBase64Bytes: GENERATION_REFERENCE_MAX_BASE64_BYTES,
  jpegQualities: GENERATION_REFERENCE_JPEG_QUALITIES,
  webpQualities: GENERATION_REFERENCE_WEBP_QUALITIES,
}

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

function imageWithinLimits(data: string, size: number, profile: CompressionProfile): boolean {
  return size <= profile.targetBytes && cleanBase64(data).length <= profile.maxBase64Bytes
}

function targetDimensions(
  width: number,
  height: number,
  size: number,
  profile: CompressionProfile,
): { width: number; height: number } {
  const dimScale = Math.min(1, profile.maxDimension / Math.max(width, height))
  const byteScale = size > profile.targetBytes ? Math.sqrt(profile.targetBytes / size) * 0.9 : 1
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
  profile: CompressionProfile,
): Promise<{ firstWithinLimit: AgentImagePayload | null; smallest: AgentImagePayload | null }> {
  let smallest: AgentImagePayload | null = null
  for (const quality of profile.jpegQualities) {
    const candidate = await encodeCanvas(canvas, 'image/jpeg', quality)
    smallest = preferSmaller(smallest, candidate)
    if (candidate && imageWithinLimits(candidate.data, candidate.size, profile)) {
      return { firstWithinLimit: candidate, smallest }
    }
  }
  return { firstWithinLimit: null, smallest }
}

async function encodeWebpFallbacks(
  canvas: HTMLCanvasElement,
  profile: CompressionProfile,
): Promise<{ firstWithinLimit: AgentImagePayload | null; smallest: AgentImagePayload | null }> {
  let smallest: AgentImagePayload | null = null
  for (const quality of profile.webpQualities ?? []) {
    const candidate = await encodeCanvas(canvas, 'image/webp', quality)
    smallest = preferSmaller(smallest, candidate)
    if (candidate && imageWithinLimits(candidate.data, candidate.size, profile)) {
      return { firstWithinLimit: candidate, smallest }
    }
  }
  return { firstWithinLimit: null, smallest }
}

async function compressDecodedImage(
  bitmap: ImageBitmap,
  sourceSize: number,
  sourceMimeType: string,
  profile: CompressionProfile,
): Promise<AgentImagePayload | null> {
  let { width, height } = targetDimensions(bitmap.width, bitmap.height, sourceSize, profile)
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
      if (original && imageWithinLimits(original.data, original.size, profile)) return original
    }

    const webp = await encodeWebpFallbacks(transparentCanvas, profile)
    smallest = preferSmaller(smallest, webp.smallest)
    if (webp.firstWithinLimit) {
      return webp.firstWithinLimit
    }

    const jpegCanvas = drawImageBitmap(bitmap, width, height, true)
    const jpeg = await encodeJpegFallbacks(jpegCanvas, profile)
    smallest = preferSmaller(smallest, jpeg.smallest)
    if (jpeg.firstWithinLimit) return jpeg.firstWithinLimit

    width = Math.max(1, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * 0.8))
  }

  return smallest
}

async function compressImage(image: AgentImageInput, profile: CompressionProfile): Promise<AgentImagePayload> {
  const sourceMimeType = normalizeMimeType(image.mimeType)
  const sourceData = cleanBase64(image.data)
  const sourceSize = base64ByteLength(sourceData)
  const passthrough = { data: sourceData, mimeType: sourceMimeType || image.mimeType, size: sourceSize }

  if (!COMPRESSIBLE_MIME_TYPES.has(sourceMimeType)) return passthrough

  try {
    const blob = base64ToBlob(sourceData, sourceMimeType)
    const bitmap = await createImageBitmap(blob)
    try {
      const withinLimits = imageWithinLimits(sourceData, blob.size, profile)
      const withinDimensions = Math.max(bitmap.width, bitmap.height) <= profile.maxDimension
      if (withinLimits && withinDimensions) return { ...passthrough, size: blob.size }

      const compressed = await compressDecodedImage(bitmap, blob.size, sourceMimeType, profile)
      if (!compressed) return { ...passthrough, size: blob.size }
      if (!withinDimensions && imageWithinLimits(compressed.data, compressed.size, profile)) return compressed
      if (compressed.size >= blob.size) return { ...passthrough, size: blob.size }
      return compressed
    } finally {
      bitmap.close()
    }
  } catch {
    return passthrough
  }
}

export async function compressImageForAgentInput(image: AgentImageInput): Promise<AgentImagePayload> {
  return compressImage(image, AGENT_INPUT_PROFILE)
}

export async function compressImageForGenerationReference(image: AgentImageInput): Promise<AgentImagePayload> {
  return compressImage(image, GENERATION_REFERENCE_PROFILE)
}
