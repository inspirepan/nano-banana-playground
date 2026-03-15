import { useState, useCallback, useEffect, useRef } from 'react'
import { MODEL_CONFIGS, DEFAULT_MODEL, type ModelConfig } from '../config/models'
import { generateImage } from '../lib/api'
import type { PersistedPromptMode, PlaygroundImage, PromptScheme } from '../lib/types'
import { isKeyError } from '../lib/validateKey'
import { saveToHistory, loadHistory, deleteFromHistory, clearHistory } from '../lib/history'
import {
  readSimpleUrlParams,
  readStateBlobParam,
  decompressStateBlob,
  compressStateBlob,
  preloadStateBlobCodec,
  updateUrl,
} from '../lib/urlState'
import { useApiKey } from './useApiKey'

export type GenerationState = 'idle' | 'generating' | 'error'

// Snapshot of settings at generation time
export type GenerationSnapshot = {
  batchId: string
  batchCount: number
  resolution: string
  aspectRatio: string
  configHash: string
}

export type GenerationPreviewSlot =
  | { status: 'pending' }
  | { status: 'fulfilled'; image: PlaygroundImage }
  | { status: 'rejected'; error: string }

function computeConfigHash(modelId: string, resolution: string, aspectRatio: string, batchCount: number, prompt: string): string {
  return `${modelId}|${resolution}|${aspectRatio}|${batchCount}|${prompt}`
}

// Read simple (non-compressed) URL params once at module load to safely init useState
const _initial = readSimpleUrlParams()

function resolveModel(modelId: string | null): ModelConfig {
  if (modelId) {
    const found = MODEL_CONFIGS.find((m) => m.id === modelId)
    if (found) return found
  }
  return DEFAULT_MODEL
}

