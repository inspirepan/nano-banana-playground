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

export type PlaygroundImage = {
  id: string
  data: string // base64
  mimeType: string
  source: ImageSource
  timestamp: number
}

export type PromptMode = 'text' | 'augmenting' | 'structured'
export type PersistedPromptMode = Exclude<PromptMode, 'augmenting'>

export type PromptScheme = {
  title: string
  description: string
  text: string
}
