import { gptImage2PricePerImage, openAISize } from './openai'
import type { TokenUsage } from './types'
import type { ModelConfig } from '../config/models'

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

const OPENAI_TEXT_INPUT_PRICE_PER_MILLION = 5
const OPENAI_IMAGE_INPUT_PRICE_PER_MILLION = 8
const OPENAI_IMAGE_OUTPUT_PRICE_PER_MILLION = 30

export function getActualCost(model: ModelConfig, usage: TokenUsage | undefined): number | null {
  if (!usage) return null

  if (model.provider === 'google') {
    const inputCost = (usage.inputTokens * model.inputPricePerMillion) / 1_000_000
    const imageCost = (usage.imageOutputTokens * model.imageOutputPricePerMillion) / 1_000_000
    const textCost = (usage.textOutputTokens * model.textOutputPricePerMillion) / 1_000_000
    return inputCost + imageCost + textCost
  }

  const imageInputTokens = usage.inputImageTokens ?? 0
  const textInputTokens = usage.inputTextTokens ?? Math.max(usage.inputTokens - imageInputTokens, 0)
  const textInputCost = (textInputTokens * OPENAI_TEXT_INPUT_PRICE_PER_MILLION) / 1_000_000
  const imageInputCost = (imageInputTokens * OPENAI_IMAGE_INPUT_PRICE_PER_MILLION) / 1_000_000
  const imageOutputCost = (usage.imageOutputTokens * OPENAI_IMAGE_OUTPUT_PRICE_PER_MILLION) / 1_000_000

  return textInputCost + imageInputCost + imageOutputCost
}
