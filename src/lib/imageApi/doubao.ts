import { GENERATE_MAX_RETRIES, GENERATE_RETRY_DELAYS, isRetryable, REQUEST_TIMEOUT_MS, retryMessage } from './retry'
import type { GenerateCallbacks, GenerateParams } from './types'
import type { PlaygroundImage, TokenUsage } from '../types'
import { resolveBaseUrl } from '../validateKey'

type DoubaoResponse = {
  data?: Array<{
    b64_json?: string
    url?: string
    size?: string
    error?: { message?: string; code?: string }
  }>
  usage?: {
    output_tokens?: number
    total_tokens?: number
    generated_images?: number
  }
  error?: { message?: string; code?: string }
}

const DOUBAO_TARGET_PIXELS: Record<string, number> = {
  '2K': 2048 * 2048,
  '3K': 3072 * 3072,
  '4K': 4096 * 4096,
}

function parseAspectRatio(aspectRatio: string): number {
  const match = /^(\d+):(\d+)$/.exec(aspectRatio)
  if (!match) return 1
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1
  return width / height
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.max(multiple, Math.round(value / multiple) * multiple)
}

function doubaoSize(resolution: string, aspectRatio: string): string {
  const targetPixels = DOUBAO_TARGET_PIXELS[resolution] ?? DOUBAO_TARGET_PIXELS['2K']
  const ratio = parseAspectRatio(aspectRatio)
  const width = roundToMultiple(Math.sqrt(targetPixels * ratio), 16)
  const height = roundToMultiple(width / ratio, 16)
  return `${width}x${height}`
}

function imageDataUrl(image: PlaygroundImage): string {
  return `data:${image.mimeType || 'image/png'};base64,${image.data}`
}

function normalizeBase64(value: string): string {
  const marker = ';base64,'
  const index = value.indexOf(marker)
  return index === -1 ? value : value.slice(index + marker.length)
}

export async function generateImageDoubao(
  params: GenerateParams,
  signal?: AbortSignal,
  callbacks?: GenerateCallbacks,
): Promise<PlaygroundImage> {
  const {
    apiKey,
    baseUrl,
    model,
    prompt,
    referenceImages,
    resolution,
    aspectRatio,
    options,
    batchId,
    batchCreatedAt,
    stackId,
    stackTitle,
    parentImageId,
    slotIndex,
    outputImageId,
    outputImageIdSource,
  } = params

  const body: Record<string, unknown> = {
    model: model.apiModel,
    prompt,
    size: doubaoSize(resolution, aspectRatio),
    sequential_image_generation: 'disabled',
    stream: false,
    response_format: 'b64_json',
    watermark: false,
  }

  if (options.webSearch === true) {
    body.tools = [{ type: 'web_search' }]
  }

  if (referenceImages.length === 1) {
    body.image = imageDataUrl(referenceImages[0])
  } else if (referenceImages.length > 1) {
    body.image = referenceImages.map(imageDataUrl)
  }

  const url = `${resolveBaseUrl('doubao', baseUrl)}/images/generations`
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const requestInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= GENERATE_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = GENERATE_RETRY_DELAYS[attempt - 1]
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay)
      })
      if (signal?.aborted) throw signal.reason
    }

    let res: Response
    try {
      res = await fetch(url, requestInit)
    } catch (e) {
      lastError = e
      if (isRetryable(e) && attempt < GENERATE_MAX_RETRIES) {
        callbacks?.onRetry?.({
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          delayMs: GENERATE_RETRY_DELAYS[attempt],
          error: retryMessage(e),
        })
        continue
      }
      throw e
    }

    if (isRetryable(null, res.status) && attempt < GENERATE_MAX_RETRIES) {
      lastError = new Error(`Server error ${res.status}`)
      callbacks?.onRetry?.({
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        delayMs: GENERATE_RETRY_DELAYS[attempt],
        error: retryMessage(lastError),
      })
      continue
    }

    const data = (await res.json()) as DoubaoResponse
    const itemError = data.data?.find((item) => item.error)?.error
    if (!res.ok || data.error || itemError) {
      throw new Error(data.error?.message ?? itemError?.message ?? `HTTP ${res.status}`)
    }

    const b64 = data.data?.find((item) => item.b64_json)?.b64_json
    if (!b64) throw new Error('No image in response')

    const outputTokens = data.usage?.output_tokens ?? data.usage?.total_tokens ?? 0
    const tokenUsage: TokenUsage | undefined = data.usage
      ? {
          inputTokens: 0,
          imageOutputTokens: outputTokens,
          textOutputTokens: 0,
          totalTokens: data.usage.total_tokens ?? outputTokens,
        }
      : undefined

    return {
      id: outputImageId ?? crypto.randomUUID(),
      data: normalizeBase64(b64),
      mimeType: 'image/jpeg',
      source: {
        type: 'generated',
        modelId: model.id,
        prompt,
        resolution,
        aspectRatio,
        referenceImageIds: referenceImages.map((r) => r.id),
        batchId,
        batchCreatedAt,
        stackId,
        ...(stackTitle ? { stackTitle } : {}),
        ...(parentImageId ? { parentImageId } : {}),
        ...(slotIndex !== undefined ? { slotIndex } : {}),
        ...(outputImageIdSource ? { imageIdSource: outputImageIdSource } : {}),
        tokenUsage,
        options: { ...options },
      },
      timestamp: Date.now(),
    }
  }

  throw lastError
}
