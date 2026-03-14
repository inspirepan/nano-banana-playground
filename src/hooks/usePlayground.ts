import { useState, useCallback, useEffect, useRef } from 'react'
import { MODEL_CONFIGS, DEFAULT_MODEL, type ModelConfig } from '../config/models'
import { generateImage, type GenerateParams } from '../lib/api'
import type { PlaygroundImage } from '../lib/types'
import { isKeyError } from '../lib/validateKey'
import { saveToHistory, loadHistory, deleteFromHistory, clearHistory } from '../lib/history'
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

function computeConfigHash(modelId: string, resolution: string, aspectRatio: string, batchCount: number, prompt: string): string {
  return `${modelId}|${resolution}|${aspectRatio}|${batchCount}|${prompt}`
}

export function usePlayground() {
  const apiKeyHook = useApiKey()
  const [model, setModel] = useState<ModelConfig>(DEFAULT_MODEL)
  const [resolution, setResolution] = useState(DEFAULT_MODEL.defaultResolution)
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_MODEL.defaultAspectRatio)
  const [batchCount, setBatchCount] = useState(1)
  const [prompt, setPromptRaw] = useState(() => localStorage.getItem('nano-banana-prompt') || '')
  const setPrompt = useCallback((v: string) => {
    setPromptRaw(v)
    localStorage.setItem('nano-banana-prompt', v)
  }, [])
  const [referenceImages, setReferenceImages] = useState<PlaygroundImage[]>([])
  const [history, setHistory] = useState<PlaygroundImage[]>([])
  const [generationState, setGenerationState] = useState<GenerationState>('idle')
  const [generationSnapshot, setGenerationSnapshot] = useState<GenerationSnapshot | null>(null)
  const [lastGenHash, setLastGenHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const currentConfigHash = computeConfigHash(model.id, resolution, aspectRatio, batchCount, prompt)

  useEffect(() => {
    loadHistory().then(setHistory)
  }, [])

  const switchModel = useCallback((modelId: string) => {
    const config = MODEL_CONFIGS.find((m) => m.id === modelId)
    if (!config) return
    setModel(config)
    setResolution((prev) =>
      config.resolutions.includes(prev) ? prev : config.defaultResolution,
    )
    setAspectRatio((prev) =>
      config.aspectRatios.includes(prev) ? prev : config.defaultAspectRatio,
    )
    setBatchCount((prev) => Math.min(prev, config.maxBatchCount))
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

  const generate = useCallback(async () => {
    if (!apiKeyHook.apiKey || !prompt.trim()) return

    const batchId = crypto.randomUUID()
    const hash = computeConfigHash(model.id, resolution, aspectRatio, batchCount, prompt)

    setGenerationState('generating')
    setGenerationSnapshot({ batchId, batchCount, resolution, aspectRatio, configHash: hash })
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    const params: GenerateParams = {
      apiKey: apiKeyHook.apiKey,
      model,
      prompt: prompt.trim(),
      referenceImages,
      resolution,
      aspectRatio,
      batchId,
    }

    try {
      const promises = Array.from({ length: batchCount }, () =>
        generateImage(params, controller.signal),
      )
      const results = await Promise.allSettled(promises)

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
    }
  }, [apiKeyHook, prompt, model, referenceImages, resolution, aspectRatio, batchCount])

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort()
    setGenerationState('idle')
    setGenerationSnapshot(null)
  }, [])

  const editImage = useCallback((image: PlaygroundImage) => {
    setReferenceImages([image])
    setPrompt('')
  }, [setPrompt])

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
    referenceImages,
    history,
    generationState,
    generationSnapshot,
    showDraft: lastGenHash !== currentConfigHash,
    error,
    switchModel,
    setResolution,
    setAspectRatio,
    setBatchCount,
    setPrompt,
    addReferenceImages,
    removeReferenceImage,
    generate,
    cancelGeneration,
    editImage,
    addToReferences,
    removeFromHistory,
    clearAllHistory,
  }
}
