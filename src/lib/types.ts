export type UploadSource = {
  type: 'upload'
  fileName: string
}

export type TokenUsage = {
  inputTokens: number
  inputTextTokens?: number
  inputImageTokens?: number
  imageOutputTokens: number // image modality output tokens (drives most of the cost)
  textOutputTokens: number // text + thinking output tokens
  totalTokens: number
}

// Google grounding metadata (google_search tool). Attribution must be surfaced
// to the user when image_search is enabled; see nano-banana-api-guide.md.
export type GroundingChunk = {
  web?: { uri?: string; title?: string }
  image?: { imageUri?: string; uri?: string; title?: string }
}

export type GroundingMetadata = {
  searchEntryPoint?: { renderedContent?: string }
  groundingChunks?: GroundingChunk[]
  webSearchQueries?: string[]
  imageSearchQueries?: string[]
}

export type GeneratedSource = {
  type: 'generated'
  modelId: string
  prompt: string
  resolution: string
  aspectRatio: string
  referenceImageIds: string[]
  batchId: string
  batchCreatedAt?: number
  stackId?: string
  parentImageId?: string
  slotIndex?: number
  imageIdSource?: 'agent'
  tokenUsage?: TokenUsage
  // Provider/model-specific generation options (keyed by option id; values typed
  // by the option descriptor). Introduced after the options-descriptor refactor.
  options?: Record<string, unknown>
  // Google-only: grounding sources returned when google_search tool was used.
  groundingMetadata?: GroundingMetadata
  // OpenAI-only: whether the source request used an alpha mask that is not
  // persisted as a normal reference image.
  usesMask?: boolean
  // Legacy fields retained for reading pre-refactor history records. New records
  // write to `options` instead. Readers should prefer `options[...]` first.
  quality?: string
  searchTools?: {
    web?: boolean
    image?: boolean
  }
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
