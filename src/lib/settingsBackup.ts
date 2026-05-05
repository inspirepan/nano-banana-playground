import { AGENT_MODEL_CONFIGS, AGENT_THINKING_OPTIONS, type AgentThinkingLevel } from '../config/agentModels'
import { getComposerSubmitMode, type ComposerSubmitMode } from '../config/composerSubmitMode'
import { isLanguagePreference, type LanguagePreference } from '../config/languages'
import { MODEL_CONFIGS, type Provider } from '../config/models'
import { PROVIDER_CONFIGS, getProviderConfig } from '../config/providers'
import { COLOR_THEME_IDS, type ColorThemeId, type Theme } from '../config/theme'
import {
  WEB_API_PROVIDER_CONFIGS,
  isWebFetchProvider,
  isWebSearchProvider,
  type WebApiProvider,
  type WebFetchProvider,
  type WebSearchProvider,
} from '../config/webProviders'
import { loadSkillSettings, loadStoredUserSkills } from '../agent/skills/storage'
import { normalizeSkillIcon } from '../agent/skills/icons'
import type { AgentSkillDisplayDescription, AgentSkillDisplayName, StoredUserSkill } from '../agent/skills/types'
import type { TranslationParams } from '../i18n/types'
import {
  readAgentPanelWidePreference,
  readAgentWideTipDismissedPreference,
  readColorThemePreference,
  readDetailSidebarCollapsedPreference,
  readGenerationConcurrencyPreference,
  readLanguagePreference,
  readPreferredAgentModelPreference,
  readPreferredAgentThinkingLevelPreference,
  readPreferredImageModelPreference,
  readThemePreference,
} from './preferenceStore'
import { readProviderApiKey, readProviderBaseUrl, readProviderUseProxy } from './credentialStore'
import { readWebProviderApiKey, readWebProviderSettings } from './webProviderStore'

export const SETTINGS_EXPORT_KIND = 'settings'
export const SETTINGS_EXPORT_VERSION = 1

export type SettingsExportBundle = {
  kind: typeof SETTINGS_EXPORT_KIND
  version: typeof SETTINGS_EXPORT_VERSION
  exportedAt: string
  settings: ExportedSettings
  secrets?: ExportedSecrets
}

export type ExportedSettings = {
  preferences?: Partial<Record<PreferenceImportKey, string | number | boolean>>
  serviceProviders?: Partial<Record<Provider, ExportedServiceProviderSettings>>
  webTools?: ExportedWebToolsSettings
  skills?: ExportedSkillSettings
}

export type ExportedServiceProviderSettings = {
  baseUrl?: string
  useProxy?: boolean
}

export type ExportedWebToolsSettings = {
  searchProvider?: WebSearchProvider
  fetchProvider?: WebFetchProvider
}

export type ExportedSkillSettings = {
  userSkills?: StoredUserSkill[]
  skillSettings?: Record<string, { enabled: boolean }>
}

export type ExportedSecrets = {
  apiKeys?: Partial<Record<Provider, string>>
  webApiKeys?: Partial<Record<WebApiProvider, string>>
}

export type PreferenceImportKey =
  | 'theme'
  | 'colorTheme'
  | 'language'
  | 'agentPanelWide'
  | 'agentWideTipDismissed'
  | 'generationConcurrency'
  | 'detailSidebarCollapsed'
  | 'preferredImageModel'
  | 'preferredAgentModel'
  | 'preferredAgentThinkingLevel'
  | 'composerSubmitMode'

export type SettingsImportGroup =
  | 'appearance'
  | 'generation'
  | 'agent'
  | 'serviceProviders'
  | 'webTools'
  | 'skills'
  | 'secrets'

export type SettingsImportItemStatus = 'added' | 'changed' | 'unchanged' | 'invalid'

export type SettingsImportItemKind =
  | 'preference'
  | 'serviceProviderBaseUrl'
  | 'serviceProviderUseProxy'
  | 'webProvider'
  | 'userSkill'
  | 'skillEnabled'
  | 'providerApiKey'
  | 'webApiKey'

