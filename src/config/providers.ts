export type Provider = 'google' | 'openai' | 'anthropic' | 'moonshot-cn' | 'moonshot-ai' | 'doubao'

export type ProviderBrandIconName = 'gemini' | 'openai' | 'claude' | 'moonshot' | 'doubao'

export type ProviderConfig = {
  id: Provider
  label: string
  shortLabel: string
  brandIcon: ProviderBrandIconName
  defaultBaseUrl: string
  apiKeyUrl: string
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
    apiKeyUrl: 'https://aistudio.google.com/apikey',
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
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyStorageKey: 'nbp-api-key:openai',
    baseUrlStorageKey: 'nbp-base-url:openai',
    keyLabelKey: 'apiKeys.provider.openai.label',
    keyPlaceholderKey: 'apiKeys.provider.openai.placeholder',
    keyHintKey: 'apiKeys.provider.openai.hint',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    shortLabel: 'Anthropic',
    brandIcon: 'claude',
    defaultBaseUrl: 'https://api.anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyStorageKey: 'nbp-api-key:anthropic',
    baseUrlStorageKey: 'nbp-base-url:anthropic',
    keyLabelKey: 'apiKeys.provider.anthropic.label',
    keyPlaceholderKey: 'apiKeys.provider.anthropic.placeholder',
    keyHintKey: 'apiKeys.provider.anthropic.hint',
  },
  'moonshot-cn': {
    id: 'moonshot-cn',
    label: 'Moonshot CN',
    shortLabel: 'Moonshot CN',
    brandIcon: 'moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    apiKeyStorageKey: 'nbp-api-key:moonshot-cn',
    baseUrlStorageKey: 'nbp-base-url:moonshot-cn',
    keyLabelKey: 'apiKeys.provider.moonshotCn.label',
    keyPlaceholderKey: 'apiKeys.provider.moonshotCn.placeholder',
    keyHintKey: 'apiKeys.provider.moonshotCn.hint',
  },
  'moonshot-ai': {
    id: 'moonshot-ai',
    label: 'Moonshot AI',
    shortLabel: 'Moonshot AI',
    brandIcon: 'moonshot',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    apiKeyUrl: 'https://platform.moonshot.ai/console/api-keys',
    apiKeyStorageKey: 'nbp-api-key:moonshot-ai',
    baseUrlStorageKey: 'nbp-base-url:moonshot-ai',
    keyLabelKey: 'apiKeys.provider.moonshotAi.label',
    keyPlaceholderKey: 'apiKeys.provider.moonshotAi.placeholder',
    keyHintKey: 'apiKeys.provider.moonshotAi.hint',
  },
  doubao: {
    id: 'doubao',
    label: 'Doubao Seedream',
    shortLabel: 'Doubao',
    brandIcon: 'doubao',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    apiKeyStorageKey: 'nbp-api-key:doubao',
    baseUrlStorageKey: 'nbp-base-url:doubao',
    keyLabelKey: 'apiKeys.provider.doubao.label',
    keyPlaceholderKey: 'apiKeys.provider.doubao.placeholder',
    keyHintKey: 'apiKeys.provider.doubao.hint',
  },
}

export const PROVIDER_CONFIGS: ProviderConfig[] = Object.values(PROVIDER_CONFIG_BY_ID)

export const PROVIDERS = PROVIDER_CONFIGS.map((provider) => provider.id)

export function getProviderConfig(provider: Provider): ProviderConfig {
  return PROVIDER_CONFIG_BY_ID[provider]
}
