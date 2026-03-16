import type { ModelConfig } from '../config/models'
import type { PlaygroundImage, PromptScheme } from './types'
import AUGMENT_SYSTEM_PROMPT from './augment-system-prompt.md?raw'

export type GenerateParams = {
  apiKey: string
  model: ModelConfig
  prompt: string
  referenceImages: PlaygroundImage[]
  resolution: string
  aspectRatio: string
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
}

const GENERATE_MAX_RETRIES = 2
const GENERATE_RETRY_DELAYS = [1000, 3000]

export async function generateImage(
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

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
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
      },
      timestamp: Date.now(),
    }
  }

  throw lastError
}

const AUGMENT_MODEL = 'gemini-3-flash-preview'

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

export async function augmentPrompt(
  apiKey: string,
  rawPrompt: string,
  referenceImages: PlaygroundImage[],
  signal?: AbortSignal,
): Promise<PromptScheme[]> {
  // Use v1alpha for mediaResolution support on reference images
  const url = `https://generativelanguage.googleapis.com/v1alpha/models/${AUGMENT_MODEL}:generateContent`

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

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  }

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

    const data: ApiResponse = await res.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    if (!data.candidates?.length) {
      throw new Error('No response from model')
    }

    const textPart = data.candidates[0].content.parts?.find((p) => p.text)
    if (!textPart?.text) {
      throw new Error('No text in augmentation response')
    }

    const raw = JSON.parse(textPart.text) as { schemes: Array<Record<string, string>> }

    return raw.schemes.map((s) => ({
      title: s.title ?? '',
      description: s.description ?? '',
      text: assemblePrompt(s),
    }))
  }

  throw lastError
}
