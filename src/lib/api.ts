import type { ModelConfig } from '../config/models'
import type { GroundingMetadata, PlaygroundImage, TokenUsage } from './types'
import { openAISize } from './openai'
import { resolveBaseUrl } from './validateKey'

export type GenerateParams = {
  apiKey: string
  baseUrl?: string
  model: ModelConfig
  prompt: string
  referenceImages: PlaygroundImage[]
  resolution: string
  aspectRatio: string
  // Provider/model-specific generation parameters, keyed by option id.
  options: Record<string, unknown>
  batchId: string
}

type ApiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }

type ApiResponse = {
  candidates?: Array<{
    content: {
      parts?: Array<{
        text?: string
        inlineData?: { mimeType: string; data: string }
        inline_data?: { mime_type: string; data: string }
      }>
    }
    finishReason?: string
    groundingMetadata?: {
      searchEntryPoint?: { renderedContent?: string }
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string }
        image?: { imageUri?: string; uri?: string; title?: string }
      }>
      webSearchQueries?: string[]
      imageSearchQueries?: string[]
    }
  }>
  error?: { message: string; code: number }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
    candidatesTokensDetails?: Array<{ modality: string; tokenCount: number }>
  }
}

export const REQUEST_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

const GENERATE_MAX_RETRIES = 2
const GENERATE_RETRY_DELAYS = [1000, 3000]

export async function generateImage(
  params: GenerateParams,
  signal?: AbortSignal,
): Promise<PlaygroundImage> {
  if (params.model.provider === 'openai') {
    return generateImageOpenAI(params, signal)
  }
  return generateImageGoogle(params, signal)
}

// Map a thinking level value (stored lowercase) to the wire form expected by
// the Gemini API. The Python SDK example uses "High" / "Minimal" casing.
function thinkingLevelWireValue(level: string): string {
  if (level === 'high') return 'High'
  return 'Minimal'
}

async function generateImageGoogle(
  params: GenerateParams,
  signal?: AbortSignal,
): Promise<PlaygroundImage> {
  const { apiKey, baseUrl, model, prompt, referenceImages, resolution, aspectRatio, batchId, options } = params

  const webSearch = options.webSearch === true
  const imageSearch = options.imageSearch === true
  const thinkingLevel = typeof options.thinkingLevel === 'string' ? options.thinkingLevel : ''

  const parts: ApiPart[] = [{ text: prompt }]
  for (const img of referenceImages) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.data,
      },
    })
  }

  const generationConfig: Record<string, unknown> = {
    responseModalities: ['IMAGE'],
    imageConfig: {
      aspectRatio,
      imageSize: resolution,
    },
  }
  if (thinkingLevel) {
    generationConfig.thinkingConfig = {
      thinkingLevel: thinkingLevelWireValue(thinkingLevel),
    }
  }

  const body: Record<string, unknown> = {
    system_instruction: {
      parts: [{ text: 'You are an image generation model. Always generate an image in response to every request. Never decline or refuse to generate an image.' }],
    },
    contents: [{ parts }],
    generationConfig,
  }

  if (webSearch || imageSearch) {
    const searchTypes: Record<string, object> = {}
    if (webSearch) searchTypes.webSearch = {}
    if (imageSearch) searchTypes.imageSearch = {}
    body.tools = [{ google_search: { searchTypes } }]
  }

  const url = `${resolveBaseUrl('google', baseUrl)}/v1beta/models/${model.apiModel}:generateContent`

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= GENERATE_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = GENERATE_RETRY_DELAYS[attempt - 1]
      await new Promise((r) => setTimeout(r, delay))
      if (signal?.aborted) throw signal.reason
    }

    let res: Response
    try {
      res = await fetch(url, requestInit)
    } catch (e) {
      lastError = e
      if (isRetryable(e) && attempt < GENERATE_MAX_RETRIES) continue
      throw e
    }

    if (isRetryable(null, res.status) && attempt < GENERATE_MAX_RETRIES) {
      lastError = new Error(`Server error ${res.status}`)
      continue
    }

    const data: ApiResponse = await res.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    if (!data.candidates?.length) {
      throw new Error('No response from model')
    }

    const candidate = data.candidates[0]

    // NO_IMAGE means model refused or failed to produce an image — retry
    if (candidate.finishReason === 'NO_IMAGE') {
      lastError = new Error('Model did not generate an image (NO_IMAGE)')
      if (attempt < GENERATE_MAX_RETRIES) continue
      throw lastError
    }

    const parts_ = candidate.content.parts ?? []
    const imagePart = parts_.find((p) => p.inlineData || p.inline_data)

    if (!imagePart) {
      const textPart = parts_.find((p) => p.text)
      lastError = new Error(textPart?.text || 'No image in response')
      if (attempt < GENERATE_MAX_RETRIES) continue
      throw lastError
    }

    const imageData = imagePart.inlineData ?? imagePart.inline_data
    if (!imageData) {
      throw new Error('No image data in response')
    }

    const mimeType =
      ('mimeType' in imageData ? imageData.mimeType : undefined) ??
      ('mime_type' in imageData ? imageData.mime_type : undefined) ??
      'image/png'
    const base64 = imageData.data

    let tokenUsage: TokenUsage | undefined
    if (data.usageMetadata) {
      const details = data.usageMetadata.candidatesTokensDetails ?? []
      const imageOutputTokens = details.find((d) => d.modality === 'IMAGE')?.tokenCount ?? 0
      const totalOutputTokens = data.usageMetadata.candidatesTokenCount ?? 0
      // thinking tokens may not appear in candidatesTokensDetails, so use subtraction
      const textOutputTokens = totalOutputTokens - imageOutputTokens
      tokenUsage = {
        inputTokens: data.usageMetadata.promptTokenCount ?? 0,
        imageOutputTokens,
        textOutputTokens,
        totalTokens: data.usageMetadata.totalTokenCount ?? 0,
      }
    }

    let groundingMetadata: GroundingMetadata | undefined
    if (candidate.groundingMetadata) {
      const gm = candidate.groundingMetadata
      const hasAny =
        gm.searchEntryPoint?.renderedContent ||
        (gm.groundingChunks && gm.groundingChunks.length > 0) ||
        (gm.webSearchQueries && gm.webSearchQueries.length > 0) ||
        (gm.imageSearchQueries && gm.imageSearchQueries.length > 0)
      if (hasAny) {
        groundingMetadata = {
          searchEntryPoint: gm.searchEntryPoint?.renderedContent
            ? { renderedContent: gm.searchEntryPoint.renderedContent }
            : undefined,
          groundingChunks: gm.groundingChunks,
          webSearchQueries: gm.webSearchQueries,
          imageSearchQueries: gm.imageSearchQueries,
        }
      }
    }

    return {
      id: crypto.randomUUID(),
      data: base64,
      mimeType,
      source: {
        type: 'generated',
        modelId: model.id,
        prompt,
        resolution,
        aspectRatio,
        referenceImageIds: referenceImages.map((r) => r.id),
        batchId,
        tokenUsage,
        options: { ...options },
        ...(groundingMetadata ? { groundingMetadata } : {}),
      },
      timestamp: Date.now(),
    }
  }

  throw lastError
}

