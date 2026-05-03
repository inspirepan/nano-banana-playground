import { useMemo } from 'react'

import { useExternalSync } from '../../../hooks/effects'
import type { GenerationJob } from '../../../hooks/usePlayground'

export function useEditJobTracker(
  generationJobs: GenerationJob[],
  activeEditBatchId: string | null,
  onSetActiveBatchId: (id: string | null, sourceImageId?: string) => void,
): void {
  const activeJob = useMemo(() => {
    if (!activeEditBatchId) return null
    return generationJobs.find((j) => j.id === activeEditBatchId) ?? null
  }, [activeEditBatchId, generationJobs])

  // Clear activeEditBatchId when the job it points to is fully terminal, or
  // when it has dropped off the active jobs list (e.g. pruned after completion).
  useExternalSync(() => {
    if (!activeEditBatchId) return
    if (!activeJob) {
      onSetActiveBatchId(null)
      return
    }
    const anyActive = activeJob.slots.some(
      (s) => s.status === 'queued' || s.status === 'running' || s.status === 'retrying',
    )
    if (!anyActive) onSetActiveBatchId(null)
  }, [activeJob, activeEditBatchId, onSetActiveBatchId])
}
