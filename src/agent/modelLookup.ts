import { MODEL_CONFIGS, type ModelConfig } from '../config/models'

export function normalizeModelLookupKey(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

export function findModelConfig(modelId: string): ModelConfig | null {
  const direct = MODEL_CONFIGS.find((item) => item.id === modelId)
  if (direct) return direct
  const normalized = normalizeModelLookupKey(modelId)
  if (!normalized) return null
  return MODEL_CONFIGS.find((item) => normalizeModelLookupKey(item.id) === normalized) ?? null
}

export function normalizeResolution(model: ModelConfig, resolution: string): string {
  return model.resolutions.includes(resolution) ? resolution : model.defaultResolution
}

export function normalizeAspectRatio(model: ModelConfig, aspectRatio: string): string {
  return model.aspectRatios.includes(aspectRatio) ? aspectRatio : model.defaultAspectRatio
}

export function activeOptionsForModel(model: ModelConfig, source: Record<string, unknown>): Record<string, unknown> {
  const activeOptions: Record<string, unknown> = {}
  for (const opt of model.options ?? []) activeOptions[opt.id] = opt.id in source ? source[opt.id] : opt.default
  return activeOptions
}