export type SettingsImportItemDependency = {
  id: string
  itemId?: string
  reasonKey: string
  reasonParams?: TranslationParams
}

export type SettingsImportItemIssue = {
  reasonKey: string
  reasonParams?: TranslationParams
}

export type SettingsImportPlanItem = {
  id: string
  kind: SettingsImportItemKind
  group: SettingsImportGroup
  status: SettingsImportItemStatus
  labelKey: string
  labelParams?: TranslationParams
  currentValueLabel: string
  incomingValueLabel: string
  sensitive?: boolean
  defaultSelected: boolean
  reasonKey?: string
  reasonParams?: TranslationParams
  dependencies?: SettingsImportItemDependency[]
  payload:
    | { key: PreferenceImportKey; value: string | number | boolean }
    | { provider: Provider; value: string }
    | { provider: Provider; value: boolean }
    | { key: 'searchProvider'; value: WebSearchProvider }
    | { key: 'fetchProvider'; value: WebFetchProvider }
    | { skill: StoredUserSkill }
    | { skillName: string; enabled: boolean }
    | { provider: Provider; apiKey: string }
    | { provider: WebApiProvider; apiKey: string }
}

export type SettingsImportPlan = {
  bundle: SettingsExportBundle
  items: SettingsImportPlanItem[]
  summary: Record<SettingsImportItemStatus, number>
}

export type CreateSettingsExportOptions = {
  includeApiKeys: boolean
}

type PreferenceDescriptor = {
  key: PreferenceImportKey
  group: SettingsImportGroup
  labelKey: string
  read: () => string | number | boolean | null
  normalize: (value: unknown) => string | number | boolean | null
}

const THEME_VALUES = new Set<Theme>(['light', 'dark', 'system'])
const BOOLEAN_LABELS = { true: 'on', false: 'off' } as const

