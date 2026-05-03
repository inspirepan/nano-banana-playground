import { useCallback, useMemo, useRef, useState } from 'react'

import { useExternalSync, useMountEffect } from './effects'
import { putBlobInCache, removeBlobFromCache } from './useImageSrc'
import type { ModelConfig } from '../config/models'
import { translate } from '../i18n'
import { GENERATE_MAX_ATTEMPTS, generateImage } from '../lib/api'
import { deleteFromHistory, saveToHistory } from '../lib/history'
import { readGenerationConcurrencyPreference, writeGenerationConcurrencyPreference } from '../lib/preferenceStore'
import type { PlaygroundImage } from '../lib/types'
import { isKeyError } from '../lib/validateKey'

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
  outputImageId?: string
}

export type GenerationJob = {
  id: string
  stackId: string
  parentImageId?: string
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
    outputImageIds?: string[]
    outputImageIdSource?: 'agent'
    // OpenAI-only: alpha-channel mask sent to images.edits. We keep it off the
    // persisted `referenceImageIds` so history metadata doesn't show it as a
    // user-visible reference, but the blob still lives here for retries.
    mask?: PlaygroundImage
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

export type RetryGenerationSlotResult = { status: 'queued'; batchId: string } | { status: 'unavailable' }

type ProviderCredentials = { apiKey: string; baseUrl?: string }

type UseGenerationQueueParams = {
  getProviderCredentials: (provider: ModelConfig['provider']) => ProviderCredentials
  invalidateGenerationKey: (provider: ModelConfig['provider']) => void
  onImageSaved: (image: PlaygroundImage) => void
}

const DEFAULT_GENERATION_CONCURRENCY = 2
const MAX_STANDARD_GENERATION_CONCURRENCY = 4
const UNLIMITED_GENERATION_CONCURRENCY = 999

export function clampGenerationConcurrency(value: number): number {
  if (value >= UNLIMITED_GENERATION_CONCURRENCY) return UNLIMITED_GENERATION_CONCURRENCY
  return Math.min(Math.max(1, value), MAX_STANDARD_GENERATION_CONCURRENCY)
}

function initialGenerationConcurrency(): number {
  const raw = readGenerationConcurrencyPreference()
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_GENERATION_CONCURRENCY
  return clampGenerationConcurrency(Number.isFinite(parsed) ? parsed : DEFAULT_GENERATION_CONCURRENCY)
}

export function isActiveSlot(slot: GenerationSlot): boolean {
  return slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'
}

export function isActiveJob(job: GenerationJob): boolean {
  return job.slots.some(isActiveSlot)
}

function shouldKeepExistingJob(job: GenerationJob): boolean {
  return isActiveJob(job) || job.request.outputImageIdSource === 'agent'
}

function deriveJobStatus(slots: GenerationSlot[]): GenerationJobStatus {
  if (slots.some((slot) => slot.status === 'running' || slot.status === 'retrying')) return 'running'
  if (slots.some((slot) => slot.status === 'queued')) return 'queued'

  let succeeded = 0
  let failed = 0
  let canceled = 0
  for (const slot of slots) {
    if (slot.status === 'succeeded') succeeded++
    else if (slot.status === 'failed') failed++
    else if (slot.status === 'canceled') canceled++
  }
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
  if (err.name === 'TimeoutError') return translate('configLib.generationQueue.timeout')
  if (err.name === 'AbortError') return translate('configLib.generationQueue.requestAborted')
  return err.message
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

function generationRequestKey(request: GenerationJob['request']): string {
  return stableStringify({
    modelId: request.model.id,
    prompt: request.prompt,
    resolution: request.resolution,
    aspectRatio: request.aspectRatio,
    options: request.options,
    referenceImages: request.referenceImages.map((image) => ({
      id: image.id,
      mimeType: image.mimeType,
      dataHash: hashString(image.data),
    })),
    mask: request.mask
      ? { id: request.mask.id, mimeType: request.mask.mimeType, dataHash: hashString(request.mask.data) }
      : null,
    outputImageIds: request.outputImageIds ?? null,
    outputImageIdSource: request.outputImageIdSource ?? null,
  })
}

export function useGenerationQueue({
  getProviderCredentials,
  invalidateGenerationKey,
  onImageSaved,
}: UseGenerationQueueParams) {
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

  useMountEffect(() => {
    return () => {
      for (const controller of abortControllersRef.current.values()) controller.abort()
      abortControllersRef.current.clear()
      activeSlotIdsRef.current.clear()
    }
  })

  const updateGenerationSlot = useCallback(
    (jobId: string, slotId: string, updateSlot: (slot: GenerationSlot) => GenerationSlot, removeCompleted = false) => {
      setGenerationJobs((prev) =>
        prev.flatMap((job) => {
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
          if (removeCompleted && status === 'completed' && !job.request.outputImageIds) return []
          return [nextJob]
        }),
      )
    },
    [setGenerationJobs],
  )

  const persistJobReferences = useCallback((job: GenerationJob): Promise<void> => {
    const existing = referencePersistenceRef.current.get(job.id)
    if (existing) return existing

    const promise = Promise.all(
      job.request.referenceImages.map(async (refImg) => {
        await saveToHistory(refImg)
        putBlobInCache(refImg.id, refImg.data)
      }),
    ).then(() => undefined)
    referencePersistenceRef.current.set(job.id, promise)
    return promise
  }, [])

  const startGenerationSlot = useCallback(
    (jobId: string, slotId: string) => {
      const job = generationJobsRef.current.find((item) => item.id === jobId)
      const slot = job?.slots.find((item) => item.id === slotId)
      if (!job || !slot || slot.status !== 'queued' || activeSlotIdsRef.current.has(slotId)) return

      const controller = new AbortController()
      activeSlotIdsRef.current.add(slotId)
      abortControllersRef.current.set(slotId, controller)

      setGenerationJobs((prev) =>
        prev.map((item) => {
          if (item.id !== jobId) return item
          const slots = item.slots.map((current) =>
            current.id === slotId
              ? {
                  ...current,
                  status: 'running' as const,
                  error: undefined,
                  retryDelayMs: undefined,
                  retryAt: undefined,
                }
              : current,
          )
          return { ...item, startedAt: item.startedAt ?? Date.now(), status: deriveJobStatus(slots), slots }
        }),
      )

      void (async () => {
        try {
          await persistJobReferences(job)
          if (controller.signal.aborted) return

          const image = await generateImage(
            {
              ...job.request,
              batchId: job.id,
              batchCreatedAt: job.createdAt,
              stackId: job.stackId,
              parentImageId: job.parentImageId,
              slotIndex: slot.index,
              outputImageId: slot.outputImageId,
              outputImageIdSource: job.request.outputImageIdSource,
            },
            controller.signal,
            {
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
            },
          )

          if (controller.signal.aborted) return

          await saveToHistory(image)
          if (controller.signal.aborted) {
            await deleteFromHistory(image.id).catch(() => {})
            removeBlobFromCache(image.id)
            return
          }
          putBlobInCache(image.id, image.data)
          onImageSaved(image)
          updateGenerationSlot(
            job.id,
            slot.id,
            (current) => ({
              ...current,
              status: 'succeeded',
              image,
              error: undefined,
              retryDelayMs: undefined,
              retryAt: undefined,
            }),
            true,
          )
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e))
          if (controller.signal.aborted) {
            const msg = toDisplayError(err)
            updateGenerationSlot(job.id, slot.id, (current) => {
              if (!isActiveSlot(current)) return current
              return {
                ...current,
                status: 'failed',
                error: msg,
                retryDelayMs: undefined,
                retryAt: undefined,
              }
            })
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
    },
    [invalidateGenerationKey, onImageSaved, persistJobReferences, setGenerationJobs, updateGenerationSlot],
  )

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

  useExternalSync(() => {
    pumpQueueRef.current = pumpGenerationQueue
  }, [pumpGenerationQueue])

  const setGenerationConcurrency = useCallback((value: number) => {
    const next = clampGenerationConcurrency(value)
    generationConcurrencyRef.current = next
    setGenerationConcurrencyState(next)
    writeGenerationConcurrencyPreference(next)
    pumpQueueRef.current()
  }, [])

  const enqueueGenerationJob = useCallback(
    (request: GenerationJob['request'], batchCount: number, stackId: string, parentImageId?: string): string => {
      const batchId = crypto.randomUUID()
      const job: GenerationJob = {
        id: batchId,
        stackId,
        parentImageId,
        createdAt: Date.now(),
        status: 'queued',
        request,
        slots: Array.from({ length: batchCount }, (_, index) => ({
          id: crypto.randomUUID(),
          index,
          status: 'queued',
          attempt: 1,
          maxAttempts: GENERATE_MAX_ATTEMPTS,
          outputImageId: request.outputImageIds?.[index],
        })),
      }
      setGenerationJobs((prev) => [job, ...prev.filter(shouldKeepExistingJob)])
      for (const refImg of request.referenceImages) putBlobInCache(refImg.id, refImg.data)
      pumpQueueRef.current()
      return batchId
    },
    [setGenerationJobs],
  )

  const appendGenerationSlot = useCallback(
    (jobId: string, outputImageId?: string): string | null => {
      const slotId = crypto.randomUUID()
      let appended = false
      setGenerationJobs((prev) =>
        prev.map((job) => {
          if (job.id !== jobId || !isActiveJob(job)) return job
          appended = true
          const slots: GenerationSlot[] = [
            ...job.slots,
            {
              id: slotId,
              index: job.slots.length,
              status: 'queued',
              attempt: 1,
              maxAttempts: GENERATE_MAX_ATTEMPTS,
              outputImageId,
            },
          ]
          return { ...job, slots, status: deriveJobStatus(slots), finishedAt: undefined }
        }),
      )
      if (!appended) return null
      pumpQueueRef.current()
      return slotId
    },
    [setGenerationJobs],
  )

  const findActiveGenerationJob = useCallback(
    (params: { request: GenerationJob['request']; stackId: string; parentImageId?: string }): GenerationJob | null => {
      const targetKey = generationRequestKey(params.request)
      return (
        generationJobsRef.current.find(
          (job) =>
            isActiveJob(job) &&
            job.stackId === params.stackId &&
            job.parentImageId === params.parentImageId &&
            generationRequestKey(job.request) === targetKey,
        ) ?? null
      )
    },
    [],
  )

  const retryGenerationSlot = useCallback(
    (jobId: string, slotId: string): RetryGenerationSlotResult => {
      const job = generationJobsRef.current.find((item) => item.id === jobId)
      const slot = job?.slots.find((item) => item.id === slotId)
      if (!job || !slot || (slot.status !== 'failed' && slot.status !== 'canceled')) return { status: 'unavailable' }

      const credentials = getProviderCredentials(job.request.model.provider)
      if (!credentials.apiKey) return { status: 'unavailable' }

      const request: GenerationJob['request'] = {
        ...job.request,
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl,
        outputImageIds: slot.outputImageId ? [slot.outputImageId] : undefined,
        outputImageIdSource: job.request.outputImageIdSource,
      }
      const activeJob = findActiveGenerationJob({ request, stackId: job.stackId, parentImageId: job.parentImageId })
      if (activeJob) {
        const nextSlotId = appendGenerationSlot(activeJob.id, slot.outputImageId)
        if (nextSlotId) return { status: 'queued', batchId: activeJob.id }
      }

      const batchId = enqueueGenerationJob(request, 1, job.stackId, job.parentImageId)
      return { status: 'queued', batchId }
    },
    [appendGenerationSlot, enqueueGenerationJob, findActiveGenerationJob, getProviderCredentials],
  )

  const cancelGenerationSlot = useCallback(
    (slotId: string) => {
      abortControllersRef.current.get(slotId)?.abort()
      activeSlotIdsRef.current.delete(slotId)
      abortControllersRef.current.delete(slotId)
      setGenerationJobs((prev) =>
        prev.map((job) => {
          if (!job.slots.some((slot) => slot.id === slotId)) return job
          const slots = job.slots.map((slot) =>
            slot.id === slotId && isActiveSlot(slot)
              ? { ...slot, status: 'canceled' as const, error: undefined, retryDelayMs: undefined, retryAt: undefined }
              : slot,
          )
          const status = deriveJobStatus(slots)
          return {
            ...job,
            slots,
            status,
            finishedAt: slots.some(isActiveSlot) ? undefined : (job.finishedAt ?? Date.now()),
          }
        }),
      )
      pumpQueueRef.current()
    },
    [setGenerationJobs],
  )

  const cancelGenerationJob = useCallback(
    (jobId: string) => {
      const job = generationJobsRef.current.find((item) => item.id === jobId)
      if (!job) return
      for (const slot of job.slots) {
        if (!isActiveSlot(slot)) continue
        abortControllersRef.current.get(slot.id)?.abort()
        activeSlotIdsRef.current.delete(slot.id)
        abortControllersRef.current.delete(slot.id)
      }
      setGenerationJobs((prev) =>
        prev.map((item) => {
          if (item.id !== jobId) return item
          const slots = item.slots.map((slot) =>
            isActiveSlot(slot)
              ? { ...slot, status: 'canceled' as const, error: undefined, retryDelayMs: undefined, retryAt: undefined }
              : slot,
          )
          return { ...item, slots, status: deriveJobStatus(slots), finishedAt: Date.now() }
        }),
      )
      pumpQueueRef.current()
    },
    [setGenerationJobs],
  )

  const dismissGenerationJob = useCallback(
    (jobId: string) => {
      setGenerationJobs((prev) => prev.filter((job) => job.id !== jobId || isActiveJob(job)))
    },
    [setGenerationJobs],
  )

  const generationQueueSummary = useMemo(() => summarizeGenerationQueue(generationJobs), [generationJobs])

  return {
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
  }
}
