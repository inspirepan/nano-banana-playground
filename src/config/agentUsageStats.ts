import { readShowAgentUsageStatsPreference, writeShowAgentUsageStatsPreference } from '../lib/preferenceStore'

let activeShowAgentUsageStats = readShowAgentUsageStatsPreference()
const listeners = new Set<() => void>()

export function getShowAgentUsageStats(): boolean {
  return activeShowAgentUsageStats
}

export function setShowAgentUsageStats(next: boolean): void {
  if (activeShowAgentUsageStats === next) return
  activeShowAgentUsageStats = next
  writeShowAgentUsageStatsPreference(next)
  for (const listener of listeners) listener()
}

export function subscribeShowAgentUsageStats(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
