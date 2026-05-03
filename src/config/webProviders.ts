export type WebApiProvider = 'exa' | 'tavily' | 'brave' | 'parallel'

export type WebFetchApiProvider = Exclude<WebApiProvider, 'brave'>

export type WebSearchProvider = 'none' | WebApiProvider

export type WebFetchProvider = 'default' | WebFetchApiProvider

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
  {
    id: 'brave',
    label: 'Brave Search',
    shortLabel: 'Brave',
    apiKeyUrl: 'https://api-dashboard.search.brave.com/app/keys',
    supportsSearch: true,
    supportsFetch: false,
  },
  {
    id: 'parallel',
    label: 'Parallel',
    shortLabel: 'Parallel',
    apiKeyUrl: 'https://platform.parallel.ai/settings/api-keys',
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
  {
    id: 'brave',
    labelKey: 'settings.webTools.provider.brave',
    descriptionKey: 'settings.webTools.search.provider.braveDescription',
  },
  {
    id: 'parallel',
    labelKey: 'settings.webTools.provider.parallel',
    descriptionKey: 'settings.webTools.search.provider.parallelDescription',
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
  {
    id: 'parallel',
    labelKey: 'settings.webTools.provider.parallel',
    descriptionKey: 'settings.webTools.fetch.provider.parallelDescription',
  },
]

export function isWebApiProvider(value: string): value is WebApiProvider {
  return WEB_API_PROVIDER_CONFIGS.some((provider) => provider.id === value)
}

export function isWebSearchProvider(value: string): value is WebSearchProvider {
  return value === 'none' || isWebApiProvider(value)
}

export function isWebFetchApiProvider(value: string): value is WebFetchApiProvider {
  return isWebApiProvider(value) && getWebApiProviderConfig(value).supportsFetch
}

export function isWebFetchProvider(value: string): value is WebFetchProvider {
  return value === 'default' || isWebFetchApiProvider(value)
}

export function getWebApiProviderConfig(provider: WebApiProvider): WebApiProviderConfig {
  return WEB_API_PROVIDER_CONFIGS.find((item) => item.id === provider) ?? WEB_API_PROVIDER_CONFIGS[0]
}