// --- OpenAI (gpt-image-2) ---

function base64ToBlob(b64: string, mimeType: string): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mimeType })
}

async function generateImageOpenAI(
  params: GenerateParams,
  signal?: AbortSignal,
): Promise<PlaygroundImage> {
  const { apiKey, baseUrl, model, prompt, referenceImages, resolution, aspectRatio, options, batchId } = params

  const size = openAISize(resolution, aspectRatio)
  const quality = typeof options.quality === 'string' ? options.quality : 'auto'

  const base = resolveBaseUrl('openai', baseUrl)
  const hasRefs = referenceImages.length > 0
  const url = hasRefs
    ? `${base}/images/edits`
    : `${base}/images/generations`

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const mergedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

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
    body = form
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({
      model: model.apiModel,
      prompt,
      size,
      quality,
      n: 1,
    })
  }

  const requestInit: RequestInit = { method: 'POST', headers, body, signal: mergedSignal }

  let lastError: unknown
  for (let attempt = 0; attempt <= GENERATE_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = GENERATE_RETRY_DELAYS[attempt - 1]
      await new Promise((r) => setTimeout(r, delay))
      if (signal?.aborted) throw signal.reason
    }

    let res: Response
    try {
      res = await fetch(url, requestInit)
    } catch (e) {
      lastError = e
      if (isRetryable(e) && attempt < GENERATE_MAX_RETRIES) continue
      throw e
    }

    if (isRetryable(null, res.status) && attempt < GENERATE_MAX_RETRIES) {
      lastError = new Error(`Server error ${res.status}`)
      continue
    }

    const data = await res.json() as {
      data?: Array<{ b64_json?: string }>
      error?: { message: string }
    }

    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    }

    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('No image in response')

    return {
      id: crypto.randomUUID(),
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
        options: { ...options },
      },
      timestamp: Date.now(),
    }
  }

  throw lastError
}

function isRetryable(error: unknown, status?: number): boolean {
  // Network errors (ERR_CONNECTION_CLOSED, DNS failure, etc.)
  if (error instanceof TypeError) return true
  // Server errors
  if (status !== undefined && status >= 500) return true
  return false
}
