import {
  createGenerationAbortSignal,
  GENERATE_MAX_RETRIES,
  GENERATE_RETRY_DELAYS,
  isRetryable,
  normalizeGenerationAbortError,
  REQUEST_TIMEOUT_MS,
  retryMessage,
} from './retry'
import type { GenerateCallbacks, GenerateParams } from './types'
import { base64ToBlob } from '../blobUtils'
import { openAISize } from '../openai'
import type { PlaygroundImage, TokenUsage } from '../types'
import { resolveBaseUrl } from '../validateKey'

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
    input_tokens_details?: { text_tokens?: number; image_tokens?: number }
    output_tokens_details?: { text_tokens?: number; image_tokens?: number }
  }
  error?: string | { message?: string; code?: string; status?: number }
  message?: string
}

async function readOpenAIImageResponse(res: Response): Promise<OpenAIImageResponse> {
  const text = await res.text()
  try {
    return JSON.parse(text) as OpenAIImageResponse
  } catch {
    const message = text.trim() || `HTTP ${res.status}`
    return { error: { message, status: res.status } }
  }
}

function openAIImageErrorMessage(data: OpenAIImageResponse, status: number): string | undefined {
  if (!data.error) return data.message
  if (typeof data.error === 'string') return data.message ?? data.error
  return data.error.message ?? data.error.code ?? data.message ?? `HTTP ${status}`
}

export async function generateImageOpenAI(
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
    agentSessionId,
    mask,
  } = params

  const size = openAISize(resolution, aspectRatio)
  const quality = typeof options.quality === 'string' ? options.quality : 'auto'

  const base = resolveBaseUrl('openai', baseUrl)
  const hasRefs = referenceImages.length > 0
  const url = hasRefs ? `${base}/images/edits` : `${base}/images/generations`

  let body: BodyInit
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  if (hasRefs) {
    const form = new FormData()
    form.append('model', model.apiModel)
    form.append('prompt', prompt)
    form.append('size', size)
    form.append('quality', quality)
    form.append('n', '1')
    for (const img of referenceImages) {
      const blob = base64ToBlob(img.data, img.mimeType || 'image/png')
      const ext = (img.mimeType || 'image/png').split('/')[1] || 'png'
      form.append('image[]', blob, `ref.${ext}`)
    }
    if (mask) {
      // images.edits requires the mask to match the reference image dimensions.
      const maskBlob = base64ToBlob(mask.data, mask.mimeType || 'image/png')
      form.append('mask', maskBlob, 'mask.png')
    }
    body = form
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({ model: model.apiModel, prompt, size, quality, n: 1 })
  }

  const requestInit: RequestInit = { method: 'POST', headers, body }
  let lastError: unknown
  for (let attempt = 0; attempt <= GENERATE_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = GENERATE_RETRY_DELAYS[attempt - 1]
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay)
      })
      if (signal?.aborted) throw signal.reason
    }

    const generationSignal = createGenerationAbortSignal(signal, REQUEST_TIMEOUT_MS)
    let res: Response
    let data: OpenAIImageResponse
    try {
      res = await fetch(url, { ...requestInit, signal: generationSignal.signal })

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

      data = await readOpenAIImageResponse(res)
    } catch (e) {
      const error = normalizeGenerationAbortError(e, generationSignal.signal)
      lastError = error
      if (isRetryable(error) && attempt < GENERATE_MAX_RETRIES) {
        callbacks?.onRetry?.({
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          delayMs: GENERATE_RETRY_DELAYS[attempt],
          error: retryMessage(error),
        })
        continue
      }
      throw error
    } finally {
      generationSignal.cleanup()
    }

    if (!res.ok || data.error) throw new Error(openAIImageErrorMessage(data, res.status) ?? `HTTP ${res.status}`)

    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('No image in response')

    const outputImageTokens = data.usage?.output_tokens_details?.image_tokens ?? data.usage?.output_tokens ?? 0
    const outputTextTokens =
      data.usage?.output_tokens_details?.text_tokens ??
      Math.max((data.usage?.output_tokens ?? 0) - outputImageTokens, 0)
    const tokenUsage: TokenUsage | undefined = data.usage
      ? {
          inputTokens: data.usage.input_tokens ?? 0,
          inputTextTokens: data.usage.input_tokens_details?.text_tokens ?? 0,
          inputImageTokens: data.usage.input_tokens_details?.image_tokens ?? 0,
          imageOutputTokens: outputImageTokens,
          textOutputTokens: outputTextTokens,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined

    return {
      id: outputImageId ?? crypto.randomUUID(),
      data: b64,
      mimeType: 'image/png',
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
        ...(agentSessionId ? { agentSessionId } : {}),
        tokenUsage,
        options: { ...options },
        usesMask: Boolean(mask),
      },
      timestamp: Date.now(),
    }
  }

  throw lastError
}
