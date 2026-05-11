import { useCallback, useMemo, useRef, useState } from 'react'

import type { AgentImageTask } from '../agent'
import type { AgentImageTaskFocusOptions } from '../components/agent-chat/types'
import type { DetailTarget } from '../components/output/outputPanelHelpers'
import { useExternalSync, useMediaQuery } from '../hooks/effects'
import type { GenerationJob } from '../hooks/usePlayground'
import { buildImageStacks, type ImageStack } from '../lib/stacks'
import type { PlaygroundImageMeta } from '../lib/types'

const MOBILE_LAYOUT_QUERY = '(max-width: 767.98px)'
const PENDING_MOBILE_DETAIL_TIMEOUT_MS = 2000

export type MobileDetailNavTarget = { stackId: string; itemId: string }
type MobileDetailState = { stackId: string; itemId?: string }
type PendingMobileDetailState = MobileDetailState & { createdAt: number; targetItemIds: string[] }

type Params = {
  history: PlaygroundImageMeta[]
  generationJobs: GenerationJob[]
}

function resolveStackIdForTask(
  task: AgentImageTask,
  generationJobs: GenerationJob[],
  stacks: ImageStack[],
): string | undefined {
  if (task.request.stackId) return task.request.stackId
  if (task.generationJobId) {
    const stackId = generationJobs.find((item) => item.id === task.generationJobId)?.stackId
    if (stackId) return stackId
  }
  const resultIds = new Set(task.resultImageIds)
  return stacks.find((stack) => stack.items.some((item) => item.type === 'image' && resultIds.has(item.id)))?.id
}

function resolveTaskDetailItemId(
  task: AgentImageTask,
  stack: ImageStack,
  requestedItemId: string | undefined,
): string | undefined {
  if (requestedItemId && stack.items.some((item) => item.id === requestedItemId)) return requestedItemId
  const resultIds = new Set(task.resultImageIds)
  const reservedIds = new Set(task.request.reservedImageIds)
  let newestTaskImage: PlaygroundImageMeta | undefined
  for (const image of stack.images) {
    if (!resultIds.has(image.id)) continue
    if (!newestTaskImage || image.timestamp > newestTaskImage.timestamp) newestTaskImage = image
  }
  const failureItem = stack.items.find(
    (item) =>
      item.type === 'slot' &&
      item.slot.status === 'failed' &&
      ((task.generationJobId && item.batchId === task.generationJobId) ||
        (item.slot.outputImageId && reservedIds.has(item.slot.outputImageId))),
  )
  return newestTaskImage?.id ?? failureItem?.id ?? stack.items[stack.items.length - 1]?.id
}

function targetItemIdsForTask(
  task: AgentImageTask,
  stack: ImageStack | undefined,
  requestedItemId: string | undefined,
): string[] {
  if (requestedItemId) return [requestedItemId]
  if (task.resultImageIds.length > 0) return task.resultImageIds
  if (task.status !== 'failed' || !stack) return []
  const reservedIds = new Set(task.request.reservedImageIds)
  return stack.items.flatMap((item) => {
    if (item.type !== 'slot' || item.slot.status !== 'failed') return []
    if (task.generationJobId && item.batchId === task.generationJobId) return [item.id]
    if (item.slot.outputImageId && reservedIds.has(item.slot.outputImageId)) return [item.id]
    return []
  })
}

function stackHasTargetItem(stack: ImageStack, targetItemIds: string[]): boolean {
  if (targetItemIds.length === 0) return true
  const ids = new Set(targetItemIds)
  return stack.items.some((item) => ids.has(item.id))
}

function resolvePendingDetailItemId(pending: PendingMobileDetailState, stack: ImageStack): string | undefined {
  if (pending.itemId && stack.items.some((item) => item.id === pending.itemId)) return pending.itemId
  const ids = new Set(pending.targetItemIds)
  return stack.items.find((item) => ids.has(item.id))?.id ?? stack.items[stack.items.length - 1]?.id
}

// Owns agent -> image-task focus routing: mobile opens the fullscreen detail
// modal directly; desktop pulses the output stack and may request its modal.
export function useMobileDetailModal({ history, generationJobs }: Params) {
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_QUERY)
  const [highlightStackId, setHighlightStackId] = useState<string | null>(null)
  const [mobileDetailState, setMobileDetailState] = useState<MobileDetailState | null>(null)
  const [pendingMobileDetailState, setPendingMobileDetailState] = useState<PendingMobileDetailState | null>(null)
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

  useExternalSync(() => {
    if (!pendingMobileDetailState) return
    if (!isMobileLayout) {
      setPendingMobileDetailState(null)
      return
    }
    const stack = allStacks.find((item) => item.id === pendingMobileDetailState.stackId)
    if (stack && stackHasTargetItem(stack, pendingMobileDetailState.targetItemIds)) {
      setMobileDetailState({
        stackId: pendingMobileDetailState.stackId,
        itemId: resolvePendingDetailItemId(pendingMobileDetailState, stack),
      })
      setPendingMobileDetailState(null)
      return
    }

    const remaining = PENDING_MOBILE_DETAIL_TIMEOUT_MS - (Date.now() - pendingMobileDetailState.createdAt)
    if (remaining <= 0) {
      setPendingMobileDetailState(null)
      return
    }
    const timeout = window.setTimeout(() => {
      setPendingMobileDetailState((prev) => (prev === pendingMobileDetailState ? null : prev))
    }, remaining)
    return () => window.clearTimeout(timeout)
  }, [allStacks, isMobileLayout, pendingMobileDetailState])

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
      const stackId = resolveStackIdForTask(task, generationJobs, allStacks)
      if (!stackId) return
      const stack = allStacks.find((s) => s.id === stackId)
      if (isMobileLayout) {
        const targetItemIds = targetItemIdsForTask(task, stack, options?.itemId)
        if (!stack || !stackHasTargetItem(stack, targetItemIds)) {
          setPendingMobileDetailState({
            stackId,
            itemId: options?.itemId ?? task.resultImageIds[0],
            targetItemIds,
            createdAt: Date.now(),
          })
          return
        }
        setPendingMobileDetailState(null)
        setMobileDetailState({
          stackId,
          itemId: resolveTaskDetailItemId(task, stack, options?.itemId),
        })
        return
      }

      pulseHighlightStack(stackId)
      const openableStatus = task.status === 'completed' || task.status === 'failed'
      if ((options?.behavior ?? 'open') === 'locate' || !openableStatus || !stack) {
        return
      }
      setDesktopDetailTarget({
        stackId: stack.id,
        itemId: resolveTaskDetailItemId(task, stack, options?.itemId),
        viewMode: 'detail',
      })
    },
    [allStacks, generationJobs, isMobileLayout, pulseHighlightStack],
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
