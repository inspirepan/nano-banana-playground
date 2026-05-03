import { useCallback, useMemo, useRef, useState } from 'react'

import type { AgentImageTask } from '../agent'
import type { GenerationJob } from '../hooks/usePlayground'
import { buildImageStacks } from '../lib/stacks'
import type { PlaygroundImageMeta } from '../lib/types'

export type MobileDetailNavTarget = { stackId: string; itemId: string }
type MobileDetailState = { stackId: string; itemId?: string }

type Params = {
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
}

// Owns the mobile fullscreen-detail modal state, the desktop highlight pulse
// state, and the agent -> image-task focus dispatcher that picks between the
// two based on viewport width.
export function useMobileDetailModal({ history, generationJobs }: Params) {
  const [highlightStackId, setHighlightStackId] = useState<string | null>(null)
  const [mobileDetailState, setMobileDetailState] = useState<MobileDetailState | null>(null)
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

  const handleFocusAgentImageTask = useCallback(
    (task: AgentImageTask) => {
      let stackId = task.request.stackId
      if (!stackId && task.generationJobId) {
        const job = generationJobs.find((item) => item.id === task.generationJobId)
        stackId = job?.stackId ?? undefined
      }
      if (!stackId) return
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        const stack = allStacks.find((s) => s.id === stackId)
        if (!stack) return
        const newestImage = stack.images.toSorted((a, b) => b.timestamp - a.timestamp)[0]
        const fallbackItem = stack.items[stack.items.length - 1]
        setMobileDetailState({
          stackId: stack.id,
          itemId: newestImage?.id ?? fallbackItem?.id,
        })
      } else {
        setHighlightStackId(stackId)
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightStackId((prev) => (prev === stackId ? null : prev))
          highlightTimerRef.current = null
        }, 1800)
      }
    },
    [allStacks, generationJobs],
  )

  return {
    highlightStackId,
    mobileDetailState,
    mobileDetailStack,
    mobilePrevStackTarget,
    mobileNextStackTarget,
    handleMobileNavigateToStackItem,
    handleCloseMobileDetail,
    handleFocusAgentImageTask,
  }
}
