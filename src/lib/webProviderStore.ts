import { getStorageItem, removeStorageItem, setStorageItem } from './storage'
import {
  isWebApiProvider,
  isWebFetchProvider,
  isWebSearchProvider,
  WEB_API_PROVIDER_CONFIGS,
  type WebApiProvider,
  type WebFetchProvider,
  type WebSearchProvider,
} from '../config/webProviders'

const WEB_SEARCH_PROVIDER_KEY = 'nano-banana-web-search-provider'
const WEB_FETCH_PROVIDER_KEY = 'nano-banana-web-fetch-provider'
const WEB_API_KEY_PREFIX = 'nbp-web-api-key:'

export type WebProviderApiKeys = Record<WebApiProvider, string>

export type WebProviderSettings = {
  searchProvider: WebSearchProvider
  fetchProvider: WebFetchProvider
  apiKeys: WebProviderApiKeys
}

function read(key: string): string | null {
  return getStorageItem('localStorage', key)
}

function write(key: string, value: string): boolean {
  return setStorageItem('localStorage', key, value)
}

function webApiKeyStorageKey(provider: WebApiProvider): string {
  return `${WEB_API_KEY_PREFIX}${provider}`
}

export function readWebSearchProviderPreference(): WebSearchProvider {
  const value = read(WEB_SEARCH_PROVIDER_KEY)
  return value && isWebSearchProvider(value) ? value : 'none'
}

export function writeWebSearchProviderPreference(provider: WebSearchProvider): boolean {
  return write(WEB_SEARCH_PROVIDER_KEY, provider)
}

export function readWebFetchProviderPreference(): WebFetchProvider {
  const value = read(WEB_FETCH_PROVIDER_KEY)
  return value && isWebFetchProvider(value) ? value : 'default'
}

export function writeWebFetchProviderPreference(provider: WebFetchProvider): boolean {
  return write(WEB_FETCH_PROVIDER_KEY, provider)
}

export function readWebProviderApiKey(provider: WebApiProvider): string {
  return read(webApiKeyStorageKey(provider)) ?? ''
}

export function writeWebProviderApiKey(provider: WebApiProvider, apiKey: string): boolean {
  return write(webApiKeyStorageKey(provider), apiKey)
}

export function clearWebProviderApiKey(provider: WebApiProvider): void {
  removeStorageItem('localStorage', webApiKeyStorageKey(provider))
}

export function readWebProviderApiKeys(): WebProviderApiKeys {
  return WEB_API_PROVIDER_CONFIGS.reduce((keys, provider) => {
    keys[provider.id] = readWebProviderApiKey(provider.id)
    return keys
  }, {} as WebProviderApiKeys)
}

export function readWebProviderSettings(): WebProviderSettings {
  return {
    searchProvider: readWebSearchProviderPreference(),
    fetchProvider: readWebFetchProviderPreference(),
    apiKeys: readWebProviderApiKeys(),
  }
}

export function hasWebProviderApiKey(provider: string, settings = readWebProviderSettings()): boolean {
  return isWebApiProvider(provider) && settings.apiKeys[provider].trim() !== ''
}
