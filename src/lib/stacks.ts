import type { PlaygroundImageMeta } from './types'
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
  timestamp: number
  order: number
}

export type StackItem = StackImageItem | StackSlotItem

export type ImageStack = {
  id: string
  createdAt: number
  updatedAt: number
  images: PlaygroundImageMeta[]
  items: StackItem[]
  jobs: GenerationJob[]
  activeSlotCount: number
  failedSlotCount: number
}

function isActiveSlot(slot: GenerationSlot): boolean {
  return slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'
}

export function stackIdForImage(image: PlaygroundImageMeta): string | null {
  if (image.source.type !== 'generated') return null
  return image.source.stackId ?? image.source.batchId
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
  if (image.source.type !== 'generated') return image.timestamp
  return image.source.batchCreatedAt ?? image.timestamp
}

export function buildImageStacks(history: PlaygroundImageMeta[], generationJobs: GenerationJob[]): ImageStack[] {
  const stacks = new Map<string, ImageStack>()
  const jobBatchIds = new Set(generationJobs.map((job) => job.id))
  const batchTimestamps = new Map<string, number>()
  const generatedHistoryItems: Array<{ image: PlaygroundImageMeta; stackId: string; batchId: string; order: number }> =
    []

  for (const image of history) {
    if (image.source.type !== 'generated') continue
    if (jobBatchIds.has(image.source.batchId)) continue
    const stackId = stackIdForImage(image)
    if (!stackId) continue
    const batchTimestamp = batchTimestampForImage(image)
    const current = batchTimestamps.get(image.source.batchId)
    batchTimestamps.set(
      image.source.batchId,
      current === undefined ? batchTimestamp : Math.min(current, batchTimestamp),
    )
    generatedHistoryItems.push({
      image,
      stackId,
      batchId: image.source.batchId,
      order: image.source.slotIndex ?? image.timestamp,
    })
  }

  for (const { image, stackId, batchId, order } of generatedHistoryItems) {
    const batchTimestamp = batchTimestamps.get(batchId) ?? batchTimestampForImage(image)
    const stack = ensureStack(stacks, stackId, batchTimestamp)
    stack.images.push(image)
    stack.items.push({
      type: 'image',
      id: image.id,
      stackId,
      batchId,
      image,
      timestamp: batchTimestamp,
      order,
    })
  }

  for (const job of generationJobs) {
    const stack = ensureStack(stacks, job.stackId, job.createdAt)
    stack.jobs.push(job)
    stack.updatedAt = Math.max(stack.updatedAt, job.createdAt)

    for (const slot of job.slots) {
      if (isActiveSlot(slot)) stack.activeSlotCount++
      if (slot.status === 'failed') stack.failedSlotCount++

      if (slot.status === 'succeeded' && slot.image) {
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
    const seenImages = new Set<string>()
    stack.images = stack.images
      .filter((image) => {
        if (seenImages.has(image.id)) return false
        seenImages.add(image.id)
        return true
      })
      .sort((a, b) => a.timestamp - b.timestamp)
    stack.items.sort(compareStackItems)
  }

  return Array.from(stacks.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}
