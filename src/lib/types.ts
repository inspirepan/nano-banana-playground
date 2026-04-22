export type UploadSource = {
  type: 'upload'
  fileName: string
}

export type TokenUsage = {
  inputTokens: number
  imageOutputTokens: number  // image modality output tokens (drives most of the cost)
  textOutputTokens: number   // text + thinking output tokens
  totalTokens: number
}

export type GeneratedSource = {
  type: 'generated'
  modelId: string
  prompt: string
  resolution: string
  aspectRatio: string
  // OpenAI (gpt-image-2) rendering quality: 'auto' | 'low' | 'medium' | 'high'.
  // Optional because Google models and legacy records don't carry it.
  quality?: string
  referenceImageIds: string[]
  batchId: string
  tokenUsage?: TokenUsage
}

export type ImageSource = UploadSource | GeneratedSource

// Metadata only — no binary data
export type PlaygroundImageMeta = {
  id: string
  mimeType: string
  source: ImageSource
  timestamp: number
}

// Full image with base64 data
export type PlaygroundImage = PlaygroundImageMeta & {
  data: string // base64
}

export type PromptMode = 'text' | 'augmenting' | 'structured'
export type PersistedPromptMode = Exclude<PromptMode, 'augmenting'>

export type PromptScheme = {
  title: string
  description: string
  text: string
}
