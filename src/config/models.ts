export type Provider = 'google' | 'openai'

// --- Option descriptors ---
// Each model declares its provider-specific generation parameters as a list of
// descriptors. The UI renders controls generically, state is a bag keyed by
// `id`, URL sync writes each option under its `urlKey`, and the provider-
// specific request layer reads values out by `id` to build the API payload.

export type ModelOptionChoice = {
  value: string
  label: string
}

export type ModelToggleOption = {
  id: string
  type: 'toggle'
  label: string
  default: boolean
  urlKey: string
  hint?: string
  // Adjacent options sharing the same `group` render inside one Section using
  // `groupLabel` (first occurrence wins). Used for e.g. the "搜索增强" pair.
  group?: string
  groupLabel?: string
}

export type ModelSelectOption = {
  id: string
  type: 'select'
  label: string
  choices: ModelOptionChoice[]
  default: string
  urlKey: string
  hint?: string
}

export type ModelOption = ModelToggleOption | ModelSelectOption

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
  // Provider/model-specific generation parameters.
  options?: ModelOption[]
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
}

export type ModelConfig = GoogleModelConfig | OpenAIModelConfig

// --- Option descriptor presets ---
// Shared so we don't drift between Nano Banana 2 / Pro.
const SEARCH_WEB_OPTION: ModelToggleOption = {
  id: 'webSearch',
  type: 'toggle',
  label: 'Web 搜索',
  default: false,
  urlKey: 'ws',
  group: 'searchTools',
  groupLabel: '搜索增强',
}

const SEARCH_IMAGE_OPTION: ModelToggleOption = {
  id: 'imageSearch',
  type: 'toggle',
  label: '图片搜索',
  default: false,
  urlKey: 'is',
  group: 'searchTools',
  groupLabel: '搜索增强',
}

const THINKING_LEVEL_OPTION: ModelSelectOption = {
  id: 'thinkingLevel',
  type: 'select',
  label: '思考等级',
  default: 'minimal',
  choices: [
    { value: 'minimal', label: 'Minimal' },
    { value: 'high', label: 'High' },
  ],
  urlKey: 'tl',
  hint: '平衡生成质量与延迟',
}

const QUALITY_OPTION: ModelSelectOption = {
  id: 'quality',
  type: 'select',
  label: '质量',
  default: 'auto',
  choices: [
    { value: 'auto', label: 'Auto' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ],
  urlKey: 'q',
}

const BACKGROUND_OPTION: ModelSelectOption = {
  id: 'background',
  type: 'select',
  label: '背景',
  default: 'auto',
  choices: [
    { value: 'auto', label: 'Auto' },
    { value: 'transparent', label: '透明' },
    { value: 'opaque', label: '不透明' },
  ],
  urlKey: 'bg',
  hint: 'Transparent 需要 PNG / WebP 输出',
}

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
    options: [
      SEARCH_WEB_OPTION,
      SEARCH_IMAGE_OPTION,
      THINKING_LEVEL_OPTION,
    ],
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
    options: [
      SEARCH_WEB_OPTION,
    ],
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
    aspectRatios: [
      '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4',
      '9:16', '16:9', '21:9', '1:3', '3:1',
    ],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 16,
    maxCharacterImages: 0,
    maxBatchCount: 4,
    options: [
      QUALITY_OPTION,
      BACKGROUND_OPTION,
    ],
  },
]

export const DEFAULT_MODEL = MODEL_CONFIGS[0]

// --- Helpers ---

// Produce a default options bag for the given model (per option's `default`).
export function defaultOptionsFor(model: ModelConfig): Record<string, unknown> {
  const bag: Record<string, unknown> = {}
  for (const opt of model.options ?? []) bag[opt.id] = opt.default
  return bag
}

// Coerce a URL-level string into the option value type.
export function coerceOptionValue(opt: ModelOption, raw: string | undefined): unknown {
  if (raw === undefined) return opt.default
  if (opt.type === 'toggle') return raw === '1' || raw === 'true'
  // select
  const match = opt.choices.find((c) => c.value === raw)
  return match ? match.value : opt.default
}

// Serialize an option value to URL form; returns null to indicate "omit from URL".
export function serializeOptionValue(opt: ModelOption, value: unknown): string | null {
  if (opt.type === 'toggle') {
    if (value === true) return '1'
    return null
  }
  // select
  if (typeof value !== 'string' || value === opt.default) return null
  return value
}
