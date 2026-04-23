import type { ModelConfig } from '../config/models'
import { gptImage2PricePerImage, openAISize } from './openai'

// Provider-agnostic per-image price estimate used before generation.
// Returns null if the price for this combination is not known.
export function getPricePerImage(
  model: ModelConfig,
  resolution: string,
  aspectRatio: string,
  options: Record<string, unknown>,
): number | null {
  if (model.provider === 'google') {
    return model.imagePriceByResolution[resolution] ?? null
  }
  const size = openAISize(resolution, aspectRatio)
  const quality = typeof options.quality === 'string' ? options.quality : 'auto'
  return gptImage2PricePerImage(size, quality)
}
