import { useSyncExternalStore } from 'react'

import { getShowAgentUsageStats, setShowAgentUsageStats, subscribeShowAgentUsageStats } from '../config/agentUsageStats'

export function useShowAgentUsageStats(): {
  showAgentUsageStats: boolean
  setShowAgentUsageStats: (show: boolean) => void
} {
  const showAgentUsageStats = useSyncExternalStore(
    subscribeShowAgentUsageStats,
    getShowAgentUsageStats,
    getShowAgentUsageStats,
  )
  return { showAgentUsageStats, setShowAgentUsageStats }
}
