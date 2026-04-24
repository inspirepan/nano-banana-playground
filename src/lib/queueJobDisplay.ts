import type { GenerationSlot } from '../hooks/usePlayground'

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

export function jobStatusLabel(counts: SlotCounts): string {
  if (counts.active > 0) {
    const parts = [`运行 ${counts.done}/${counts.total}`]
    if (counts.running > 0) parts.push(`生成 ${counts.running}`)
    if (counts.retrying > 0) parts.push(`重试 ${counts.retrying}`)
    if (counts.queued > 0) parts.push(`排队 ${counts.queued}`)
    return parts.join(' · ')
  }
  if (counts.succeeded === counts.total) return `完成 ${counts.succeeded}/${counts.total}`
  if (counts.succeeded > 0) {
    const parts = [`完成 ${counts.succeeded}/${counts.total}`]
    if (counts.failed > 0) parts.push(`失败 ${counts.failed}`)
    if (counts.canceled > 0) parts.push(`取消 ${counts.canceled}`)
    return parts.join(' · ')
  }
  if (counts.failed > 0) return `失败 ${counts.failed}/${counts.total}`
  return `已取消 ${counts.canceled}/${counts.total}`
}

export function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return new Date(ts).toLocaleDateString()
}