const PREFERENCE_DESCRIPTORS: PreferenceDescriptor[] = [
  {
    key: 'theme',
    group: 'appearance',
    labelKey: 'settings.backup.item.theme',
    read: readThemePreference,
    normalize: (value) => (typeof value === 'string' && THEME_VALUES.has(value as Theme) ? value : null),
  },
  {
    key: 'colorTheme',
    group: 'appearance',
    labelKey: 'settings.backup.item.colorTheme',
    read: readColorThemePreference,
    normalize: (value) =>
      typeof value === 'string' && (COLOR_THEME_IDS as string[]).includes(value) ? (value as ColorThemeId) : null,
  },
  {
    key: 'language',
    group: 'appearance',
    labelKey: 'settings.backup.item.language',
    read: readLanguagePreference,
    normalize: (value) =>
      typeof value === 'string' && isLanguagePreference(value) ? (value as LanguagePreference) : null,
  },
  {
    key: 'generationConcurrency',
    group: 'generation',
    labelKey: 'settings.backup.item.generationConcurrency',
    read: () => readGenerationConcurrencyPreference(),
    normalize: (value) => {
      const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : NaN
      if (!Number.isFinite(numeric)) return null
      const rounded = Math.floor(numeric)
      return rounded >= 1 && (rounded <= 4 || rounded === 999) ? rounded : null
    },
  },
  {
    key: 'detailSidebarCollapsed',
    group: 'generation',
    labelKey: 'settings.backup.item.detailSidebarCollapsed',
    read: readDetailSidebarCollapsedPreference,
    normalize: normalizeBoolean,
  },
  {
    key: 'preferredImageModel',
    group: 'generation',
    labelKey: 'settings.backup.item.preferredImageModel',
    read: readPreferredImageModelPreference,
    normalize: (value) =>
      typeof value === 'string' && MODEL_CONFIGS.some((model) => model.id === value) ? value : null,
  },
  {
    key: 'agentPanelWide',
    group: 'agent',
    labelKey: 'settings.backup.item.agentPanelWide',
    read: readAgentPanelWidePreference,
    normalize: normalizeBoolean,
  },
  {
    key: 'agentWideTipDismissed',
    group: 'agent',
    labelKey: 'settings.backup.item.agentWideTipDismissed',
    read: readAgentWideTipDismissedPreference,
    normalize: normalizeBoolean,
  },
  {
    key: 'preferredAgentModel',
    group: 'agent',
    labelKey: 'settings.backup.item.preferredAgentModel',
    read: readPreferredAgentModelPreference,
    normalize: (value) =>
      typeof value === 'string' && AGENT_MODEL_CONFIGS.some((model) => model.id === value) ? value : null,
  },
  {
    key: 'preferredAgentThinkingLevel',
    group: 'agent',
    labelKey: 'settings.backup.item.preferredAgentThinkingLevel',
    read: readPreferredAgentThinkingLevelPreference,
    normalize: (value) =>
      typeof value === 'string' && AGENT_THINKING_OPTIONS.some((option) => option.value === value)
        ? (value as AgentThinkingLevel)
        : null,
  },
  {
    key: 'composerSubmitMode',
    group: 'agent',
    labelKey: 'settings.backup.item.composerSubmitMode',
    read: getComposerSubmitMode,
    normalize: (value) => (value === 'cmdEnter' || value === 'enter' ? (value as ComposerSubmitMode) : null),
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return null
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isProvider(value: string): value is Provider {
  return PROVIDER_CONFIGS.some((provider) => provider.id === value)
}

function isWebApiProvider(value: string): value is WebApiProvider {
  return WEB_API_PROVIDER_CONFIGS.some((provider) => provider.id === value)
}

function maskSecret(value: string): string {
  if (!value) return ''
  const tail = value.slice(-4)
  return tail ? `••••${tail}` : '••••'
}

function labelValue(value: string | number | boolean | null | undefined, sensitive = false): string {
  if (value === null || value === undefined || value === '') return '—'
  if (sensitive && typeof value === 'string') return maskSecret(value)
  if (typeof value === 'boolean') return BOOLEAN_LABELS[String(value) as 'true' | 'false']
  return String(value)
}

function statusFor(current: string | number | boolean | null | undefined, incoming: string | number | boolean) {
  if (current === incoming) return 'unchanged' as const
  if (current === null || current === undefined || current === '') return 'added' as const
  return 'changed' as const
}

function defaultSelected(status: SettingsImportItemStatus, sensitive = false): boolean {
  if (sensitive || status === 'invalid' || status === 'unchanged') return false
  return true
}

function addPlanItem(
  items: SettingsImportPlanItem[],
  item: Omit<SettingsImportPlanItem, 'defaultSelected'> & { defaultSelected?: boolean },
) {
  const { defaultSelected: forcedDefaultSelected, ...planItem } = item
  items.push({
    ...planItem,
    defaultSelected: forcedDefaultSelected ?? defaultSelected(planItem.status, planItem.sensitive),
  })
}

function normalizeStoredUserSkill(value: unknown): StoredUserSkill | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== 'string' || typeof value.enabled !== 'boolean' || !Array.isArray(value.files)) return null
  const files = value.files.flatMap((file): StoredUserSkill['files'] => {
    if (!isRecord(file) || typeof file.path !== 'string' || typeof file.content !== 'string') return []
    return [{ path: file.path, content: file.content }]
  })
  if (!files.some((file) => file.path === 'SKILL.md')) return null
  return {
    name: value.name,
    agentDescription: typeof value.agentDescription === 'string' ? value.agentDescription : undefined,
    displayName: isRecord(value.displayName) ? displayNameRecord(value.displayName) : undefined,
    displayDescription: isRecord(value.displayDescription)
      ? displayDescriptionRecord(value.displayDescription)
      : undefined,
    icon: normalizeSkillIcon(typeof value.icon === 'string' ? value.icon : undefined),
    enabled: value.enabled,
    files,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  }
}

function displayNameRecord(value: Record<string, unknown>): AgentSkillDisplayName {
  return {
    'zh-CN': typeof value['zh-CN'] === 'string' ? value['zh-CN'] : undefined,
    en: typeof value.en === 'string' ? value.en : undefined,
  }
}

