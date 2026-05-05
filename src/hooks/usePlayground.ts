import { useState, useCallback, useMemo, useRef } from 'react'

import { useExternalSync, useMountEffect } from './effects'
import { useApiKey } from './useApiKey'
import { useGenerationQueue, type GenerationJob } from './useGenerationQueue'
import { putBlobInCache, getBlobFromCache, removeBlobFromCache } from './useImageSrc'
import { findModelConfig, normalizeAspectRatio, normalizeResolution } from '../agent/modelLookup'
import { useAgentPlayground } from '../agent/useAgentPlayground'
import {
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  coerceOptionValue,
  defaultOptionsFor,
  serializeOptionValue,
  type ModelConfig,
  type Provider,
} from '../config/models'
import { readFileAsImageData } from '../lib/fileToImage'
import {
  loadHistoryPage,
  deleteFromHistory,
  loadImageBlobs,
  loadImageMetas,
  saveHistoryMeta,
  saveDraftRefs,
  loadDraftRefs,
  clearDraftRefs,
} from '../lib/history'
import { stackIdForGenerationRequest } from '../lib/stackId'
import type { GenerationFailureSource, GeneratedSource, PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { AGENT_MODE_SENTINEL, readSimpleUrlParams, updateUrl } from '../lib/urlState'

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

export type RetryFailedGenerationImageResult = RerollGeneratedImageResult

export type InputMode = 'generate' | 'agent'

const HISTORY_PAGE_SIZE = 20
const GENERATION_FAILURE_MIME_TYPE = 'application/x.nano-banana-generation-failure'

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

function optionsForGeneratedSource(
  model: ModelConfig,
  source: GeneratedSource | GenerationFailureSource,
): Record<string, unknown> {
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

function generationFailureImageId(jobId: string, slotId: string): string {
  return `generation-failure:${jobId}:${slotId}`
}

function isGenerationFailureImage(
  image: PlaygroundImageMeta,
): image is PlaygroundImageMeta & { source: GenerationFailureSource } {
  return image.source.type === 'generation-failure'
}

function generationFailureMetaFromSlot(job: GenerationJob, slot: GenerationJob['slots'][number]): PlaygroundImageMeta {
  const failedAt = Date.now()
  return {
    id: generationFailureImageId(job.id, slot.id),
    mimeType: GENERATION_FAILURE_MIME_TYPE,
    source: {
      type: 'generation-failure',
      modelId: job.request.model.id,
      prompt: job.request.prompt,
      resolution: job.request.resolution,
      aspectRatio: job.request.aspectRatio,
      referenceImageIds: job.request.referenceImages.map((image) => image.id),
      batchId: job.id,
      batchCreatedAt: job.createdAt,
      stackId: job.stackId,
      parentImageId: job.parentImageId,
      slotIndex: slot.index,
      imageIdSource: job.request.outputImageIdSource,
      options: job.request.options,
      usesMask: Boolean(job.request.mask),
      error: slot.error ?? '',
      attemptErrors: slot.attemptErrors,
      attempt: slot.attempt,
      maxAttempts: slot.maxAttempts,
      failedAt,
      outputImageId: slot.outputImageId,
    },
    timestamp: failedAt,
  }
}

export function usePlayground() {
  const googleKeyHook = useApiKey('google')
  const openaiKeyHook = useApiKey('openai')
  const anthropicKeyHook = useApiKey('anthropic')
  const moonshotCnKeyHook = useApiKey('moonshot-cn')
  const moonshotAiKeyHook = useApiKey('moonshot-ai')
  const doubaoKeyHook = useApiKey('doubao')
  const keyHooks: Record<Provider, ReturnType<typeof useApiKey>> = useMemo(
    () => ({
      google: googleKeyHook,
      openai: openaiKeyHook,
      anthropic: anthropicKeyHook,
      'moonshot-cn': moonshotCnKeyHook,
      'moonshot-ai': moonshotAiKeyHook,
      doubao: doubaoKeyHook,
    }),
    [anthropicKeyHook, doubaoKeyHook, googleKeyHook, moonshotAiKeyHook, moonshotCnKeyHook, openaiKeyHook],
  )
  const [model, setModel] = useState<ModelConfig>(() => resolveModel(_initial.modelId))
  const apiKeyHook = keyHooks[model.provider]
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
  const [inputMode, setInputMode] = useState<InputMode>(() => (_initial.agentMode ? 'agent' : 'generate'))
  const [referenceImages, setReferenceImages] = useState<PlaygroundImage[]>([])
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null)
  const [history, setHistoryRaw] = useState<PlaygroundImageMeta[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const historyLoadingRef = useRef(false)
  const historyLengthRef = useRef(0)

  const setHistory = useCallback(
    (updater: PlaygroundImageMeta[] | ((prev: PlaygroundImageMeta[]) => PlaygroundImageMeta[])) => {
      setHistoryRaw((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        historyLengthRef.current = next.length
        return next
      })
    },
    [],
  )
  const getProviderCredentials = useCallback(
    (provider: ModelConfig['provider']) => {
      const keyHook = keyHooks[provider]
      return { apiKey: keyHook.apiKey, baseUrl: keyHook.baseUrl }
    },
    [keyHooks],
  )

  const invalidateGenerationKey = useCallback(
    (provider: Provider) => {
      keyHooks[provider].invalidate()
    },
    [keyHooks],
  )

  const onGeneratedImageSaved = useCallback(
    (image: PlaygroundImage) => {
      const { data: _, ...meta } = image
      setHistory((prev) => (prev.some((item) => item.id === meta.id) ? prev : [meta, ...prev]))
    },
    [setHistory],
  )

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

  const recordedFailureIdsRef = useRef(new Set<string>())

  useExternalSync(() => {
    const metas: PlaygroundImageMeta[] = []
    for (const job of generationJobs) {
      for (const slot of job.slots) {
        if (slot.status !== 'failed') continue
        const id = generationFailureImageId(job.id, slot.id)
        if (recordedFailureIdsRef.current.has(id)) continue
        recordedFailureIdsRef.current.add(id)
        metas.push(generationFailureMetaFromSlot(job, slot))
      }
    }
    if (metas.length === 0) return
    setHistory((prev) => {
      const seen = new Set(prev.map((image) => image.id))
      const missing = metas.filter((meta) => !seen.has(meta.id))
      return missing.length > 0 ? [...missing, ...prev] : prev
    })
    for (const meta of metas) void saveHistoryMeta(meta).catch(() => {})
  }, [generationJobs, setHistory])

  const dismissGenerationJobWithFailures = useCallback(
    (jobId: string) => {
      const job = generationJobs.find((item) => item.id === jobId)
      const jobHasActiveSlots = job?.slots.some(
        (slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying',
      )
      const failureIds =
        !job || jobHasActiveSlots || job.request.outputImageIdSource === 'agent'
          ? []
          : job.slots
              .filter((slot) => slot.status === 'failed')
              .map((slot) => generationFailureImageId(job.id, slot.id))
      dismissGenerationJob(jobId)
      if (failureIds.length === 0) return
      setHistory((prev) => prev.filter((image) => !failureIds.includes(image.id)))
      for (const id of failureIds) void deleteFromHistory(id).catch(() => {})
    },
    [dismissGenerationJob, generationJobs, setHistory],
  )

  const agent = useAgentPlayground({
    initialSessionId: _initial.agentSessionId,
    keyHooks,
    referenceImages,
    history,
    generationJobs,
    getProviderCredentials,
    invalidateGenerationKey,
    enqueueGenerationJob,
    cancelGenerationJob,
    dismissGenerationJob: dismissGenerationJobWithFailures,
  })

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
      const { items, hasMore } = await loadHistoryPage(historyLengthRef.current, HISTORY_PAGE_SIZE)
      setHistory((prev) => [...prev, ...items])
      setHistoryHasMore(hasMore)
    } finally {
      historyLoadingRef.current = false
    }
  }, [historyHasMore, setHistory])

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
        agent: inputMode === 'agent' ? (agent.currentAgentSessionId ?? AGENT_MODE_SENTINEL) : null,
        ...optionUpdates,
      })
    }, 300)
    return () => window.clearTimeout(urlDebounceRef.current)
  }, [model, resolution, aspectRatio, batchCount, prompt, options, inputMode, agent.currentAgentSessionId])

  // Persist draft reference images so editing can survive a page refresh.
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

  const modelMaxReferenceImages = model.maxReferenceImages
  const modelMaxCharacterImages = model.maxCharacterImages

  const addReferenceImages = useCallback(
    (files: File[]) => {
      const maxTotal = modelMaxReferenceImages + modelMaxCharacterImages
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
    [modelMaxReferenceImages, modelMaxCharacterImages, referenceImages.length],
  )

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

  const rerollGeneratedImage = useCallback(
    async (image: PlaygroundImageMeta): Promise<RerollGeneratedImageResult> => {
      if (image.source.type !== 'generated') return { status: 'unavailable' }
      const source = image.source
      const targetModel = findModelConfig(source.modelId)
      if (!targetModel) return { status: 'unavailable' }
      if (targetModel.provider === 'openai' && source.parentImageId && source.usesMask !== false) {
        return { status: 'unsupported-mask' }
      }
      const keyHook = keyHooks[targetModel.provider]
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
      keyHooks,
      resolveFullImages,
      resolveReferenceMetas,
    ],
  )

  const retryFailedGenerationImage = useCallback(
    async (image: PlaygroundImageMeta): Promise<RetryFailedGenerationImageResult> => {
      if (!isGenerationFailureImage(image)) return { status: 'unavailable' }
      const source = image.source
      const targetModel = findModelConfig(source.modelId)
      if (!targetModel) return { status: 'unavailable' }
      if (targetModel.provider === 'openai' && source.parentImageId && source.usesMask !== false) {
        return { status: 'unsupported-mask' }
      }
      const keyHook = keyHooks[targetModel.provider]
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
      const outputImageIds = source.outputImageId ? [source.outputImageId] : undefined
      const request: GenerationJob['request'] = {
        apiKey: keyHook.apiKey,
        baseUrl: keyHook.baseUrl,
        model: targetModel,
        prompt: trimmed,
        referenceImages: refs,
        resolution: normalizeResolution(targetModel, source.resolution),
        aspectRatio: normalizeAspectRatio(targetModel, source.aspectRatio),
        options: optionsForGeneratedSource(targetModel, source),
        outputImageIds,
        outputImageIdSource: source.imageIdSource,
      }
      const activeJob = findActiveGenerationJob({ request, stackId, parentImageId })
      if (activeJob) {
        const slotId = appendGenerationSlot(activeJob.id, source.outputImageId)
        if (slotId) return { status: 'queued', batchId: activeJob.id }
      }

      const batchId = enqueueGenerationJob(request, 1, stackId, parentImageId)
      return { status: 'queued', batchId }
    },
    [
      appendGenerationSlot,
      enqueueGenerationJob,
      findActiveGenerationJob,
      keyHooks,
      resolveFullImages,
      resolveReferenceMetas,
    ],
  )

  const currentApiKey = apiKeyHook.apiKey
  const currentBaseUrl = apiKeyHook.baseUrl

  const generate = useCallback(() => {
    if (!currentApiKey) return
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
        apiKey: currentApiKey,
        baseUrl: currentBaseUrl,
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
  }, [
    currentApiKey,
    currentBaseUrl,
    prompt,
    model,
    referenceImages,
    resolution,
    aspectRatio,
    options,
    batchCount,
    enqueueGenerationJob,
  ])

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
      const keyHook = keyHooks[params.model.provider]
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
    [keyHooks, resolveFullImages, enqueueGenerationJob],
  )

  const addToReferences = useCallback(
    async (image: PlaygroundImageMeta) => {
      const maxTotal = modelMaxReferenceImages + modelMaxCharacterImages
      if (referenceImages.length >= maxTotal) return
      const [full] = await resolveFullImages([image])
      if (full) {
        setReferenceImages((prev) => [...prev, full])
      }
    },
    [modelMaxReferenceImages, modelMaxCharacterImages, referenceImages.length, resolveFullImages],
  )

  const removeFromHistory = useCallback(
    async (id: string) => {
      await deleteFromHistory(id)
      removeBlobFromCache(id)
      setHistory((prev) => prev.filter((img) => img.id !== id))
    },
    [setHistory],
  )

  return {
    apiKey: apiKeyHook.apiKey,
    apiBaseUrl: apiKeyHook.baseUrl,
    apiKeyStatus: apiKeyHook.status,
    submitApiKey: apiKeyHook.submit,
    resetApiKey: apiKeyHook.reset,
    keyHooks,
    keyStatuses: {
      google: googleKeyHook.status,
      openai: openaiKeyHook.status,
      anthropic: anthropicKeyHook.status,
      'moonshot-cn': moonshotCnKeyHook.status,
      'moonshot-ai': moonshotAiKeyHook.status,
      doubao: doubaoKeyHook.status,
    } satisfies Record<Provider, ReturnType<typeof useApiKey>['status']>,
    model,
    resolution,
    aspectRatio,
    batchCount,
    options,
    prompt,
    inputMode,
    ...agent,
    referenceImages,
    referenceImageError,
    history,
    historyHasMore,
    generationJobs,
    generationQueueSummary,
    generationConcurrency,
    switchModel,
    setInputMode,

    setResolution,
    setAspectRatio,
    setBatchCount,
    setOption,
    setPrompt,
    setGenerationConcurrency,

    addReferenceImages,
    removeReferenceImage,
    clearAllReferences,
    clearReferenceImageError,
    restoreSession,
    restoreGeneratedImageParams,
    rerollGeneratedImage,
    retryFailedGenerationImage,
    retryGenerationSlot,
    resolveFullImages,
    generate,
    editImage,
    cancelGenerationJob,
    dismissGenerationJob: dismissGenerationJobWithFailures,
    cancelGenerationSlot,
    addToReferences,
    removeFromHistory,
    loadMoreHistory,
  }
}
