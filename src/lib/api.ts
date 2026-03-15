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
      parts: Array<{
        text?: string
        inlineData?: { mimeType: string; data: string }
        inline_data?: { mime_type: string; data: string }
      }>
    }
  }>
  error?: { message: string; code: number }
}

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
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio,
        imageSize: resolution,
      },
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.apiModel}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  })

  const data: ApiResponse = await res.json()

  if (data.error) {
    throw new Error(data.error.message)
  }

  if (!data.candidates?.length) {
    throw new Error('No response from model')
  }

  const imagePart = data.candidates[0].content.parts.find(
    (p) => p.inlineData || p.inline_data,
  )

  if (!imagePart) {
    const textPart = data.candidates[0].content.parts.find((p) => p.text)
    throw new Error(textPart?.text || 'No image in response')
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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  })

  const data: ApiResponse = await res.json()

  if (data.error) {
    throw new Error(data.error.message)
  }

  if (!data.candidates?.length) {
    throw new Error('No response from model')
  }

  const textPart = data.candidates[0].content.parts.find((p) => p.text)
  if (!textPart?.text) {
    throw new Error('No text in augmentation response')
  }

  const raw = JSON.parse(textPart.text) as { schemes: Array<Record<string, string>> }

  return raw.schemes.map((s) => ({
    title: s.title ?? '',
    description: s.description ?? '',
    fields: {
      mode: (s.mode === 'edit' ? 'edit' : 'generate') as 'generate' | 'edit',
      subject: s.subject ?? '', action: s.action ?? '', scene: s.scene ?? '',
      composition: s.composition ?? '', style: s.style ?? '', lighting: s.lighting ?? '',
      colorPalette: s.colorPalette ?? '', textInImage: s.textInImage ?? '', constraints: s.constraints ?? '',
      editType: s.editType ?? '', primaryRequest: s.primaryRequest ?? '',
      referenceRole: s.referenceRole ?? '', targetScene: s.targetScene ?? '', invariants: s.invariants ?? '',
    },
  }))
}
