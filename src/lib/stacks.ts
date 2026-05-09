import { DEFAULT_MODEL, MODEL_CONFIGS } from '../config/models'
import type { PlaygroundImageMeta } from './types'
import { isGeneratedLikeSource, type GenerationFailureSource } from './types'
import type { GenerationJob, GenerationSlot } from '../hooks/usePlayground'

export type StackImageItem = {
  type: 'image'
  id: string
  stackId: string
  batchId: string
  image: PlaygroundImageMeta
  timestamp: number
  order: number
}

export type StackSlotItem = {
  type: 'slot'
  id: string
  stackId: string
  batchId: string
  slot: GenerationSlot
  job: GenerationJob
  failureImage?: PlaygroundImageMeta & { source: GenerationFailureSource }
  timestamp: number
  order: number
}

export type StackItem = StackImageItem | StackSlotItem

export type ImageStack = {
  id: string
  title?: string
  createdAt: number
  updatedAt: number
  images: PlaygroundImageMeta[]
  items: StackItem[]
  jobs: GenerationJob[]
  activeSlotCount: number
  failedSlotCount: number
}

function applyStackTitle(stack: ImageStack, title: string | undefined): void {
  const trimmed = title?.trim()
  if (trimmed && !stack.title) stack.title = trimmed
}

function isActiveSlot(slot: GenerationSlot): boolean {
  return slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'
}

export function stackIdForImage(image: PlaygroundImageMeta): string | null {
  if (!isGeneratedLikeSource(image.source)) return null
  return image.source.stackId ?? image.source.batchId
}

const MODEL_BY_ID = new Map(MODEL_CONFIGS.map((model) => [model.id, model]))

function modelForFailure(source: GenerationFailureSource) {
  return MODEL_BY_ID.get(source.modelId) ?? { ...DEFAULT_MODEL, id: source.modelId, name: source.modelId }
}

function slotItemForFailureImage(image: PlaygroundImageMeta & { source: GenerationFailureSource }): StackSlotItem {
  const source = image.source
  const slotIndex = source.slotIndex ?? 0
  const attemptErrors = source.attemptErrors ?? []
  const latestAttempt = attemptErrors.length > 0 ? Math.max(...attemptErrors.map((item) => item.attempt)) : 1
  const slot: GenerationSlot = {
    id: image.id,
    index: slotIndex,
    status: 'failed',
    attempt: source.attempt ?? latestAttempt,
    maxAttempts: source.maxAttempts ?? Math.max(latestAttempt, 1),
    error: source.error,
    attemptErrors: source.attemptErrors,
    outputImageId: source.outputImageId,
  }
  const job: GenerationJob = {
    id: source.batchId,
    stackId: source.stackId ?? source.batchId,
    parentImageId: source.parentImageId,
    createdAt: source.batchCreatedAt ?? image.timestamp,
    finishedAt: source.failedAt,
    status: 'failed',
    request: {
      apiKey: '',
      model: modelForFailure(source),
      prompt: source.prompt,
      referenceImages: [],
      resolution: source.resolution,
      aspectRatio: source.aspectRatio,
      options: source.options ?? {},
      outputImageIds: source.outputImageId ? [source.outputImageId] : undefined,
      outputImageIdSource: source.imageIdSource,
    },
    slots: [slot],
  }
  return {
    type: 'slot',
    id: image.id,
    stackId: source.stackId ?? source.batchId,
    batchId: source.batchId,
    slot,
    job,
    failureImage: image,
    timestamp: source.batchCreatedAt ?? image.timestamp,
    order: slotIndex,
  }
}

function ensureStack(map: Map<string, ImageStack>, id: string, timestamp: number): ImageStack {
  const existing = map.get(id)
  if (existing) {
    existing.createdAt = Math.min(existing.createdAt, timestamp)
    existing.updatedAt = Math.max(existing.updatedAt, timestamp)
    return existing
  }
  const stack: ImageStack = {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    images: [],
    items: [],
    jobs: [],
    activeSlotCount: 0,
    failedSlotCount: 0,
  }
  map.set(id, stack)
  return stack
}

