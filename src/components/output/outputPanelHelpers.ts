import { MODEL_CONFIGS } from '../../config/models'
import type { GenerationJob } from '../../hooks/usePlayground'
import type { Translate } from '../../i18n'
import { countSlots } from '../../lib/queueJobDisplay'
import type { ImageStack, StackItem } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

export const MODEL_CONFIG_BY_ID = new Map(MODEL_CONFIGS.map((m) => [m.id, m]))

export type DetailTarget = {
  stackId: string
  itemId?: string
  viewMode?: 'detail' | 'gallery'
  initialEditing?: boolean
}
export type DetailNavigationTarget = { stackId: string; itemId: string }
export type ActiveStackStatusPart = { kind: 'running' | 'retrying' | 'queued'; label: string }
export type ItemGenerationSummary = { modelName: string; aspectRatio: string; resolution: string }

export function latestImages(stack: ImageStack): PlaygroundImageMeta[] {
  return stack.images.toSorted((a, b) => b.timestamp - a.timestamp)
}

export function firstStackItemTarget(stack: ImageStack | undefined): DetailNavigationTarget | null {
  const item = stack?.items[0]
  return item ? { stackId: stack.id, itemId: item.id } : null
}

export function lastStackItemTarget(stack: ImageStack | undefined): DetailNavigationTarget | null {
  const item = stack?.items[stack.items.length - 1]
  return item ? { stackId: stack.id, itemId: item.id } : null
}

export function stackItemAspectRatio(item: StackItem): string {
  if (item.type === 'image' && item.image.source.type === 'generated') return item.image.source.aspectRatio
  if (item.type === 'slot') return item.job.request.aspectRatio
  return '1:1'
}

export function stackItemGenerationSummary(item: StackItem): ItemGenerationSummary | null {
  if (item.type === 'slot') {
    return {
      modelName: item.job.request.model.name,
      aspectRatio: item.job.request.aspectRatio,
      resolution: item.job.request.resolution,
    }
  }
  const source = item.image.source
  if (source.type !== 'generated') return null
  return {
    modelName: MODEL_CONFIG_BY_ID.get(source.modelId)?.name ?? source.modelId,
    aspectRatio: source.aspectRatio,
    resolution: source.resolution,
  }
}

export function hasActiveGenerationSlots(job: GenerationJob): boolean {
  return job.slots.some((slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying')
}

export function canDismissFailedGenerationJob(job: GenerationJob): boolean {
  return !hasActiveGenerationSlots(job) && job.slots.some((slot) => slot.status === 'failed')
}

export function activeStackStatusParts(stack: ImageStack, t: Translate): ActiveStackStatusPart[] {
  const counts = countSlots(stack.jobs.flatMap((job) => job.slots))
  const parts: ActiveStackStatusPart[] = []
  if (counts.running > 0)
    parts.push({ kind: 'running', label: t('output.status.generatingCount', { count: counts.running }) })
  if (counts.retrying > 0)
    parts.push({ kind: 'retrying', label: t('output.status.retryingCount', { count: counts.retrying }) })
  if (counts.queued > 0) parts.push({ kind: 'queued', label: t('output.status.queuedCount', { count: counts.queued }) })
  return parts
}
