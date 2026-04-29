import { generateImageGoogle } from './imageApi/google'
import { generateImageOpenAI } from './imageApi/openai'
import { GENERATE_MAX_ATTEMPTS, REQUEST_TIMEOUT_MS } from './imageApi/retry'
import type { GenerateCallbacks, GenerateParams, GenerateRetryEvent } from './imageApi/types'
import type { PlaygroundImage } from './types'

export { GENERATE_MAX_ATTEMPTS, REQUEST_TIMEOUT_MS }
export type { GenerateCallbacks, GenerateParams, GenerateRetryEvent }

export async function generateImage(
  params: GenerateParams,
  signal?: AbortSignal,
  callbacks?: GenerateCallbacks,
): Promise<PlaygroundImage> {
  if (params.model.provider === 'openai') {
    return generateImageOpenAI(params, signal, callbacks)
  }
  return generateImageGoogle(params, signal, callbacks)
}
