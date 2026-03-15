export type UploadSource = {
  type: 'upload'
  fileName: string
}

export type GeneratedSource = {
  type: 'generated'
  modelId: string
  prompt: string
  resolution: string
  aspectRatio: string
  referenceImageIds: string[]
  batchId: string
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
