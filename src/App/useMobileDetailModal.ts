import { useCallback, useMemo, useRef, useState } from 'react'

import type { AgentImageTask } from '../agent'
import type { AgentImageTaskFocusOptions } from '../components/agent-chat/types'
import type { DetailTarget } from '../components/output/outputPanelHelpers'
import type { GenerationJob } from '../hooks/usePlayground'
import { buildImageStacks, type ImageStack } from '../lib/stacks'
import type { PlaygroundImageMeta } from '../lib/types'

export type MobileDetailNavTarget = { stackId: string; itemId: string }
type MobileDetailState = { stackId: string; itemId?: string }

type Params = {
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
}

function resolveStackIdForTask(task: AgentImageTask, generationJobs: GenerationJob[]): string | undefined {
  if (task.request.stackId) return task.request.stackId
  if (!task.generationJobId) return undefined
  return generationJobs.find((item) => item.id === task.generationJobId)?.stackId
}

function resolveTaskDetailItemId(task: AgentImageTask, stack: ImageStack, requestedItemId: string | undefined): string | undefined {
  if (requestedItemId && stack.items.some((item) => item.id === requestedItemId)) return requestedItemId
  const resultIds = new Set(task.resultImageIds)
  let newestTaskImage: PlaygroundImageMeta | undefined
  for (const image of stack.images) {
    if (!resultIds.has(image.id)) continue
    if (!newestTaskImage || image.timestamp > newestTaskImage.timestamp) newestTaskImage = image
  }
  return newestTaskImage?.id ?? stack.items[stack.items.length - 1]?.id
}

// Owns agent -> image-task focus routing: mobile opens the fullscreen detail
// modal directly; desktop pulses the output stack and may request its modal.
export function useMobileDetailModal({ history, generationJobs }: Params) {
  const [highlightStackId, setHighlightStackId] = useState<string | null>(null)
  const [mobileDetailState, setMobileDetailState] = useState<MobileDetailState | null>(null)
  const [desktopDetailTarget, setDesktopDetailTarget] = useState<DetailTarget | null>(null)
  const highlightTimerRef = useRef<number | null>(null)

  const allStacks = useMemo(() => buildImageStacks(history, generationJobs), [history, generationJobs])
  const mobileStackIndex = mobileDetailState
    ? allStacks.findIndex((stack) => stack.id === mobileDetailState.stackId)
    : -1
  const mobileDetailStack = mobileStackIndex >= 0 ? allStacks[mobileStackIndex] : null
  const mobilePrevStackTarget: MobileDetailNavTarget | null =
    mobileStackIndex > 0
      ? (() => {
          const prev = allStacks[mobileStackIndex - 1]
          const item = prev?.items[prev.items.length - 1]
          return item ? { stackId: prev.id, itemId: item.id } : null
        })()
      : null
  const mobileNextStackTarget: MobileDetailNavTarget | null =
    mobileStackIndex >= 0 && mobileStackIndex < allStacks.length - 1
      ? (() => {
          const next = allStacks[mobileStackIndex + 1]
          const item = next?.items[0]
          return item ? { stackId: next.id, itemId: item.id } : null
        })()
      : null

  const handleMobileNavigateToStackItem = useCallback(
    (target: MobileDetailNavTarget) => {
      if (!allStacks.some((stack) => stack.id === target.stackId)) return
      setMobileDetailState({ stackId: target.stackId, itemId: target.itemId })
    },
    [allStacks],
  )

  const handleCloseMobileDetail = useCallback(() => {
    setMobileDetailState(null)
  }, [])

  const handleDesktopDetailTargetConsumed = useCallback(() => {
    setDesktopDetailTarget(null)
  }, [])

  const pulseHighlightStack = useCallback((stackId: string) => {
    if (typeof window === 'undefined') {
      setHighlightStackId(stackId)
      return
    }
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    setHighlightStackId(null)
    window.requestAnimationFrame(() => {
      setHighlightStackId(stackId)
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightStackId((prev) => (prev === stackId ? null : prev))
        highlightTimerRef.current = null
      }, 1800)
    })
  }, [])

  const handleFocusAgentImageTask = useCallback(
    (task: AgentImageTask, options?: AgentImageTaskFocusOptions) => {
      const stackId = resolveStackIdForTask(task, generationJobs)
      if (!stackId) return
      const stack = allStacks.find((s) => s.id === stackId)
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        if (!stack) return
        setMobileDetailState({
          stackId: stack.id,
          itemId: resolveTaskDetailItemId(task, stack, options?.itemId),
        })
        return
      }

      pulseHighlightStack(stackId)
      if ((options?.behavior ?? 'open') === 'locate' || task.status !== 'completed' || !stack) return
      setDesktopDetailTarget({
        stackId: stack.id,
        itemId: resolveTaskDetailItemId(task, stack, options?.itemId),
        viewMode: 'detail',
      })
    },
    [allStacks, generationJobs, pulseHighlightStack],
  )

  return {
    highlightStackId,
    desktopDetailTarget,
    mobileDetailState,
    mobileDetailStack,
    mobilePrevStackTarget,
    mobileNextStackTarget,
    handleMobileNavigateToStackItem,
    handleCloseMobileDetail,
    handleDesktopDetailTargetConsumed,
    handleFocusAgentImageTask,
  }
}