function compareStackItems(a: StackItem, b: StackItem): number {
  return a.timestamp - b.timestamp || a.order - b.order || a.id.localeCompare(b.id)
}

function batchTimestampForImage(image: PlaygroundImageMeta): number {
  if (!isGeneratedLikeSource(image.source)) return image.timestamp
  return image.source.batchCreatedAt ?? image.timestamp
}

export function buildImageStacks(history: PlaygroundImageMeta[], generationJobs: GenerationJob[]): ImageStack[] {
  const stacks = new Map<string, ImageStack>()
  const jobBatchIds = new Set<string>()
  for (const job of generationJobs) jobBatchIds.add(job.id)

  // Pass 1: gather earliest batch timestamp per batchId so we can attach all
  // images of the same batch to a stable visual time.
  const batchTimestamps = new Map<string, number>()
  for (const image of history) {
    if (!isGeneratedLikeSource(image.source)) continue
    if (jobBatchIds.has(image.source.batchId)) continue
    const ts = batchTimestampForImage(image)
    const current = batchTimestamps.get(image.source.batchId)
    if (current === undefined || ts < current) batchTimestamps.set(image.source.batchId, ts)
  }

  // Pass 2: bucket history images into stacks. Track seen ids per stack to
  // dedup against future job slot images without an extra full filter pass.
  const seenIdsByStack = new Map<string, Set<string>>()
  for (const image of history) {
    if (!isGeneratedLikeSource(image.source)) continue
    const batchId = image.source.batchId
    if (jobBatchIds.has(batchId)) continue
    const stackId = stackIdForImage(image)
    if (!stackId) continue
    const batchTimestamp = batchTimestamps.get(batchId) ?? batchTimestampForImage(image)
    const stack = ensureStack(stacks, stackId, batchTimestamp)
    applyStackTitle(stack, image.source.stackTitle)
    let seen = seenIdsByStack.get(stackId)
    if (!seen) {
      seen = new Set<string>()
      seenIdsByStack.set(stackId, seen)
    }
    if (seen.has(image.id)) continue
    seen.add(image.id)
    if (image.source.type === 'generation-failure') {
      stack.failedSlotCount++
      const failureItem = slotItemForFailureImage(image as PlaygroundImageMeta & { source: GenerationFailureSource })
      stack.jobs.push(failureItem.job)
      stack.items.push(failureItem)
      continue
    }
    stack.images.push(image)
    stack.items.push({
      type: 'image',
      id: image.id,
      stackId,
      batchId,
      image,
      timestamp: batchTimestamp,
      order: image.source.slotIndex ?? image.timestamp,
    })
  }

  // Pass 3: fold active jobs (and their slots) into the stacks.
  for (const job of generationJobs) {
    const stack = ensureStack(stacks, job.stackId, job.createdAt)
    applyStackTitle(stack, job.stackTitle)
    stack.jobs.push(job)
    if (job.createdAt > stack.updatedAt) stack.updatedAt = job.createdAt
    let seen = seenIdsByStack.get(job.stackId)
    if (!seen) {
      seen = new Set<string>()
      seenIdsByStack.set(job.stackId, seen)
    }

    for (const slot of job.slots) {
      if (isActiveSlot(slot)) stack.activeSlotCount++
      if (slot.status === 'failed') stack.failedSlotCount++

      if (slot.status === 'succeeded' && slot.image) {
        if (!seen.has(slot.image.id)) {
          seen.add(slot.image.id)
          stack.images.push(slot.image)
          stack.items.push({
            type: 'image',
            id: slot.image.id,
            stackId: job.stackId,
            batchId: job.id,
            image: slot.image,
            timestamp: job.createdAt,
            order: slot.index,
          })
        }
      } else {
        stack.items.push({
          type: 'slot',
          id: slot.id,
          stackId: job.stackId,
          batchId: job.id,
          slot,
          job,
          timestamp: job.createdAt,
          order: slot.index,
        })
      }
    }
  }

  for (const stack of stacks.values()) {
    stack.images.sort((a, b) => a.timestamp - b.timestamp)
    stack.items.sort(compareStackItems)
  }

  return Array.from(stacks.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}