function displayDescriptionRecord(value: Record<string, unknown>): AgentSkillDisplayDescription | undefined {
  const zh = typeof value['zh-CN'] === 'string' ? value['zh-CN'] : ''
  const en = typeof value.en === 'string' ? value.en : ''
  if (!zh && !en) return undefined
  return {
    'zh-CN': zh || en,
    en: en || zh,
  }
}

function normalizeSkillSettings(value: unknown): Record<string, { enabled: boolean }> {
  if (!isRecord(value)) return {}
  const result: Record<string, { enabled: boolean }> = {}
  for (const [name, setting] of Object.entries(value)) {
    if (!isRecord(setting) || typeof setting.enabled !== 'boolean') continue
    result[name] = { enabled: setting.enabled }
  }
  return result
}

export function createSettingsExportBundle(options: CreateSettingsExportOptions): SettingsExportBundle {
  const preferences: ExportedSettings['preferences'] = {}
  for (const descriptor of PREFERENCE_DESCRIPTORS) {
    const value = descriptor.read()
    if (value !== null && value !== '') preferences[descriptor.key] = value
  }

  const serviceProviders: ExportedSettings['serviceProviders'] = {}
  for (const provider of PROVIDER_CONFIGS) {
    serviceProviders[provider.id] = {
      baseUrl: readProviderBaseUrl(provider.id),
      useProxy: readProviderUseProxy(provider.id),
    }
  }

  const webSettings = readWebProviderSettings()
  const settings: ExportedSettings = {
    preferences,
    serviceProviders,
    webTools: {
      searchProvider: webSettings.searchProvider,
      fetchProvider: webSettings.fetchProvider,
    },
    skills: {
      userSkills: loadStoredUserSkills(),
      skillSettings: loadSkillSettings(),
    },
  }

  const bundle: SettingsExportBundle = {
    kind: SETTINGS_EXPORT_KIND,
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
  }

  if (options.includeApiKeys) {
    const apiKeys: Partial<Record<Provider, string>> = {}
    for (const provider of PROVIDER_CONFIGS) {
      const apiKey = readProviderApiKey(provider.id).trim()
      if (apiKey) apiKeys[provider.id] = apiKey
    }
    const webApiKeys: Partial<Record<WebApiProvider, string>> = {}
    for (const provider of WEB_API_PROVIDER_CONFIGS) {
      const apiKey = readWebProviderApiKey(provider.id).trim()
      if (apiKey) webApiKeys[provider.id] = apiKey
    }
    if (Object.keys(apiKeys).length > 0 || Object.keys(webApiKeys).length > 0) {
      bundle.secrets = { apiKeys, webApiKeys }
    }
  }

  return bundle
}

export function parseSettingsExportJson(text: string): SettingsExportBundle {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('invalid-json')
  }
  if (!isRecord(parsed) || parsed.kind !== SETTINGS_EXPORT_KIND || parsed.version !== SETTINGS_EXPORT_VERSION) {
    throw new Error('unsupported-settings-export')
  }
  if (!isRecord(parsed.settings)) throw new Error('invalid-settings-export')
  return parsed as SettingsExportBundle
}

