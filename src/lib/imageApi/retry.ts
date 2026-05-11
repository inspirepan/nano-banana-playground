import { translate } from '../../i18n'

export const REQUEST_TIMEOUT_MS = 12 * 60 * 1000 // 12 minutes

export const GENERATE_MAX_RETRIES = 2
export const GENERATE_MAX_ATTEMPTS = GENERATE_MAX_RETRIES + 1
export const GENERATE_RETRY_DELAYS = [1000, 3000]

export class GenerationRequestTimeoutError extends Error {
  timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMinutes(timeoutMs)} minutes`)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export function timeoutMinutes(timeoutMs: number): number {
  return Math.ceil(timeoutMs / 60_000)
}

export function timeoutErrorMessage(error: Error): string {
  const timeoutMs = error instanceof GenerationRequestTimeoutError ? error.timeoutMs : REQUEST_TIMEOUT_MS
  return translate('configLib.generationQueue.timeout', { minutes: timeoutMinutes(timeoutMs) })
}

export function isTimeoutError(error: unknown): error is Error {
  return error instanceof GenerationRequestTimeoutError || (error instanceof Error && error.name === 'TimeoutError')
}

export function createGenerationAbortSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) controller.abort(new GenerationRequestTimeoutError(timeoutMs))
  }, timeoutMs)

  const abortFromParent = () => {
    if (!controller.signal.aborted) controller.abort(signal?.reason)
  }
  if (signal?.aborted) {
    abortFromParent()
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abortFromParent)
    },
  }
}

export function normalizeGenerationAbortError(error: unknown, signal: AbortSignal): unknown {
  const reason = signal.reason
  if (reason instanceof GenerationRequestTimeoutError) return reason
  if (reason instanceof Error && reason.name === 'TimeoutError') return reason
  return error
}

export function generationNetworkErrorMessage(error: Error): string {
  return translate('configLib.generationQueue.networkCorsError', { message: error.message || 'Unknown network error' })
}

export function generationAbortErrorMessage(): string {
  return translate('configLib.generationQueue.requestAborted')
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.trim().toLowerCase()
    return (
      error.name === 'AbortError' ||
      message === 'request was aborted' ||
      message === 'the operation was aborted' ||
      message === 'this operation was aborted'
    )
  }
  return String(error).trim().toLowerCase() === 'request was aborted'
}

export function retryMessage(error: unknown): string {
  if (isTimeoutError(error)) return timeoutErrorMessage(error)
  if (isAbortError(error)) return generationAbortErrorMessage()
  if (error instanceof TypeError) return generationNetworkErrorMessage(error)
  if (error instanceof Error) return error.message
  return String(error)
}

export function isRetryable(error: unknown, status?: number): boolean {
  if (isTimeoutError(error)) return true
  // Network/CORS errors (ERR_CONNECTION_CLOSED, DNS failure, blocked fetch, etc.)
  if (error instanceof TypeError) return true
  // Server errors
  if (status !== undefined && status >= 500) return true
  return false
}
