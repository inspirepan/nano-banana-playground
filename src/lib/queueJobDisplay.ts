import type { GenerationSlot } from '../hooks/usePlayground'
import { translate, type Translate } from '../i18n'

type SlotCounts = {
  queued: number
  running: number
  retrying: number
  succeeded: number
  failed: number
  canceled: number
  active: number
  done: number
  total: number
}

function isActiveSlot(slot: GenerationSlot): boolean {
  return slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'
}

export function countSlots(slots: GenerationSlot[]): SlotCounts {
  const counts: SlotCounts = {
    queued: 0,
    running: 0,
    retrying: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0,
    active: 0,
    done: 0,
    total: slots.length,
  }
  for (const slot of slots) {
    counts[slot.status]++
    if (isActiveSlot(slot)) counts.active++
    else counts.done++
  }
  return counts
}

export function jobStatusLabel(counts: SlotCounts, t: Translate = translate): string {
  if (counts.active > 0) {
    const parts = [t('configLib.queue.runningProgress', { done: counts.done, total: counts.total })]
    if (counts.running > 0) parts.push(t('configLib.queue.generatingCount', { count: counts.running }))
    if (counts.retrying > 0) parts.push(t('configLib.queue.retryingCount', { count: counts.retrying }))
    if (counts.queued > 0) parts.push(t('configLib.queue.queuedCount', { count: counts.queued }))
    return parts.join(' · ')
  }
  if (counts.succeeded === counts.total) {
    return t('configLib.queue.completedProgress', { done: counts.succeeded, total: counts.total })
  }
  if (counts.succeeded > 0) {
    const parts = [t('configLib.queue.completedProgress', { done: counts.succeeded, total: counts.total })]
    if (counts.failed > 0) parts.push(t('configLib.queue.failedCount', { count: counts.failed }))
    if (counts.canceled > 0) parts.push(t('configLib.queue.canceledCount', { count: counts.canceled }))
    return parts.join(' · ')
  }
  if (counts.failed > 0) return t('configLib.queue.failedProgress', { failed: counts.failed, total: counts.total })
  return t('configLib.queue.canceledProgress', { canceled: counts.canceled, total: counts.total })
}

export function formatTime(ts: number, t: Translate = translate): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return t('configLib.queue.justNow')
  if (diff < 3600_000) return t('configLib.queue.minutesAgo', { count: Math.floor(diff / 60_000) })
  if (diff < 86400_000) return t('configLib.queue.hoursAgo', { count: Math.floor(diff / 3600_000) })
  return new Date(ts).toLocaleDateString()
}
