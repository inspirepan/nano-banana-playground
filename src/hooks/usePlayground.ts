import { useState, useCallback, useEffect, useRef } from 'react'
import { MODEL_CONFIGS, DEFAULT_MODEL, type ModelConfig } from '../config/models'
import { generateImage } from '../lib/api'
import type { PlaygroundImage } from '../lib/types'
import { isKeyError } from '../lib/validateKey'
import { saveToHistory, loadHistory, deleteFromHistory, clearHistory } from '../lib/history'
import { getSessionId, loadDraft, saveDraft, cleanupOldDrafts, getOtherDrafts, adoptDraft, type DraftEntry } from '../lib/draft'
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

export function usePlayground() {
  const apiKeyHook = useApiKey()
  const sessionId = useRef(getSessionId()).current
  const [model, setModel] = useState<ModelConfig>(DEFAULT_MODEL)
  const [resolution, setResolution] = useState(DEFAULT_MODEL.defaultResolution)
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_MODEL.defaultAspectRatio)
  const [batchCount, setBatchCount] = useState(1)
  const [prompt, setPromptRaw] = useState(() => loadDraft(sessionId)?.prompt || '')
  const [orphanedDrafts, setOrphanedDrafts] = useState<DraftEntry[]>(() => getOtherDrafts(sessionId))
  const setPrompt = useCallback((v: string) => {
    setPromptRaw(v)
  }, [])
  const [referenceImages, setReferenceImages] = useState<PlaygroundImage[]>([])
  const [history, setHistory] = useState<PlaygroundImage[]>([])
  const [generationState, setGenerationState] = useState<GenerationState>('idle')
  const [generationSnapshot, setGenerationSnapshot] = useState<GenerationSnapshot | null>(null)
  const [generationPreview, setGenerationPreview] = useState<GenerationPreviewSlot[]>([])
  const [lastGenHash, setLastGenHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const currentConfigHash = computeConfigHash(model.id, resolution, aspectRatio, batchCount, prompt)

  useEffect(() => {
    loadHistory().then(setHistory)
    cleanupOldDrafts()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDraft(sessionId, { prompt })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [prompt, sessionId])

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

  const generate = useCallback(async (prompts?: string[]) => {
    if (!apiKeyHook.apiKey) return
    const promptList = prompts ?? (prompt.trim() ? Array.from({ length: batchCount }, () => prompt.trim()) : [])
    if (promptList.length === 0) return

    const batchId = crypto.randomUUID()
    // Use current state values for hash so showDraft comparison works after generation
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

  const adoptOrphanDraft = useCallback((fromSessionId: string, onRestore: (prompt: string) => void) => {
    const data = adoptDraft(fromSessionId, sessionId)
    if (data) {
      setPromptRaw(data.prompt)
      onRestore(data.prompt)
      setOrphanedDrafts(getOtherDrafts(sessionId))
    }
  }, [sessionId])

  const dismissOrphanDraft = useCallback((fromSessionId: string) => {
    // Just remove from the orphaned list — leave the draft in storage
    setOrphanedDrafts((prev) => prev.filter((d) => d.sessionId !== fromSessionId))
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
    generationPreview,
    showDraft: prompt.trim() !== '' && lastGenHash !== currentConfigHash,
    error,
    sessionId,
    orphanedDrafts,
    switchModel,
    setResolution,
    setAspectRatio,
    setBatchCount,
    setPrompt,
    addReferenceImages,
    removeReferenceImage,
    generate,
    cancelGeneration,
    addToReferences,
    removeFromHistory,
    clearAllHistory,
    adoptOrphanDraft,
    dismissOrphanDraft,
  }
}
