import { Agent, ProviderTransport, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, useRef, useState } from 'react'

import { attachmentToAgentAttachment, type AgentChatAttachment } from './agentChat'
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
  createAgentSession,
  deleteAgentSession,
  listAgentSessions,
  loadAgentSession,
  saveAgentSessionSidecar,
  updateAgentSessionConfig,
} from './sessionStore'
import type { AgentSessionSummary } from './sessionTypes'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import {
  createAgentImageTools,
  type AgentImageToolResult,
  type GenImageToolArgs,
  type ReadImageToolArgs,
} from './tools'
import {
  AGENT_MODEL_CONFIGS,
  DEFAULT_AGENT_MODEL,
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import { MODEL_CONFIGS, defaultOptionsFor, type ModelConfig } from '../config/models'
import { useExternalSync, useLatestRef, useMountEffect } from '../hooks/effects'
import type { useApiKey } from '../hooks/useApiKey'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import { putBlobInCache, getBlobFromCache } from '../hooks/useImageSrc'
import { readFileAsImageData } from '../lib/fileToImage'
import { loadImageBlob, loadImageMetas } from '../lib/history'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { isKeyError } from '../lib/validateKey'

const AGENT_MAX_ATTACHMENTS = 8

type ApiKeyHook = ReturnType<typeof useApiKey>
type ProviderCredentials = { apiKey: string; baseUrl?: string }

export type UseAgentPlaygroundParams = {
  initialSessionId: string | null
  googleKeyHook: ApiKeyHook
  openaiKeyHook: ApiKeyHook
  referenceImages: PlaygroundImage[]
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
  getProviderCredentials: (provider: ModelConfig['provider']) => ProviderCredentials
  invalidateGenerationKey: (provider: ModelConfig['provider']) => void
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
      return 'The human user manually canceled this image generation while it was running. Do not retry without explicit user direction; ask what they want to change.'
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

function toolTextResult(text: string, details: unknown): AgentImageToolResult {
  return { content: [{ type: 'text', text }], details }
}

function restoreAgentImageTasks(tasks: AgentImageTask[]): AgentImageTask[] {
  return tasks.map((task) => {
    if (task.status !== 'approved' && task.status !== 'queued' && task.status !== 'running') return task
    return {
      ...task,
      status: 'canceled',
      error: task.error ?? '页面刷新或切换会话中断了这次生成任务。',
    }
  })
}

export function useAgentPlayground({
  initialSessionId,
  googleKeyHook,
  openaiKeyHook,
  referenceImages,
  history,
  generationJobs,
  getProviderCredentials,
  invalidateGenerationKey,
  enqueueGenerationJob,
  cancelGenerationJob,
  dismissGenerationJob,
}: UseAgentPlaygroundParams) {
  const [agentModelId, setAgentModelId] = useState(DEFAULT_AGENT_MODEL.id)
  const agentModel = resolveAgentModelConfig(agentModelId)
  const [agentThinkingLevel, setAgentThinkingLevelState] = useState<AgentThinkingLevel>('low')
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentStreamingMessage, setAgentStreamingMessage] = useState<AgentMessage | null>(null)
  const [agentIsStreaming, setAgentIsStreaming] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentDraft, setAgentDraft] = useState('')
  const [agentAttachments, setAgentAttachments] = useState<AgentChatAttachment[]>([])
  const [agentAttachmentError, setAgentAttachmentError] = useState<string | null>(null)
  const [autoApproveAgentImageTasks, setAutoApproveAgentImageTasksState] = useState(false)
  const [agentImageTasks, setAgentImageTasksState] = useState<AgentImageTask[]>([])
  const [agentSessions, setAgentSessions] = useState<AgentSessionSummary[]>([])
  const [currentAgentSessionId, setCurrentAgentSessionId] = useState<string | null>(null)
  const [agentSessionsLoading, setAgentSessionsLoading] = useState(true)

  const agentRef = useRef<Agent | null>(null)
  const agentToolsRef = useRef<Agent['state']['tools']>([])
  const autoApproveAgentImageTasksRef = useRef(false)
  const agentImageTasksRef = useRef<AgentImageTask[]>([])
  const agentImageRegistryRef = useRef<Map<string, AgentImageRegistryEntry>>(new Map())
  const agentTurnCallbacksRef = useRef<Map<string, AgentTurnCallbackState>>(new Map())
  const currentAgentTurnIdRef = useRef<string | null>(null)
  const currentAgentSessionIdRef = useRef<string | null>(null)
  const currentAgentSessionLeafEntryIdRef = useRef<string | null>(null)
  const agentSessionPersistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const agentSessionSidecarPersistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const agentSessionReadyRef = useRef(false)
  const agentSessionSidecarDebounceRef = useRef<number>(0)
  const referenceImagesRef = useRef<PlaygroundImage[]>([])
  const historyRef = useRef<PlaygroundImageMeta[]>([])
  const generationJobsRefForAgent = useRef<GenerationJob[]>([])
  const agentCredentialsRef = useRef({
    google: { apiKey: googleKeyHook.apiKey, baseUrl: googleKeyHook.baseUrl },
    openai: { apiKey: openaiKeyHook.apiKey, baseUrl: openaiKeyHook.baseUrl },
  })

  useExternalSync(() => {
    agentCredentialsRef.current = {
      google: { apiKey: googleKeyHook.apiKey, baseUrl: googleKeyHook.baseUrl },
      openai: { apiKey: openaiKeyHook.apiKey, baseUrl: openaiKeyHook.baseUrl },
    }
  }, [googleKeyHook.apiKey, googleKeyHook.baseUrl, openaiKeyHook.apiKey, openaiKeyHook.baseUrl])

  const setAgentImageTasks = useCallback((updater: (prev: AgentImageTask[]) => AgentImageTask[]) => {
    const next = updater(agentImageTasksRef.current)
    agentImageTasksRef.current = next
    setAgentImageTasksState(next)
    return next
  }, [])

  const setAutoApproveAgentImageTasks = useCallback((value: boolean) => {
    autoApproveAgentImageTasksRef.current = value
    setAutoApproveAgentImageTasksState(value)
    const sessionId = currentAgentSessionIdRef.current
    if (sessionId) {
      void updateAgentSessionConfig(sessionId, { autoApproveImageTasks: value }).then((record) => {
        if (!record) return
        setAgentSessions((prev) => [record, ...prev.filter((item) => item.id !== record.id)])
      })
    }
  }, [])

  const upsertAgentSessionSummary = useCallback((record: AgentSessionSummary) => {
    setAgentSessions((prev) =>
      [record, ...prev.filter((item) => item.id !== record.id)].sort((a, b) => b.updatedAt - a.updatedAt),
    )
  }, [])

  const persistCurrentAgentSidecar = useCallback(() => {
    const sessionId = currentAgentSessionIdRef.current
    if (!sessionId || !agentSessionReadyRef.current) return Promise.resolve()
    const payload = {
      sessionId,
      draft: agentDraft,
      attachments: agentAttachments,
      imageTasks: agentImageTasksRef.current,
      imageRegistry: Array.from(agentImageRegistryRef.current.values()),
      turnCallbacks: Array.from(agentTurnCallbacksRef.current.values()),
      currentAgentTurnId: currentAgentTurnIdRef.current,
    }
    const write = agentSessionSidecarPersistQueueRef.current.then(() => saveAgentSessionSidecar(payload))
    agentSessionSidecarPersistQueueRef.current = write.catch(() => undefined)
    return write.catch(() => undefined)
  }, [agentAttachments, agentDraft])

  const canLeaveCurrentAgentSession = useCallback(() => {
    const activeTask = agentImageTasksRef.current.find((task) => !isTerminalAgentImageTaskStatus(task.status))
    if (!activeTask) return true
    setAgentError('当前对话还有未完成的 Agent 生图任务，请先审批、取消或等待完成后再切换对话。')
    return false
  }, [])

  useExternalSync(() => {
    referenceImagesRef.current = referenceImages
  }, [referenceImages])

  useExternalSync(() => {
    historyRef.current = history
  }, [history])

  useExternalSync(() => {
    generationJobsRefForAgent.current = generationJobs
  }, [generationJobs])

  useExternalSync(() => {
    void agentDraft
    void agentAttachments
    void agentImageTasks
    if (!currentAgentSessionId || !agentSessionReadyRef.current) return
    window.clearTimeout(agentSessionSidecarDebounceRef.current)
    agentSessionSidecarDebounceRef.current = window.setTimeout(() => {
      void persistCurrentAgentSidecar()
    }, 400)
    return () => window.clearTimeout(agentSessionSidecarDebounceRef.current)
  }, [currentAgentSessionId, agentDraft, agentAttachments, agentImageTasks, persistCurrentAgentSidecar])

  const setAgentModelIdForSession = useCallback(
    (modelId: string) => {
      setAgentModelId(modelId)
      const sessionId = currentAgentSessionIdRef.current
      if (!sessionId) return
      void updateAgentSessionConfig(sessionId, { modelId }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [upsertAgentSessionSummary],
  )

  const setAgentThinkingLevel = useCallback(
    (level: AgentThinkingLevel) => {
      setAgentThinkingLevelState(level)
      const sessionId = currentAgentSessionIdRef.current
      if (!sessionId) return
      void updateAgentSessionConfig(sessionId, { thinkingLevel: level }).then((record) => {
        if (record) upsertAgentSessionSummary(record)
      })
    },
    [upsertAgentSessionSummary],
  )

  const syncAgentSnapshot = useCallback((agent: Agent) => {
    setAgentMessages(agent.state.messages.slice())
    setAgentStreamingMessage(getAgentStreamingMessage(agent))
    setAgentIsStreaming(agent.state.isStreaming)
    setAgentError(getAgentError(agent))
  }, [])

  const getAgentBaseUrl = useCallback(
    (provider: AgentModelProvider) => agentCredentialsRef.current[provider].baseUrl,
    [],
  )

  const applyAgentRuntimeConfig = useCallback(
    (agent: Agent, config = agentModel, thinkingLevel = agentThinkingLevel) => {
      agent.state.systemPrompt = AGENT_SYSTEM_PROMPT
      agent.state.model = agentModelWithBaseUrl(config, getAgentBaseUrl(config.provider))
      agent.state.thinkingLevel = config.supportsThinking ? thinkingLevel : 'off'
      agent.state.tools = agentToolsRef.current
    },
    [agentModel, agentThinkingLevel, getAgentBaseUrl],
  )

  const getOrCreateAgent = useCallback(() => {
    if (agentRef.current) return agentRef.current
    const agent = new Agent({
      transport: new ProviderTransport({
        getApiKey: (provider) => {
          if (provider === 'google' || provider === 'openai') {
            return agentCredentialsRef.current[provider].apiKey || undefined
          }
          return undefined
        },
      }),
      initialState: {
        systemPrompt: AGENT_SYSTEM_PROMPT,
        model: agentModelWithBaseUrl(agentModel, getAgentBaseUrl(agentModel.provider)),
        thinkingLevel: agentModel.supportsThinking ? agentThinkingLevel : 'off',
        tools: agentToolsRef.current,
        messages: [],
      },
    })
    agent.subscribe((event) => {
      syncAgentSnapshot(agent)
      if (event.type !== 'message_end') return
      const sessionId = currentAgentSessionIdRef.current
      if (!sessionId) return
      agentSessionPersistQueueRef.current = agentSessionPersistQueueRef.current
        .then(async () => {
          const parentId = currentAgentSessionLeafEntryIdRef.current
          const result = await appendAgentSessionMessage({ sessionId, parentId, message: event.message })
          if (currentAgentSessionIdRef.current === sessionId) {
            currentAgentSessionLeafEntryIdRef.current = result.entryId
          }
          upsertAgentSessionSummary(result.record)
        })
        .catch((error: unknown) => {
          setAgentError(error instanceof Error ? error.message : String(error))
        })
    })
    agentRef.current = agent
    return agent
  }, [agentModel, agentThinkingLevel, getAgentBaseUrl, syncAgentSnapshot, upsertAgentSessionSummary])

  const loadAgentSessionIntoRuntime = useCallback(
    (session: Awaited<ReturnType<typeof loadAgentSession>>) => {
      if (!session) return
      agentSessionReadyRef.current = false
      const config = resolveAgentModelConfig(session.record.modelId)
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

      currentAgentSessionIdRef.current = session.record.id
      currentAgentSessionLeafEntryIdRef.current = session.record.leafEntryId
      currentAgentTurnIdRef.current = session.sidecar.currentAgentTurnId
      agentImageTasksRef.current = restoredTasks
      agentImageRegistryRef.current = new Map(restoredRegistry.map((entry) => [entry.id, entry]))
      agentTurnCallbacksRef.current = new Map(
        session.sidecar.turnCallbacks.map((callback) => [callback.agentTurnId, callback]),
      )
      autoApproveAgentImageTasksRef.current = session.record.autoApproveImageTasks

      setCurrentAgentSessionId(session.record.id)
      setAgentModelId(session.record.modelId)
      setAgentThinkingLevelState(session.record.thinkingLevel)
      setAutoApproveAgentImageTasksState(session.record.autoApproveImageTasks)
      setAgentDraft(session.sidecar.draft)
      setAgentAttachments(session.sidecar.attachments)
      setAgentAttachmentError(null)
      setAgentImageTasksState(restoredTasks)
      setAgentError(null)

      const agent = getOrCreateAgent()
      applyAgentRuntimeConfig(agent, config, session.record.thinkingLevel)
      agent.state.error = undefined
      agent.state.streamMessage = null
      agent.state.pendingToolCalls = new Set()
      agent.replaceMessages(session.messages)
      syncAgentSnapshot(agent)
      agentSessionReadyRef.current = true
    },
    [applyAgentRuntimeConfig, getOrCreateAgent, syncAgentSnapshot],
  )

  const createNewAgentSession = useCallback(async () => {
    if (agentRef.current?.state.isStreaming) return
    if (!canLeaveCurrentAgentSession()) return
    await agentSessionPersistQueueRef.current
    await persistCurrentAgentSidecar()
    await agentSessionSidecarPersistQueueRef.current
    const record = await createAgentSession({
      modelId: agentModel.id,
      thinkingLevel: agentThinkingLevel,
      autoApproveImageTasks: autoApproveAgentImageTasks,
    })
    upsertAgentSessionSummary(record)
    loadAgentSessionIntoRuntime({
      record,
      messages: [],
      sidecar: {
        draft: '',
        attachments: [],
        imageTasks: [],
        imageRegistry: [],
        turnCallbacks: [],
        currentAgentTurnId: null,
      },
    })
  }, [
    agentModel.id,
    agentThinkingLevel,
    autoApproveAgentImageTasks,
    canLeaveCurrentAgentSession,
    loadAgentSessionIntoRuntime,
    persistCurrentAgentSidecar,
    upsertAgentSessionSummary,
  ])

  const switchAgentSession = useCallback(
    (sessionId: string) => {
      if (sessionId === currentAgentSessionIdRef.current || agentRef.current?.state.isStreaming) return
      if (!canLeaveCurrentAgentSession()) return
      void (async () => {
        await agentSessionPersistQueueRef.current
        await persistCurrentAgentSidecar()
        await agentSessionSidecarPersistQueueRef.current
        const session = await loadAgentSession(sessionId)
        loadAgentSessionIntoRuntime(session)
      })().catch((error: unknown) => {
        setAgentError(error instanceof Error ? error.message : String(error))
      })
    },
    [canLeaveCurrentAgentSession, loadAgentSessionIntoRuntime, persistCurrentAgentSidecar],
  )

  const removeAgentSession = useCallback(
    (sessionId: string) => {
      if (agentRef.current?.state.isStreaming) return
      if (sessionId === currentAgentSessionIdRef.current && !canLeaveCurrentAgentSession()) return
      void (async () => {
        await agentSessionPersistQueueRef.current
        await deleteAgentSession(sessionId)
        const nextSessions = (await listAgentSessions()).filter((session) => session.id !== sessionId)
        setAgentSessions(nextSessions)
        if (sessionId !== currentAgentSessionIdRef.current) return
        const next = nextSessions[0]
        if (next) {
          loadAgentSessionIntoRuntime(await loadAgentSession(next.id))
        } else {
          agentSessionReadyRef.current = false
          currentAgentSessionIdRef.current = null
          setCurrentAgentSessionId(null)
          await createNewAgentSession()
        }
      })().catch((error: unknown) => {
        setAgentError(error instanceof Error ? error.message : String(error))
      })
    },
    [canLeaveCurrentAgentSession, createNewAgentSession, loadAgentSessionIntoRuntime],
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
    const agent = agentRef.current
    if (!agent) return
    applyAgentRuntimeConfig(agent)
    syncAgentSnapshot(agent)
  }, [applyAgentRuntimeConfig, syncAgentSnapshot])

  const addAgentAttachments = useCallback(
    (files: File[]) => {
      const remaining = AGENT_MAX_ATTACHMENTS - agentAttachments.length
      if (remaining <= 0) {
        setAgentAttachmentError(`最多附加 ${AGENT_MAX_ATTACHMENTS} 张图片`)
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
          setAgentAttachments((prev) => [...prev, ...attachments].slice(0, AGENT_MAX_ATTACHMENTS))
          setAgentAttachmentError(null)
        }
        if (errors.length > 0) setAgentAttachmentError(errors.join('\n'))
      })
    },
    [agentAttachments.length],
  )

  const addAgentImageAttachment = useCallback(
    (image: PlaygroundImage | PlaygroundImageMeta) => {
      if (agentAttachments.some((item) => item.id === image.id)) return
      const remaining = AGENT_MAX_ATTACHMENTS - agentAttachments.length
      if (remaining <= 0) {
        setAgentAttachmentError(`最多附加 ${AGENT_MAX_ATTACHMENTS} 张图片`)
        return
      }

      void (async () => {
        const data = 'data' in image ? image.data : (getBlobFromCache(image.id) ?? (await loadImageBlob(image.id)))
        if (!data) {
          setAgentAttachmentError('无法读取这张图片，请先打开图片或稍后重试。')
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
        agentImageRegistryRef.current.set(image.id, {
          id: image.id,
          image: { ...image, data },
          source: image.source.type === 'generated' ? 'generated' : 'history',
          status: 'ready',
          createdAt: image.timestamp,
        })
        setAgentAttachments((prev) => (prev.some((item) => item.id === image.id) ? prev : [...prev, attachment]))
        setAgentAttachmentError(null)
      })()
    },
    [agentAttachments],
  )

  const removeAgentAttachment = useCallback((id: string) => {
    setAgentAttachments((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAgentAttachmentError = useCallback(() => {
    setAgentAttachmentError(null)
  }, [])

  const imageIdExistsForAgent = useCallback(async (id: string): Promise<boolean> => {
    if (agentImageRegistryRef.current.has(id)) return true
    if (referenceImagesRef.current.some((image) => image.id === id)) return true
    if (historyRef.current.some((image) => image.id === id)) return true
    if (generationJobsRefForAgent.current.some((job) => job.slots.some((slot) => slot.image?.id === id))) return true
    const metas = await loadImageMetas([id])
    return metas.has(id)
  }, [])

  const resolveAgentImageById = useCallback(
    async (
      id: string,
    ): Promise<
      | { status: 'ready'; source: AgentImageRegistryEntry['source']; image: PlaygroundImage }
      | { status: 'not_ready'; source: AgentImageRegistryEntry['source'] }
      | null
    > => {
      const reference = referenceImagesRef.current.find((image) => image.id === id)
      if (reference) return { status: 'ready', source: 'reference', image: reference }

      const registryEntry = agentImageRegistryRef.current.get(id)
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
    async (ids: string[]): Promise<PlaygroundImage[]> => {
      const images: PlaygroundImage[] = []
      for (const id of ids) {
        const result = await resolveAgentImageById(id)
        if (!result) throw new Error(`Reference image does not exist: ${id}`)
        if (result.status !== 'ready') throw new Error(`Reference image is not ready: ${id}`)
        images.push(result.image)
      }
      return images
    },
    [resolveAgentImageById],
  )

  const sendAgentSystemEvent = useCallback(
    async (text: string): Promise<boolean> => {
      const credentials = agentCredentialsRef.current[agentModel.provider]
      if (!credentials.apiKey) {
        setAgentError(`Agent 需要 ${agentModel.providerLabel} API Key 才能接收任务完成回调。`)
        return false
      }

      const agent = getOrCreateAgent()
      applyAgentRuntimeConfig(agent, agentModel)
      currentAgentTurnIdRef.current = crypto.randomUUID()
      if (agent.state.isStreaming) {
        await agent.queueMessage({ role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() })
      } else {
        await agent.prompt(text)
      }
      syncAgentSnapshot(agent)
      return true
    },
    [agentModel, applyAgentRuntimeConfig, getOrCreateAgent, syncAgentSnapshot],
  )

  const maybeDispatchAgentImageCallbacks = useCallback(
    (tasks = agentImageTasksRef.current) => {
      if (agentRef.current?.state.isStreaming) return
      for (const callbackState of agentTurnCallbacksRef.current.values()) {
        if (callbackState.callbackQueued || callbackState.taskIds.length === 0) continue
        const turnTasks = callbackState.taskIds
          .map((taskId) => tasks.find((task) => task.id === taskId))
          .filter((task): task is AgentImageTask => Boolean(task))
        if (turnTasks.length !== callbackState.taskIds.length) continue
        if (!turnTasks.every((task) => isTerminalAgentImageTaskStatus(task.status))) continue

        const text = buildAgentTaskCallbackText(turnTasks)
        callbackState.callbackQueued = true
        void sendAgentSystemEvent(text)
          .then((sent) => {
            if (!sent) callbackState.callbackQueued = false
          })
          .catch((error: unknown) => {
            callbackState.callbackQueued = false
            const message = error instanceof Error ? error.message : String(error)
            setAgentError(message)
          })
      }
    },
    [sendAgentSystemEvent],
  )

  const startAgentImageTask = useCallback(
    async (task: AgentImageTask): Promise<{ ok: boolean; message: string }> => {
      setAgentImageTasks((prev) =>
        prev.map((item) =>
          item.id === task.id && item.status === 'pending_approval' ? { ...item, status: 'approved' } : item,
        ),
      )

      const modelConfig = findModelConfig(task.request.modelId)
      if (!modelConfig) {
        const message = `Unknown GenImage model: ${task.request.modelId}.`
        const next = setAgentImageTasks((prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) agentImageRegistryRef.current.delete(id)
        maybeDispatchAgentImageCallbacks(next)
        return { ok: false, message }
      }

      const credentials = getProviderCredentials(modelConfig.provider)
      if (!credentials.apiKey) {
        const message = `使用 ${modelConfig.name} 需要先配置 ${modelConfig.provider === 'google' ? 'Gemini' : 'OpenAI'} API Key。`
        const next = setAgentImageTasks((prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) agentImageRegistryRef.current.delete(id)
        maybeDispatchAgentImageCallbacks(next)
        return { ok: false, message }
      }

      let referenceImages: PlaygroundImage[]
      try {
        referenceImages = await resolveAgentReferenceImages(task.request.referenceImageIds)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const next = setAgentImageTasks((prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) agentImageRegistryRef.current.delete(id)
        maybeDispatchAgentImageCallbacks(next)
        return { ok: false, message }
      }

      const currentTask = agentImageTasksRef.current.find((item) => item.id === task.id)
      if (!currentTask || isTerminalAgentImageTaskStatus(currentTask.status)) {
        return { ok: false, message: '任务已经取消。' }
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
      setAgentImageTasks((prev) =>
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
      return { ok: true, message: '任务已经提交并开始生成。' }
    },
    [
      enqueueGenerationJob,
      getProviderCredentials,
      maybeDispatchAgentImageCallbacks,
      resolveAgentReferenceImages,
      setAgentImageTasks,
    ],
  )

  const approveAgentImageTask = useCallback(
    (taskId: string) => {
      const task = agentImageTasksRef.current.find((item) => item.id === taskId)
      if (!task || task.status !== 'pending_approval') return
      void startAgentImageTask(task)
    },
    [startAgentImageTask],
  )

  const cancelAgentImageTask = useCallback(
    (taskId: string) => {
      const task = agentImageTasksRef.current.find((item) => item.id === taskId)
      if (!task) return
      if (task.status === 'pending_approval') {
        const next = setAgentImageTasks((prev) =>
          prev.map((item) => (item.id === taskId ? { ...item, status: 'rejected' } : item)),
        )
        for (const id of task.request.reservedImageIds) agentImageRegistryRef.current.delete(id)
        maybeDispatchAgentImageCallbacks(next)
        return
      }
      if (task.generationJobId) cancelGenerationJob(task.generationJobId)
      const job = task.generationJobId
        ? generationJobsRefForAgent.current.find((item) => item.id === task.generationJobId)
        : undefined
      const resultImageIds = job?.slots.flatMap((slot) => (slot.image ? [slot.image.id] : [])) ?? task.resultImageIds
      const fulfilledIds = new Set(resultImageIds)
      for (const id of task.request.reservedImageIds) {
        if (!fulfilledIds.has(id)) agentImageRegistryRef.current.delete(id)
      }
      const next = setAgentImageTasks((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: 'canceled', resultImageIds } : item)),
      )
      maybeDispatchAgentImageCallbacks(next)
    },
    [cancelGenerationJob, maybeDispatchAgentImageCallbacks, setAgentImageTasks],
  )

  const runGenImageTool = useCallback(
    async (toolCallId: string, args: GenImageToolArgs, signal?: AbortSignal): Promise<AgentImageToolResult> => {
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
      const referenceImages = await resolveAgentReferenceImages(referenceImageIds)
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const editSource = referenceImages.find((image) => image.source.type === 'generated')
      const reserved = await reserveAgentImageIds({
        requestedImageId: args.image_id,
        count: batchCount,
        isReserved: (id) => agentImageRegistryRef.current.has(id),
        exists: imageIdExistsForAgent,
      })
      const activeOptions = activeOptionsForModel(modelConfig, defaultOptionsFor(modelConfig))
      const task: AgentImageTask = {
        id: crypto.randomUUID(),
        toolCallId,
        agentTurnId: currentAgentTurnIdRef.current ?? crypto.randomUUID(),
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

      const callbackState = agentTurnCallbacksRef.current.get(task.agentTurnId) ?? {
        agentTurnId: task.agentTurnId,
        taskIds: [],
        callbackQueued: false,
      }
      callbackState.taskIds.push(task.id)
      agentTurnCallbacksRef.current.set(task.agentTurnId, callbackState)

      for (const id of reserved.reservedImageIds) {
        agentImageRegistryRef.current.set(id, {
          id,
          source: 'generated',
          status: 'reserved',
          createdAt: task.createdAt,
        })
      }
      setAgentImageTasks((prev) => [task, ...prev])

      const startResult = autoApproveAgentImageTasksRef.current ? await startAgentImageTask(task) : null
      const status = autoApproveAgentImageTasksRef.current
        ? startResult?.ok
          ? 'queued'
          : 'failed'
        : 'pending_approval'
      const message = autoApproveAgentImageTasksRef.current
        ? (startResult?.message ?? '任务已经提交并自动开始生成。')
        : reserved.renamed
          ? `任务已经提交，等待用户审批。image_id 已预留为 ${reserved.reservedImageIds.join('、')}。`
          : '任务已经提交，等待用户审批。'
      const payload = {
        status,
        task_id: task.id,
        requested_image_id: reserved.requestedImageId,
        reserved_image_ids: reserved.reservedImageIds,
        renamed: reserved.renamed,
        message,
      }
      return toolTextResult(JSON.stringify(payload, null, 2), payload)
    },
    [imageIdExistsForAgent, resolveAgentReferenceImages, setAgentImageTasks, startAgentImageTask],
  )

  const runReadImageTool = useCallback(
    async (_toolCallId: string, args: ReadImageToolArgs): Promise<AgentImageToolResult> => {
      const imageId = args.image_id.trim()
      const missing = '<tool_use_error>Image does not exist.</tool_use_error>'
      if (!imageId) return toolTextResult(missing, { status: 'error', image_id: imageId })

      const result = await resolveAgentImageById(imageId)
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
          { type: 'image', data: result.image.data, mimeType: result.image.mimeType },
        ],
        details: payload,
      }
    },
    [resolveAgentImageById],
  )

  // useApiKey returns a fresh object each render, so runGenImageTool /
  // runReadImageTool would change every render too. Register the tools once
  // with stable wrapper functions that delegate to the latest implementation
  // via ref — otherwise this effect re-fires on every render and pumps state
  // updates into the agent, causing infinite re-render once the agent exists.
  const runGenImageToolRef = useLatestRef(runGenImageTool)
  const runReadImageToolRef = useLatestRef(runReadImageTool)
  useMountEffect(() => {
    agentToolsRef.current = createAgentImageTools({
      imageModels: MODEL_CONFIGS,
      genImage: (toolCallId, args, signal) => runGenImageToolRef.current(toolCallId, args, signal),
      readImage: (toolCallId, args) => runReadImageToolRef.current(toolCallId, args),
    })
    if (agentRef.current) {
      agentRef.current.state.tools = agentToolsRef.current
    }
  })

  useExternalSync(() => {
    void agentModel.id
    void googleKeyHook.apiKey
    void openaiKeyHook.apiKey
    maybeDispatchAgentImageCallbacks()
  }, [agentModel.id, googleKeyHook.apiKey, maybeDispatchAgentImageCallbacks, openaiKeyHook.apiKey])

  useExternalSync(() => {
    let changed = false
    const next = agentImageTasksRef.current.map((task) => {
      if (!task.generationJobId || isTerminalAgentImageTaskStatus(task.status)) return task
      const job = generationJobs.find((item) => item.id === task.generationJobId)
      if (!job) return task
      const resultImageIds = job.slots.flatMap((slot) => (slot.image ? [slot.image.id] : []))
      const nextStatus = agentTaskStatusFromGenerationJob(job)
      const nextError = errorFromGenerationJob(job)
      if (nextStatus === 'completed') dismissGenerationJob(job.id)
      for (const slot of job.slots) {
        if (slot.image) {
          agentImageRegistryRef.current.set(slot.image.id, {
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
          if (!fulfilledIds.has(id)) agentImageRegistryRef.current.delete(id)
        }
      }
      return updated
    })
    if (!changed) return
    agentImageTasksRef.current = next
    setAgentImageTasksState(next)
    maybeDispatchAgentImageCallbacks(next)
  }, [dismissGenerationJob, generationJobs, maybeDispatchAgentImageCallbacks])

  const sendAgentMessage = useCallback(() => {
    const trimmed = agentDraft.trim()
    if (agentIsStreaming || (!trimmed && agentAttachments.length === 0)) return
    if (!currentAgentSessionIdRef.current) {
      setAgentError('Agent 对话还在加载，请稍后再发送。')
      return
    }

    const credentials = agentCredentialsRef.current[agentModel.provider]
    if (!credentials.apiKey) {
      setAgentError(`使用 ${agentModel.label} 需要先配置 ${agentModel.providerLabel} API Key。`)
      return
    }

    const agent = getOrCreateAgent()
    applyAgentRuntimeConfig(agent, agentModel)
    const images = agentAttachments.map(attachmentToAgentAttachment)
    const attachmentIds = agentAttachments.map((attachment) => attachment.id)
    const attachmentNote = attachmentIds.length > 0 ? `\n\n可用附件图片 ID：${attachmentIds.join('、')}` : ''
    const promptText = `${trimmed || '请分析这些图片。'}${attachmentNote}`
    for (const attachment of agentAttachments) {
      if (agentImageRegistryRef.current.get(attachment.id)?.status === 'ready') continue
      agentImageRegistryRef.current.set(attachment.id, {
        id: attachment.id,
        image: attachment,
        source: 'agent_attachment',
        status: 'ready',
        createdAt: Date.now(),
      })
    }
    currentAgentTurnIdRef.current = crypto.randomUUID()
    setAgentDraft('')
    setAgentAttachments([])
    setAgentAttachmentError(null)
    syncAgentSnapshot(agent)

    void agent
      .prompt(promptText, images)
      .then(() => {
        const message = getAgentError(agent)
        if (message && isKeyError(message)) invalidateGenerationKey(agentModel.provider)
      })
      .finally(() => syncAgentSnapshot(agent))
      .finally(() => maybeDispatchAgentImageCallbacks())
  }, [
    agentAttachments,
    agentDraft,
    agentIsStreaming,
    agentModel,
    applyAgentRuntimeConfig,
    getOrCreateAgent,
    invalidateGenerationKey,
    maybeDispatchAgentImageCallbacks,
    syncAgentSnapshot,
  ])

  const stopAgentMessage = useCallback(() => {
    agentRef.current?.abort()
  }, [])

  const clearAgentChat = useCallback(() => {
    void createNewAgentSession()
  }, [createNewAgentSession])

  return {
    agentModels: AGENT_MODEL_CONFIGS,
    agentModel,
    agentThinkingLevel,
    agentMessages,
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
    setAgentModelId: setAgentModelIdForSession,
    setAgentThinkingLevel,
    createAgentSession: createNewAgentSession,
    switchAgentSession,
    deleteAgentSession: removeAgentSession,
    setAutoApproveAgentImageTasks,
    setAgentDraft,
    addAgentAttachments,
    addAgentImageAttachment,
    removeAgentAttachment,
    clearAgentAttachmentError,
    sendAgentMessage,
    stopAgentMessage,
    clearAgentChat,
    approveAgentImageTask,
    cancelAgentImageTask,
  }
}
