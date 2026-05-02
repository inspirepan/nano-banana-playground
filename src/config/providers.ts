export type Provider = 'google' | 'openai'

export type ProviderBrandIconName = 'gemini' | 'openai'

export type ProviderConfig = {
  id: Provider
  label: string
  shortLabel: string
  brandIcon: ProviderBrandIconName
  defaultBaseUrl: string
  apiKeyStorageKey: string
  baseUrlStorageKey: string
  keyLabelKey: string
  keyPlaceholderKey: string
  keyHintKey: string
}

const PROVIDER_CONFIG_BY_ID: Record<Provider, ProviderConfig> = {
  google: {
    id: 'google',
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    brandIcon: 'gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    apiKeyStorageKey: 'nbp-api-key:google',
    baseUrlStorageKey: 'nbp-base-url:google',
    keyLabelKey: 'apiKeys.provider.google.label',
    keyPlaceholderKey: 'apiKeys.provider.google.placeholder',
    keyHintKey: 'apiKeys.provider.google.hint',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    brandIcon: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyStorageKey: 'nbp-api-key:openai',
    baseUrlStorageKey: 'nbp-base-url:openai',
    keyLabelKey: 'apiKeys.provider.openai.label',
    keyPlaceholderKey: 'apiKeys.provider.openai.placeholder',
    keyHintKey: 'apiKeys.provider.openai.hint',
  },
}

export const PROVIDER_CONFIGS: ProviderConfig[] = Object.values(PROVIDER_CONFIG_BY_ID)

export const PROVIDERS = PROVIDER_CONFIGS.map((provider) => provider.id)

export function getProviderConfig(provider: Provider): ProviderConfig {
  return PROVIDER_CONFIG_BY_ID[provider]
}
