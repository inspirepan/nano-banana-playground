import type { ModelConfig } from '../config/models'
import type { PlaygroundImage, StructuredPrompt } from './types'
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

const AUGMENT_MODEL = 'gemini-3.1-flash-lite-preview'

const STRUCTURED_PROMPT_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    subject: { type: 'STRING' as const },
    action: { type: 'STRING' as const },
    scene: { type: 'STRING' as const },
    composition: { type: 'STRING' as const },
    style: { type: 'STRING' as const },
    lighting: { type: 'STRING' as const },
    colorPalette: { type: 'STRING' as const },
    textInImage: { type: 'STRING' as const },
    constraints: { type: 'STRING' as const },
  },
  required: ['subject', 'action', 'scene', 'composition', 'style', 'lighting', 'colorPalette', 'textInImage', 'constraints'],
}

export async function augmentPrompt(
  apiKey: string,
  rawPrompt: string,
  signal?: AbortSignal,
): Promise<StructuredPrompt> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AUGMENT_MODEL}:generateContent`

  const body = {
    system_instruction: { parts: [{ text: AUGMENT_SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: rawPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: STRUCTURED_PROMPT_SCHEMA,
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

  return JSON.parse(textPart.text) as StructuredPrompt
}