export function buildSettingsImportPlan(bundle: SettingsExportBundle): SettingsImportPlan {
  const items: SettingsImportPlanItem[] = []
  const incomingPreferences = isRecord(bundle.settings.preferences) ? bundle.settings.preferences : {}
  const incomingWebApiKeys = readIncomingWebApiKeys(bundle)

  for (const descriptor of PREFERENCE_DESCRIPTORS) {
    if (!(descriptor.key in incomingPreferences)) continue
    const currentRaw = descriptor.read()
    const current = descriptor.normalize(currentRaw) ?? currentRaw
    const normalized = descriptor.normalize(incomingPreferences[descriptor.key])
    if (normalized === null) {
      addPlanItem(items, {
        id: `preference:${descriptor.key}`,
        kind: 'preference',
        group: descriptor.group,
        status: 'invalid',
        labelKey: descriptor.labelKey,
        currentValueLabel: labelValue(currentRaw),
        incomingValueLabel: labelValue(incomingPreferences[descriptor.key]),
        reasonKey: 'settings.backup.reason.invalidValue',
        payload: { key: descriptor.key, value: '' },
      })
      continue
    }
    const status = statusFor(current, normalized)
    addPlanItem(items, {
      id: `preference:${descriptor.key}`,
      kind: 'preference',
      group: descriptor.group,
      status,
      labelKey: descriptor.labelKey,
      currentValueLabel: labelValue(current),
      incomingValueLabel: labelValue(normalized),
      payload: { key: descriptor.key, value: normalized },
    })
  }

  addServiceProviderItems(items, bundle)
  addWebToolItems(items, bundle, incomingWebApiKeys)
  addSkillItems(items, bundle)
  addSecretItems(items, bundle)

  return {
    bundle,
    items,
    summary: summarizeImportItems(items),
  }
}

function addServiceProviderItems(items: SettingsImportPlanItem[], bundle: SettingsExportBundle) {
  const serviceProviders = isRecord(bundle.settings.serviceProviders) ? bundle.settings.serviceProviders : {}
  for (const [providerId, rawSettings] of Object.entries(serviceProviders)) {
    if (!isProvider(providerId) || !isRecord(rawSettings)) continue
    const provider = getProviderConfig(providerId)
    if ('baseUrl' in rawSettings) {
      const incoming = normalizeString(rawSettings.baseUrl)
      const current = readProviderBaseUrl(providerId)
      addPlanItem(items, {
        id: `service:${providerId}:baseUrl`,
        kind: 'serviceProviderBaseUrl',
        group: 'serviceProviders',
        status: incoming === null ? 'invalid' : statusFor(current, incoming),
        labelKey: 'settings.backup.item.providerBaseUrl',
        labelParams: { provider: provider.shortLabel },
        currentValueLabel: labelValue(current),
        incomingValueLabel: labelValue(incoming),
        reasonKey: incoming === null ? 'settings.backup.reason.invalidValue' : undefined,
        payload: { provider: providerId, value: incoming ?? '' },
      })
    }
    if ('useProxy' in rawSettings) {
      const incoming = normalizeBoolean(rawSettings.useProxy)
      const current = readProviderUseProxy(providerId)
      addPlanItem(items, {
        id: `service:${providerId}:useProxy`,
        kind: 'serviceProviderUseProxy',
        group: 'serviceProviders',
        status: incoming === null ? 'invalid' : statusFor(current, incoming),
        labelKey: 'settings.backup.item.providerUseProxy',
        labelParams: { provider: provider.shortLabel },
        currentValueLabel: labelValue(current),
        incomingValueLabel: labelValue(incoming),
        reasonKey: incoming === null ? 'settings.backup.reason.invalidValue' : undefined,
        payload: { provider: providerId, value: incoming ?? false },
      })
    }
  }
}

