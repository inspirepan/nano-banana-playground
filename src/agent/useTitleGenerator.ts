import { useCallback, useRef } from 'react'

import { generateSessionTitle, generateStackTitle } from './titleGenerator'
import { TITLE_MODEL_CONFIGS, type AgentModelConfig, type AgentModelProvider } from '../config/agentModels'
import { useLatestRef } from '../hooks/effects'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { getActiveLanguage } from '../i18n'
import { readTitleModelPreference, TITLE_MODEL_DISABLED, writeTitleModelPreference } from '../lib/preferenceStore'

export type TitleProviderCredentials = { apiKey: string; baseUrl?: string }

export type TitleModelPreference = { mode: 'disabled' } | { mode: 'auto' } | { mode: 'explicit'; modelId: string }

export type ResolvedTitleModel = { config: AgentModelConfig; credentials: TitleProviderCredentials } | null

export function parseTitleModelPreference(raw: string | null): TitleModelPreference {
  if (raw === TITLE_MODEL_DISABLED) return { mode: 'disabled' }
  if (!raw) return { mode: 'auto' }
  if (TITLE_MODEL_CONFIGS.some((item) => item.id === raw)) return { mode: 'explicit', modelId: raw }
  return { mode: 'auto' }
}

export function serializeTitleModelPreference(value: TitleModelPreference): string {
  if (value.mode === 'disabled') return TITLE_MODEL_DISABLED
  if (value.mode === 'explicit') return value.modelId
  return ''
}

function pickAutoTitleModel(
  keyStatuses: Record<AgentModelProvider, ApiKeyStatus>,
  credentials: Partial<Record<AgentModelProvider, TitleProviderCredentials>>,
): AgentModelConfig | null {
  for (const item of TITLE_MODEL_CONFIGS) {
    if (keyStatuses[item.provider] === 'valid' && credentials[item.provider]?.apiKey) return item
  }
  for (const item of TITLE_MODEL_CONFIGS) {
    if (credentials[item.provider]?.apiKey) return item
  }
  return null
}

export type UseTitleGeneratorParams = {
  keyStatuses: Record<AgentModelProvider, ApiKeyStatus>
  providerCredentials: Record<AgentModelProvider, TitleProviderCredentials>
}

export function useTitleGenerator({ keyStatuses, providerCredentials }: UseTitleGeneratorParams) {
  const preferenceRef = useRef<TitleModelPreference>(parseTitleModelPreference(readTitleModelPreference()))
  const keyStatusesRef = useLatestRef(keyStatuses)
  const credentialsRef = useLatestRef(providerCredentials)
  const abortPoolRef = useRef<Map<string, AbortController>>(new Map())

  const setTitleModelPreference = useCallback((value: TitleModelPreference) => {
    preferenceRef.current = value
    writeTitleModelPreference(serializeTitleModelPreference(value))
  }, [])

  const resolveModel = useCallback((): ResolvedTitleModel => {
    const preference = preferenceRef.current
    if (preference.mode === 'disabled') return null
    const credentials = credentialsRef.current
    let config: AgentModelConfig | null = null
    if (preference.mode === 'explicit') {
      config = TITLE_MODEL_CONFIGS.find((item) => item.id === preference.modelId) ?? null
    }
    if (!config) config = pickAutoTitleModel(keyStatusesRef.current, credentials)
    if (!config) return null
    const providerCredentials = credentials[config.provider]
    if (!providerCredentials?.apiKey) return null
    return { config, credentials: providerCredentials }
  }, [credentialsRef, keyStatusesRef])

  const cancelInflight = useCallback((dedupeKey: string) => {
    const existing = abortPoolRef.current.get(dedupeKey)
    if (existing) {
      existing.abort()
      abortPoolRef.current.delete(dedupeKey)
    }
  }, [])

  const requestStackTitle = useCallback(
    async (params: { prompt: string; dedupeKey: string }): Promise<string | null> => {
      const resolved = resolveModel()
      if (!resolved) return null
      cancelInflight(params.dedupeKey)
      const controller = new AbortController()
      abortPoolRef.current.set(params.dedupeKey, controller)
      try {
        return await generateStackTitle({
          prompt: params.prompt,
          language: getActiveLanguage(),
          model: resolved.config.model,
          apiKey: resolved.credentials.apiKey,
          baseUrl: resolved.credentials.baseUrl,
          signal: controller.signal,
        })
      } catch {
        return null
      } finally {
        if (abortPoolRef.current.get(params.dedupeKey) === controller) {
          abortPoolRef.current.delete(params.dedupeKey)
        }
      }
    },
    [cancelInflight, resolveModel],
  )

  const requestSessionTitle = useCallback(
    async (params: {
      sessionId: string
      currentUserMessage: string
      previousUserMessages: string[]
      previousTitle?: string
    }): Promise<string | null> => {
      const resolved = resolveModel()
      if (!resolved) return null
      const dedupeKey = `session:${params.sessionId}`
      cancelInflight(dedupeKey)
      const controller = new AbortController()
      abortPoolRef.current.set(dedupeKey, controller)
      try {
        return await generateSessionTitle({
          currentUserMessage: params.currentUserMessage,
          previousUserMessages: params.previousUserMessages,
          previousTitle: params.previousTitle,
          language: getActiveLanguage(),
          model: resolved.config.model,
          apiKey: resolved.credentials.apiKey,
          baseUrl: resolved.credentials.baseUrl,
          signal: controller.signal,
        })
      } catch {
        return null
      } finally {
        if (abortPoolRef.current.get(dedupeKey) === controller) {
          abortPoolRef.current.delete(dedupeKey)
        }
      }
    },
    [cancelInflight, resolveModel],
  )

  return { requestStackTitle, requestSessionTitle, setTitleModelPreference }
}

export type TitleGeneratorApi = ReturnType<typeof useTitleGenerator>
