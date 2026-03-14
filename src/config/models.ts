export type ModelConfig = {
  id: string
  name: string
  apiModel: string
  resolutions: string[]
  defaultResolution: string
  aspectRatios: string[]
  defaultAspectRatio: string
  maxReferenceImages: number
  maxCharacterImages: number
  maxBatchCount: number
}

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
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
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
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
  },
]

export const DEFAULT_MODEL = MODEL_CONFIGS[0]
