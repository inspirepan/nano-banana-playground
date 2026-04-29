import type { ModelConfig } from '../../config/models'
import type { PlaygroundImage } from '../types'

export type GenerateParams = {
  apiKey: string
  baseUrl?: string
  model: ModelConfig
  prompt: string
  referenceImages: PlaygroundImage[]
  resolution: string
  aspectRatio: string
  // Provider/model-specific generation parameters, keyed by option id.
  options: Record<string, unknown>
  batchId: string
  batchCreatedAt: number
  stackId: string
  parentImageId?: string
  slotIndex?: number
  // OpenAI images.edits mask: alpha=0 marks the region to rewrite. Ignored on
  // non-OpenAI providers (Gemini has no native mask support — callers should
  // bake the mask into the reference image themselves).
  mask?: PlaygroundImage
}

export type GenerateRetryEvent = {
  attempt: number
  nextAttempt: number
  delayMs: number
  error: string
}

export type GenerateCallbacks = {
  onRetry?: (event: GenerateRetryEvent) => void
}
