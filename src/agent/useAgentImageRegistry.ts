import { useCallback, useRef, type RefObject } from 'react'

import type { AgentChatAttachment } from './agentChat'
import { reserveAgentImageIds, type AgentImageRegistryEntry } from './imageTasks'
import type { AgentSessionRuntime } from './runtimeTypes'
import { useExternalSync } from '../hooks/effects'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import { getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'
import { translate } from '../i18n'
import { loadImageBlob, loadImageMetas } from '../lib/history'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

export type AgentResolvedImage =
  | { status: 'ready'; source: AgentImageRegistryEntry['source']; image: PlaygroundImage }
  | { status: 'not_ready'; source: AgentImageRegistryEntry['source'] }
  | null

export function useAgentImageRegistry({
  agentRuntimesRef,
  referenceImages,
  history,
  generationJobs,
}: {
  agentRuntimesRef: RefObject<Map<string, AgentSessionRuntime>>
  referenceImages: PlaygroundImage[]
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
}) {
  const agentImageReservationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const agentPendingReservedImageIdsRef = useRef<Set<string>>(new Set())
  const referenceImagesRef = useRef<PlaygroundImage[]>([])
  const historyRef = useRef<PlaygroundImageMeta[]>([])
  const generationJobsRefForAgent = useRef<GenerationJob[]>([])

  useExternalSync(() => {
    referenceImagesRef.current = referenceImages
  }, [referenceImages])

  useExternalSync(() => {
    historyRef.current = history
  }, [history])

  useExternalSync(() => {
    generationJobsRefForAgent.current = generationJobs
  }, [generationJobs])

  const imageIdExistsForAgent = useCallback(
    async (runtime: AgentSessionRuntime, id: string): Promise<boolean> => {
      if (runtime.imageRegistry.has(id)) return true
      for (const otherRuntime of agentRuntimesRef.current.values()) {
        if (otherRuntime.sessionId !== runtime.sessionId && otherRuntime.imageRegistry.has(id)) return true
      }
      if (referenceImagesRef.current.some((image) => image.id === id)) return true
      if (historyRef.current.some((image) => image.id === id)) return true
      if (generationJobsRefForAgent.current.some((job) => job.slots.some((slot) => slot.image?.id === id))) return true
      const metas = await loadImageMetas([id])
      return metas.has(id)
    },
    [agentRuntimesRef],
  )

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

  const resolveAgentImageById = useCallback(async (runtime: AgentSessionRuntime, id: string): Promise<AgentResolvedImage> => {
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
    if (registryEntry && registryEntry.status !== 'ready') return { status: 'not_ready', source: registryEntry.source }

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
  }, [])

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

  return {
    generationJobsRefForAgent,
    reserveAgentImageIdsForRuntime,
    releasePendingAgentImageIds,
    resolveAgentImageById,
    resolveAgentReferenceImages,
  }
}