function addWebToolItems(
  items: SettingsImportPlanItem[],
  bundle: SettingsExportBundle,
  incomingWebApiKeys: Partial<Record<WebApiProvider, string>>,
) {
  const webTools = isRecord(bundle.settings.webTools) ? bundle.settings.webTools : {}
  const current = readWebProviderSettings()
  if ('searchProvider' in webTools) {
    const incoming = normalizeString(webTools.searchProvider)
    const valid = incoming !== null && isWebSearchProvider(incoming)
    const dependency =
      valid && incoming !== 'none' ? webApiKeyDependency(incoming, current.apiKeys, incomingWebApiKeys) : null
    const missingKey = dependency !== null && dependency.itemId === undefined
    const status = valid ? statusFor(current.searchProvider, incoming) : 'invalid'
    addPlanItem(items, {
      id: 'webTools:searchProvider',
      kind: 'webProvider',
      group: 'webTools',
      status,
      labelKey: 'settings.backup.item.webSearchProvider',
      currentValueLabel: labelValue(current.searchProvider),
      incomingValueLabel: labelValue(incoming),
      reasonKey: valid
        ? missingKey && status !== 'unchanged'
          ? 'settings.backup.reason.requiresWebApiKey'
          : undefined
        : 'settings.backup.reason.invalidValue',
      defaultSelected: missingKey ? false : defaultSelected(status),
      dependencies: dependency ? [dependency] : undefined,
      payload: { key: 'searchProvider', value: valid ? incoming : 'none' },
    })
  }
  if ('fetchProvider' in webTools) {
    const incoming = normalizeString(webTools.fetchProvider)
    const valid = incoming !== null && isWebFetchProvider(incoming)
    const dependency =
      valid && incoming !== 'default' ? webApiKeyDependency(incoming, current.apiKeys, incomingWebApiKeys) : null
    const missingKey = dependency !== null && dependency.itemId === undefined
    const status = valid ? statusFor(current.fetchProvider, incoming) : 'invalid'
    addPlanItem(items, {
      id: 'webTools:fetchProvider',
      kind: 'webProvider',
      group: 'webTools',
      status,
      labelKey: 'settings.backup.item.webFetchProvider',
      currentValueLabel: labelValue(current.fetchProvider),
      incomingValueLabel: labelValue(incoming),
      reasonKey: valid
        ? missingKey && status !== 'unchanged'
          ? 'settings.backup.reason.requiresWebApiKey'
          : undefined
        : 'settings.backup.reason.invalidValue',
      defaultSelected: missingKey ? false : defaultSelected(status),
      dependencies: dependency ? [dependency] : undefined,
      payload: { key: 'fetchProvider', value: valid ? incoming : 'default' },
    })
  }
}

function webApiKeyDependency(
  provider: WebApiProvider,
  currentApiKeys: Partial<Record<WebApiProvider, string>>,
  incomingWebApiKeys: Partial<Record<WebApiProvider, string>>,
): SettingsImportItemDependency | null {
  if (currentApiKeys[provider]?.trim()) return null
  return {
    id: `webApiKey:${provider}`,
    itemId: incomingWebApiKeys[provider]?.trim() ? `secret:webApiKey:${provider}` : undefined,
    reasonKey: 'settings.backup.reason.requiresWebApiKey',
  }
}

function readIncomingWebApiKeys(bundle: SettingsExportBundle): Partial<Record<WebApiProvider, string>> {
  const webApiKeys = isRecord(bundle.secrets?.webApiKeys) ? bundle.secrets.webApiKeys : {}
  const result: Partial<Record<WebApiProvider, string>> = {}
  for (const [providerId, rawApiKey] of Object.entries(webApiKeys)) {
    if (!isWebApiProvider(providerId)) continue
    const incoming = normalizeString(rawApiKey)?.trim()
    if (incoming) result[providerId] = incoming
  }
  return result
}

function addSkillItems(items: SettingsImportPlanItem[], bundle: SettingsExportBundle) {
  const skills = isRecord(bundle.settings.skills) ? bundle.settings.skills : {}
  const currentSkills = new Map(loadStoredUserSkills().map((skill) => [skill.name, skill]))
  const incomingSkills = Array.isArray(skills.userSkills) ? skills.userSkills : []
  for (const rawSkill of incomingSkills) {
    const skill = normalizeStoredUserSkill(rawSkill)
    if (!skill) continue
    const current = currentSkills.get(skill.name)
    const status = current ? (JSON.stringify(current) === JSON.stringify(skill) ? 'unchanged' : 'changed') : 'added'
    addPlanItem(items, {
      id: `skill:${skill.name}`,
      kind: 'userSkill',
      group: 'skills',
      status,
      labelKey: 'settings.backup.item.userSkill',
      labelParams: { name: skill.name },
      currentValueLabel: current ? `${current.files.length}` : '—',
      incomingValueLabel: `${skill.files.length}`,
      payload: { skill },
    })
  }

  const currentSettings = loadSkillSettings()
  const incomingSettings = normalizeSkillSettings(skills.skillSettings)
  for (const [skillName, setting] of Object.entries(incomingSettings)) {
    const current = currentSettings[skillName]?.enabled
    const status = statusFor(current, setting.enabled)
    addPlanItem(items, {
      id: `skill-enabled:${skillName}`,
      kind: 'skillEnabled',
      group: 'skills',
      status,
      labelKey: 'settings.backup.item.skillEnabled',
      labelParams: { name: skillName },
      currentValueLabel: labelValue(current),
      incomingValueLabel: labelValue(setting.enabled),
      payload: { skillName, enabled: setting.enabled },
    })
  }
}

