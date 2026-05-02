import { setDefaultBaseUrls } from '@google/genai'
import { Agent, ProviderTransport, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useRef, useState } from 'react'

import { agentMessageRole, compressedAttachmentToAgentAttachment, type AgentChatAttachment } from './agentChat'
import {
  buildCompactionSummaryMessage,
  compact,
  DEFAULT_COMPACTION_SETTINGS,
  estimateContextTokens,
  shouldCompact,
} from './compaction'
import { compressImageForAgentInput } from './imageCompression'
import {
  AGENT_PROMPT_DEFAULT_LINE_LIMIT,
  formatPromptLines,
  isTerminalAgentImageTaskStatus,
  promptLineCount,
  reserveAgentImageIds,
  type AgentImageRegistryEntry,
  type AgentImageTask,
  type AgentImageTaskStatus,
  type AgentTurnCallbackState,
} from './imageTasks'
import {
  appendAgentSessionMessage,
  createAgentSessionRecord,
  deleteAgentSession,
  listAgentSessions,
  loadAgentSession,
  saveAgentSessionSidecar,
  updateAgentSessionConfig,
} from './sessionStore'
import type { AgentCompactionState, AgentSessionMessageMetadata, AgentSessionSummary } from './sessionTypes'
import { buildAvailableSkillsSystemMessage } from './skills/listing'
import {
  createAgentSkill,
  deleteAgentSkill as deleteAgentSkillFromRegistry,
  findAgentSkill,
  getAgentSkillSummaries,
  setAgentSkillEnabled as setAgentSkillEnabledInRegistry,
} from './skills/registry'
import type { AgentSkill, AgentSkillCreateInput, AgentSkillSummary } from './skills/types'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import {
  createAgentTools,
  formatAskUserQuestionResult,
  formatLoadedSkillText,
  formatReadSkillFileResult,
  runWebFetch,
  type AgentToolResult,
  type AskUserQuestionAnswer,
  type AskUserQuestionItem,
  type AskUserQuestionToolArgs,
  type CreateSkillToolArgs,
  type GenImageToolArgs,
  type ReadImageToolArgs,
  type ReadSkillFileToolArgs,
  type SkillToolArgs,
  type WebFetchToolArgs,
} from './tools'
import {
  AGENT_MODEL_CONFIGS,
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import {
  getPreferredAgentModelId,
  getPreferredAgentThinkingLevel,
  setPreferredAgentModelId,
  setPreferredAgentThinkingLevel,
} from '../config/agentPreferences'
import type { Language } from '../config/languages'
import { MODEL_CONFIGS, defaultOptionsFor, type ModelConfig } from '../config/models'
import { getPreferredImageModelId } from '../config/preferredImageModel'
import { getProviderConfig } from '../config/providers'
import { useExternalSync, useMountEffect } from '../hooks/effects'
import type { useApiKey } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import { putBlobInCache, getBlobFromCache } from '../hooks/useImageSrc'
import { getActiveLanguage, translate } from '../i18n'
import { readFileAsImageData } from '../lib/fileToImage'
import { loadImageBlob, loadImageMetas } from '../lib/history'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { isKeyError, resolveBaseUrl } from '../lib/validateKey'

const AGENT_MAX_ATTACHMENTS = 8
const TRAILING_GEMINI_API_VERSION = /\/v\d+(?:alpha|beta)?\/*$/i

function syncGeminiAgentBaseUrl(provider: AgentModelProvider, baseUrl: string): void {
  if (provider !== 'google') return
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    setDefaultBaseUrls({ geminiUrl: undefined })
    return
  }
  const sdkBaseUrl = resolveBaseUrl('google', trimmed).replace(TRAILING_GEMINI_API_VERSION, '')
  setDefaultBaseUrls({ geminiUrl: sdkBaseUrl })
}

function buildLanguageDirective(language: Language): string {
  const instruction =
    language === 'en' ? 'Reply to the user in English.' : 'Reply to the user in Simplified Chinese (简体中文).'
  return `<system>${instruction}</system>`
}

function buildPreferredImageModelDirective(): string | null {
  const id = getPreferredImageModelId()
  if (!id) return null
  const model = MODEL_CONFIGS.find((item) => item.id === id)
  if (!model) return null
  return `<system>The user prefers "${model.name}" (model id: ${model.id}) for image generation. Use this model for GenImage tool calls unless the user explicitly asks for a different one.</system>`
}

function agentMessageMetadataForModel(modelId: string): AgentSessionMessageMetadata {
  const config = resolveAgentModelConfig(modelId)
  return { modelId: config.id, modelTitle: config.shortLabel }
}

const AGENT_TASK_PROTOCOL_MESSAGES = {
  autoStarted: 'The task has been submitted and automatically started generation.',
  failedToStart: 'The task was submitted but could not start generation.',
  pending: 'The task has been submitted and is waiting for user approval.',
  pendingWithReserved: (ids: string[]) =>
    `The task has been submitted and is waiting for user approval. image_id has been reserved as ${ids.join(', ')}.`,
} as const

type ApiKeyHook = ReturnType<typeof useApiKey>
type ProviderCredentials = { apiKey: string; baseUrl: string }

function isAgentModelProvider(provider: string): provider is AgentModelProvider {
  return provider === 'google' || provider === 'openai' || provider === 'anthropic' || provider === 'deepseek'
}

export type UseAgentPlaygroundParams = {
  initialSessionId: string | null
  keyHooks: Record<AgentModelProvider, ApiKeyHook>
  referenceImages: PlaygroundImage[]
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  getProviderCredentials: (provider: ModelConfig['provider']) => ProviderCredentials
  invalidateGenerationKey: (provider: AgentModelProvider) => void
  enqueueGenerationJob: (
    request: GenerationJob['request'],
    batchCount: number,
    stackId: string,
    parentImageId?: string,
  ) => string
  cancelGenerationJob: (jobId: string) => void
  dismissGenerationJob: (jobId: string) => void
}

function normalizeModelLookupKey(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

function findModelConfig(modelId: string): ModelConfig | null {
  const direct = MODEL_CONFIGS.find((item) => item.id === modelId)
  if (direct) return direct
  const normalized = normalizeModelLookupKey(modelId)
  if (!normalized) return null
  return MODEL_CONFIGS.find((item) => normalizeModelLookupKey(item.id) === normalized) ?? null
}

function normalizeResolution(model: ModelConfig, resolution: string): string {
  return model.resolutions.includes(resolution) ? resolution : model.defaultResolution
}

function normalizeAspectRatio(model: ModelConfig, aspectRatio: string): string {
  return model.aspectRatios.includes(aspectRatio) ? aspectRatio : model.defaultAspectRatio
}

function stableStringify(value: unknown): string {
  if (value === undefined) return '"__undefined__"'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function hashString(value: string): string {
  let a = 0x811c9dc5
  let b = 0x45d9f3b
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    a ^= code
    a = Math.imul(a, 0x01000193)
    b ^= code
    b = Math.imul(b, 0x1000193)
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function stackIdForGenerationRequest(params: {
  model: ModelConfig
  prompt: string
  referenceImages: PlaygroundImage[]
  resolution: string
  aspectRatio: string
  options: Record<string, unknown>
  batchCount: number
}): string {
  const payload = {
    version: 1,
    date: localDateKey(),
    modelId: params.model.id,
    prompt: params.prompt,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
    batchCount: params.batchCount,
    options: params.options,
    referenceImages: params.referenceImages.map((image) => ({
      mimeType: image.mimeType,
      dataHash: hashString(image.data),
    })),
  }

  return `stack-${hashString(stableStringify(payload))}`
}

function agentStateValue(agent: Agent, key: 'streamingMessage' | 'streamMessage' | 'errorMessage' | 'error'): unknown {
  return (agent.state as unknown as Record<string, unknown>)[key]
}

function getAgentStreamingMessage(agent: Agent): AgentMessage | null {
  const value = agentStateValue(agent, 'streamingMessage') ?? agentStateValue(agent, 'streamMessage')
  return value && typeof value === 'object' ? (value as AgentMessage) : null
}

function getAgentError(agent: Agent): string | null {
  const value = agentStateValue(agent, 'errorMessage') ?? agentStateValue(agent, 'error')
  return typeof value === 'string' ? value : null
}

function activeOptionsForModel(model: ModelConfig, source: Record<string, unknown>): Record<string, unknown> {
  const activeOptions: Record<string, unknown> = {}
  for (const opt of model.options ?? []) activeOptions[opt.id] = opt.id in source ? source[opt.id] : opt.default
  return activeOptions
}

function agentTaskStatusFromGenerationJob(job: GenerationJob): AgentImageTaskStatus {
  if (job.status === 'completed') return 'completed'
  if (job.status === 'canceled') return 'canceled'
  if (job.status === 'failed' || job.status === 'partial_failed') return 'failed'
  if (job.slots.some((slot) => slot.status === 'running' || slot.status === 'retrying')) return 'running'
  return 'queued'
}

function errorFromGenerationJob(job: GenerationJob): string | undefined {
  return job.slots.find((slot) => slot.error)?.error
}

function noteForAgentTaskStatus(status: AgentImageTask['status']): string | undefined {
  switch (status) {
    case 'rejected':
      return 'The human user manually clicked the Reject button in the approval UI to decline this image task before any generation began. This is purely a user decision — there was NO content policy violation, NO safety filter, and NO system-side rejection. Do not apologize for safety reasons or assume the prompt was problematic. Ask the user what they want to change (subject, style, parameters, etc.) before proposing another task.'
    case 'canceled':
      return 'The image generation was interrupted or canceled before all requested images were produced. This does NOT necessarily mean the human user clicked Cancel. If an error line is present, use it as the reason. Do not ask why the user canceled unless the error explicitly says it was a manual cancellation.'
    case 'failed':
      return 'The image generation failed due to a technical or service-side error (network, model API, etc.). The error message is included above. This is not a user rejection.'
    default:
      return undefined
  }
}

function buildAgentTaskCallbackText(tasks: AgentImageTask[]): string {
  const lines = ['<system>']
  for (const task of tasks) {
    lines.push(`tool GenImage call ${task.toolCallId} has been finished.`)
    lines.push(`status: ${task.status}`)
    lines.push(`requested_image_id: ${task.request.requestedImageId}`)
    lines.push(`reserved_image_ids: ${task.request.reservedImageIds.join(', ')}`)
    lines.push(`image_ids: ${task.resultImageIds.join(', ')}`)
    if (task.error) lines.push(`error: ${task.error}`)
    const note = noteForAgentTaskStatus(task.status)
    if (note) lines.push(`note: ${note}`)
    lines.push('')
  }
  if (lines[lines.length - 1] === '') lines.pop()
  lines.push('</system>')
  return lines.join('\n')
}

function toolTextResult(text: string, details: unknown): AgentToolResult {
  return { content: [{ type: 'text', text }], details }
}

export type AgentPendingQuestion = {
  toolCallId: string
  agentTurnId: string
  questions: AskUserQuestionItem[]
  createdAt: number
}

type AgentQuestionResolver = {
  resolve: (result: AgentToolResult) => void
  reject: (reason: unknown) => void
  questions: AskUserQuestionItem[]
}

type AgentSessionRuntime = {
  sessionId: string
  persisted: boolean
  agent: Agent
  ready: boolean
  modelId: string
  thinkingLevel: AgentThinkingLevel
  autoApproveImageTasks: boolean
  messages: AgentMessage[]
  streamingMessage: AgentMessage | null
  isStreaming: boolean
  error: string | null
  draft: string
  attachments: AgentChatAttachment[]
  attachmentError: string | null
  imageTasks: AgentImageTask[]
  imageRegistry: Map<string, AgentImageRegistryEntry>
  turnCallbacks: Map<string, AgentTurnCallbackState>
  currentAgentTurnId: string | null
  leafEntryId: string | null
  pendingQuestions: AgentPendingQuestion[]
  questionResolvers: Map<string, AgentQuestionResolver>
  persistQueue: Promise<void>
  sidecarPersistQueue: Promise<void>
  sidecarDebounce: number
  promptPreparing: boolean
  messageEntryIds: WeakMap<AgentMessage, string>
  messageMetadata: WeakMap<AgentMessage, AgentSessionMessageMetadata>
  activeResponseMetadata: AgentSessionMessageMetadata | undefined
  queuedResponseMetadata: AgentSessionMessageMetadata[]
  lastCompaction: AgentCompactionState | undefined
  isCompacting: boolean
  compactionAbort: AbortController | null
}

function activateAgentResponseMetadata(
  runtime: AgentSessionRuntime,
  modelId = runtime.modelId,
): AgentSessionMessageMetadata {
  const metadata = agentMessageMetadataForModel(modelId)
  runtime.activeResponseMetadata = metadata
  return metadata
}

function queueAgentResponseMetadata(runtime: AgentSessionRuntime, modelId = runtime.modelId): void {
  runtime.queuedResponseMetadata.push(agentMessageMetadataForModel(modelId))
}

function metadataForAgentMessage(
  runtime: AgentSessionRuntime,
  message: AgentMessage,
): AgentSessionMessageMetadata | undefined {
  if (agentMessageRole(message) !== 'assistant') return undefined
  const existing = runtime.messageMetadata.get(message)
  if (existing) return existing
  const metadata = runtime.activeResponseMetadata ?? agentMessageMetadataForModel(runtime.modelId)
  runtime.messageMetadata.set(message, metadata)
  return metadata
}

function findDanglingToolCallIds(messages: AgentMessage[]): Set<string> {
  const fulfilled = new Set<string>()
  const all = new Set<string>()
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) continue
    const record = message as unknown as Record<string, unknown>
    if (record.role === 'assistant' && Array.isArray(record.content)) {
      for (const part of record.content) {
        if (typeof part !== 'object' || part === null) continue
        const partRecord = part as Record<string, unknown>
        if (partRecord.type === 'toolCall' && typeof partRecord.id === 'string') all.add(partRecord.id)
      }
    }
    if (record.role === 'toolResult' && typeof record.toolCallId === 'string') fulfilled.add(record.toolCallId)
  }
  for (const id of fulfilled) all.delete(id)
  return all
}

function buildAbandonedToolResult(toolCallId: string, toolName: string): AgentMessage {
  return {
    role: 'toolResult',
    toolCallId,
    toolName,
    content: [
      {
        type: 'text',
        text: '<system>The user navigated away or refreshed before answering. Re-ask if still needed.</system>',
      },
    ],
    isError: false,
    timestamp: Date.now(),
  } as unknown as AgentMessage
}

function injectAbandonedToolResults(messages: AgentMessage[], skipIds?: Set<string>): AgentMessage[] {
  const dangling = findDanglingToolCallIds(messages)
  if (skipIds) for (const id of skipIds) dangling.delete(id)
  if (dangling.size === 0) return messages

  const result: AgentMessage[] = []
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    result.push(message)
    if (typeof message !== 'object' || message === null) continue
    const record = message as unknown as Record<string, unknown>
    if (record.role !== 'assistant' || !Array.isArray(record.content)) continue
    for (const part of record.content) {
      if (typeof part !== 'object' || part === null) continue
      const partRecord = part as Record<string, unknown>
      if (partRecord.type !== 'toolCall') continue
      const id = typeof partRecord.id === 'string' ? partRecord.id : null
      const name = typeof partRecord.name === 'string' ? partRecord.name : null
      if (!id || !name || !dangling.has(id)) continue
      result.push(buildAbandonedToolResult(id, name))
    }
  }
  return result
}

function restoreAgentImageTasks(tasks: AgentImageTask[]): AgentImageTask[] {
  return tasks.map((task) => {
    if (task.status !== 'approved' && task.status !== 'queued' && task.status !== 'running') return task
    return {
      ...task,
      status: 'failed',
      error: task.error ?? translate('configLib.agent.taskInterrupted'),
    }
  })
}

export function useAgentPlayground({
  initialSessionId,
  keyHooks,
  referenceImages,
  history,
  generationJobs,
  getProviderCredentials,
  invalidateGenerationKey,
  enqueueGenerationJob,
  cancelGenerationJob,
  dismissGenerationJob,
}: UseAgentPlaygroundParams) {
  const [agentModelId, setAgentModelId] = useState(getPreferredAgentModelId)
  const agentModel = resolveAgentModelConfig(agentModelId)
  const [agentThinkingLevel, setAgentThinkingLevelState] = useState<AgentThinkingLevel>(getPreferredAgentThinkingLevel)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentMessageMetadata, setAgentMessageMetadata] = useState(
    () => new WeakMap<AgentMessage, AgentSessionMessageMetadata>(),
  )
  const [agentStreamingMessage, setAgentStreamingMessage] = useState<AgentMessage | null>(null)
  const [agentIsStreaming, setAgentIsStreaming] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentDraft, setAgentDraft] = useState('')
  const [agentAttachments, setAgentAttachments] = useState<AgentChatAttachment[]>([])
  const [agentAttachmentError, setAgentAttachmentError] = useState<string | null>(null)
  const [autoApproveAgentImageTasks, setAutoApproveAgentImageTasksState] = useState(false)
  const [agentImageTasks, setAgentImageTasksState] = useState<AgentImageTask[]>([])
  const [agentPendingQuestions, setAgentPendingQuestionsState] = useState<AgentPendingQuestion[]>([])
  const [agentSkills, setAgentSkillsState] = useState<AgentSkillSummary[]>(getAgentSkillSummaries)
  const [agentSessions, setAgentSessions] = useState<AgentSessionSummary[]>([])
  const [currentAgentSessionId, setCurrentAgentSessionId] = useState<string | null>(null)
  const [agentSessionsLoading, setAgentSessionsLoading] = useState(true)

  const agentRuntimesRef = useRef<Map<string, AgentSessionRuntime>>(new Map())
  const agentImageReservationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const agentPendingReservedImageIdsRef = useRef<Set<string>>(new Set())
  const currentAgentSessionIdRef = useRef<string | null>(null)
  const referenceImagesRef = useRef<PlaygroundImage[]>([])
  const historyRef = useRef<PlaygroundImageMeta[]>([])
  const generationJobsRefForAgent = useRef<GenerationJob[]>([])
  const agentCredentialsRef = useRef<Record<AgentModelProvider, ProviderCredentials>>({
    google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
    openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
    anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
    deepseek: { apiKey: keyHooks.deepseek.apiKey, baseUrl: keyHooks.deepseek.baseUrl },
  })
  const agentToolHandlersRef = useRef<{
    genImage: (
      sessionId: string,
      toolCallId: string,
      args: GenImageToolArgs,
      signal?: AbortSignal,
    ) => Promise<AgentToolResult>
    readImage: (sessionId: string, toolCallId: string, args: ReadImageToolArgs) => Promise<AgentToolResult>
    askUserQuestion: (
      sessionId: string,
      toolCallId: string,
      args: AskUserQuestionToolArgs,
      signal?: AbortSignal,
    ) => Promise<AgentToolResult>
    loadSkill: (sessionId: string, toolCallId: string, args: SkillToolArgs) => Promise<AgentToolResult>
    readSkillFile: (sessionId: string, toolCallId: string, args: ReadSkillFileToolArgs) => Promise<AgentToolResult>
    createSkill: (sessionId: string, toolCallId: string, args: CreateSkillToolArgs) => Promise<AgentToolResult>
    webFetch: (
      sessionId: string,
      toolCallId: string,
      args: WebFetchToolArgs,
      signal?: AbortSignal,
    ) => Promise<AgentToolResult>
  }>({
    genImage: async (_sessionId: string, _toolCallId: string, _args: GenImageToolArgs, _signal?: AbortSignal) => {
      throw new Error('Agent tools are not ready yet.')
    },
    readImage: async (_sessionId: string, _toolCallId: string, _args: ReadImageToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    askUserQuestion: (_sessionId: string, _toolCallId: string, _args: AskUserQuestionToolArgs, _signal?: AbortSignal) =>
      Promise.reject(new Error('Agent tools are not ready yet.')),
    loadSkill: async (_sessionId: string, _toolCallId: string, _args: SkillToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    readSkillFile: async (_sessionId: string, _toolCallId: string, _args: ReadSkillFileToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    createSkill: async (_sessionId: string, _toolCallId: string, _args: CreateSkillToolArgs) => {
      throw new Error('Agent tools are not ready yet.')
    },
    webFetch: async (_sessionId: string, _toolCallId: string, _args: WebFetchToolArgs, _signal?: AbortSignal) => {
      throw new Error('Agent tools are not ready yet.')
    },
  })

  useExternalSync(() => {
    agentCredentialsRef.current = {
      google: { apiKey: keyHooks.google.apiKey, baseUrl: keyHooks.google.baseUrl },
      openai: { apiKey: keyHooks.openai.apiKey, baseUrl: keyHooks.openai.baseUrl },
      anthropic: { apiKey: keyHooks.anthropic.apiKey, baseUrl: keyHooks.anthropic.baseUrl },
      deepseek: { apiKey: keyHooks.deepseek.apiKey, baseUrl: keyHooks.deepseek.baseUrl },
    }
  }, [
    keyHooks.anthropic.apiKey,
    keyHooks.anthropic.baseUrl,
    keyHooks.deepseek.apiKey,
    keyHooks.deepseek.baseUrl,
    keyHooks.google.apiKey,
    keyHooks.google.baseUrl,
    keyHooks.openai.apiKey,
    keyHooks.openai.baseUrl,
  ])

  const upsertAgentSessionSummary = useCallback((record: AgentSessionSummary) => {
    setAgentSessions((prev) =>
      record.messageCount > 0
        ? [record, ...prev.filter((item) => item.id !== record.id)].sort((a, b) => b.updatedAt - a.updatedAt)
        : prev.filter((item) => item.id !== record.id),
    )
  }, [])

  const getCurrentRuntime = useCallback((): AgentSessionRuntime | null => {
    const sessionId = currentAgentSessionIdRef.current
    return sessionId ? (agentRuntimesRef.current.get(sessionId) ?? null) : null
  }, [])

  const isCurrentRuntime = useCallback((runtime: AgentSessionRuntime) => {
    return runtime.sessionId === currentAgentSessionIdRef.current
  }, [])

  const projectRuntimeToUi = useCallback((runtime: AgentSessionRuntime) => {
    currentAgentSessionIdRef.current = runtime.sessionId
    setCurrentAgentSessionId(runtime.persisted ? runtime.sessionId : null)
    setAgentModelId(runtime.modelId)
    setAgentThinkingLevelState(runtime.thinkingLevel)
    setAutoApproveAgentImageTasksState(runtime.autoApproveImageTasks)
    setAgentMessages(runtime.messages)
    setAgentMessageMetadata(runtime.messageMetadata)
    setAgentStreamingMessage(runtime.streamingMessage)
    setAgentIsStreaming(runtime.isStreaming)
    setAgentError(runtime.error)
    setAgentDraft(runtime.draft)
    setAgentAttachments(runtime.attachments)
    setAgentAttachmentError(runtime.attachmentError)
    setAgentImageTasksState(runtime.imageTasks)
    setAgentPendingQuestionsState(runtime.pendingQuestions)
  }, [])

  const setRuntimeError = useCallback(
    (runtime: AgentSessionRuntime, message: string | null) => {
      runtime.error = message
      if (isCurrentRuntime(runtime)) setAgentError(message)
    },
    [isCurrentRuntime],
  )

  const maybeRunRuntimeCompactionRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})
  const maybeDispatchAgentImageCallbacksRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})

  const persistRuntimeSidecar = useCallback((runtime: AgentSessionRuntime) => {
    if (!runtime.ready || !runtime.persisted) return Promise.resolve()
    const payload = {
      sessionId: runtime.sessionId,
      draft: runtime.draft,
      attachments: runtime.attachments,
      imageTasks: runtime.imageTasks,
      imageRegistry: Array.from(runtime.imageRegistry.values()),
      turnCallbacks: Array.from(runtime.turnCallbacks.values()),
      currentAgentTurnId: runtime.currentAgentTurnId,
      pendingQuestions: runtime.pendingQuestions,
      lastCompaction: runtime.lastCompaction,
    }
    const write = runtime.sidecarPersistQueue.then(() => saveAgentSessionSidecar(payload))
    runtime.sidecarPersistQueue = write.catch(() => undefined)
    return write.catch(() => undefined)
  }, [])

  const scheduleRuntimeSidecarPersist = useCallback(
    (runtime: AgentSessionRuntime) => {
      if (!runtime.ready) return
      window.clearTimeout(runtime.sidecarDebounce)
      runtime.sidecarDebounce = window.setTimeout(() => {
        void persistRuntimeSidecar(runtime)
      }, 400)
    },
    [persistRuntimeSidecar],
  )

  const flushRuntime = useCallback(
    async (runtime: AgentSessionRuntime | null) => {
      if (!runtime) return
      window.clearTimeout(runtime.sidecarDebounce)
      await runtime.persistQueue
      await persistRuntimeSidecar(runtime)
      await runtime.sidecarPersistQueue
    },
    [persistRuntimeSidecar],
  )

  const setRuntimeImageTasks = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentImageTask[]) => AgentImageTask[]) => {
      const next = updater(runtime.imageTasks)
      runtime.imageTasks = next
      if (isCurrentRuntime(runtime)) setAgentImageTasksState(next)
      scheduleRuntimeSidecarPersist(runtime)
      return next
    },
    [isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const setRuntimePendingQuestions = useCallback(
    (runtime: AgentSessionRuntime, updater: (prev: AgentPendingQuestion[]) => AgentPendingQuestion[]) => {
      const next = updater(runtime.pendingQuestions)
      runtime.pendingQuestions = next
      if (isCurrentRuntime(runtime)) setAgentPendingQuestionsState(next)
      scheduleRuntimeSidecarPersist(runtime)
      return next
    },
    [isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const clearRuntimeQuestionResolvers = useCallback(
    (runtime: AgentSessionRuntime, reason: string) => {
      if (runtime.questionResolvers.size === 0) return
      for (const [, resolver] of runtime.questionResolvers) {
        try {
          resolver.resolve(
            toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
              status: 'cancelled',
              reason,
            }),
          )
        } catch {
          // Ignore — caller may have moved on.
        }
      }
      runtime.questionResolvers.clear()
      setRuntimePendingQuestions(runtime, () => [])
    },
    [setRuntimePendingQuestions],
  )

  useExternalSync(() => {
    referenceImagesRef.current = referenceImages
  }, [referenceImages])

  useExternalSync(() => {
    historyRef.current = history
  }, [history])

  useExternalSync(() => {
    generationJobsRefForAgent.current = generationJobs
  }, [generationJobs])

  const getAgentBaseUrl = useCallback(
    (provider: AgentModelProvider) => agentCredentialsRef.current[provider].baseUrl,
    [],
  )

  const setAgentModelIdForSession = useCallback(
    (modelId: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.modelId = modelId
      setAgentModelId(modelId)
      setPreferredAgentModelId(modelId)
      const config = resolveAgentModelConfig(modelId)
      runtime.agent.state.model = agentModelWithBaseUrl(config, getAgentBaseUrl(config.provider))
      runtime.agent.state.thinkingLevel = config.supportsThinking ? runtime.thinkingLevel : 'off'
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { modelId }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [getAgentBaseUrl, getCurrentRuntime, upsertAgentSessionSummary],
  )

  const setAgentThinkingLevel = useCallback(
    (level: AgentThinkingLevel) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.thinkingLevel = level
      setAgentThinkingLevelState(level)
      setPreferredAgentThinkingLevel(level)
      const config = resolveAgentModelConfig(runtime.modelId)
      runtime.agent.state.thinkingLevel = config.supportsThinking ? level : 'off'
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { thinkingLevel: level }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [getCurrentRuntime, upsertAgentSessionSummary],
  )

  const syncRuntimeSnapshot = useCallback(
    (runtime: AgentSessionRuntime) => {
      runtime.messages = runtime.agent.state.messages.slice()
      runtime.streamingMessage = getAgentStreamingMessage(runtime.agent)
      if (runtime.streamingMessage) metadataForAgentMessage(runtime, runtime.streamingMessage)
      runtime.isStreaming = runtime.agent.state.isStreaming || runtime.isCompacting
      runtime.error = getAgentError(runtime.agent)
      if (!isCurrentRuntime(runtime)) return
      setAgentMessages(runtime.messages)
      setAgentMessageMetadata(runtime.messageMetadata)
      setAgentStreamingMessage(runtime.streamingMessage)
      setAgentIsStreaming(runtime.isStreaming)
      setAgentError(runtime.error)
    },
    [isCurrentRuntime],
  )

  const applyAgentRuntimeConfig = useCallback(
    (runtime: AgentSessionRuntime) => {
      const config = resolveAgentModelConfig(runtime.modelId)
      const baseUrl = getAgentBaseUrl(config.provider)
      syncGeminiAgentBaseUrl(config.provider, baseUrl)
      runtime.agent.state.systemPrompt = AGENT_SYSTEM_PROMPT
      runtime.agent.state.model = agentModelWithBaseUrl(config, baseUrl)
      runtime.agent.state.thinkingLevel = config.supportsThinking ? runtime.thinkingLevel : 'off'
      runtime.agent.state.tools = createAgentTools({
        imageModels: MODEL_CONFIGS,
        genImage: (toolCallId, args, signal) =>
          agentToolHandlersRef.current.genImage(runtime.sessionId, toolCallId, args, signal),
        readImage: (toolCallId, args) => agentToolHandlersRef.current.readImage(runtime.sessionId, toolCallId, args),
        askUserQuestion: (toolCallId, args, signal) =>
          agentToolHandlersRef.current.askUserQuestion(runtime.sessionId, toolCallId, args, signal),
        loadSkill: (toolCallId, args) => agentToolHandlersRef.current.loadSkill(runtime.sessionId, toolCallId, args),
        readSkillFile: (toolCallId, args) =>
          agentToolHandlersRef.current.readSkillFile(runtime.sessionId, toolCallId, args),
        createSkill: (toolCallId, args) =>
          agentToolHandlersRef.current.createSkill(runtime.sessionId, toolCallId, args),
        webFetch: (toolCallId, args, signal) =>
          agentToolHandlersRef.current.webFetch(runtime.sessionId, toolCallId, args, signal),
      })
    },
    [getAgentBaseUrl],
  )

  const runRuntimeCompaction = useCallback(
    async (runtime: AgentSessionRuntime) => {
      if (runtime.isCompacting || runtime.agent.state.isStreaming) return
      if (!runtime.ready) return
      if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return

      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) return

      const model = agentModelWithBaseUrl(config, credentials.baseUrl)
      const contextWindow = model.contextWindow ?? 0
      if (contextWindow <= 0) return

      // Trust assistant usage only when its timestamp is later than the last
      // compaction — otherwise the message still carries pre-compaction
      // usage.totalTokens and would falsely re-trigger compaction every turn.
      const minUsageTimestamp = runtime.lastCompaction?.createdAt ?? 0
      const settings = DEFAULT_COMPACTION_SETTINGS
      const preflightMessages = runtime.agent.state.messages
      if (preflightMessages.length === 0) return
      const preflightTokens = estimateContextTokens(preflightMessages, { minUsageTimestamp }).tokens
      if (!shouldCompact(preflightTokens, contextWindow, settings)) return

      // Acquire the compaction lock BEFORE awaiting persistence so that
      // sendAgentMessage / image callbacks / system events that all guard on
      // `isCompacting` cannot start a new prompt during the await window.
      runtime.isCompacting = true
      const abortController = new AbortController()
      runtime.compactionAbort = abortController
      // Use syncRuntimeSnapshot (not just setAgentIsStreaming) so runtime.isStreaming
      // also reflects the lock — otherwise the next sendAgentMessage would read the
      // stale runtime field and take the in-flight queueMessage path instead of prompt.
      syncRuntimeSnapshot(runtime)

      let compactionErrorMessage: string | null = null
      try {
        await runtime.persistQueue.catch(() => undefined)

        // Re-confirm runtime is still alive and idle. The await above can yield
        // long enough for the session to be deleted, swapped, or for some path
        // we did not lock to push the agent into a new turn.
        if (!runtime.ready) return
        if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return
        if (runtime.agent.state.isStreaming) return

        const messages = runtime.agent.state.messages.slice()
        if (messages.length === 0) return
        // If nothing changed during the await, the preflight estimate is still valid;
        // otherwise recompute on the latest snapshot.
        const sameAsPreflight =
          messages.length === preflightMessages.length &&
          messages[messages.length - 1] === preflightMessages[preflightMessages.length - 1]
        const contextTokens = sameAsPreflight
          ? preflightTokens
          : estimateContextTokens(messages, { minUsageTimestamp }).tokens
        if (!shouldCompact(contextTokens, contextWindow, settings)) return

        const previousSummary = runtime.lastCompaction?.summary
        const ignoreLeadingCount = previousSummary && messages.length > 0 ? 1 : 0

        const result = await compact({
          messages,
          settings,
          model,
          apiKey: credentials.apiKey,
          previousSummary,
          ignoreLeadingCount,
          tokensBefore: contextTokens,
          signal: abortController.signal,
        })
        if (!result) return
        if (!runtime.ready) return
        if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return

        // If user has appended new messages while we were summarizing, snap firstKeptIndex
        // forward proportionally so we don't drop those new messages.
        const liveMessages = runtime.agent.state.messages
        const drift = liveMessages.length - messages.length
        if (drift < 0) return // messages got truncated externally; bail
        const liveFirstKeptIndex = Math.min(result.firstKeptIndex, liveMessages.length)
        if (liveFirstKeptIndex <= 0) return

        const firstKeptMessage = liveMessages[liveFirstKeptIndex]
        if (!firstKeptMessage) return
        let firstKeptEntryId: string | undefined
        for (let i = liveFirstKeptIndex; i < liveMessages.length; i++) {
          const candidate = liveMessages[i]
          const id = runtime.messageEntryIds.get(candidate)
          if (id) {
            firstKeptEntryId = id
            break
          }
        }
        if (!firstKeptEntryId) return // nothing reliably persisted; skip this round

        const summaryMessage = buildCompactionSummaryMessage(result.summary)
        const keptMessages = liveMessages.slice(liveFirstKeptIndex)
        const nextMessages = [summaryMessage, ...keptMessages]

        runtime.agent.replaceMessages(nextMessages)
        runtime.lastCompaction = {
          summary: result.summary,
          firstKeptEntryId,
          tokensBefore: result.tokensBefore,
          createdAt: Date.now(),
        }

        // syncRuntimeSnapshot will copy agent.state.messages into runtime.messages
        // and push it to React state — no need to assign runtime.messages manually.
        syncRuntimeSnapshot(runtime)
        await persistRuntimeSidecar(runtime)
      } catch (error) {
        if (abortController.signal.aborted) return
        // Compaction failure should not break the user's session — log via runtime error
        // surface but keep messages intact. Stash the message and apply it AFTER
        // syncRuntimeSnapshot in finally so the snapshot does not overwrite it
        // with agent.state.error (which is unrelated to the summarization call).
        compactionErrorMessage = error instanceof Error ? error.message : String(error)
      } finally {
        runtime.isCompacting = false
        runtime.compactionAbort = null
        // Re-sync so runtime.isStreaming returns to agent.state.isStreaming.
        // setAgentIsStreaming alone would only update React state, leaving
        // runtime.isStreaming stuck at true and breaking the next sendAgentMessage.
        syncRuntimeSnapshot(runtime)
        if (compactionErrorMessage !== null) setRuntimeError(runtime, compactionErrorMessage)
        // Image task callbacks that arrived during compaction are skipped at
        // dispatch time; drain once now so the agent receives any deferred
        // "image finished" system events even if no further job updates fire.
        // Skip if the runtime was deleted or replaced — otherwise we could
        // dispatch onto a torn-down session.
        if (runtime.ready && agentRuntimesRef.current.get(runtime.sessionId) === runtime) {
          maybeDispatchAgentImageCallbacksRef.current(runtime)
        }
      }
    },
    [persistRuntimeSidecar, setRuntimeError, syncRuntimeSnapshot],
  )

  useExternalSync(() => {
    maybeRunRuntimeCompactionRef.current = (runtime) => {
      void runRuntimeCompaction(runtime)
    }
  }, [runRuntimeCompaction])

  const createRuntime = useCallback(
    (params: {
      sessionId: string
      persisted: boolean
      modelId: string
      thinkingLevel: AgentThinkingLevel
      autoApproveImageTasks: boolean
      leafEntryId: string | null
      messages: AgentMessage[]
      messageEntryIds: string[]
      messageMetadata: AgentSessionMessageMetadata[]
      lastCompaction?: AgentCompactionState
      draft: string
      attachments: AgentChatAttachment[]
      imageTasks: AgentImageTask[]
      imageRegistry: AgentImageRegistryEntry[]
      turnCallbacks: AgentTurnCallbackState[]
      currentAgentTurnId: string | null
      pendingQuestions: AgentPendingQuestion[]
    }): AgentSessionRuntime => {
      const config = resolveAgentModelConfig(params.modelId)
      const agent = new Agent({
        transport: new ProviderTransport({
          getApiKey: (provider) => {
            if (isAgentModelProvider(provider)) {
              return agentCredentialsRef.current[provider].apiKey || undefined
            }
            return undefined
          },
        }),
        initialState: {
          systemPrompt: AGENT_SYSTEM_PROMPT,
          model: agentModelWithBaseUrl(config, getAgentBaseUrl(config.provider)),
          thinkingLevel: config.supportsThinking ? params.thinkingLevel : 'off',
          tools: [],
          messages: params.messages,
        },
      })
      const messageEntryIds = new WeakMap<AgentMessage, string>()
      const messageMetadata = new WeakMap<AgentMessage, AgentSessionMessageMetadata>()
      const limit = Math.min(params.messages.length, params.messageEntryIds.length)
      for (let i = 0; i < limit; i++) {
        const message = params.messages[i]
        const entryId = params.messageEntryIds[i]
        if (message && typeof entryId === 'string' && entryId) messageEntryIds.set(message, entryId)
        const metadata = params.messageMetadata[i]
        if (message && metadata) messageMetadata.set(message, metadata)
      }

      const runtime: AgentSessionRuntime = {
        sessionId: params.sessionId,
        persisted: params.persisted,
        agent,
        ready: false,
        modelId: params.modelId,
        thinkingLevel: params.thinkingLevel,
        autoApproveImageTasks: params.autoApproveImageTasks,
        messages: params.messages,
        streamingMessage: null,
        isStreaming: false,
        error: null,
        draft: params.draft,
        attachments: params.attachments,
        attachmentError: null,
        imageTasks: params.imageTasks,
        imageRegistry: new Map(params.imageRegistry.map((entry) => [entry.id, entry])),
        turnCallbacks: new Map(params.turnCallbacks.map((callback) => [callback.agentTurnId, callback])),
        currentAgentTurnId: params.currentAgentTurnId,
        leafEntryId: params.leafEntryId,
        pendingQuestions: params.pendingQuestions,
        questionResolvers: new Map(),
        persistQueue: Promise.resolve(),
        sidecarPersistQueue: Promise.resolve(),
        sidecarDebounce: 0,
        promptPreparing: false,
        messageEntryIds,
        messageMetadata,
        activeResponseMetadata: undefined,
        queuedResponseMetadata: [],
        lastCompaction: params.lastCompaction,
        isCompacting: false,
        compactionAbort: null,
      }
      agent.subscribe((event) => {
        if (event.type === 'message_end') {
          metadataForAgentMessage(runtime, event.message)
        }
        syncRuntimeSnapshot(runtime)
        if (event.type === 'message_end') {
          const persistedMessage = event.message
          const metadata = runtime.messageMetadata.get(persistedMessage)
          runtime.persistQueue = runtime.persistQueue
            .then(async () => {
              const result = await appendAgentSessionMessage({
                sessionId: runtime.sessionId,
                parentId: runtime.leafEntryId,
                message: persistedMessage,
                metadata,
                ...(runtime.persisted
                  ? {}
                  : {
                      createSession: {
                        id: runtime.sessionId,
                        modelId: runtime.modelId,
                        thinkingLevel: runtime.thinkingLevel,
                        autoApproveImageTasks: runtime.autoApproveImageTasks,
                      },
                    }),
              })
              runtime.leafEntryId = result.entryId
              runtime.messageEntryIds.set(persistedMessage, result.entryId)
              if (!runtime.persisted) {
                runtime.persisted = true
                if (isCurrentRuntime(runtime)) setCurrentAgentSessionId(runtime.sessionId)
                void persistRuntimeSidecar(runtime)
              }
              upsertAgentSessionSummary(result.record)
            })
            .catch((error: unknown) => {
              setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
            })
          return
        }
        if (event.type === 'agent_end') {
          runtime.activeResponseMetadata = runtime.queuedResponseMetadata.shift()
          maybeRunRuntimeCompactionRef.current(runtime)
        }
      })
      agentRuntimesRef.current.set(runtime.sessionId, runtime)
      applyAgentRuntimeConfig(runtime)
      syncRuntimeSnapshot(runtime)
      runtime.ready = true
      return runtime
    },
    [
      applyAgentRuntimeConfig,
      getAgentBaseUrl,
      isCurrentRuntime,
      persistRuntimeSidecar,
      setRuntimeError,
      syncRuntimeSnapshot,
      upsertAgentSessionSummary,
    ],
  )

  const loadAgentSessionIntoRuntime = useCallback(
    (session: Awaited<ReturnType<typeof loadAgentSession>>) => {
      if (!session) return
      const existing = agentRuntimesRef.current.get(session.record.id)
      if (existing) {
        projectRuntimeToUi(existing)
        return
      }
      const restoredTasks = restoreAgentImageTasks(session.sidecar.imageTasks)
      const releasedReservedIds = new Set<string>()
      for (let index = 0; index < session.sidecar.imageTasks.length; index++) {
        const original = session.sidecar.imageTasks[index]
        const restored = restoredTasks[index]
        if (original.status === restored.status) continue
        const fulfilledIds = new Set(restored.resultImageIds)
        for (const id of restored.request.reservedImageIds) {
          if (!fulfilledIds.has(id)) releasedReservedIds.add(id)
        }
      }
      const restoredRegistry = session.sidecar.imageRegistry.filter((entry) => !releasedReservedIds.has(entry.id))

      const restoredQuestions = session.sidecar.pendingQuestions ?? []
      const restoredQuestionIds = new Set(restoredQuestions.map((item) => item.toolCallId))

      const lastCompaction = session.sidecar.lastCompaction
      const persistedMessages = session.messages
      const persistedEntryIds = session.messageEntryIds
      const persistedMetadata = session.messageMetadata
      let runtimeMessages = persistedMessages
      let runtimeEntryIds = persistedEntryIds
      let runtimeMetadata = persistedMetadata
      if (lastCompaction) {
        const summaryMessage = buildCompactionSummaryMessage(lastCompaction.summary, lastCompaction.createdAt)
        runtimeMessages = [summaryMessage, ...persistedMessages]
        runtimeEntryIds = ['', ...persistedEntryIds]
        runtimeMetadata = [{}, ...persistedMetadata]
      }
      const finalMessages = injectAbandonedToolResults(runtimeMessages, restoredQuestionIds)
      // injectAbandonedToolResults preserves originals in order and only inserts
      // synthetic toolResult placeholders, so we can walk in lockstep instead of
      // calling indexOf per message (which was O(N²) on large transcripts).
      const finalEntryIds: string[] = []
      const finalMetadata: AgentSessionMessageMetadata[] = []
      let originalCursor = 0
      for (const message of finalMessages) {
        if (originalCursor < runtimeMessages.length && runtimeMessages[originalCursor] === message) {
          finalEntryIds.push(runtimeEntryIds[originalCursor] ?? '')
          finalMetadata.push(runtimeMetadata[originalCursor] ?? {})
          originalCursor++
        } else {
          finalEntryIds.push('')
          finalMetadata.push({})
        }
      }

      const runtime = createRuntime({
        sessionId: session.record.id,
        persisted: true,
        modelId: session.record.modelId,
        thinkingLevel: session.record.thinkingLevel,
        autoApproveImageTasks: session.record.autoApproveImageTasks,
        leafEntryId: session.record.leafEntryId,
        messages: finalMessages,
        messageEntryIds: finalEntryIds,
        messageMetadata: finalMetadata,
        lastCompaction,
        draft: session.sidecar.draft,
        attachments: session.sidecar.attachments,
        imageTasks: restoredTasks,
        imageRegistry: restoredRegistry,
        turnCallbacks: session.sidecar.turnCallbacks,
        currentAgentTurnId: session.sidecar.currentAgentTurnId,
        pendingQuestions: restoredQuestions,
      })
      runtime.agent.state.error = undefined
      runtime.agent.state.streamMessage = null
      runtime.agent.state.pendingToolCalls = new Set()
      runtime.agent.replaceMessages(runtime.messages)
      syncRuntimeSnapshot(runtime)
      projectRuntimeToUi(runtime)
    },
    [createRuntime, projectRuntimeToUi, syncRuntimeSnapshot],
  )

  const createNewAgentSession = useCallback(async () => {
    const previousRuntime = getCurrentRuntime()
    await flushRuntime(previousRuntime)
    if (
      previousRuntime &&
      !previousRuntime.persisted &&
      !previousRuntime.isStreaming &&
      previousRuntime.messages.length === 0
    ) {
      agentRuntimesRef.current.delete(previousRuntime.sessionId)
    }
    const record = createAgentSessionRecord({
      modelId: getPreferredAgentModelId(),
      thinkingLevel: getPreferredAgentThinkingLevel(),
      autoApproveImageTasks: autoApproveAgentImageTasks,
    })
    const runtime = createRuntime({
      sessionId: record.id,
      persisted: false,
      modelId: record.modelId,
      thinkingLevel: record.thinkingLevel,
      autoApproveImageTasks: record.autoApproveImageTasks,
      leafEntryId: null,
      messages: [],
      messageEntryIds: [],
      messageMetadata: [],
      draft: '',
      attachments: [],
      imageTasks: [],
      imageRegistry: [],
      turnCallbacks: [],
      currentAgentTurnId: null,
      pendingQuestions: [],
      lastCompaction: undefined,
    })
    projectRuntimeToUi(runtime)
  }, [autoApproveAgentImageTasks, createRuntime, flushRuntime, getCurrentRuntime, projectRuntimeToUi])

  const switchAgentSession = useCallback(
    (sessionId: string) => {
      if (sessionId === currentAgentSessionIdRef.current) return
      void (async () => {
        const previousRuntime = getCurrentRuntime()
        await flushRuntime(previousRuntime)
        if (previousRuntime && !previousRuntime.persisted && previousRuntime.messages.length === 0) {
          agentRuntimesRef.current.delete(previousRuntime.sessionId)
        }
        const runtime = agentRuntimesRef.current.get(sessionId)
        if (runtime) {
          projectRuntimeToUi(runtime)
          return
        }
        loadAgentSessionIntoRuntime(await loadAgentSession(sessionId))
      })().catch((error: unknown) => {
        setAgentError(error instanceof Error ? error.message : String(error))
      })
    },
    [flushRuntime, getCurrentRuntime, loadAgentSessionIntoRuntime, projectRuntimeToUi],
  )

  const removeAgentSession = useCallback(
    (sessionId: string) => {
      void (async () => {
        const runtime = agentRuntimesRef.current.get(sessionId)
        if (runtime) {
          runtime.ready = false
          clearRuntimeQuestionResolvers(runtime, 'session_deleted')
          runtime.compactionAbort?.abort()
          runtime.agent.abort()
          for (const task of runtime.imageTasks) {
            if (task.generationJobId && !isTerminalAgentImageTaskStatus(task.status))
              cancelGenerationJob(task.generationJobId)
          }
          agentRuntimesRef.current.delete(sessionId)
        }
        await deleteAgentSession(sessionId)
        const nextSessions = (await listAgentSessions()).filter((session) => session.id !== sessionId)
        setAgentSessions(nextSessions)
        if (sessionId !== currentAgentSessionIdRef.current) return
        const next = nextSessions[0]
        if (next) {
          loadAgentSessionIntoRuntime(await loadAgentSession(next.id))
        } else {
          currentAgentSessionIdRef.current = null
          setCurrentAgentSessionId(null)
          await createNewAgentSession()
        }
      })().catch((error: unknown) => {
        setAgentError(error instanceof Error ? error.message : String(error))
      })
    },
    [cancelGenerationJob, clearRuntimeQuestionResolvers, createNewAgentSession, loadAgentSessionIntoRuntime],
  )

  useMountEffect(() => {
    void (async () => {
      setAgentSessionsLoading(true)
      const sessions = await listAgentSessions()
      setAgentSessions(sessions)
      const initialSession = initialSessionId
        ? (sessions.find((session) => session.id === initialSessionId) ?? null)
        : null
      if (initialSession || sessions[0]) {
        loadAgentSessionIntoRuntime(await loadAgentSession((initialSession ?? sessions[0]).id))
      } else {
        await createNewAgentSession()
      }
      setAgentSessionsLoading(false)
    })().catch((error: unknown) => {
      setAgentSessionsLoading(false)
      setAgentError(error instanceof Error ? error.message : String(error))
    })
  })

  useExternalSync(() => {
    for (const runtime of agentRuntimesRef.current.values()) {
      applyAgentRuntimeConfig(runtime)
      syncRuntimeSnapshot(runtime)
    }
  }, [applyAgentRuntimeConfig, syncRuntimeSnapshot])

  const addAgentAttachments = useCallback(
    (files: File[]) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const config = resolveAgentModelConfig(runtime.modelId)
      if (!config.supportsImages) {
        const message = translate('configLib.agent.modelImageUnsupported', { model: config.label })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }
      const remaining = AGENT_MAX_ATTACHMENTS - runtime.attachments.length
      if (remaining <= 0) {
        const message = translate('configLib.agent.maxAttachments', { count: AGENT_MAX_ATTACHMENTS })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }

      const toAdd = files.slice(0, remaining)
      void Promise.allSettled(
        toAdd.map((file) =>
          readFileAsImageData(file).then((result) => {
            if (!result) return null
            return {
              id: crypto.randomUUID(),
              data: result.base64,
              mimeType: result.mimeType,
              fileName: result.fileName,
              size: file.size,
            } satisfies AgentChatAttachment
          }),
        ),
      ).then((results) => {
        const attachments: AgentChatAttachment[] = []
        const errors: string[] = []
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            attachments.push(result.value)
          } else if (result.status === 'rejected') {
            errors.push((result.reason as Error).message)
          }
        }
        if (attachments.length > 0) {
          runtime.attachments = [...runtime.attachments, ...attachments].slice(0, AGENT_MAX_ATTACHMENTS)
          runtime.attachmentError = null
          if (isCurrentRuntime(runtime)) {
            setAgentAttachments(runtime.attachments)
            setAgentAttachmentError(null)
          }
          scheduleRuntimeSidecarPersist(runtime)
        }
        if (errors.length > 0) {
          runtime.attachmentError = errors.join('\n')
          if (isCurrentRuntime(runtime)) setAgentAttachmentError(runtime.attachmentError)
        }
      })
    },
    [getCurrentRuntime, isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const addAgentImageAttachment = useCallback(
    (image: PlaygroundImage | PlaygroundImageMeta) => {
      const runtime = getCurrentRuntime()
      if (!runtime || runtime.attachments.some((item) => item.id === image.id)) return
      const config = resolveAgentModelConfig(runtime.modelId)
      if (!config.supportsImages) {
        const message = translate('configLib.agent.modelImageUnsupported', { model: config.label })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }
      const remaining = AGENT_MAX_ATTACHMENTS - runtime.attachments.length
      if (remaining <= 0) {
        const message = translate('configLib.agent.maxAttachments', { count: AGENT_MAX_ATTACHMENTS })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }

      void (async () => {
        const data = 'data' in image ? image.data : (getBlobFromCache(image.id) ?? (await loadImageBlob(image.id)))
        if (!data) {
          runtime.attachmentError = translate('configLib.agent.readAttachmentFailed')
          if (isCurrentRuntime(runtime)) setAgentAttachmentError(runtime.attachmentError)
          return
        }
        putBlobInCache(image.id, data)
        const fileName = image.source.type === 'upload' ? image.source.fileName : image.id
        const attachment: AgentChatAttachment = {
          id: image.id,
          data,
          mimeType: image.mimeType,
          fileName,
          size: 0,
        }
        runtime.imageRegistry.set(image.id, {
          id: image.id,
          image: { ...image, data },
          source: image.source.type === 'generated' ? 'generated' : 'history',
          status: 'ready',
          createdAt: image.timestamp,
        })
        if (!runtime.attachments.some((item) => item.id === image.id))
          runtime.attachments = [...runtime.attachments, attachment]
        runtime.attachmentError = null
        if (isCurrentRuntime(runtime)) {
          setAgentAttachments(runtime.attachments)
          setAgentAttachmentError(null)
        }
        scheduleRuntimeSidecarPersist(runtime)
      })()
    },
    [getCurrentRuntime, isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const removeAgentAttachment = useCallback(
    (id: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.attachments = runtime.attachments.filter((item) => item.id !== id)
      if (isCurrentRuntime(runtime)) setAgentAttachments(runtime.attachments)
      scheduleRuntimeSidecarPersist(runtime)
    },
    [getCurrentRuntime, isCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const clearAgentAttachmentError = useCallback(() => {
    const runtime = getCurrentRuntime()
    if (runtime) runtime.attachmentError = null
    setAgentAttachmentError(null)
  }, [getCurrentRuntime])

  const imageIdExistsForAgent = useCallback(async (runtime: AgentSessionRuntime, id: string): Promise<boolean> => {
    if (runtime.imageRegistry.has(id)) return true
    for (const otherRuntime of agentRuntimesRef.current.values()) {
      if (otherRuntime.sessionId !== runtime.sessionId && otherRuntime.imageRegistry.has(id)) return true
    }
    if (referenceImagesRef.current.some((image) => image.id === id)) return true
    if (historyRef.current.some((image) => image.id === id)) return true
    if (generationJobsRefForAgent.current.some((job) => job.slots.some((slot) => slot.image?.id === id))) return true
    const metas = await loadImageMetas([id])
    return metas.has(id)
  }, [])

  const reserveAgentImageIdsForRuntime = useCallback(
    async (runtime: AgentSessionRuntime, requestedImageId: string, count: number) => {
      const reserve = agentImageReservationQueueRef.current.then(async () => {
        const result = await reserveAgentImageIds({
          requestedImageId,
          count,
          isReserved: (id) => agentPendingReservedImageIdsRef.current.has(id) || runtime.imageRegistry.has(id),
          exists: (id) => imageIdExistsForAgent(runtime, id),
        })
        for (const id of result.reservedImageIds) agentPendingReservedImageIdsRef.current.add(id)
        return result
      })
      agentImageReservationQueueRef.current = reserve.then(
        () => undefined,
        () => undefined,
      )
      return reserve
    },
    [imageIdExistsForAgent],
  )

  const releasePendingAgentImageIds = useCallback((ids: string[]) => {
    for (const id of ids) agentPendingReservedImageIdsRef.current.delete(id)
  }, [])

  const resolveAgentImageById = useCallback(
    async (
      runtime: AgentSessionRuntime,
      id: string,
    ): Promise<
      | { status: 'ready'; source: AgentImageRegistryEntry['source']; image: PlaygroundImage }
      | { status: 'not_ready'; source: AgentImageRegistryEntry['source'] }
      | null
    > => {
      const reference = referenceImagesRef.current.find((image) => image.id === id)
      if (reference) return { status: 'ready', source: 'reference', image: reference }

      const registryEntry = runtime.imageRegistry.get(id)
      if (registryEntry?.source === 'agent_attachment' && registryEntry.image) {
        const attachment = registryEntry.image as AgentChatAttachment
        return {
          status: 'ready',
          source: 'agent_attachment',
          image: {
            id: attachment.id,
            data: attachment.data,
            mimeType: attachment.mimeType,
            source: { type: 'upload', fileName: attachment.fileName },
            timestamp: registryEntry.createdAt,
          },
        }
      }
      if (registryEntry?.status === 'ready' && registryEntry.image) {
        const image = registryEntry.image
        if ('data' in image && typeof image.data === 'string') {
          return { status: 'ready', source: registryEntry.source, image: image as PlaygroundImage }
        }
        if ('mimeType' in image && 'source' in image && 'timestamp' in image) {
          const blob = getBlobFromCache(id) ?? (await loadImageBlob(id))
          if (blob) {
            putBlobInCache(id, blob)
            return {
              status: 'ready',
              source: registryEntry.source,
              image: { ...(image as PlaygroundImageMeta), data: blob },
            }
          }
        }
      }
      if (registryEntry && registryEntry.status !== 'ready')
        return { status: 'not_ready', source: registryEntry.source }

      for (const job of generationJobsRefForAgent.current) {
        const image = job.slots.find((slot) => slot.image?.id === id)?.image
        if (image) return { status: 'ready', source: 'generated', image }
      }

      const loaded = historyRef.current.find((image) => image.id === id) ?? (await loadImageMetas([id])).get(id)
      if (!loaded) return null
      const blob = getBlobFromCache(id) ?? (await loadImageBlob(id))
      if (!blob) return null
      putBlobInCache(id, blob)
      return {
        status: 'ready',
        source: loaded.source.type === 'generated' ? 'generated' : 'history',
        image: { ...loaded, data: blob },
      }
    },
    [],
  )

  const resolveAgentReferenceImages = useCallback(
    async (runtime: AgentSessionRuntime, ids: string[]): Promise<PlaygroundImage[]> => {
      const images: PlaygroundImage[] = []
      for (const id of ids) {
        const result = await resolveAgentImageById(runtime, id)
        if (!result) throw new Error(translate('configLib.agent.referenceMissing', { id }))
        if (result.status !== 'ready') throw new Error(translate('configLib.agent.referenceNotReady', { id }))
        images.push(result.image)
      }
      return images
    },
    [resolveAgentImageById],
  )

  const sendAgentSystemEvent = useCallback(
    async (runtime: AgentSessionRuntime, text: string): Promise<boolean> => {
      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) {
        setRuntimeError(runtime, translate('configLib.agent.callbackMissingKey', { provider: config.providerLabel }))
        return false
      }

      applyAgentRuntimeConfig(runtime)
      runtime.currentAgentTurnId = crypto.randomUUID()
      if (runtime.agent.state.isStreaming || runtime.isCompacting) {
        queueAgentResponseMetadata(runtime, config.id)
        await runtime.agent.queueMessage({ role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() })
      } else {
        activateAgentResponseMetadata(runtime, config.id)
        await runtime.agent.prompt(text)
      }
      syncRuntimeSnapshot(runtime)
      return true
    },
    [applyAgentRuntimeConfig, setRuntimeError, syncRuntimeSnapshot],
  )

  const maybeDispatchAgentImageCallbacks = useCallback(
    (runtime: AgentSessionRuntime, tasks = runtime.imageTasks) => {
      if (runtime.agent.state.isStreaming || runtime.isCompacting) return
      for (const callbackState of runtime.turnCallbacks.values()) {
        if (callbackState.callbackQueued || callbackState.taskIds.length === 0) continue
        const turnTasks = callbackState.taskIds
          .map((taskId) => tasks.find((task) => task.id === taskId))
          .filter((task): task is AgentImageTask => Boolean(task))
        if (turnTasks.length !== callbackState.taskIds.length) continue
        if (!turnTasks.every((task) => isTerminalAgentImageTaskStatus(task.status))) continue

        const text = buildAgentTaskCallbackText(turnTasks)
        callbackState.callbackQueued = true
        scheduleRuntimeSidecarPersist(runtime)
        void sendAgentSystemEvent(runtime, text)
          .then((sent) => {
            if (!sent) callbackState.callbackQueued = false
          })
          .catch((error: unknown) => {
            callbackState.callbackQueued = false
            const message = error instanceof Error ? error.message : String(error)
            setRuntimeError(runtime, message)
          })
      }
    },
    [scheduleRuntimeSidecarPersist, sendAgentSystemEvent, setRuntimeError],
  )

  useExternalSync(() => {
    maybeDispatchAgentImageCallbacksRef.current = maybeDispatchAgentImageCallbacks
  }, [maybeDispatchAgentImageCallbacks])

  const startAgentImageTask = useCallback(
    async (runtime: AgentSessionRuntime, task: AgentImageTask): Promise<{ ok: boolean; message: string }> => {
      setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) =>
          item.id === task.id && item.status === 'pending_approval' ? { ...item, status: 'approved' } : item,
        ),
      )

      const modelConfig = findModelConfig(task.request.modelId)
      if (!modelConfig) {
        const message = translate('configLib.agent.unknownGenImageModel', { model: task.request.modelId })
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      const credentials = getProviderCredentials(modelConfig.provider)
      if (!credentials.apiKey) {
        const message = translate('configLib.agent.modelMissingKey', {
          model: modelConfig.name,
          provider: getProviderConfig(modelConfig.provider).shortLabel,
        })
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      let referenceImages: PlaygroundImage[]
      try {
        referenceImages = await resolveAgentReferenceImages(runtime, task.request.referenceImageIds)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      if (!runtime.ready || agentRuntimesRef.current.get(runtime.sessionId) !== runtime) {
        return { ok: false, message: translate('configLib.agent.sessionDeleted') }
      }

      const currentTask = runtime.imageTasks.find((item) => item.id === task.id)
      if (!currentTask || isTerminalAgentImageTaskStatus(currentTask.status)) {
        return { ok: false, message: translate('configLib.agent.taskCanceled') }
      }

      const stackId =
        task.request.stackId ??
        stackIdForGenerationRequest({
          model: modelConfig,
          prompt: task.request.prompt,
          referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          batchCount: task.request.batchCount,
        })
      const batchId = enqueueGenerationJob(
        {
          apiKey: credentials.apiKey,
          baseUrl: credentials.baseUrl,
          model: modelConfig,
          prompt: task.request.prompt,
          referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          outputImageIds: task.request.reservedImageIds,
          outputImageIdSource: 'agent',
        },
        task.request.batchCount,
        stackId,
        task.request.parentImageId,
      )
      setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: 'queued',
                generationJobId: batchId,
                error: undefined,
                request: { ...item.request, stackId },
              }
            : item,
        ),
      )
      return { ok: true, message: translate('configLib.agent.taskStarted') }
    },
    [
      enqueueGenerationJob,
      getProviderCredentials,
      maybeDispatchAgentImageCallbacks,
      resolveAgentReferenceImages,
      setRuntimeImageTasks,
    ],
  )

  const approveAgentImageTask = useCallback(
    (taskId: string) => {
      const runtime = getCurrentRuntime()
      const task = runtime?.imageTasks.find((item) => item.id === taskId)
      if (!runtime || !task || task.status !== 'pending_approval') return
      void startAgentImageTask(runtime, task)
    },
    [getCurrentRuntime, startAgentImageTask],
  )

  const cancelAgentImageTask = useCallback(
    (taskId: string) => {
      const runtime = getCurrentRuntime()
      const task = runtime?.imageTasks.find((item) => item.id === taskId)
      if (!runtime || !task) return
      if (task.status === 'pending_approval') {
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === taskId ? { ...item, status: 'rejected' } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return
      }
      if (task.generationJobId) cancelGenerationJob(task.generationJobId)
      const job = task.generationJobId
        ? generationJobsRefForAgent.current.find((item) => item.id === task.generationJobId)
        : undefined
      const resultImageIds = job?.slots.flatMap((slot) => (slot.image ? [slot.image.id] : [])) ?? task.resultImageIds
      const fulfilledIds = new Set(resultImageIds)
      for (const id of task.request.reservedImageIds) {
        if (!fulfilledIds.has(id)) runtime.imageRegistry.delete(id)
      }
      const next = setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: 'canceled', resultImageIds } : item)),
      )
      maybeDispatchAgentImageCallbacks(runtime, next)
    },
    [cancelGenerationJob, getCurrentRuntime, maybeDispatchAgentImageCallbacks, setRuntimeImageTasks],
  )

  const runGenImageTool = useCallback(
    async (
      sessionId: string,
      toolCallId: string,
      args: GenImageToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) throw new Error('Agent session is no longer available.')
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const promptText = args.prompt.trim()
      if (!promptText) throw new Error('GenImage.prompt is required.')
      const modelConfig = findModelConfig(args.model)
      if (!modelConfig) {
        throw new Error(
          `Unknown GenImage model: ${args.model}. Available models: ${MODEL_CONFIGS.map((item) => item.id).join(', ')}`,
        )
      }
      const requestedCount = Number.isFinite(args.n) ? Math.floor(args.n) : 1
      const batchCount = Math.min(Math.max(1, requestedCount), modelConfig.maxBatchCount)
      const resolution = normalizeResolution(modelConfig, args.resolution)
      const aspect = normalizeAspectRatio(modelConfig, args.ratio)
      const referenceImageIds = args.reference_image_ids.filter((id) => id.trim()).map((id) => id.trim())
      const referenceImages = await resolveAgentReferenceImages(runtime, referenceImageIds)
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const editSource = referenceImages.find((image) => image.source.type === 'generated')
      const reserved = await reserveAgentImageIdsForRuntime(runtime, args.image_id, batchCount)
      try {
        const activeOptions = activeOptionsForModel(modelConfig, defaultOptionsFor(modelConfig))
        const task: AgentImageTask = {
          id: crypto.randomUUID(),
          toolCallId,
          agentTurnId: runtime.currentAgentTurnId ?? crypto.randomUUID(),
          createdAt: Date.now(),
          status: 'pending_approval',
          request: {
            prompt: promptText,
            requestedImageId: reserved.requestedImageId,
            reservedImageIds: reserved.reservedImageIds,
            modelId: modelConfig.id,
            resolution,
            aspectRatio: aspect,
            batchCount,
            referenceImageIds,
            options: activeOptions,
            stackId:
              editSource?.source.type === 'generated'
                ? (editSource.source.stackId ?? editSource.source.batchId)
                : undefined,
            parentImageId: editSource?.source.type === 'generated' ? editSource.id : undefined,
          },
          resultImageIds: [],
          renamedImageIds: reserved.renamed,
        }

        const callbackState = runtime.turnCallbacks.get(task.agentTurnId) ?? {
          agentTurnId: task.agentTurnId,
          taskIds: [],
          callbackQueued: false,
        }
        callbackState.taskIds.push(task.id)
        runtime.turnCallbacks.set(task.agentTurnId, callbackState)

        for (const id of reserved.reservedImageIds) {
          runtime.imageRegistry.set(id, {
            id,
            source: 'generated',
            status: 'reserved',
            createdAt: task.createdAt,
          })
        }
        setRuntimeImageTasks(runtime, (prev) => [task, ...prev])

        const startResult = runtime.autoApproveImageTasks ? await startAgentImageTask(runtime, task) : null
        const status = runtime.autoApproveImageTasks ? (startResult?.ok ? 'queued' : 'failed') : 'pending_approval'
        const message = runtime.autoApproveImageTasks
          ? startResult?.ok
            ? AGENT_TASK_PROTOCOL_MESSAGES.autoStarted
            : AGENT_TASK_PROTOCOL_MESSAGES.failedToStart
          : reserved.renamed
            ? AGENT_TASK_PROTOCOL_MESSAGES.pendingWithReserved(reserved.reservedImageIds)
            : AGENT_TASK_PROTOCOL_MESSAGES.pending
        const payload = {
          status,
          task_id: task.id,
          requested_image_id: reserved.requestedImageId,
          reserved_image_ids: reserved.reservedImageIds,
          renamed: reserved.renamed,
          message,
        }
        return toolTextResult(JSON.stringify(payload, null, 2), payload)
      } finally {
        releasePendingAgentImageIds(reserved.reservedImageIds)
      }
    },
    [
      releasePendingAgentImageIds,
      reserveAgentImageIdsForRuntime,
      resolveAgentReferenceImages,
      setRuntimeImageTasks,
      startAgentImageTask,
    ],
  )

  const runReadImageTool = useCallback(
    async (sessionId: string, _toolCallId: string, args: ReadImageToolArgs): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) throw new Error('Agent session is no longer available.')
      const imageId = args.image_id.trim()
      const missing = '<tool_use_error>Image does not exist.</tool_use_error>'
      if (!imageId) return toolTextResult(missing, { status: 'error', image_id: imageId })

      const result = await resolveAgentImageById(runtime, imageId)
      if (!result) return toolTextResult(missing, { status: 'error', image_id: imageId })
      if (result.status !== 'ready') {
        const payload = {
          image_id: imageId,
          status: 'not_ready',
          source: result.source,
          message: 'Image is not ready.',
        }
        return toolTextResult(JSON.stringify(payload, null, 2), payload)
      }

      const offset = args.offset !== undefined && Number.isFinite(args.offset) ? args.offset : 0
      const limit =
        args.limit !== undefined && Number.isFinite(args.limit) ? args.limit : AGENT_PROMPT_DEFAULT_LINE_LIMIT
      const generated = result.image.source.type === 'generated' ? result.image.source : null
      if (offset > 0) {
        if (!generated) {
          const text = '<tool_use_error>Image prompt is only available for generated images.</tool_use_error>'
          return toolTextResult(text, { status: 'error', image_id: imageId })
        }
        const header = `[prompt] image_id=${imageId} references=${generated.referenceImageIds.join(',')} total_lines=${promptLineCount(generated.prompt)}`
        const text = `${header}\n${formatPromptLines(generated.prompt, offset, limit)}`
        return toolTextResult(text, { status: 'ready', image_id: imageId, mode: 'prompt' })
      }

      const modelForImage = generated ? findModelConfig(generated.modelId) : null
      const promptOutputText = generated
        ? formatPromptLines(generated.prompt, 1, AGENT_PROMPT_DEFAULT_LINE_LIMIT)
        : undefined
      const imageForAgent = await compressImageForAgentInput({
        data: result.image.data,
        mimeType: result.image.mimeType,
      })
      const payload = {
        image_id: imageId,
        status: 'ready',
        source: result.source,
        mime_type: result.image.mimeType,
        generated: generated
          ? {
              model_id: generated.modelId,
              model_name: modelForImage?.name ?? generated.modelId,
              prompt_preview: generated.prompt.slice(0, 100),
              prompt_length: generated.prompt.length,
              prompt_total_lines: promptLineCount(generated.prompt),
              prompt_truncated: promptOutputText?.includes('more lines truncated') ?? false,
              prompt_output_text: promptOutputText,
              reference_image_ids: generated.referenceImageIds,
              resolution: generated.resolution,
              ratio: generated.aspectRatio,
              created_at: result.image.timestamp,
            }
          : undefined,
        message: 'Image is ready.',
      }
      return {
        content: [
          { type: 'text', text: JSON.stringify(payload, null, 2) },
          { type: 'image', data: imageForAgent.data, mimeType: imageForAgent.mimeType },
        ],
        details: payload,
      }
    },
    [resolveAgentImageById],
  )

  const runAskUserQuestionTool = useCallback(
    (
      sessionId: string,
      toolCallId: string,
      args: AskUserQuestionToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) return Promise.reject(new Error('Agent session is no longer available.'))
      const questions = args.questions
      if (questions.length === 0) {
        return Promise.resolve(
          toolTextResult('<tool_use_error>AskUserQuestion requires at least one question.</tool_use_error>', {
            status: 'error',
          }),
        )
      }

      const pending: AgentPendingQuestion = {
        toolCallId,
        agentTurnId: runtime.currentAgentTurnId ?? toolCallId,
        questions,
        createdAt: Date.now(),
      }
      setRuntimePendingQuestions(runtime, (prev) => [...prev.filter((item) => item.toolCallId !== toolCallId), pending])

      return new Promise<AgentToolResult>((resolve, reject) => {
        const cleanup = () => {
          runtime.questionResolvers.delete(toolCallId)
          setRuntimePendingQuestions(runtime, (prev) => prev.filter((item) => item.toolCallId !== toolCallId))
        }

        const resolver: AgentQuestionResolver = {
          questions,
          resolve: (result) => {
            cleanup()
            resolve(result)
          },
          reject: (reason) => {
            cleanup()
            reject(reason instanceof Error ? reason : new Error(String(reason)))
          },
        }
        runtime.questionResolvers.set(toolCallId, resolver)

        if (signal) {
          if (signal.aborted) {
            resolver.reject(new Error('AskUserQuestion was aborted.'))
            return
          }
          signal.addEventListener(
            'abort',
            () => {
              const stillPending = runtime.questionResolvers.get(toolCallId)
              if (!stillPending) return
              stillPending.resolve(
                toolTextResult(formatAskUserQuestionResult(questions, [], { cancelled: true }), {
                  status: 'cancelled',
                  reason: 'aborted',
                }),
              )
            },
            { once: true },
          )
        }
      })
    },
    [setRuntimePendingQuestions],
  )

  const finishRestoredAgentQuestion = useCallback(
    (
      runtime: AgentSessionRuntime,
      toolCallId: string,
      answers: AskUserQuestionAnswer[],
      options: { cancelled: boolean },
    ) => {
      const pending = runtime.pendingQuestions.find((item) => item.toolCallId === toolCallId)
      if (!pending) return
      const text = formatAskUserQuestionResult(pending.questions, answers, { cancelled: options.cancelled })
      const toolResultMessage = {
        role: 'toolResult',
        toolCallId,
        toolName: 'AskUserQuestion',
        content: [{ type: 'text', text }],
        isError: false,
        timestamp: Date.now(),
      } as unknown as AgentMessage

      setRuntimePendingQuestions(runtime, (prev) => prev.filter((item) => item.toolCallId !== toolCallId))

      runtime.agent.appendMessage(toolResultMessage)
      syncRuntimeSnapshot(runtime)

      runtime.persistQueue = runtime.persistQueue
        .then(async () => {
          const result = await appendAgentSessionMessage({
            sessionId: runtime.sessionId,
            parentId: runtime.leafEntryId,
            message: toolResultMessage,
          })
          runtime.leafEntryId = result.entryId
          upsertAgentSessionSummary(result.record)
        })
        .catch((error: unknown) => {
          setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
        })

      if (options.cancelled) return
      const eventText = `<system>\ntool AskUserQuestion call ${toolCallId} has been answered.\n</system>`
      void sendAgentSystemEvent(runtime, eventText)
    },
    [sendAgentSystemEvent, setRuntimeError, setRuntimePendingQuestions, syncRuntimeSnapshot, upsertAgentSessionSummary],
  )

  const submitAgentQuestionAnswers = useCallback(
    (toolCallId: string, answers: AskUserQuestionAnswer[]) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const resolver = runtime.questionResolvers.get(toolCallId)
      if (resolver) {
        const text = formatAskUserQuestionResult(resolver.questions, answers)
        resolver.resolve(toolTextResult(text, { status: 'submitted', answers }))
        return
      }
      finishRestoredAgentQuestion(runtime, toolCallId, answers, { cancelled: false })
    },
    [finishRestoredAgentQuestion, getCurrentRuntime],
  )

  const cancelAgentQuestion = useCallback(
    (toolCallId: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const resolver = runtime.questionResolvers.get(toolCallId)
      if (resolver) {
        resolver.resolve(
          toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
            status: 'cancelled',
            reason: 'user_dismissed',
          }),
        )
        return
      }
      finishRestoredAgentQuestion(runtime, toolCallId, [], { cancelled: true })
    },
    [finishRestoredAgentQuestion, getCurrentRuntime],
  )

  const refreshAgentSkills = useCallback(() => {
    const next = getAgentSkillSummaries()
    setAgentSkillsState(next)
    return next
  }, [])

  const setAgentSkillEnabled = useCallback((name: string, enabled: boolean) => {
    setAgentSkillsState(setAgentSkillEnabledInRegistry(name, enabled))
  }, [])

  const deleteAgentSkill = useCallback((name: string) => {
    setAgentSkillsState(deleteAgentSkillFromRegistry(name))
  }, [])

  const getAgentSkillPackage = useCallback((name: string): AgentSkill | null => findAgentSkill(name), [])

  const createUserAgentSkill = useCallback(
    (input: AgentSkillCreateInput) => {
      createAgentSkill(input)
      refreshAgentSkills()
    },
    [refreshAgentSkills],
  )

  const runSkillTool = useCallback(
    async (_sessionId: string, _toolCallId: string, args: SkillToolArgs): Promise<AgentToolResult> => {
      return formatLoadedSkillText(args.skill)
    },
    [],
  )

  const runReadSkillFileTool = useCallback(
    async (_sessionId: string, _toolCallId: string, args: ReadSkillFileToolArgs): Promise<AgentToolResult> => {
      return formatReadSkillFileResult(args.skill, args.path)
    },
    [],
  )

  const runCreateSkillTool = useCallback(
    async (_sessionId: string, _toolCallId: string, args: CreateSkillToolArgs): Promise<AgentToolResult> => {
      const skill = createAgentSkill(args)
      refreshAgentSkills()
      const payload = {
        status: 'saved',
        skill_name: skill.name,
        icon: skill.icon,
        enabled: skill.enabled,
        file_count: skill.files.length,
        message:
          'Skill saved to the browser skill library. It will be listed in available skills for future new conversations.',
      }
      return toolTextResult(JSON.stringify(payload, null, 2), payload)
    },
    [refreshAgentSkills],
  )

  const runWebFetchTool = useCallback(
    async (
      _sessionId: string,
      _toolCallId: string,
      args: WebFetchToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      return runWebFetch(args, signal)
    },
    [],
  )

  useExternalSync(() => {
    agentToolHandlersRef.current = {
      genImage: runGenImageTool,
      readImage: runReadImageTool,
      askUserQuestion: runAskUserQuestionTool,
      loadSkill: runSkillTool,
      readSkillFile: runReadSkillFileTool,
      createSkill: runCreateSkillTool,
      webFetch: runWebFetchTool,
    }
  }, [
    runAskUserQuestionTool,
    runCreateSkillTool,
    runGenImageTool,
    runReadImageTool,
    runReadSkillFileTool,
    runSkillTool,
    runWebFetchTool,
  ])

  useExternalSync(() => {
    void keyHooks.anthropic.apiKey
    void keyHooks.deepseek.apiKey
    void keyHooks.google.apiKey
    void keyHooks.openai.apiKey
    for (const runtime of agentRuntimesRef.current.values()) maybeDispatchAgentImageCallbacks(runtime)
  }, [
    keyHooks.anthropic.apiKey,
    keyHooks.deepseek.apiKey,
    keyHooks.google.apiKey,
    keyHooks.openai.apiKey,
    maybeDispatchAgentImageCallbacks,
  ])

  useExternalSync(() => {
    for (const runtime of agentRuntimesRef.current.values()) {
      let changed = false
      const next = runtime.imageTasks.map((task) => {
        if (!task.generationJobId || isTerminalAgentImageTaskStatus(task.status)) return task
        const job = generationJobs.find((item) => item.id === task.generationJobId)
        if (!job) return task
        const resultImageIds = job.slots.flatMap((slot) => (slot.image ? [slot.image.id] : []))
        const nextStatus = agentTaskStatusFromGenerationJob(job)
        const nextError = errorFromGenerationJob(job)
        if (nextStatus === 'completed') dismissGenerationJob(job.id)
        for (const slot of job.slots) {
          if (slot.image) {
            runtime.imageRegistry.set(slot.image.id, {
              id: slot.image.id,
              image: slot.image,
              source: 'generated',
              status: 'ready',
              createdAt: slot.image.timestamp,
            })
          }
        }
        if (
          nextStatus === task.status &&
          nextError === task.error &&
          resultImageIds.length === task.resultImageIds.length &&
          resultImageIds.every((id, index) => id === task.resultImageIds[index])
        ) {
          return task
        }
        changed = true
        const updated = { ...task, status: nextStatus, resultImageIds, error: nextError }
        if (isTerminalAgentImageTaskStatus(nextStatus)) {
          const fulfilledIds = new Set(resultImageIds)
          for (const id of task.request.reservedImageIds) {
            if (!fulfilledIds.has(id)) runtime.imageRegistry.delete(id)
          }
        }
        return updated
      })
      if (!changed) continue
      runtime.imageTasks = next
      if (isCurrentRuntime(runtime)) setAgentImageTasksState(next)
      scheduleRuntimeSidecarPersist(runtime)
      maybeDispatchAgentImageCallbacks(runtime, next)
    }
  }, [
    dismissGenerationJob,
    generationJobs,
    isCurrentRuntime,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
  ])

  const sendAgentMessage = useCallback(() => {
    const runtime = getCurrentRuntime()
    const trimmed = runtime?.draft.trim() ?? ''
    if (!runtime || runtime.promptPreparing || runtime.isCompacting) return
    if (!trimmed && runtime.attachments.length === 0) return

    const config = resolveAgentModelConfig(runtime.modelId)
    const credentials = agentCredentialsRef.current[config.provider]
    if (!credentials.apiKey) {
      setRuntimeError(
        runtime,
        translate('configLib.agent.modelMissingKey', { model: config.label, provider: config.providerLabel }),
      )
      return
    }
    if (!config.supportsImages && runtime.attachments.length > 0) {
      setRuntimeError(runtime, translate('configLib.agent.modelImageUnsupported', { model: config.label }))
      return
    }

    applyAgentRuntimeConfig(runtime)
    const attachmentsToSend = runtime.attachments
    const attachmentIds = attachmentsToSend.map((attachment) => attachment.id)
    const attachmentNote =
      attachmentIds.length > 0 ? `\n\n<system>Available attachment image IDs: ${attachmentIds.join(', ')}</system>` : ''
    const isFirstUserMessage = runtime.agent.state.messages.length === 0
    let systemPrefix = ''
    if (isFirstUserMessage) {
      systemPrefix += `${buildLanguageDirective(getActiveLanguage())}\n\n`
      const preferredModelDirective = buildPreferredImageModelDirective()
      if (preferredModelDirective) systemPrefix += `${preferredModelDirective}\n\n`
      const skillListing = buildAvailableSkillsSystemMessage(getAgentSkillSummaries())
      if (skillListing) systemPrefix += `${skillListing}\n\n`
    }
    const promptText = `${systemPrefix}${trimmed || '请分析这些图片。'}${attachmentNote}`
    for (const attachment of attachmentsToSend) {
      if (runtime.imageRegistry.get(attachment.id)?.status === 'ready') continue
      runtime.imageRegistry.set(attachment.id, {
        id: attachment.id,
        image: attachment,
        source: 'agent_attachment',
        status: 'ready',
        createdAt: Date.now(),
      })
    }

    const pendingQuestionsToCancel = runtime.pendingQuestions.slice()
    const hasInFlightResolver = pendingQuestionsToCancel.some((question) =>
      runtime.questionResolvers.has(question.toolCallId),
    )
    const inFlight = runtime.isStreaming || hasInFlightResolver

    runtime.draft = ''
    runtime.attachments = []
    runtime.attachmentError = null
    runtime.promptPreparing = true
    if (!inFlight) {
      runtime.currentAgentTurnId = crypto.randomUUID()
      activateAgentResponseMetadata(runtime, config.id)
      runtime.isStreaming = true
    }
    if (isCurrentRuntime(runtime)) {
      setAgentDraft('')
      setAgentAttachments([])
      setAgentAttachmentError(null)
      setAgentIsStreaming(runtime.isStreaming)
    }
    syncRuntimeSnapshot(runtime)
    scheduleRuntimeSidecarPersist(runtime)

    const cancelRuntimeQuestion = (question: AgentPendingQuestion) => {
      const resolver = runtime.questionResolvers.get(question.toolCallId)
      if (resolver) {
        resolver.resolve(
          toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
            status: 'cancelled',
            reason: 'user_dismissed',
          }),
        )
        return
      }
      finishRestoredAgentQuestion(runtime, question.toolCallId, [], { cancelled: true })
    }

    void (async () => {
      try {
        const images = await Promise.all(attachmentsToSend.map(compressedAttachmentToAgentAttachment))
        if (inFlight) {
          const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [
            { type: 'text', text: promptText },
          ]
          for (const image of images) {
            if (image.type === 'image') content.push({ type: 'image', data: image.content, mimeType: image.mimeType })
          }
          queueAgentResponseMetadata(runtime, config.id)
          await runtime.agent.queueMessage({
            role: 'user',
            content,
            attachments: images.length > 0 ? images : undefined,
            timestamp: Date.now(),
          })
          for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(question)
          return
        }

        for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(question)
        activateAgentResponseMetadata(runtime, config.id)
        const promptPromise = runtime.agent.prompt(promptText, images)
        runtime.promptPreparing = false
        promptPromise
          .then(() => {
            const errorMessage = getAgentError(runtime.agent)
            if (errorMessage && isKeyError(errorMessage)) invalidateGenerationKey(config.provider)
          })
          .catch((error: unknown) => {
            setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
          })
          .finally(() => {
            syncRuntimeSnapshot(runtime)
            maybeDispatchAgentImageCallbacks(runtime)
          })
      } catch (error) {
        setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
      } finally {
        runtime.promptPreparing = false
        syncRuntimeSnapshot(runtime)
        maybeDispatchAgentImageCallbacks(runtime)
      }
    })()
  }, [
    applyAgentRuntimeConfig,
    finishRestoredAgentQuestion,
    getCurrentRuntime,
    invalidateGenerationKey,
    isCurrentRuntime,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
    setRuntimeError,
    syncRuntimeSnapshot,
  ])

  const stopAgentMessage = useCallback(() => {
    getCurrentRuntime()?.agent.abort()
  }, [getCurrentRuntime])

  const clearAgentChat = useCallback(() => {
    void createNewAgentSession()
  }, [createNewAgentSession])

  const setCurrentAgentDraft = useCallback(
    (value: string) => {
      const runtime = getCurrentRuntime()
      if (runtime) {
        runtime.draft = value
        scheduleRuntimeSidecarPersist(runtime)
      }
      setAgentDraft(value)
    },
    [getCurrentRuntime, scheduleRuntimeSidecarPersist],
  )

  const setAutoApproveAgentImageTasks = useCallback(
    (value: boolean) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.autoApproveImageTasks = value
      setAutoApproveAgentImageTasksState(value)
      scheduleRuntimeSidecarPersist(runtime)
      if (!runtime.persisted) return
      void updateAgentSessionConfig(runtime.sessionId, { autoApproveImageTasks: value }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [getCurrentRuntime, scheduleRuntimeSidecarPersist, upsertAgentSessionSummary],
  )

  return {
    agentModels: AGENT_MODEL_CONFIGS,
    agentModel,
    agentThinkingLevel,
    agentMessages,
    agentMessageMetadata,
    agentStreamingMessage,
    agentIsStreaming,
    agentError,
    agentDraft,
    agentAttachments,
    agentAttachmentError,
    agentSessions,
    currentAgentSessionId,
    agentSessionsLoading,
    autoApproveAgentImageTasks,
    agentImageTasks,
    agentPendingQuestions,
    agentSkills,
    setAgentModelId: setAgentModelIdForSession,
    setAgentThinkingLevel,
    createAgentSession: createNewAgentSession,
    switchAgentSession,
    deleteAgentSession: removeAgentSession,
    setAutoApproveAgentImageTasks,
    setAgentSkillEnabled,
    deleteAgentSkill,
    getAgentSkillPackage,
    createUserAgentSkill,
    setAgentDraft: setCurrentAgentDraft,
    addAgentAttachments,
    addAgentImageAttachment,
    removeAgentAttachment,
    clearAgentAttachmentError,
    sendAgentMessage,
    stopAgentMessage,
    clearAgentChat,
    approveAgentImageTask,
    cancelAgentImageTask,
    submitAgentQuestionAnswers,
    cancelAgentQuestion,
  }
}
