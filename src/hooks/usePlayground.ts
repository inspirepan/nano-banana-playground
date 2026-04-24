import { useState, useCallback, useEffect, useRef } from 'react'
import {
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  coerceOptionValue,
  defaultOptionsFor,
  serializeOptionValue,
  type ModelConfig,
} from '../config/models'
import { generateImage, GENERATE_MAX_ATTEMPTS } from '../lib/api'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { isKeyError } from '../lib/validateKey'
import { saveToHistory, loadHistoryPage, deleteFromHistory, clearHistory, loadImageBlobs, saveDraftRefs, loadDraftRefs, clearDraftRefs } from '../lib/history'
import { readSimpleUrlParams, updateUrl } from '../lib/urlState'
import { useApiKey } from './useApiKey'
import { putBlobInCache, getBlobFromCache, removeBlobFromCache, clearBlobCache } from './useImageSrc'

export type GenerationSlotStatus = 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed' | 'canceled'
export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'partial_failed' | 'failed' | 'canceled'

export type GenerationSlot = {
  id: string
  index: number
  status: GenerationSlotStatus
  attempt: number
  maxAttempts: number
  image?: PlaygroundImage
  error?: string
  retryDelayMs?: number
  retryAt?: number
}

export type GenerationJob = {
  id: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  status: GenerationJobStatus
  request: {
    apiKey: string
    baseUrl?: string
    model: ModelConfig
    prompt: string
    referenceImages: PlaygroundImage[]
    resolution: string
    aspectRatio: string
    options: Record<string, unknown>
  }
  slots: GenerationSlot[]
}

export type GenerationQueueSummary = {
  total: number
  queued: number
  running: number
  retrying: number
  succeeded: number
  failed: number
  canceled: number
  activeJobs: number
}

const HISTORY_PAGE_SIZE = 20
const GENERATION_CONCURRENCY_KEY = 'nano-banana-generation-concurrency'
const DEFAULT_GENERATION_CONCURRENCY = 2
const MAX_GENERATION_CONCURRENCY = 4

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

function clampGenerationConcurrency(value: number): number {
  return Math.min(Math.max(1, value), MAX_GENERATION_CONCURRENCY)
}

