export type Provider = 'google' | 'openai'

type BaseModelConfig = {
  id: string
  name: string
  provider: Provider
  apiModel: string
  resolutions: string[]
  defaultResolution: string
  aspectRatios: string[]
  defaultAspectRatio: string
  maxReferenceImages: number
  maxCharacterImages: number
  maxBatchCount: number
}

export type GoogleModelConfig = BaseModelConfig & {
  provider: 'google'
  // price per image in USD, keyed by resolution string (used for pre-generation estimate)
  imagePriceByResolution: Record<string, number>
  // token-based pricing per 1M tokens in USD (used for post-generation actual cost)
  // source: https://ai.google.dev/gemini-api/docs/pricing
  inputPricePerMillion: number       // text + image input tokens
  imageOutputPricePerMillion: number // image output tokens
  textOutputPricePerMillion: number  // text + thinking output tokens
}

export type OpenAIModelConfig = BaseModelConfig & {
  provider: 'openai'
  qualities: string[]        // e.g. ['auto','low','medium','high']
  defaultQuality: string
}

export type ModelConfig = GoogleModelConfig | OpenAIModelConfig

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    provider: 'google',
    apiModel: 'gemini-3.1-flash-image-preview',
    resolutions: ['512', '1K', '2K', '4K'],
    defaultResolution: '1K',
    aspectRatios: [
      '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4',
      '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1',
    ],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 10,
    maxCharacterImages: 4,
    maxBatchCount: 4,
    imagePriceByResolution: { '512': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    inputPricePerMillion: 0.50,
    imageOutputPricePerMillion: 60.00,
    textOutputPricePerMillion: 3.00,
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'google',
    apiModel: 'gemini-3-pro-image-preview',
    resolutions: ['1K', '2K', '4K'],
    defaultResolution: '1K',
    aspectRatios: [
      '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4',
      '9:16', '16:9', '21:9',
    ],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 6,
    maxCharacterImages: 5,
    maxBatchCount: 4,
    // 1K and 2K share the same token count (1120), hence same price
    imagePriceByResolution: { '1K': 0.134, '2K': 0.134, '4K': 0.240 },
    inputPricePerMillion: 2.00,
    imageOutputPricePerMillion: 120.00,
    textOutputPricePerMillion: 12.00,
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    provider: 'openai',
    apiModel: 'gpt-image-2',
    // Resolution tiers map to explicit pixel sizes together with the aspect ratio
    // (see src/lib/openai.ts for the lookup table).
    resolutions: ['1K', '2K', '4K'],
    defaultResolution: '1K',
    aspectRatios: ['1:1', '3:2', '2:3', '16:9'],
    defaultAspectRatio: '1:1',
    qualities: ['auto', 'low', 'medium', 'high'],
    defaultQuality: 'auto',
    maxReferenceImages: 10,
    maxCharacterImages: 0,
    maxBatchCount: 4,
  },
]

export const DEFAULT_MODEL = MODEL_CONFIGS[0]
