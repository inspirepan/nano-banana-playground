export type WebApiProvider = 'exa' | 'tavily'

export type WebSearchProvider = 'none' | WebApiProvider

export type WebFetchProvider = 'default' | WebApiProvider

export type WebApiProviderConfig = {
  id: WebApiProvider
  label: string
  shortLabel: string
  apiKeyUrl: string
  supportsSearch: boolean
  supportsFetch: boolean
}

export type WebProviderOption<T extends string> = {
  id: T
  labelKey: string
  descriptionKey: string
}

export const WEB_API_PROVIDER_CONFIGS: WebApiProviderConfig[] = [
  {
    id: 'exa',
    label: 'Exa',
    shortLabel: 'Exa',
    apiKeyUrl: 'https://dashboard.exa.ai/api-keys',
    supportsSearch: true,
    supportsFetch: true,
  },
  {
    id: 'tavily',
    label: 'Tavily',
    shortLabel: 'Tavily',
    apiKeyUrl: 'https://app.tavily.com/home',
    supportsSearch: true,
    supportsFetch: true,
  },
]

export const WEB_SEARCH_PROVIDER_OPTIONS: WebProviderOption<WebSearchProvider>[] = [
  {
    id: 'none',
    labelKey: 'settings.webTools.search.provider.none',
    descriptionKey: 'settings.webTools.search.provider.noneDescription',
  },
  {
    id: 'exa',
    labelKey: 'settings.webTools.provider.exa',
    descriptionKey: 'settings.webTools.search.provider.exaDescription',
  },
  {
    id: 'tavily',
    labelKey: 'settings.webTools.provider.tavily',
    descriptionKey: 'settings.webTools.search.provider.tavilyDescription',
  },
]

export const WEB_FETCH_PROVIDER_OPTIONS: WebProviderOption<WebFetchProvider>[] = [
  {
    id: 'default',
    labelKey: 'settings.webTools.fetch.provider.default',
    descriptionKey: 'settings.webTools.fetch.provider.defaultDescription',
  },
  {
    id: 'exa',
    labelKey: 'settings.webTools.provider.exa',
    descriptionKey: 'settings.webTools.fetch.provider.exaDescription',
  },
  {
    id: 'tavily',
    labelKey: 'settings.webTools.provider.tavily',
    descriptionKey: 'settings.webTools.fetch.provider.tavilyDescription',
  },
]

export function isWebApiProvider(value: string): value is WebApiProvider {
  return WEB_API_PROVIDER_CONFIGS.some((provider) => provider.id === value)
}

export function isWebSearchProvider(value: string): value is WebSearchProvider {
  return value === 'none' || isWebApiProvider(value)
}

export function isWebFetchProvider(value: string): value is WebFetchProvider {
  return value === 'default' || isWebApiProvider(value)
}

export function getWebApiProviderConfig(provider: WebApiProvider): WebApiProviderConfig {
  return WEB_API_PROVIDER_CONFIGS.find((item) => item.id === provider) ?? WEB_API_PROVIDER_CONFIGS[0]
}