function initialGenerationConcurrency(): number {
  const raw = localStorage.getItem(GENERATION_CONCURRENCY_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_GENERATION_CONCURRENCY
  return clampGenerationConcurrency(Number.isFinite(parsed) ? parsed : DEFAULT_GENERATION_CONCURRENCY)
}

function isActiveSlot(slot: GenerationSlot): boolean {
  return slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'
}

function isActiveJob(job: GenerationJob): boolean {
  return job.slots.some(isActiveSlot)
}

function deriveJobStatus(slots: GenerationSlot[]): GenerationJobStatus {
  if (slots.some((slot) => slot.status === 'running' || slot.status === 'retrying')) return 'running'
  if (slots.some((slot) => slot.status === 'queued')) return 'queued'

  const succeeded = slots.filter((slot) => slot.status === 'succeeded').length
  const failed = slots.filter((slot) => slot.status === 'failed').length
  const canceled = slots.filter((slot) => slot.status === 'canceled').length
  if (succeeded === slots.length) return 'completed'
  if (canceled === slots.length) return 'canceled'
  if (succeeded > 0 && failed + canceled > 0) return 'partial_failed'
  if (failed > 0) return 'failed'
  return 'canceled'
}

function summarizeGenerationQueue(jobs: GenerationJob[]): GenerationQueueSummary {
  const summary: GenerationQueueSummary = {
    total: 0,
    queued: 0,
    running: 0,
    retrying: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0,
    activeJobs: 0,
  }

  for (const job of jobs) {
    if (isActiveJob(job)) summary.activeJobs++
    for (const slot of job.slots) {
      summary.total++
      summary[slot.status]++
    }
  }

  return summary
}

function toDisplayError(e: unknown): string {
  const err = e instanceof Error ? e : new Error(String(e))
  if (err.name === 'TimeoutError') return '请求超时（5min），请检查网络连接或代理配置后重试'
  return err.message
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

  const [referenceImages, setReferenceImages] = useState<PlaygroundImage[]>([])
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null)
  const [history, setHistory] = useState<PlaygroundImageMeta[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const historyLoadingRef = useRef(false)
  const [generationJobs, setGenerationJobsState] = useState<GenerationJob[]>([])
  const generationJobsRef = useRef<GenerationJob[]>([])
  const [generationConcurrency, setGenerationConcurrencyState] = useState(initialGenerationConcurrency)
  const generationConcurrencyRef = useRef(generationConcurrency)
  const activeSlotIdsRef = useRef(new Set<string>())
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const referencePersistenceRef = useRef(new Map<string, Promise<void>>())
  const pumpQueueRef = useRef<() => void>(() => {})

  const setGenerationJobs = useCallback((updater: (prev: GenerationJob[]) => GenerationJob[]) => {
    const next = updater(generationJobsRef.current)
    generationJobsRef.current = next
    setGenerationJobsState(next)
  }, [])

  useEffect(() => {
    return () => {
      for (const controller of abortControllersRef.current.values()) controller.abort()
      abortControllersRef.current.clear()
      activeSlotIdsRef.current.clear()
    }
  }, [])

  // Load first page of history on mount
  useEffect(() => {
    loadHistoryPage(0, HISTORY_PAGE_SIZE).then(({ items, hasMore }) => {
      setHistory(items)
      setHistoryHasMore(hasMore)
    })
  }, [])

  // Load persisted draft reference images on mount
  const draftRefsLoadedRef = useRef(false)
  useEffect(() => {
    loadDraftRefs().then((images) => {
      if (images.length > 0) {
        setReferenceImages(images)
        for (const img of images) putBlobInCache(img.id, img.data)
      }
      draftRefsLoadedRef.current = true
    })
  }, [])

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

  useEffect(() => {
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
  useEffect(() => {
    if (!draftRefsLoadedRef.current) return // skip initial save before load completes
    window.clearTimeout(draftRefsDebounceRef.current)
    draftRefsDebounceRef.current = window.setTimeout(() => {
      saveDraftRefs(referenceImages)
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
    setResolutionRaw((prev) =>
      config.resolutions.includes(prev) ? prev : config.defaultResolution,
    )
    setAspectRatioRaw((prev) =>
      config.aspectRatios.includes(prev) ? prev : config.defaultAspectRatio,
    )
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

  // Convert HEIC/HEIF to PNG via canvas; returns base64 data + mimeType.
  const readFileAsImageData = useCallback(
    (file: File): Promise<{ base64: string; mimeType: string; fileName: string } | null> =>
      new Promise((resolve, reject) => {
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
        if (!isHeic) {
          const reader = new FileReader()
          reader.onload = () => resolve({
            base64: (reader.result as string).split(',')[1],
            mimeType: file.type,
            fileName: file.name,
          })
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
          return
        }
        // Convert HEIC to PNG via canvas — GPT Image does not accept HEIC.
        // Reject if the browser cannot decode HEIC (Chrome, Firefox).
        createImageBitmap(file)
          .then((bitmap) => {
            const canvas = document.createElement('canvas')
            canvas.width = bitmap.width
            canvas.height = bitmap.height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(bitmap, 0, 0)
            bitmap.close()
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error(`无法转换 ${file.name}：canvas toBlob 失败`))
                return
              }
              const reader = new FileReader()
              reader.onload = () => resolve({
                base64: (reader.result as string).split(',')[1],
                mimeType: 'image/png',
                fileName: file.name.replace(/\.(heic|heif)$/i, '.png'),
              })
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(blob)
            }, 'image/png')
          })
          .catch(() => {
            reject(new Error(`${file.name}：当前浏览器不支持 HEIC 格式。请在 iPhone「设置 > 相机 > 格式」中选择"兼容性最佳"，或使用 Safari 浏览器。`))
          })
      }),
    [],
  )

  const addReferenceImages = useCallback(
    (files: File[]) => {
      const maxTotal = model.maxReferenceImages + model.maxCharacterImages
      const remaining = maxTotal - referenceImages.length
      const toAdd = files.slice(0, remaining)

      Promise.allSettled(
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
    [model, referenceImages.length, readFileAsImageData],
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

  const updateGenerationSlot = useCallback((
    jobId: string,
    slotId: string,
    updateSlot: (slot: GenerationSlot) => GenerationSlot,
    removeCompleted = false,
  ) => {
    setGenerationJobs((prev) => prev.flatMap((job) => {
      if (job.id !== jobId) return [job]
      const slots = job.slots.map((slot) => (slot.id === slotId ? updateSlot(slot) : slot))
      const status = deriveJobStatus(slots)
      const inactive = !slots.some(isActiveSlot)
      const nextJob: GenerationJob = {
        ...job,
        slots,
        status,
        finishedAt: inactive ? (job.finishedAt ?? Date.now()) : undefined,
      }
      if (removeCompleted && status === 'completed') return []
      return [nextJob]
    }))
  }, [setGenerationJobs])

  const invalidateGenerationKey = useCallback((provider: ModelConfig['provider']) => {
    if (provider === 'google') googleKeyHook.invalidate()
    else openaiKeyHook.invalidate()
  }, [googleKeyHook, openaiKeyHook])

  const persistJobReferences = useCallback((job: GenerationJob): Promise<void> => {
    const existing = referencePersistenceRef.current.get(job.id)
    if (existing) return existing

    const promise = Promise.all(job.request.referenceImages.map(async (refImg) => {
      await saveToHistory(refImg)
      putBlobInCache(refImg.id, refImg.data)
    })).then(() => undefined)
    referencePersistenceRef.current.set(job.id, promise)
    return promise
  }, [])

  const startGenerationSlot = useCallback((jobId: string, slotId: string) => {
    const job = generationJobsRef.current.find((item) => item.id === jobId)
    const slot = job?.slots.find((item) => item.id === slotId)
    if (!job || !slot || slot.status !== 'queued' || activeSlotIdsRef.current.has(slotId)) return

    const controller = new AbortController()
    activeSlotIdsRef.current.add(slotId)
    abortControllersRef.current.set(slotId, controller)

    setGenerationJobs((prev) => prev.map((item) => {
      if (item.id !== jobId) return item
      const slots = item.slots.map((current) => (
        current.id === slotId
          ? { ...current, status: 'running' as const, error: undefined, retryDelayMs: undefined, retryAt: undefined }
          : current
      ))
      return {
        ...item,
        startedAt: item.startedAt ?? Date.now(),
        status: deriveJobStatus(slots),
        slots,
      }
    }))

    void (async () => {
      try {
        await persistJobReferences(job)
        if (controller.signal.aborted) return

        const image = await generateImage({
          ...job.request,
          batchId: job.id,
        }, controller.signal, {
          onRetry: (event) => {
            if (controller.signal.aborted) return
            updateGenerationSlot(job.id, slot.id, (current) => {
              if (!isActiveSlot(current)) return current
              return {
                ...current,
                status: 'retrying',
                attempt: event.nextAttempt,
                error: event.error,
                retryDelayMs: event.delayMs,
                retryAt: Date.now() + event.delayMs,
              }
            })
          },
        })

        if (controller.signal.aborted) return

        await saveToHistory(image)
        if (controller.signal.aborted) {
          await deleteFromHistory(image.id).catch(() => {})
          removeBlobFromCache(image.id)
          return
        }
        putBlobInCache(image.id, image.data)
        const { data: _, ...meta } = image
        setHistory((prev) => prev.some((item) => item.id === meta.id) ? prev : [meta, ...prev])
        updateGenerationSlot(job.id, slot.id, (current) => ({
          ...current,
          status: 'succeeded',
          image,
          error: undefined,
          retryDelayMs: undefined,
          retryAt: undefined,
        }), true)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (controller.signal.aborted || err.name === 'AbortError') {
          updateGenerationSlot(job.id, slot.id, (current) => ({
            ...current,
            status: 'canceled',
            error: undefined,
            retryDelayMs: undefined,
            retryAt: undefined,
          }))
          return
        }

        const msg = toDisplayError(err)
        updateGenerationSlot(job.id, slot.id, (current) => ({
          ...current,
          status: 'failed',
          error: msg,
          retryDelayMs: undefined,
          retryAt: undefined,
        }))
        if (isKeyError(msg)) invalidateGenerationKey(job.request.model.provider)
      } finally {
        activeSlotIdsRef.current.delete(slotId)
        abortControllersRef.current.delete(slotId)
        pumpQueueRef.current()
      }
    })()
  }, [invalidateGenerationKey, persistJobReferences, setGenerationJobs, updateGenerationSlot])

  const pumpGenerationQueue = useCallback(() => {
    while (activeSlotIdsRef.current.size < generationConcurrencyRef.current) {
      const next = [...generationJobsRef.current]
        .reverse()
        .flatMap((job) => job.slots.map((slot) => ({ job, slot })))
        .find(({ slot }) => slot.status === 'queued')
      if (!next) return
      startGenerationSlot(next.job.id, next.slot.id)
    }
  }, [startGenerationSlot])

  pumpQueueRef.current = pumpGenerationQueue

  const setGenerationConcurrency = useCallback((value: number) => {
    const next = clampGenerationConcurrency(value)
    generationConcurrencyRef.current = next
    setGenerationConcurrencyState(next)
    localStorage.setItem(GENERATION_CONCURRENCY_KEY, String(next))
    pumpQueueRef.current()
  }, [])

  const generate = useCallback(() => {
    if (!apiKeyHook.apiKey) return
    const trimmed = prompt.trim()
    if (!trimmed) return

    const activeOptions: Record<string, unknown> = {}
    for (const opt of model.options ?? []) activeOptions[opt.id] = options[opt.id]

    const batchId = crypto.randomUUID()
    const createdAt = Date.now()
    const refsSnapshot = [...referenceImages]
    const job: GenerationJob = {
      id: batchId,
      createdAt,
      status: 'queued',
      request: {
        apiKey: apiKeyHook.apiKey,
        baseUrl: apiKeyHook.baseUrl,
        model,
        prompt: trimmed,
        referenceImages: refsSnapshot,
        resolution,
        aspectRatio,
        options: activeOptions,
      },
      slots: Array.from({ length: batchCount }, (_, index) => ({
        id: crypto.randomUUID(),
        index,
        status: 'queued',
        attempt: 1,
        maxAttempts: GENERATE_MAX_ATTEMPTS,
      })),
    }

    setGenerationJobs((prev) => [job, ...prev.filter(isActiveJob)])
    for (const refImg of refsSnapshot) putBlobInCache(refImg.id, refImg.data)

    pumpQueueRef.current()
  }, [apiKeyHook, prompt, model, referenceImages, resolution, aspectRatio, options, batchCount, setGenerationJobs])

  const cancelGenerationSlot = useCallback((slotId: string) => {
    abortControllersRef.current.get(slotId)?.abort()
    activeSlotIdsRef.current.delete(slotId)
    abortControllersRef.current.delete(slotId)
    setGenerationJobs((prev) => prev.map((job) => {
      if (!job.slots.some((slot) => slot.id === slotId)) return job
      const slots = job.slots.map((slot) => (
        slot.id === slotId && isActiveSlot(slot)
          ? { ...slot, status: 'canceled' as const, error: undefined, retryDelayMs: undefined, retryAt: undefined }
          : slot
      ))
      const status = deriveJobStatus(slots)
      return {
        ...job,
        slots,
        status,
        finishedAt: slots.some(isActiveSlot) ? undefined : (job.finishedAt ?? Date.now()),
      }
    }))
    pumpQueueRef.current()
  }, [setGenerationJobs])

  const cancelGenerationJob = useCallback((jobId: string) => {
    const job = generationJobsRef.current.find((item) => item.id === jobId)
    if (!job) return
    for (const slot of job.slots) {
      if (!isActiveSlot(slot)) continue
      abortControllersRef.current.get(slot.id)?.abort()
      activeSlotIdsRef.current.delete(slot.id)
      abortControllersRef.current.delete(slot.id)
    }
    setGenerationJobs((prev) => prev.map((item) => {
      if (item.id !== jobId) return item
      const slots = item.slots.map((slot) => (
        isActiveSlot(slot)
          ? { ...slot, status: 'canceled' as const, error: undefined, retryDelayMs: undefined, retryAt: undefined }
          : slot
      ))
      return {
        ...item,
        slots,
        status: deriveJobStatus(slots),
        finishedAt: Date.now(),
      }
    }))
    pumpQueueRef.current()
  }, [setGenerationJobs])

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

  const clearAllHistory = useCallback(async () => {
    await clearHistory()
    clearBlobCache()
    setHistory([])
    setHistoryHasMore(false)
  }, [])

  const generationQueueSummary = summarizeGenerationQueue(generationJobs)

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
    referenceImages,
    referenceImageError,
    history,
    historyHasMore,
    generationJobs,
    generationQueueSummary,
    generationConcurrency,
    switchModel,
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
    resolveFullImages,
    generate,
    cancelGenerationJob,
    cancelGenerationSlot,
    addToReferences,
    removeFromHistory,
    clearAllHistory,
    loadMoreHistory,
  }
}
