export type Provider = 'google' | 'openai'

// --- Option descriptors ---
// Each model declares its provider-specific generation parameters as a list of
// descriptors. The UI renders controls generically, state is a bag keyed by
// `id`, URL sync writes each option under its `urlKey`, and the provider-
// specific request layer reads values out by `id` to build the API payload.

export type ModelOptionChoice = {
  value: string
  label: string
  // Detailed description shown in a hover tooltip.
  tooltip?: string
}

export type ModelToggleOption = {
  id: string
  type: 'toggle'
  label: string
  default: boolean
  urlKey: string
  hint?: string
  // Detailed description shown in a hover tooltip on the toggle chip.
  tooltip?: string
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
  tooltip: '启用 Google 搜索接地，让模型基于实时网页信息生成图片，如当前天气、股市、近期事件等。响应会附带来源链接。',
}

const SEARCH_IMAGE_OPTION: ModelToggleOption = {
  id: 'imageSearch',
  type: 'toggle',
  label: '图片搜索',
  default: false,
  urlKey: 'is',
  group: 'searchTools',
  groupLabel: '搜索增强',
  tooltip: '启用 Google 图片搜索接地，模型会使用检索到的网络图片作为视觉上下文。可单独使用或与 Web 搜索叠加，生成结果需展示来源网页链接（仅 Nano Banana 2 支持）。',
}

const THINKING_LEVEL_OPTION: ModelSelectOption = {
  id: 'thinkingLevel',
  type: 'select',
  label: '思考等级',
  default: 'minimal',
  choices: [
    {
      value: 'minimal',
      label: 'Minimal',
      tooltip: '默认等级。模型仍会进行推理，但大幅精简思考步骤以换取更低的响应延迟。',
    },
    {
      value: 'high',
      label: 'High',
      tooltip: '启用完整推理流程，适合复杂提示和高保真输出。延迟显著增加，思考 token 会被计费（无论是否返回思考内容）。',
    },
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
    { value: 'auto', label: 'Auto', tooltip: '由模型根据提示自动选择质量等级。' },
    { value: 'low', label: 'Low', tooltip: '最低渲染质量。成本最低，延迟最短。' },
    { value: 'medium', label: 'Medium', tooltip: '中等渲染质量。成本与细节的折中点。' },
    { value: 'high', label: 'High', tooltip: '最高渲染质量。细节最丰富，单张成本也最高。' },
  ],
  urlKey: 'q',
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
