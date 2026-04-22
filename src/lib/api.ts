import type { ModelConfig } from '../config/models'
import type { PlaygroundImage, PromptScheme, TokenUsage } from './types'
import { openAISize } from './openai'
import AUGMENT_SYSTEM_PROMPT from './augment-system-prompt.md?raw'

export type GenerateParams = {
  apiKey: string
  model: ModelConfig
  prompt: string
  referenceImages: PlaygroundImage[]
  resolution: string
  aspectRatio: string
  quality: string
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
  }>
  error?: { message: string; code: number }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
    candidatesTokensDetails?: Array<{ modality: string; tokenCount: number }>
  }
}

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

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

async function generateImageGoogle(
  params: GenerateParams,
  signal?: AbortSignal,
): Promise<PlaygroundImage> {
  const { apiKey, model, prompt, referenceImages, resolution, aspectRatio, batchId } = params

  const parts: ApiPart[] = [{ text: prompt }]
  for (const img of referenceImages) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.data,
      },
    })
  }

  const body = {
    system_instruction: {
      parts: [{ text: 'You are an image generation model. Always generate an image in response to every request. Never decline or refuse to generate an image.' }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio,
        imageSize: resolution,
      },
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.apiModel}:generateContent`

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
  const { apiKey, model, prompt, referenceImages, resolution, aspectRatio, quality, batchId } = params

  const size = openAISize(resolution, aspectRatio)
  const qualityParam = quality || 'auto'

  const hasRefs = referenceImages.length > 0
  const url = hasRefs
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations'

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const mergedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  let body: BodyInit
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  if (hasRefs) {
    const form = new FormData()
    form.append('model', model.apiModel)
    form.append('prompt', prompt)
    form.append('size', size)
    form.append('quality', qualityParam)
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
      quality: qualityParam,
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
        quality: qualityParam,
        referenceImageIds: referenceImages.map((r) => r.id),
        batchId,
      },
      timestamp: Date.now(),
    }
  }

  throw lastError
}


const AUGMENT_MODEL_GOOGLE = 'gemini-3-flash-preview'
const AUGMENT_MODEL_OPENAI = 'gpt-5.4-mini'

const S = 'STRING' as const

const FIELD_PROPS = {
  mode: { type: S, enum: ['generate', 'edit'] },
  subject: { type: S }, action: { type: S }, scene: { type: S },
  composition: { type: S }, style: { type: S }, lighting: { type: S },
  colorPalette: { type: S }, textInImage: { type: S }, constraints: { type: S },
  editType: { type: S }, primaryRequest: { type: S }, referenceRole: { type: S },
  targetScene: { type: S }, invariants: { type: S },
} as const

const FIELD_KEYS = Object.keys(FIELD_PROPS) as string[]

const SCHEMES_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    schemes: {
      type: 'ARRAY' as const,
      items: {
        type: 'OBJECT' as const,
        properties: {
          title: { type: S },
          description: { type: S },
          ...FIELD_PROPS,
        },
        required: ['title', 'description', ...FIELD_KEYS],
      },
    },
  },
  required: ['schemes'],
}

// OpenAI JSON schema needs lowercase types, additionalProperties:false, and a
// corresponding property entry for every `required` field.
const S_OAI = 'string' as const
const OPENAI_FIELD_PROPS = {
  mode: { type: S_OAI, enum: ['generate', 'edit'] },
  subject: { type: S_OAI }, action: { type: S_OAI }, scene: { type: S_OAI },
  composition: { type: S_OAI }, style: { type: S_OAI }, lighting: { type: S_OAI },
  colorPalette: { type: S_OAI }, textInImage: { type: S_OAI }, constraints: { type: S_OAI },
  editType: { type: S_OAI }, primaryRequest: { type: S_OAI }, referenceRole: { type: S_OAI },
  targetScene: { type: S_OAI }, invariants: { type: S_OAI },
} as const

const OPENAI_SCHEMES_SCHEMA = {
  type: 'object' as const,
  properties: {
    schemes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          title: { type: S_OAI },
          description: { type: S_OAI },
          ...OPENAI_FIELD_PROPS,
        },
        required: ['title', 'description', ...FIELD_KEYS],
        additionalProperties: false,
      },
    },
  },
  required: ['schemes'],
  additionalProperties: false,
}

// Convert structured API response fields into a readable labelled-text prompt
function assemblePrompt(s: Record<string, string>): string {
  const v = (key: string) => {
    const raw = s[key]?.trim()
    return raw && raw !== '无' ? raw : ''
  }
  const lines: string[] = []
  const isEdit = s.mode === 'edit'
  if (isEdit) {
    if (v('editType')) lines.push(`编辑类型：${v('editType')}`)
    if (v('primaryRequest')) lines.push(`编辑请求：${v('primaryRequest')}`)
    if (v('referenceRole')) lines.push(`参考图说明：${v('referenceRole')}`)
    if (v('targetScene')) lines.push(`目标场景：${v('targetScene')}`)
    if (v('style')) lines.push(`目标风格：${v('style')}`)
    if (v('invariants')) lines.push(`保持不变：${v('invariants')}`)
    if (v('constraints')) lines.push(`避免：${v('constraints')}`)
  } else {
    const desc = [v('subject'), v('action'), v('scene')].filter(Boolean).join('\n')
    if (desc) lines.push(desc)
    if (v('composition')) lines.push(`构图：${v('composition')}`)
    if (v('style')) lines.push(`风格：${v('style')}`)
    if (v('lighting')) lines.push(`光影：${v('lighting')}`)
    if (v('colorPalette')) lines.push(`色彩：${v('colorPalette')}`)
    if (v('textInImage')) lines.push(`画中文字：${v('textInImage')}`)
    if (v('constraints')) lines.push(`避免：${v('constraints')}`)
  }
  return lines.join('\n\n')
}

const AUGMENT_MAX_RETRIES = 2
const AUGMENT_RETRY_DELAYS = [1000, 3000]

function isRetryable(error: unknown, status?: number): boolean {
  // Network errors (ERR_CONNECTION_CLOSED, DNS failure, etc.)
  if (error instanceof TypeError) return true
  // Server errors
  if (status !== undefined && status >= 500) return true
  return false
}

// Extract complete scheme objects from partially-streamed JSON.
// The expected shape is {"schemes": [{...}, {...}, ...]}.
// We bracket-count inside the top-level array to find each complete object.
function extractCompleteSchemes(json: string): PromptScheme[] {
  const arrayStart = json.indexOf('[')
  if (arrayStart < 0) return []

  const schemes: PromptScheme[] = []
  let depth = 0
  let objectStart = -1
  let inString = false
  let escape = false

  for (let i = arrayStart + 1; i < json.length; i++) {
    const ch = json[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{') {
      if (depth === 0) objectStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objectStart >= 0) {
        try {
          const s = JSON.parse(json.slice(objectStart, i + 1)) as Record<string, string>
          schemes.push({
            title: s.title ?? '',
            description: s.description ?? '',
            text: assemblePrompt(s),
          })
        } catch { /* incomplete */ }
        objectStart = -1
      }
    }
  }

  return schemes
}

export type AugmentStreamCallback = (schemes: PromptScheme[], done: boolean) => void

export async function augmentPromptStream(
  provider: ModelConfig['provider'],
  apiKey: string,
  rawPrompt: string,
  referenceImages: PlaygroundImage[],
  onUpdate: AugmentStreamCallback,
  signal?: AbortSignal,
): Promise<PromptScheme[]> {
  if (provider === 'openai') {
    return augmentPromptStreamOpenAI(apiKey, rawPrompt, referenceImages, onUpdate, signal)
  }
  return augmentPromptStreamGoogle(apiKey, rawPrompt, referenceImages, onUpdate, signal)
}

// Drive the SSE retry/read/emit loop shared by both providers. `extractDelta`
// pulls a text delta out of each data-event payload.
async function runAugmentStream(
  requestInit: RequestInit,
  url: string,
  extractDelta: (event: unknown) => string | null,
  onUpdate: AugmentStreamCallback,
  signal: AbortSignal | undefined,
): Promise<PromptScheme[]> {
  let lastError: unknown
  for (let attempt = 0; attempt <= AUGMENT_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = AUGMENT_RETRY_DELAYS[attempt - 1]
      await new Promise((r) => setTimeout(r, delay))
      if (signal?.aborted) throw signal.reason
    }

    let res: Response
    try {
      res = await fetch(url, requestInit)
    } catch (e) {
      lastError = e
      if (isRetryable(e) && attempt < AUGMENT_MAX_RETRIES) continue
      throw e
    }

    if (isRetryable(null, res.status) && attempt < AUGMENT_MAX_RETRIES) {
      lastError = new Error(`Server error ${res.status}`)
      continue
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
    }

    if (!res.body) throw new Error('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ''
    let jsonText = ''
    let emittedCount = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const event = JSON.parse(payload)
            const chunk = extractDelta(event)
            if (chunk) jsonText += chunk
          } catch { /* skip malformed SSE events */ }
        }

        const parsed = extractCompleteSchemes(jsonText)
        if (parsed.length > emittedCount) {
          emittedCount = parsed.length
          onUpdate(parsed, false)
        }
      }
    } finally {
      reader.releaseLock()
    }

    let finalSchemes: PromptScheme[]
    try {
      const raw = JSON.parse(jsonText) as { schemes: Array<Record<string, string>> }
      finalSchemes = raw.schemes.map((s) => ({
        title: s.title ?? '',
        description: s.description ?? '',
        text: assemblePrompt(s),
      }))
    } catch {
      const partial = extractCompleteSchemes(jsonText)
      if (partial.length === 0) throw new Error('Failed to parse augmentation response')
      finalSchemes = partial
    }

    onUpdate(finalSchemes, true)
    return finalSchemes
  }

  throw lastError
}

async function augmentPromptStreamGoogle(
  apiKey: string,
  rawPrompt: string,
  referenceImages: PlaygroundImage[],
  onUpdate: AugmentStreamCallback,
  signal?: AbortSignal,
): Promise<PromptScheme[]> {
  // Use v1alpha for mediaResolution support; streaming via SSE
  const url = `https://generativelanguage.googleapis.com/v1alpha/models/${AUGMENT_MODEL_GOOGLE}:streamGenerateContent?alt=sse`

  const parts: Array<Record<string, unknown>> = [{ text: rawPrompt }]
  for (const img of referenceImages) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.data,
      },
      mediaResolution: { level: 'media_resolution_high' },
    })
  }

  const body = {
    system_instruction: { parts: [{ text: AUGMENT_SYSTEM_PROMPT }] },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMES_SCHEMA,
      thinkingConfig: { thinkingLevel: 'medium' },
    },
  }

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

  // Gemini SSE events contain { candidates: [{ content: { parts: [{ text, thought }] } }] }
  return runAugmentStream(
    requestInit,
    url,
    (raw) => {
      const event = raw as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
      }
      const eventParts = event.candidates?.[0]?.content?.parts
      if (!eventParts) return null
      let text = ''
      for (const part of eventParts) {
        if (part.thought) continue
        if (part.text != null) text += part.text
      }
      return text || null
    },
    onUpdate,
    signal,
  )
}

async function augmentPromptStreamOpenAI(
  apiKey: string,
  rawPrompt: string,
  referenceImages: PlaygroundImage[],
  onUpdate: AugmentStreamCallback,
  signal?: AbortSignal,
): Promise<PromptScheme[]> {
  const url = 'https://api.openai.com/v1/responses'

  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: rawPrompt }]
  for (const img of referenceImages) {
    content.push({
      type: 'input_image',
      image_url: `data:${img.mimeType || 'image/png'};base64,${img.data}`,
    })
  }

  const body = {
    model: AUGMENT_MODEL_OPENAI,
    instructions: AUGMENT_SYSTEM_PROMPT,
    input: [{ role: 'user', content }],
    stream: true,
    reasoning: { effort: 'medium' },
    text: {
      format: {
        type: 'json_schema',
        name: 'schemes',
        strict: true,
        schema: OPENAI_SCHEMES_SCHEMA,
      },
    },
  }

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  }

  // OpenAI Responses API streams semantic events; output_text.delta carries
  // the incremental JSON text we care about.
  return runAugmentStream(
    requestInit,
    url,
    (raw) => {
      const event = raw as { type?: string; delta?: string }
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        return event.delta
      }
      return null
    },
    onUpdate,
    signal,
  )
}