function addSecretItems(items: SettingsImportPlanItem[], bundle: SettingsExportBundle) {
  if (!bundle.secrets) return
  const apiKeys = isRecord(bundle.secrets.apiKeys) ? bundle.secrets.apiKeys : {}
  for (const [providerId, rawApiKey] of Object.entries(apiKeys)) {
    if (!isProvider(providerId)) continue
    const incoming = normalizeString(rawApiKey)?.trim()
    if (!incoming) continue
    const current = readProviderApiKey(providerId)
    const provider = getProviderConfig(providerId)
    addPlanItem(items, {
      id: `secret:apiKey:${providerId}`,
      kind: 'providerApiKey',
      group: 'secrets',
      status: statusFor(current, incoming),
      labelKey: 'settings.backup.item.providerApiKey',
      labelParams: { provider: provider.shortLabel },
      currentValueLabel: labelValue(current, true),
      incomingValueLabel: labelValue(incoming, true),
      sensitive: true,
      payload: { provider: providerId, apiKey: incoming },
    })
  }

  const webApiKeys = isRecord(bundle.secrets.webApiKeys) ? bundle.secrets.webApiKeys : {}
  for (const [providerId, rawApiKey] of Object.entries(webApiKeys)) {
    if (!isWebApiProvider(providerId)) continue
    const incoming = normalizeString(rawApiKey)?.trim()
    if (!incoming) continue
    const current = readWebProviderApiKey(providerId)
    const provider = WEB_API_PROVIDER_CONFIGS.find((item) => item.id === providerId)
    addPlanItem(items, {
      id: `secret:webApiKey:${providerId}`,
      kind: 'webApiKey',
      group: 'secrets',
      status: statusFor(current, incoming),
      labelKey: 'settings.backup.item.webApiKey',
      labelParams: { provider: provider?.shortLabel ?? providerId },
      currentValueLabel: labelValue(current, true),
      incomingValueLabel: labelValue(incoming, true),
      sensitive: true,
      payload: { provider: providerId, apiKey: incoming },
    })
  }
}

function summarizeImportItems(items: SettingsImportPlanItem[]): Record<SettingsImportItemStatus, number> {
  const summary: Record<SettingsImportItemStatus, number> = { added: 0, changed: 0, unchanged: 0, invalid: 0 }
  for (const item of items) summary[item.status]++
  return summary
}

export function createDefaultSettingsImportSelection(plan: SettingsImportPlan): Set<string> {
  const selectedIds = new Set(plan.items.filter((item) => item.defaultSelected).map((item) => item.id))
  return includeRequiredImportDependencies(plan, selectedIds)
}

export function selectSettingsImportItems(
  plan: SettingsImportPlan,
  currentSelectedIds: Set<string>,
  itemIds: Iterable<string>,
): Set<string> {
  const nextSelectedIds = new Set(currentSelectedIds)
  const itemById = importItemMap(plan)
  for (const itemId of itemIds) {
    const item = itemById.get(itemId)
    if (!item || !isSettingsImportItemSelectable(item)) continue
    nextSelectedIds.add(item.id)
    includeRequiredImportDependencies(plan, nextSelectedIds)
  }
  return pruneUnsatisfiedImportDependents(plan, nextSelectedIds)
}

