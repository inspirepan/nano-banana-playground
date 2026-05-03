import { getStorageItem, removeStorageItem, setStorageItem } from './storage'
import type { Provider } from '../config/models'
import { getProviderConfig } from '../config/providers'

const LEGACY_GOOGLE_API_KEY = 'nano-banana-api-key'

export function readProviderApiKey(provider: Provider): string {
  const config = getProviderConfig(provider)
  const current = getStorageItem('localStorage', config.apiKeyStorageKey)
  if (current) return current
  if (provider !== 'google') return ''

  const legacy = getStorageItem('localStorage', LEGACY_GOOGLE_API_KEY)
  if (!legacy) return ''
  const migrated = writeProviderApiKey(provider, legacy)
  if (migrated && getStorageItem('localStorage', config.apiKeyStorageKey) === legacy) {
    removeStorageItem('localStorage', LEGACY_GOOGLE_API_KEY)
  }
  return legacy
}

export function writeProviderApiKey(provider: Provider, apiKey: string): boolean {
  return setStorageItem('localStorage', getProviderConfig(provider).apiKeyStorageKey, apiKey)
}

export function clearProviderApiKey(provider: Provider): void {
  removeStorageItem('localStorage', getProviderConfig(provider).apiKeyStorageKey)
}

export function readProviderBaseUrl(provider: Provider): string {
  return getStorageItem('localStorage', getProviderConfig(provider).baseUrlStorageKey) ?? ''
}

export function writeProviderBaseUrl(provider: Provider, baseUrl: string): boolean {
  return setStorageItem('localStorage', getProviderConfig(provider).baseUrlStorageKey, baseUrl)
}

export function clearProviderBaseUrl(provider: Provider): void {
  removeStorageItem('localStorage', getProviderConfig(provider).baseUrlStorageKey)
}

export function saveProviderBaseUrl(provider: Provider, baseUrl: string): boolean {
  if (baseUrl) return writeProviderBaseUrl(provider, baseUrl)
  clearProviderBaseUrl(provider)
  return true
}
