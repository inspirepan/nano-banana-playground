import { useState, useCallback, useEffect, useRef } from 'react'
import {
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  coerceOptionValue,
  defaultOptionsFor,
  serializeOptionValue,
  type ModelConfig,
} from '../config/models'
import { generateImage, REQUEST_TIMEOUT_MS } from '../lib/api'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'
import { isKeyError } from '../lib/validateKey'
import { saveToHistory, loadHistoryPage, deleteFromHistory, clearHistory, loadImageBlobs } from '../lib/history'
import { readSimpleUrlParams, updateUrl } from '../lib/urlState'
import { useApiKey } from './useApiKey'
import { putBlobInCache, getBlobFromCache, removeBlobFromCache, clearBlobCache } from './useImageSrc'

export type GenerationState = 'idle' | 'generating' | 'error'

// Snapshot of settings at generation time
export type GenerationSnapshot = {
  batchId: string
  batchCount: number
  resolution: string
  aspectRatio: string
}

export type GenerationPreviewSlot =
  | { status: 'pending' }
  | { status: 'fulfilled'; image: PlaygroundImage }
  | { status: 'rejected'; error: string }

const HISTORY_PAGE_SIZE = 20

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
  const [history, setHistory] = useState<PlaygroundImageMeta[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const historyLoadingRef = useRef(false)
  const [generationState, setGenerationState] = useState<GenerationState>('idle')
  const [generationSnapshot, setGenerationSnapshot] = useState<GenerationSnapshot | null>(null)
  const [generationPreview, setGenerationPreview] = useState<GenerationPreviewSlot[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load first page of history on mount
  useEffect(() => {
    loadHistoryPage(0, HISTORY_PAGE_SIZE).then(({ items, hasMore }) => {
      setHistory(items)
      setHistoryHasMore(hasMore)
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

  const addReferenceImages = useCallback(
    (files: File[]) => {
      const maxTotal = model.maxReferenceImages + model.maxCharacterImages
      const remaining = maxTotal - referenceImages.length
      const toAdd = files.slice(0, remaining)

      Promise.all(
        toAdd.map(
          (file) =>
            new Promise<PlaygroundImage>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => {
                const dataUrl = reader.result as string
                const base64 = dataUrl.split(',')[1]
                resolve({
                  id: crypto.randomUUID(),
                  data: base64,
                  mimeType: file.type,
                  source: { type: 'upload', fileName: file.name },
                  timestamp: Date.now(),
                })
              }
              reader.readAsDataURL(file)
            }),
        ),
      ).then((images) => {
        setReferenceImages((prev) => [...prev, ...images].slice(0, maxTotal))
      })
    },
    [model, referenceImages.length],
  )

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => prev.filter((img) => img.id !== id))
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

  const generate = useCallback(async () => {
    if (!apiKeyHook.apiKey) return
    const trimmed = prompt.trim()
    if (!trimmed) return

    const batchId = crypto.randomUUID()

    setGenerationState('generating')
    setGenerationSnapshot({ batchId, batchCount, resolution, aspectRatio })
    setGenerationPreview(Array.from({ length: batchCount }, (): GenerationPreviewSlot => ({ status: 'pending' })))
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller
    // 5min timeout — handles cases where API is unreachable or the upstream is slow
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])

    const toDisplayError = (e: unknown): string => {
      const err = e instanceof Error ? e : new Error(String(e))
      if (err.name === 'TimeoutError') return '请求超时（5min），请检查网络连接或代理配置后重试'
      return err.message
    }

    try {
      // Persist reference images to IndexedDB so they can be shown in detail modal later
      for (const refImg of referenceImages) {
        await saveToHistory(refImg)
        putBlobInCache(refImg.id, refImg.data)
      }

      // Only pass options belonging to the current model (filter stale keys).
      const activeOptions: Record<string, unknown> = {}
      for (const opt of model.options ?? []) activeOptions[opt.id] = options[opt.id]

      const promises = Array.from({ length: batchCount }, (_, index) =>
        generateImage({
          apiKey: apiKeyHook.apiKey,
          baseUrl: apiKeyHook.baseUrl,
          model,
          prompt: trimmed,
          referenceImages,
          resolution,
          aspectRatio,
          options: activeOptions,
          batchId,
        }, signal)
          .then((image) => {
            setGenerationPreview((prev) => {
              if (prev[index]?.status === 'fulfilled') return prev
              const next = [...prev]
              next[index] = { status: 'fulfilled', image }
              return next
            })
            return image
          })
          .catch((reason: unknown) => {
            const error = reason instanceof Error ? reason : new Error('Unknown error')
            if (error.name !== 'AbortError') {
              setGenerationPreview((prev) => {
                if (prev[index]?.status === 'rejected') return prev
                const next = [...prev]
                next[index] = { status: 'rejected', error: toDisplayError(error) }
                return next
              })
            }
            throw error
          }),
      )
      const results = await Promise.allSettled(promises)

      if (controller.signal.aborted) return

      const images: PlaygroundImage[] = []
      const errors: string[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') {
          images.push(r.value)
        } else {
          errors.push(toDisplayError(r.reason))
        }
      }

      for (const img of images) {
        await saveToHistory(img)
        // Cache the blob so it's instantly available for display
        putBlobInCache(img.id, img.data)
      }
      if (images.length > 0) {
        const metas: PlaygroundImageMeta[] = images.map(({ data: _, ...meta }) => meta)
        setHistory((prev) => [...metas, ...prev])
      }

      if (images.length === 0 && errors.length > 0) {
        setGenerationState('error')
        setError(errors[0])
        if (isKeyError(errors[0])) {
          apiKeyHook.invalidate()
        }
      } else {
        setGenerationState('idle')
        if (errors.length > 0) {
          setError(`${images.length} succeeded, ${errors.length} failed: ${errors[0]}`)
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = toDisplayError(e)
        setGenerationState('error')
        setError(msg)
        if (isKeyError(msg)) {
          apiKeyHook.invalidate()
        }
      }
    } finally {
      setGenerationSnapshot(null)
      setGenerationPreview([])
    }
  }, [apiKeyHook, prompt, model, referenceImages, resolution, aspectRatio, options, batchCount])

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort()
    setGenerationState('idle')
    setGenerationSnapshot(null)
    setGenerationPreview([])
  }, [])

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
    history,
    historyHasMore,
    generationState,
    generationSnapshot,
    generationPreview,
    error,
    switchModel,
    setResolution,
    setAspectRatio,
    setBatchCount,
    setOption,
    setPrompt,
    addReferenceImages,
    removeReferenceImage,
    restoreSession,
    resolveFullImages,
    generate,
    cancelGeneration,
    addToReferences,
    removeFromHistory,
    clearAllHistory,
    loadMoreHistory,
  }
}
