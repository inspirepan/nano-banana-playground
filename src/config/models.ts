import { translate } from '../i18n'

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
  // `groupLabel` (first occurrence wins). Used for e.g. the search tools pair.
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
  inputPricePerMillion: number // text + image input tokens
  imageOutputPricePerMillion: number // image output tokens
  textOutputPricePerMillion: number // text + thinking output tokens
}

export type OpenAIModelConfig = BaseModelConfig & {
  provider: 'openai'
}

export type ModelConfig = GoogleModelConfig | OpenAIModelConfig

// Trim the "Nano " brand prefix off Google model names so the segmented
// control reads tighter; OpenAI names stay verbatim.
export function getModelShortLabel(model: ModelConfig): string {
  if (model.provider === 'openai') return model.name
  return model.name.replace(/^Nano\s+/, '')
}

// --- Option descriptor presets ---
// Shared so we don't drift between Nano Banana 2 / Pro.
const SEARCH_WEB_OPTION: ModelToggleOption = {
  id: 'webSearch',
  type: 'toggle',
  get label() {
    return translate('configLib.models.webSearch.label')
  },
  default: false,
  urlKey: 'ws',
  group: 'searchTools',
  get groupLabel() {
    return translate('configLib.models.searchTools.groupLabel')
  },
  get tooltip() {
    return translate('configLib.models.webSearch.tooltip')
  },
}

const SEARCH_IMAGE_OPTION: ModelToggleOption = {
  id: 'imageSearch',
  type: 'toggle',
  get label() {
    return translate('configLib.models.imageSearch.label')
  },
  default: false,
  urlKey: 'is',
  group: 'searchTools',
  get groupLabel() {
    return translate('configLib.models.searchTools.groupLabel')
  },
  get tooltip() {
    return translate('configLib.models.imageSearch.tooltip')
  },
}

const THINKING_LEVEL_OPTION: ModelSelectOption = {
  id: 'thinkingLevel',
  type: 'select',
  get label() {
    return translate('configLib.models.thinking.label')
  },
  default: 'minimal',
  choices: [
    {
      value: 'minimal',
      get label() {
        return translate('configLib.models.thinking.minimal.label')
      },
      get tooltip() {
        return translate('configLib.models.thinking.minimal.tooltip')
      },
    },
    {
      value: 'high',
      get label() {
        return translate('configLib.models.thinking.high.label')
      },
      get tooltip() {
        return translate('configLib.models.thinking.high.tooltip')
      },
    },
  ],
  urlKey: 'tl',
  get hint() {
    return translate('configLib.models.thinking.hint')
  },
}

const QUALITY_OPTION: ModelSelectOption = {
  id: 'quality',
  type: 'select',
  get label() {
    return translate('configLib.models.quality.label')
  },
  default: 'auto',
  choices: [
    {
      value: 'auto',
      get label() {
        return translate('configLib.models.quality.auto.label')
      },
      get tooltip() {
        return translate('configLib.models.quality.auto.tooltip')
      },
    },
    {
      value: 'low',
      get label() {
        return translate('configLib.models.quality.low.label')
      },
      get tooltip() {
        return translate('configLib.models.quality.low.tooltip')
      },
    },
    {
      value: 'medium',
      get label() {
        return translate('configLib.models.quality.medium.label')
      },
      get tooltip() {
        return translate('configLib.models.quality.medium.tooltip')
      },
    },
    {
      value: 'high',
      get label() {
        return translate('configLib.models.quality.high.label')
      },
      get tooltip() {
        return translate('configLib.models.quality.high.tooltip')
      },
    },
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
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 10,
    maxCharacterImages: 4,
    maxBatchCount: 4,
    imagePriceByResolution: { '512': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    inputPricePerMillion: 0.5,
    imageOutputPricePerMillion: 60.0,
    textOutputPricePerMillion: 3.0,
    options: [SEARCH_WEB_OPTION, SEARCH_IMAGE_OPTION, THINKING_LEVEL_OPTION],
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'google',
    apiModel: 'gemini-3-pro-image-preview',
    resolutions: ['1K', '2K', '4K'],
    defaultResolution: '1K',
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 6,
    maxCharacterImages: 5,
    maxBatchCount: 4,
    // 1K and 2K share the same token count (1120), hence same price
    imagePriceByResolution: { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
    inputPricePerMillion: 2.0,
    imageOutputPricePerMillion: 120.0,
    textOutputPricePerMillion: 12.0,
    options: [SEARCH_WEB_OPTION],
  },
  {
    id: 'gpt-image-2',
    name: 'Image 2',
    provider: 'openai',
    apiModel: 'gpt-image-2',
    // Resolution tiers map to explicit pixel sizes together with the aspect ratio
    // (see src/lib/openai.ts for the lookup table).
    resolutions: ['1K', '2K', '4K'],
    defaultResolution: '1K',
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:3', '3:1'],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 16,
    maxCharacterImages: 0,
    maxBatchCount: 4,
    options: [QUALITY_OPTION],
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
