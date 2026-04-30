import { Agent, ProviderTransport, type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useState, useCallback, useRef } from 'react'

import { useExternalSync, useMountEffect } from './effects'
import { useApiKey } from './useApiKey'
import { useGenerationQueue, type GenerationJob } from './useGenerationQueue'
import { putBlobInCache, getBlobFromCache, removeBlobFromCache } from './useImageSrc'
import {
  AGENT_PROMPT_DEFAULT_LINE_LIMIT,
  attachmentToAgentAttachment,
  createAgentImageTools,
  formatPromptLines,
  isTerminalAgentImageTaskStatus,
  promptLineCount,
  reserveAgentImageIds,
  type AgentChatAttachment,
  type AgentImageRegistryEntry,
  type AgentImageTask,
  type AgentImageTaskStatus,
  type AgentImageToolResult,
  type AgentTurnCallbackState,
  type GenImageToolArgs,
  type ReadImageToolArgs,
} from '../agent'
import {
  AGENT_MODEL_CONFIGS,
  DEFAULT_AGENT_MODEL,
  agentModelWithBaseUrl,
  resolveAgentModelConfig,
  type AgentModelProvider,
  type AgentThinkingLevel,
} from '../config/agentModels'
import {
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  coerceOptionValue,
  defaultOptionsFor,
  serializeOptionValue,
  type ModelConfig,
} from '../config/models'
import { readFileAsImageData } from '../lib/fileToImage'
import {
  loadHistoryPage,
  deleteFromHistory,
  loadImageBlob,
  loadImageBlobs,
  loadImageMetas,
  saveDraftRefs,
  loadDraftRefs,
  clearDraftRefs,
} from '../lib/history'
import type { GeneratedSource, PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { readSimpleUrlParams, updateUrl } from '../lib/urlState'
import { isKeyError } from '../lib/validateKey'

export type {
  GenerationJob,
  GenerationQueueSummary,
  GenerationSlot,
  GenerationSlotStatus,
  RetryGenerationSlotResult,
} from './useGenerationQueue'

export type RerollGeneratedImageResult =
  | { status: 'queued'; batchId: string }
  | { status: 'unsupported-mask' }
  | { status: 'unavailable' }

export type InputMode = 'generate' | 'agent'

const HISTORY_PAGE_SIZE = 20
const AGENT_MAX_ATTACHMENTS = 8
const AGENT_SYSTEM_PROMPT =
  '你是 Imagine Playground 里的图像创作助手。用中文回答，帮助用户分析图片、打磨提示词、比较模型选择，并保持回答简洁可执行。'

// Read simple URL params once at module load to safely init useState
const _initial = readSimpleUrlParams()

function resolveModel(modelId: string | null): ModelConfig {
  if (modelId) {
    const found = MODEL_CONFIGS.find((m) => m.id === modelId)
    if (found) return found
  }
  return DEFAULT_MODEL
}

// Build the initial options bag from defaults + URL rawParams for the given model.
function initialOptionsFor(model: ModelConfig, rawParams: Record<string, string>): Record<string, unknown> {
  const bag: Record<string, unknown> = {}
  for (const opt of model.options ?? []) {
    bag[opt.id] = coerceOptionValue(opt, rawParams[opt.urlKey])
  }
  return bag
}

function findModelConfig(modelId: string): ModelConfig | null {
  return MODEL_CONFIGS.find((item) => item.id === modelId) ?? null
}

function optionsForGeneratedSource(model: ModelConfig, source: GeneratedSource): Record<string, unknown> {
  const next = defaultOptionsFor(model)
  for (const opt of model.options ?? []) {
    if (source.options && opt.id in source.options) {
      next[opt.id] = source.options[opt.id]
    } else if (opt.id === 'quality' && source.quality) {
      next[opt.id] = source.quality
    } else if (opt.id === 'webSearch' && source.searchTools?.web !== undefined) {
      next[opt.id] = source.searchTools.web
    } else if (opt.id === 'imageSearch' && source.searchTools?.image !== undefined) {
      next[opt.id] = source.searchTools.image
    }
  }
  return next
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

function buildAgentTaskCallbackText(tasks: AgentImageTask[]): string {
  const lines = ['<system>']
  for (const task of tasks) {
    lines.push(`tool GenImage call ${task.toolCallId} has been finished.`)
    lines.push(`status: ${task.status}`)
    lines.push(`requested_image_id: ${task.request.requestedImageId}`)
    lines.push(`reserved_image_ids: ${task.request.reservedImageIds.join(', ')}`)
    lines.push(`image_ids: ${task.resultImageIds.join(', ')}`)
    if (task.error) lines.push(`error: ${task.error}`)
    lines.push('')
  }
  if (lines[lines.length - 1] === '') lines.pop()
  lines.push('</system>')
  return lines.join('\n')
}

function toolTextResult(text: string, details: unknown): AgentImageToolResult {
  return { content: [{ type: 'text', text }], details }
}

export function usePlayground() {
  const googleKeyHook = useApiKey('google')
  const openaiKeyHook = useApiKey('openai')
  const [model, setModel] = useState<ModelConfig>(() => resolveModel(_initial.modelId))
  const apiKeyHook = model.provider === 'google' ? googleKeyHook : openaiKeyHook
  const [resolution, setResolutionRaw] = useState(() => {
    const m = resolveModel(_initial.modelId)
    if (_initial.resolution && m.resolutions.includes(_initial.resolution)) return _initial.resolution
    return m.defaultResolution
  })
  const [aspectRatio, setAspectRatioRaw] = useState(() => {
    const m = resolveModel(_initial.modelId)
    if (_initial.aspectRatio && m.aspectRatios.includes(_initial.aspectRatio)) return _initial.aspectRatio
    return m.defaultAspectRatio
  })
  const [batchCount, setBatchCountRaw] = useState(() => {
    const m = resolveModel(_initial.modelId)
    if (_initial.batchCount !== null) return Math.min(Math.max(1, _initial.batchCount), m.maxBatchCount)
    return 1
  })
  const [options, setOptionsState] = useState<Record<string, unknown>>(() =>
    initialOptionsFor(resolveModel(_initial.modelId), _initial.rawParams),
  )
  const [prompt, setPromptRaw] = useState(_initial.prompt ?? '')
  const [inputMode, setInputMode] = useState<InputMode>('generate')
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
  const [focusedAgentImageTaskId, setFocusedAgentImageTaskId] = useState<string | null>(null)

  const [referenceImages, setReferenceImages] = useState<PlaygroundImage[]>([])
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null)
  const [history, setHistory] = useState<PlaygroundImageMeta[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const historyLoadingRef = useRef(false)
  const agentRef = useRef<Agent | null>(null)
  const agentToolsRef = useRef<Agent['state']['tools']>([])
  const autoApproveAgentImageTasksRef = useRef(false)
  const agentImageTasksRef = useRef<AgentImageTask[]>([])
  const agentImageRegistryRef = useRef<Map<string, AgentImageRegistryEntry>>(new Map())
  const agentTurnCallbacksRef = useRef<Map<string, AgentTurnCallbackState>>(new Map())
  const currentAgentTurnIdRef = useRef<string | null>(null)
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

  const getProviderCredentials = useCallback(
    (provider: ModelConfig['provider']) => {
      const keyHook = provider === 'google' ? googleKeyHook : openaiKeyHook
      return { apiKey: keyHook.apiKey, baseUrl: keyHook.baseUrl }
    },
    [googleKeyHook, openaiKeyHook],
  )

  const invalidateGenerationKey = useCallback(
    (provider: ModelConfig['provider']) => {
      if (provider === 'google') googleKeyHook.invalidate()
      else openaiKeyHook.invalidate()
    },
    [googleKeyHook, openaiKeyHook],
  )

  const onGeneratedImageSaved = useCallback((image: PlaygroundImage) => {
    const { data: _, ...meta } = image
    setHistory((prev) => (prev.some((item) => item.id === meta.id) ? prev : [meta, ...prev]))
  }, [])

  const {
    generationJobs,
    generationQueueSummary,
    generationConcurrency,
    setGenerationConcurrency,
    enqueueGenerationJob,
    appendGenerationSlot,
    findActiveGenerationJob,
    retryGenerationSlot,
    cancelGenerationSlot,
    cancelGenerationJob,
    dismissGenerationJob,
  } = useGenerationQueue({
    getProviderCredentials,
    invalidateGenerationKey,
    onImageSaved: onGeneratedImageSaved,
  })

  const setAgentImageTasks = useCallback((updater: (prev: AgentImageTask[]) => AgentImageTask[]) => {
    const next = updater(agentImageTasksRef.current)
    agentImageTasksRef.current = next
    setAgentImageTasksState(next)
    return next
  }, [])

  const setAutoApproveAgentImageTasks = useCallback((value: boolean) => {
    autoApproveAgentImageTasksRef.current = value
    setAutoApproveAgentImageTasksState(value)
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

  // Load first page of history on mount
  useMountEffect(() => {
    void loadHistoryPage(0, HISTORY_PAGE_SIZE)
      .then(({ items, hasMore }) => {
        setHistory(items)
        setHistoryHasMore(hasMore)
      })
      .catch(() => {
        setHistory([])
        setHistoryHasMore(false)
      })
  })

  // Load persisted draft reference images on mount
  const draftRefsLoadedRef = useRef(false)
  useMountEffect(() => {
    void loadDraftRefs()
      .then((images) => {
        if (images.length > 0) {
          setReferenceImages(images)
          for (const img of images) putBlobInCache(img.id, img.data)
        }
      })
      .finally(() => {
        draftRefsLoadedRef.current = true
      })
  })

  // Load more history pages (infinite scroll)
  const loadMoreHistory = useCallback(async () => {
    if (!historyHasMore || historyLoadingRef.current) return
    historyLoadingRef.current = true
    try {
      const { items, hasMore } = await loadHistoryPage(history.length, HISTORY_PAGE_SIZE)
      setHistory((prev) => [...prev, ...items])
      setHistoryHasMore(hasMore)
    } finally {
      historyLoadingRef.current = false
    }
  }, [history.length, historyHasMore])

  // --- Debounced URL sync ---
  const urlDebounceRef = useRef<number>(0)

  useExternalSync(() => {
    window.clearTimeout(urlDebounceRef.current)
    urlDebounceRef.current = window.setTimeout(() => {
      // Clear every option urlKey declared by any model first, so switching
      // models doesn't leave stale params (e.g. ?ws=1 lingering on GPT Image 2).
      const optionUpdates: Record<string, string | null> = {}
      for (const m of MODEL_CONFIGS) {
        for (const opt of m.options ?? []) optionUpdates[opt.urlKey] = null
      }
      // Overlay the active model's serialized option values.
      for (const opt of model.options ?? []) {
        optionUpdates[opt.urlKey] = serializeOptionValue(opt, options[opt.id])
      }
      updateUrl({
        m: model.id !== DEFAULT_MODEL.id ? model.id : null,
        r: resolution !== model.defaultResolution ? resolution : null,
        a: aspectRatio !== model.defaultAspectRatio ? aspectRatio : null,
        n: batchCount !== 1 ? String(batchCount) : null,
        p: prompt || null,
        ...optionUpdates,
      })
    }, 300)
    return () => window.clearTimeout(urlDebounceRef.current)
  }, [model, resolution, aspectRatio, batchCount, prompt, options])

  // Persist draft reference images to IndexedDB + sessionStorage on change
  const draftRefsDebounceRef = useRef<number>(0)
  useExternalSync(() => {
    if (!draftRefsLoadedRef.current) return // skip initial save before load completes
    window.clearTimeout(draftRefsDebounceRef.current)
    draftRefsDebounceRef.current = window.setTimeout(() => {
      void saveDraftRefs(referenceImages).catch(() => {})
    }, 500)
    return () => window.clearTimeout(draftRefsDebounceRef.current)
  }, [referenceImages])

  const setPrompt = useCallback((v: string) => setPromptRaw(v), [])
  const setResolution = useCallback((v: string) => setResolutionRaw(v), [])
  const setAspectRatio = useCallback((v: string) => setAspectRatioRaw(v), [])
  const setBatchCount = useCallback((v: number) => setBatchCountRaw(v), [])
  const setOption = useCallback((id: string, value: unknown) => {
    setOptionsState((prev) => ({ ...prev, [id]: value }))
  }, [])

  const setAgentThinkingLevel = useCallback((level: AgentThinkingLevel) => {
    setAgentThinkingLevelState(level)
  }, [])

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
    (agent: Agent, config = agentModel) => {
      agent.state.systemPrompt = AGENT_SYSTEM_PROMPT
      agent.state.model = agentModelWithBaseUrl(config, getAgentBaseUrl(config.provider))
      agent.state.thinkingLevel = config.supportsThinking ? agentThinkingLevel : 'off'
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
    agent.subscribe(() => syncAgentSnapshot(agent))
    agentRef.current = agent
    return agent
  }, [agentModel, agentThinkingLevel, getAgentBaseUrl, syncAgentSnapshot])

  useExternalSync(() => {
    const agent = agentRef.current
    if (!agent) return
    applyAgentRuntimeConfig(agent)
    syncAgentSnapshot(agent)
  }, [applyAgentRuntimeConfig, syncAgentSnapshot])

  const switchModel = useCallback((modelId: string) => {
    const config = MODEL_CONFIGS.find((m) => m.id === modelId)
    if (!config) return
    setModel(config)
    setResolutionRaw((prev) => (config.resolutions.includes(prev) ? prev : config.defaultResolution))
    setAspectRatioRaw((prev) => (config.aspectRatios.includes(prev) ? prev : config.defaultAspectRatio))
    setBatchCountRaw((prev) => Math.min(prev, config.maxBatchCount))
    setOptionsState((prev) => {
      // Keep values for options the new model also declares; fall back to the
      // new model's defaults for unknown option ids.
      const next = defaultOptionsFor(config)
      for (const opt of config.options ?? []) {
        if (opt.id in prev) next[opt.id] = prev[opt.id]
      }
      return next
    })
  }, [])

  const addReferenceImages = useCallback(
    (files: File[]) => {
      const maxTotal = model.maxReferenceImages + model.maxCharacterImages
      const remaining = maxTotal - referenceImages.length
      const toAdd = files.slice(0, remaining)

      void Promise.allSettled(
        toAdd.map((file) =>
          readFileAsImageData(file).then((result) => {
            if (!result) return null
            const { base64, mimeType, fileName } = result
            return {
              id: crypto.randomUUID(),
              data: base64,
              mimeType,
              source: { type: 'upload' as const, fileName },
              timestamp: Date.now(),
            } as PlaygroundImage
          }),
        ),
      ).then((results) => {
        const images: PlaygroundImage[] = []
        const errors: string[] = []
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            images.push(r.value)
          } else if (r.status === 'rejected') {
            errors.push((r.reason as Error).message)
          }
        }
        if (images.length > 0) {
          setReferenceImages((prev) => [...prev, ...images].slice(0, maxTotal))
        }
        if (errors.length > 0) {
          setReferenceImageError(errors.join('\n'))
        }
      })
    },
    [model, referenceImages.length],
  )

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

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearAllReferences = useCallback(() => {
    setReferenceImages([])
    setReferenceImageError(null)
    clearDraftRefs()
  }, [])

  const clearReferenceImageError = useCallback(() => {
    setReferenceImageError(null)
  }, [])

  const restoreSession = useCallback((newPrompt: string, newRefs: PlaygroundImage[]) => {
    setPromptRaw(newPrompt)
    setReferenceImages(newRefs)
  }, [])

  // Resolve PlaygroundImageMeta[] to PlaygroundImage[] by loading blobs from cache/DB
  const resolveFullImages = useCallback(async (metas: PlaygroundImageMeta[]): Promise<PlaygroundImage[]> => {
    const needLoad: string[] = []
    for (const m of metas) {
      if (!getBlobFromCache(m.id)) needLoad.push(m.id)
    }
    if (needLoad.length > 0) {
      const blobs = await loadImageBlobs(needLoad)
      for (const [id, data] of blobs) putBlobInCache(id, data)
    }
    const result: PlaygroundImage[] = []
    for (const m of metas) {
      const data = getBlobFromCache(m.id)
      if (data) result.push({ ...m, data })
    }
    return result
  }, [])

  const resolveReferenceMetas = useCallback(
    async (ids: string[]): Promise<PlaygroundImageMeta[]> => {
      if (ids.length === 0) return []
      const loaded = new Map(history.map((item) => [item.id, item]))
      const missingIds = ids.filter((id) => !loaded.has(id))
      if (missingIds.length > 0) {
        const missing = await loadImageMetas(missingIds)
        for (const [id, item] of missing) loaded.set(id, item)
      }
      return ids.map((id) => loaded.get(id)).filter((item): item is PlaygroundImageMeta => Boolean(item))
    },
    [history],
  )

  const restoreGeneratedImageParams = useCallback(
    async (image: PlaygroundImageMeta): Promise<{ refCount: number; restoredModel: boolean } | null> => {
      if (image.source.type !== 'generated') return null
      const source = image.source
      const targetModel = findModelConfig(source.modelId)

      setPromptRaw(source.prompt)
      if (targetModel) {
        setModel(targetModel)
        setResolutionRaw(normalizeResolution(targetModel, source.resolution))
        setAspectRatioRaw(normalizeAspectRatio(targetModel, source.aspectRatio))
        setBatchCountRaw((prev) => Math.min(prev, targetModel.maxBatchCount))
        setOptionsState(optionsForGeneratedSource(targetModel, source))
      }

      const refMetas = await resolveReferenceMetas(source.referenceImageIds)
      const refs = await resolveFullImages(refMetas)
      setReferenceImages(refs)
      return { refCount: refs.length, restoredModel: Boolean(targetModel) }
    },
    [resolveFullImages, resolveReferenceMetas],
  )

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
      const credentials = getProviderCredentials(task.request.model.provider)
      if (!credentials.apiKey) {
        const message = `使用 ${task.request.model.name} 需要先配置 ${task.request.model.provider === 'google' ? 'Gemini' : 'OpenAI'} API Key。`
        const next = setAgentImageTasks((prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) {
          agentImageRegistryRef.current.set(id, { id, source: 'generated', status: 'failed', createdAt: Date.now() })
        }
        maybeDispatchAgentImageCallbacks(next)
        return { ok: false, message }
      }

      const stackId =
        task.request.stackId ??
        stackIdForGenerationRequest({
          model: task.request.model,
          prompt: task.request.prompt,
          referenceImages: task.request.referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          batchCount: task.request.batchCount,
        })
      const batchId = enqueueGenerationJob(
        {
          apiKey: credentials.apiKey,
          baseUrl: credentials.baseUrl,
          model: task.request.model,
          prompt: task.request.prompt,
          referenceImages: task.request.referenceImages,
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
          item.id === task.id ? { ...item, status: 'queued', generationJobId: batchId, error: undefined } : item,
        ),
      )
      return { ok: true, message: '任务已经提交并开始生成。' }
    },
    [enqueueGenerationJob, getProviderCredentials, maybeDispatchAgentImageCallbacks, setAgentImageTasks],
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
      const next = setAgentImageTasks((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: 'canceled' } : item)),
      )
      maybeDispatchAgentImageCallbacks(next)
    },
    [cancelGenerationJob, maybeDispatchAgentImageCallbacks, setAgentImageTasks],
  )

  const focusAgentImageTask = useCallback((taskId: string) => {
    setFocusedAgentImageTaskId(taskId)
  }, [])

  const clearFocusedAgentImageTask = useCallback(() => {
    setFocusedAgentImageTaskId(null)
  }, [])

  const runGenImageTool = useCallback(
    async (toolCallId: string, args: GenImageToolArgs): Promise<AgentImageToolResult> => {
      const promptText = args.prompt.trim()
      if (!promptText) throw new Error('GenImage.prompt is required.')
      const modelConfig = findModelConfig(args.model)
      if (!modelConfig) {
        throw new Error(
          `Unknown GenImage model: ${args.model}. Available models: ${MODEL_CONFIGS.map((item) => item.id).join(', ')}`,
        )
      }
      const credentials = getProviderCredentials(modelConfig.provider)
      if (!credentials.apiKey) {
        throw new Error(
          `GenImage cannot create a task because ${modelConfig.provider === 'google' ? 'Gemini' : 'OpenAI'} API Key is missing.`,
        )
      }
      const requestedCount = Number.isFinite(args.n) ? Math.floor(args.n) : 1
      const batchCount = Math.min(Math.max(1, requestedCount), modelConfig.maxBatchCount)
      const resolution = normalizeResolution(modelConfig, args.resolution)
      const aspect = normalizeAspectRatio(modelConfig, args.ratio)
      const referenceImageIds = args.reference_image_ids.filter((id) => id.trim()).map((id) => id.trim())
      const referenceImages = await resolveAgentReferenceImages(referenceImageIds)
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
          model: modelConfig,
          resolution,
          aspectRatio: aspect,
          batchCount,
          referenceImageIds,
          referenceImages,
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

      const autoApprove = autoApproveAgentImageTasksRef.current
      const startResult = autoApprove ? await startAgentImageTask(task) : null
      const status = autoApprove ? (startResult?.ok ? 'queued' : 'failed') : 'pending_approval'
      const message = autoApprove
        ? (startResult?.message ?? '任务已经提交并自动开始生成。')
        : reserved.renamed
          ? `任务已经提交，等待用户审批。image_id 已预留为 ${reserved.reservedImageIds.join('、')}。`
          : '任务已经提交，等待用户审批。'
      const result = {
        status,
        task_id: task.id,
        requested_image_id: reserved.requestedImageId,
        reserved_image_ids: reserved.reservedImageIds,
        renamed: reserved.renamed,
        message,
      }
      return toolTextResult(JSON.stringify(result, null, 2), result)
    },
    [
      getProviderCredentials,
      imageIdExistsForAgent,
      resolveAgentReferenceImages,
      setAgentImageTasks,
      startAgentImageTask,
    ],
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

  useExternalSync(() => {
    agentToolsRef.current = createAgentImageTools({
      imageModels: MODEL_CONFIGS,
      genImage: runGenImageTool,
      readImage: runReadImageTool,
    })
    if (agentRef.current) {
      agentRef.current.state.tools = agentToolsRef.current
      syncAgentSnapshot(agentRef.current)
    }
  }, [runGenImageTool, runReadImageTool, syncAgentSnapshot])

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
      return { ...task, status: nextStatus, resultImageIds, error: nextError }
    })
    if (!changed) return
    agentImageTasksRef.current = next
    setAgentImageTasksState(next)
    maybeDispatchAgentImageCallbacks(next)
  }, [dismissGenerationJob, generationJobs, maybeDispatchAgentImageCallbacks])

  const sendAgentMessage = useCallback(() => {
    const trimmed = agentDraft.trim()
    if (agentIsStreaming || (!trimmed && agentAttachments.length === 0)) return

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
    const agent = agentRef.current
    if (agent?.state.isStreaming) return
    agent?.reset()
    setAgentMessages([])
    setAgentStreamingMessage(null)
    setAgentIsStreaming(false)
    setAgentError(null)
    setAgentDraft('')
    setAgentAttachments([])
    setAgentAttachmentError(null)
  }, [])

  const rerollGeneratedImage = useCallback(
    async (image: PlaygroundImageMeta): Promise<RerollGeneratedImageResult> => {
      if (image.source.type !== 'generated') return { status: 'unavailable' }
      const source = image.source
      const targetModel = findModelConfig(source.modelId)
      if (!targetModel) return { status: 'unavailable' }
      if (targetModel.provider === 'openai' && source.parentImageId && source.usesMask !== false) {
        return { status: 'unsupported-mask' }
      }
      const keyHook = targetModel.provider === 'google' ? googleKeyHook : openaiKeyHook
      if (!keyHook.apiKey) return { status: 'unavailable' }

      const trimmed = source.prompt.trim()
      if (!trimmed) return { status: 'unavailable' }

      const refMetas = await resolveReferenceMetas(source.referenceImageIds)
      if (refMetas.length !== source.referenceImageIds.length) return { status: 'unavailable' }
      const refs = await resolveFullImages(refMetas)
      if (refs.length !== source.referenceImageIds.length) return { status: 'unavailable' }

      const maxTotal = targetModel.maxReferenceImages + targetModel.maxCharacterImages
      if (refs.length > maxTotal) return { status: 'unavailable' }

      const stackId = source.stackId ?? source.batchId
      const parentImageId = source.parentImageId
      const request: GenerationJob['request'] = {
        apiKey: keyHook.apiKey,
        baseUrl: keyHook.baseUrl,
        model: targetModel,
        prompt: trimmed,
        referenceImages: refs,
        resolution: normalizeResolution(targetModel, source.resolution),
        aspectRatio: normalizeAspectRatio(targetModel, source.aspectRatio),
        options: optionsForGeneratedSource(targetModel, source),
      }
      const activeJob = findActiveGenerationJob({ request, stackId, parentImageId })
      if (activeJob) {
        const slotId = appendGenerationSlot(activeJob.id)
        if (slotId) return { status: 'queued', batchId: activeJob.id }
      }

      const batchId = enqueueGenerationJob(request, 1, stackId, parentImageId)
      return { status: 'queued', batchId }
    },
    [
      appendGenerationSlot,
      enqueueGenerationJob,
      findActiveGenerationJob,
      googleKeyHook,
      openaiKeyHook,
      resolveFullImages,
      resolveReferenceMetas,
    ],
  )

  const generate = useCallback(() => {
    if (!apiKeyHook.apiKey) return
    const trimmed = prompt.trim()
    if (!trimmed) return

    const activeOptions: Record<string, unknown> = {}
    for (const opt of model.options ?? []) activeOptions[opt.id] = options[opt.id]

    const stackId = stackIdForGenerationRequest({
      model,
      prompt: trimmed,
      referenceImages,
      resolution,
      aspectRatio,
      options: activeOptions,
      batchCount,
    })
    enqueueGenerationJob(
      {
        apiKey: apiKeyHook.apiKey,
        baseUrl: apiKeyHook.baseUrl,
        model,
        prompt: trimmed,
        referenceImages: [...referenceImages],
        resolution,
        aspectRatio,
        options: activeOptions,
      },
      batchCount,
      stackId,
    )
  }, [apiKeyHook, prompt, model, referenceImages, resolution, aspectRatio, options, batchCount, enqueueGenerationJob])

  // Edit an existing image: prepends the source as the first reference and
  // enqueues a generation job independent of InputPanel state.
  const editImage = useCallback(
    async (params: {
      sourceImage: PlaygroundImageMeta
      model: ModelConfig
      prompt: string
      extraReferences: PlaygroundImage[]
      resolution: string
      aspectRatio: string
      options: Record<string, unknown>
      batchCount: number
      // If provided, replaces the source reference with the annotated/baked
      // image (DrawableLayer output). Used for annotate-mode strokes and for
      // Gemini mask mode (red overlay baked in).
      annotatedSource?: PlaygroundImage
      // OpenAI-only alpha mask. Ignored for non-OpenAI providers — callers
      // should pass annotatedSource instead.
      mask?: PlaygroundImage
    }): Promise<string | null> => {
      const keyHook = params.model.provider === 'google' ? googleKeyHook : openaiKeyHook
      if (!keyHook.apiKey) return null
      const trimmed = params.prompt.trim()
      if (!trimmed) return null

      const [sourceFull] = await resolveFullImages([params.sourceImage])
      if (!sourceFull) return null

      // Filter to options declared by the target model so we don't leak stale keys.
      const activeOptions: Record<string, unknown> = {}
      for (const opt of params.model.options ?? []) {
        activeOptions[opt.id] = opt.id in params.options ? params.options[opt.id] : opt.default
      }

      const maxTotal = params.model.maxReferenceImages + params.model.maxCharacterImages
      // When the user has annotations (or a Gemini mask overlay baked in), we
      // send BOTH the annotated composite and the clean source so the model has
      // the unobscured pixels to work from. Annotated copy goes first since
      // that's the "primary instruction" version.
      const refs = params.annotatedSource
        ? [params.annotatedSource, sourceFull, ...params.extraReferences]
        : [sourceFull, ...params.extraReferences]
      if (refs.length > maxTotal) return null

      const stackId =
        params.sourceImage.source.type === 'generated'
          ? (params.sourceImage.source.stackId ?? params.sourceImage.source.batchId)
          : crypto.randomUUID()

      return enqueueGenerationJob(
        {
          apiKey: keyHook.apiKey,
          baseUrl: keyHook.baseUrl,
          model: params.model,
          prompt: trimmed,
          referenceImages: refs,
          resolution: params.resolution,
          aspectRatio: params.aspectRatio,
          options: activeOptions,
          mask: params.model.provider === 'openai' ? params.mask : undefined,
        },
        params.batchCount,
        stackId,
        params.sourceImage.id,
      )
    },
    [googleKeyHook, openaiKeyHook, resolveFullImages, enqueueGenerationJob],
  )

  const addToReferences = useCallback(
    async (image: PlaygroundImageMeta) => {
      const maxTotal = model.maxReferenceImages + model.maxCharacterImages
      if (referenceImages.length >= maxTotal) return
      const [full] = await resolveFullImages([image])
      if (full) {
        setReferenceImages((prev) => [...prev, full])
      }
    },
    [model, referenceImages.length, resolveFullImages],
  )

  const removeFromHistory = useCallback(async (id: string) => {
    await deleteFromHistory(id)
    removeBlobFromCache(id)
    setHistory((prev) => prev.filter((img) => img.id !== id))
  }, [])

  return {
    apiKey: apiKeyHook.apiKey,
    apiBaseUrl: apiKeyHook.baseUrl,
    apiKeyStatus: apiKeyHook.status,
    submitApiKey: apiKeyHook.submit,
    resetApiKey: apiKeyHook.reset,
    // All provider keys (used by the API Keys dialog to configure both at once)
    googleKey: googleKeyHook,
    openaiKey: openaiKeyHook,
    model,
    resolution,
    aspectRatio,
    batchCount,
    options,
    prompt,
    inputMode,
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
    autoApproveAgentImageTasks,
    agentImageTasks,
    focusedAgentImageTaskId,
    referenceImages,
    referenceImageError,
    history,
    historyHasMore,
    generationJobs,
    generationQueueSummary,
    generationConcurrency,
    switchModel,
    setInputMode,
    setAgentModelId,
    setAgentThinkingLevel,
    setAutoApproveAgentImageTasks,
    setAgentDraft,
    setResolution,
    setAspectRatio,
    setBatchCount,
    setOption,
    setPrompt,
    setGenerationConcurrency,
    addAgentAttachments,
    addAgentImageAttachment,
    removeAgentAttachment,
    clearAgentAttachmentError,
    sendAgentMessage,
    stopAgentMessage,
    clearAgentChat,
    approveAgentImageTask,
    cancelAgentImageTask,
    focusAgentImageTask,
    clearFocusedAgentImageTask,
    addReferenceImages,
    removeReferenceImage,
    clearAllReferences,
    clearReferenceImageError,
    restoreSession,
    restoreGeneratedImageParams,
    rerollGeneratedImage,
    retryGenerationSlot,
    resolveFullImages,
    generate,
    editImage,
    cancelGenerationJob,
    dismissGenerationJob,
    cancelGenerationSlot,
    addToReferences,
    removeFromHistory,
    loadMoreHistory,
  }
}
