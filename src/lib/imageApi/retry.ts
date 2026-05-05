import { translate } from '../../i18n'

export const REQUEST_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export const GENERATE_MAX_RETRIES = 2
export const GENERATE_MAX_ATTEMPTS = GENERATE_MAX_RETRIES + 1
export const GENERATE_RETRY_DELAYS = [1000, 3000]

export function generationNetworkErrorMessage(error: Error): string {
  return translate('configLib.generationQueue.networkCorsError', { message: error.message || 'Unknown network error' })
}

export function retryMessage(error: unknown): string {
  if (error instanceof TypeError) return generationNetworkErrorMessage(error)
  if (error instanceof Error) return error.message
  return String(error)
}

export function isRetryable(error: unknown, status?: number): boolean {
  // Network/CORS errors (ERR_CONNECTION_CLOSED, DNS failure, blocked fetch, etc.)
  if (error instanceof TypeError) return true
  // Server errors
  if (status !== undefined && status >= 500) return true
  return false
}