export function deselectSettingsImportItems(
  plan: SettingsImportPlan,
  currentSelectedIds: Set<string>,
  itemIds: Iterable<string>,
): Set<string> {
  const nextSelectedIds = new Set(currentSelectedIds)
  for (const itemId of itemIds) nextSelectedIds.delete(itemId)
  return pruneUnsatisfiedImportDependents(plan, nextSelectedIds)
}

export function isSettingsImportItemSelectable(item: SettingsImportPlanItem): boolean {
  if (item.status === 'invalid' || item.status === 'unchanged') return false
  return !(item.dependencies ?? []).some((dependency) => dependency.itemId === undefined)
}

export function getSettingsImportItemIssue(
  item: SettingsImportPlanItem,
  selectedIds: Set<string>,
): SettingsImportItemIssue | null {
  if (item.reasonKey) return { reasonKey: item.reasonKey, reasonParams: item.reasonParams }
  if (!selectedIds.has(item.id)) return null
  const unsatisfiedDependency = (item.dependencies ?? []).find(
    (dependency) => !dependency.itemId || !selectedIds.has(dependency.itemId),
  )
  return unsatisfiedDependency
    ? {
        reasonKey: unsatisfiedDependency.reasonKey,
        reasonParams: unsatisfiedDependency.reasonParams,
      }
    : null
}

export function getSelectedSettingsImportItemsForApply(
  plan: SettingsImportPlan,
  selectedIds: Set<string>,
): SettingsImportPlanItem[] {
  const selectedItems = plan.items.filter(
    (item) =>
      selectedIds.has(item.id) && item.status !== 'invalid' && getSettingsImportItemIssue(item, selectedIds) === null,
  )
  return sortImportItemsByDependencies(selectedItems)
}

function includeRequiredImportDependencies(plan: SettingsImportPlan, selectedIds: Set<string>): Set<string> {
  const itemById = importItemMap(plan)
  let changed = true
  while (changed) {
    changed = false
    for (const itemId of Array.from(selectedIds)) {
      const item = itemById.get(itemId)
      if (!item) continue
      for (const dependency of item.dependencies ?? []) {
        if (!dependency.itemId || selectedIds.has(dependency.itemId)) continue
        const dependencyItem = itemById.get(dependency.itemId)
        if (!dependencyItem || !isSettingsImportItemSelectable(dependencyItem)) continue
        selectedIds.add(dependency.itemId)
        changed = true
      }
    }
  }
  return selectedIds
}

function pruneUnsatisfiedImportDependents(plan: SettingsImportPlan, selectedIds: Set<string>): Set<string> {
  const itemById = importItemMap(plan)
  let changed = true
  while (changed) {
    changed = false
    for (const itemId of Array.from(selectedIds)) {
      const item = itemById.get(itemId)
      if (!item) {
        selectedIds.delete(itemId)
        changed = true
        continue
      }
      const unsatisfied = (item.dependencies ?? []).some(
        (dependency) => !dependency.itemId || !selectedIds.has(dependency.itemId),
      )
      if (unsatisfied || !isSettingsImportItemSelectable(item)) {
        selectedIds.delete(item.id)
        changed = true
      }
    }
  }
  return selectedIds
}

function sortImportItemsByDependencies(items: SettingsImportPlanItem[]): SettingsImportPlanItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const orderedItems: SettingsImportPlanItem[] = []
  const visitedIds = new Set<string>()
  const visitingIds = new Set<string>()

  const visit = (item: SettingsImportPlanItem) => {
    if (visitedIds.has(item.id) || visitingIds.has(item.id)) return
    visitingIds.add(item.id)
    for (const dependency of item.dependencies ?? []) {
      if (!dependency.itemId) continue
      const dependencyItem = itemById.get(dependency.itemId)
      if (dependencyItem) visit(dependencyItem)
    }
    visitingIds.delete(item.id)
    visitedIds.add(item.id)
    orderedItems.push(item)
  }

  for (const item of items) visit(item)
  return orderedItems
}

function importItemMap(plan: SettingsImportPlan): Map<string, SettingsImportPlanItem> {
  return new Map(plan.items.map((item) => [item.id, item]))
}