export function usePlayground() {
  const apiKeyHook = useApiKey()
  const [model, setModel] = useState<ModelConfig>(() => resolveModel(_initial.modelId))
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
  const [prompt, setPromptRaw] = useState('')

  // Lifted from PromptPanel — persisted in URL
  const [modeRaw, setModeRaw] = useState<PersistedPromptMode>('text')
  const [schemes, setSchemesRaw] = useState<PromptScheme[]>([])
  const [currentSchemeIndexRaw, setCurrentSchemeIndexRaw] = useState(0)
  const [originalPrompt, setOriginalPromptRaw] = useState<string | null>(null)

  const [referenceImages, setReferenceImages] = useState<PlaygroundImage[]>([])
  const [history, setHistory] = useState<PlaygroundImage[]>([])
  const [generationState, setGenerationState] = useState<GenerationState>('idle')
  const [generationSnapshot, setGenerationSnapshot] = useState<GenerationSnapshot | null>(null)
  const [generationPreview, setGenerationPreview] = useState<GenerationPreviewSlot[]>([])
  const [lastGenHash, setLastGenHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const mode = modeRaw === 'structured' && schemes.length === 0 ? 'text' : modeRaw
  const currentSchemeIndex = schemes.length === 0 ? 0 : Math.min(currentSchemeIndexRaw, schemes.length - 1)
  const currentConfigHash = computeConfigHash(model.id, resolution, aspectRatio, batchCount, prompt)

  // Load history and decompress URL state blob on mount
  useEffect(() => {
    loadHistory().then(setHistory)

    const sParam = readStateBlobParam()
    if (sParam) {
      preloadStateBlobCodec()
      decompressStateBlob(sParam)
        .then((data) => {
          setPromptRaw(data.prompt)
          setModeRaw(data.mode)
          setSchemesRaw(data.schemes)
          setCurrentSchemeIndexRaw(data.currentSchemeIndex)
          setOriginalPromptRaw(data.originalPrompt)
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (prompt || schemes.length > 0 || originalPrompt !== null || mode === 'structured') {
      preloadStateBlobCodec()
    }
  }, [prompt, schemes.length, originalPrompt, mode])

  // --- Debounced URL sync ---
  const urlDebounceRef = useRef<number>(0)

  // Sync all state to URL as a single compressed blob (s) + plain config params
  useEffect(() => {
    window.clearTimeout(urlDebounceRef.current)
    urlDebounceRef.current = window.setTimeout(async () => {
      const hasState = prompt || schemes.length > 0 || originalPrompt !== null
      const compressedS = hasState
        ? await compressStateBlob({ prompt, mode, schemes, currentSchemeIndex, originalPrompt })
        : null
      updateUrl({
        m: model.id !== DEFAULT_MODEL.id ? model.id : null,
        r: resolution !== DEFAULT_MODEL.defaultResolution ? resolution : null,
        a: aspectRatio !== DEFAULT_MODEL.defaultAspectRatio ? aspectRatio : null,
        n: batchCount !== 1 ? String(batchCount) : null,
        s: compressedS,
      })
    }, 300)
    return () => window.clearTimeout(urlDebounceRef.current)
  }, [model.id, resolution, aspectRatio, batchCount, prompt, mode, schemes, currentSchemeIndex, originalPrompt])

  // --- Setters that update state (URL sync runs via effects above) ---
  const setPrompt = useCallback((v: string) => setPromptRaw(v), [])
  const setResolution = useCallback((v: string) => setResolutionRaw(v), [])
  const setAspectRatio = useCallback((v: string) => setAspectRatioRaw(v), [])
  const setBatchCount = useCallback((v: number) => setBatchCountRaw(v), [])
  const setMode = useCallback((v: PersistedPromptMode) => setModeRaw(v), [])
  const setSchemes = useCallback((v: PromptScheme[]) => setSchemesRaw(v), [])
  const setCurrentSchemeIndex = useCallback((v: number) => setCurrentSchemeIndexRaw(v), [])
  const setOriginalPrompt = useCallback((v: string | null) => setOriginalPromptRaw(v), [])

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

  const generate = useCallback(async (prompts?: string[]) => {
    if (!apiKeyHook.apiKey) return
    const promptList = prompts ?? (prompt.trim() ? Array.from({ length: batchCount }, () => prompt.trim()) : [])
    if (promptList.length === 0) return

    const batchId = crypto.randomUUID()
    const hash = computeConfigHash(model.id, resolution, aspectRatio, batchCount, prompt)

    setGenerationState('generating')
    setGenerationSnapshot({ batchId, batchCount: promptList.length, resolution, aspectRatio, configHash: hash })
    setGenerationPreview(Array.from({ length: promptList.length }, (): GenerationPreviewSlot => ({ status: 'pending' })))
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const promises = promptList.map((p, index) =>
        generateImage({
          apiKey: apiKeyHook.apiKey,
          model,
          prompt: p,
          referenceImages,
          resolution,
          aspectRatio,
          batchId,
        }, controller.signal)
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
                next[index] = { status: 'rejected', error: error.message }
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
          errors.push(r.reason?.message || 'Unknown error')
        }
      }

      for (const img of images) {
        await saveToHistory(img)
      }
      if (images.length > 0) {
        setHistory((prev) => [...images, ...prev])
      }

      if (images.length === 0 && errors.length > 0) {
        setGenerationState('error')
        setError(errors[0])
        if (isKeyError(errors[0])) {
          apiKeyHook.invalidate()
        }
      } else {
        setGenerationState('idle')
        setLastGenHash(hash)
        if (errors.length > 0) {
          setError(`${images.length} succeeded, ${errors.length} failed: ${errors[0]}`)
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).message
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
  }, [apiKeyHook, prompt, model, referenceImages, resolution, aspectRatio, batchCount])

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort()
    setGenerationState('idle')
    setGenerationSnapshot(null)
    setGenerationPreview([])
  }, [])

  const addToReferences = useCallback(
    (image: PlaygroundImage) => {
      const maxTotal = model.maxReferenceImages + model.maxCharacterImages
      if (referenceImages.length >= maxTotal) return
      setReferenceImages((prev) => [...prev, image])
    },
    [model, referenceImages.length],
  )

  const removeFromHistory = useCallback(async (id: string) => {
    await deleteFromHistory(id)
    setHistory((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearAllHistory = useCallback(async () => {
    await clearHistory()
    setHistory([])
  }, [])

  return {
    apiKey: apiKeyHook.apiKey,
    apiKeyStatus: apiKeyHook.status,
    submitApiKey: apiKeyHook.submit,
    resetApiKey: apiKeyHook.reset,
    model,
    resolution,
    aspectRatio,
    batchCount,
    prompt,
    mode,
    schemes,
    currentSchemeIndex,
    originalPrompt,
    referenceImages,
    history,
    generationState,
    generationSnapshot,
    generationPreview,
    showDraft: prompt.trim() !== '' && lastGenHash !== currentConfigHash,
    error,
    switchModel,
    setResolution,
    setAspectRatio,
    setBatchCount,
    setPrompt,
    setMode,
    setSchemes,
    setCurrentSchemeIndex,
    setOriginalPrompt,
    addReferenceImages,
    removeReferenceImage,
    generate,
    cancelGeneration,
    addToReferences,
    removeFromHistory,
    clearAllHistory,
  }
}
