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
  if (model.resolutions.includes(resolution)) return resolution
  const requested = resolutionRank(resolution)
  if (requested === null) return model.defaultResolution

  const ranked = model.resolutions
    .map((item) => ({ item, rank: resolutionRank(item) }))
    .filter((item): item is { item: string; rank: number } => item.rank !== null)
  if (ranked.length === 0) return model.defaultResolution

  const lowerOrEqual = ranked.filter((item) => item.rank <= requested).sort((a, b) => b.rank - a.rank)
  return lowerOrEqual[0]?.item ?? ranked.sort((a, b) => a.rank - b.rank)[0]?.item ?? model.defaultResolution
}

export function normalizeAspectRatio(model: ModelConfig, aspectRatio: string): string {
  if (model.aspectRatios.includes(aspectRatio)) return aspectRatio
  const requested = aspectRatioValue(aspectRatio)
  if (requested === null) return model.defaultAspectRatio

  let best = model.defaultAspectRatio
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of model.aspectRatios) {
    const value = aspectRatioValue(candidate)
    if (value === null) continue
    const distance = Math.abs(Math.log(value / requested))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function activeOptionsForModel(model: ModelConfig, source: Record<string, unknown>): Record<string, unknown> {
  const activeOptions: Record<string, unknown> = {}
  for (const opt of model.options ?? []) activeOptions[opt.id] = opt.id in source ? source[opt.id] : opt.default
  return activeOptions
}

function resolutionRank(resolution: string): number | null {
  const trimmed = resolution.trim().toUpperCase()
  const kMatch = /^(\d+(?:\.\d+)?)K$/.exec(trimmed)
  if (kMatch) return Number(kMatch[1]) * 1024
  const sizeMatch = /^(\d+)\s*[X×]\s*(\d+)$/.exec(trimmed)
  if (sizeMatch) return Math.max(Number(sizeMatch[1]), Number(sizeMatch[2]))
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function aspectRatioValue(aspectRatio: string): number | null {
  const match = /^(\d+)\s*:\s*(\d+)$/.exec(aspectRatio.trim())
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return width / height
}
