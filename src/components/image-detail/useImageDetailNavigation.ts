import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { useExternalSync } from '../../hooks/effects'
import { copyEditState } from '../../lib/editStateCache'
import type { ImageStack, StackItem } from '../../lib/stacks'

type StackNavigationTarget = { stackId: string; itemId: string }

export type SelectionState = { id: string; batchId: string; order: number }

type ResetDetailTab = () => void

function toSelectionValue(item: StackItem | null): SelectionState | null {
  return item ? { id: item.id, batchId: item.batchId, order: item.order } : null
}

/**
 * Selection state + the derived `selectedItem` / current image / slot / job
 * lookups. Kept independent from the rest of the navigation hook so callers
 * can feed the resolved image id into other hooks (e.g. modal state) before
 * the navigation handlers — which depend on `resetDetailTab` — are wired up.
 */
export function useImageDetailSelection({ stack, initialItemId }: { stack: ImageStack; initialItemId?: string }) {
  const initialItem = useMemo(
    () => stack.items.find((item) => item.id === initialItemId) ?? stack.items[stack.items.length - 1] ?? null,
    [initialItemId, stack.items],
  )
  const stackItemById = useMemo(() => new Map(stack.items.map((item) => [item.id, item])), [stack.items])
  const stackItemByBatchOrder = useMemo(
    () => new Map(stack.items.map((item) => [`${item.batchId}:${item.order}`, item])),
    [stack.items],
  )
  const stackItemIndexById = useMemo(() => new Map(stack.items.map((item, index) => [item.id, index])), [stack.items])

  const [selection, setSelection] = useState<SelectionState | null>(() => toSelectionValue(initialItem))
  const selectedItem =
    (selection && stackItemById.get(selection.id)) ??
    (selection && stackItemByBatchOrder.get(`${selection.batchId}:${selection.order}`)) ??
    initialItem ??
    null
  if (selectedItem && selection?.id !== selectedItem.id) {
    setSelection(toSelectionValue(selectedItem))
  }

  const currentIdx = selectedItem ? (stackItemIndexById.get(selectedItem.id) ?? -1) : -1
  const currentImage = selectedItem?.type === 'image' ? selectedItem.image : null
  const currentSlot = selectedItem?.type === 'slot' ? selectedItem.slot : null
  const currentJob = selectedItem?.type === 'slot' ? selectedItem.job : null
  const canNavigate = stack.items.length > 0 && currentIdx >= 0

  return {
    selection,
    setSelection,
    selectedItem,
    currentIdx,
    currentImage,
    currentSlot,
    currentJob,
    canNavigate,
  }
}

/**
 * Navigation handlers (selectStackItem / goToPrev / goToNext /
 * handleRemoveCurrent) and the auto-select-edit-batch effect. Consumes a
 * resolved selection (see `useImageDetailSelection`) plus the modal-state
 * `resetDetailTab` so we can keep the original call ordering.
 */
export function useImageDetailNavigation({
  stack,
  setSelection,
  currentIdx,
  canNavigate,
  previousStackTarget,
  nextStackTarget,
  onNavigateToStackItem,
  onClose,
  onRemove,
  resetDetailTab,
  setRefDetailId,
}: {
  stack: ImageStack
  setSelection: Dispatch<SetStateAction<SelectionState | null>>
  currentIdx: number
  canNavigate: boolean
  previousStackTarget?: StackNavigationTarget | null
  nextStackTarget?: StackNavigationTarget | null
  onNavigateToStackItem?: (target: StackNavigationTarget) => void
  onClose: () => void
  onRemove: (id: string) => void | Promise<void>
  resetDetailTab: ResetDetailTab
  setRefDetailId: Dispatch<SetStateAction<string | null>>
}) {
  const selectStackItem = useCallback(
    (item: StackItem | null) => {
      setSelection(toSelectionValue(item))
      setRefDetailId(null)
      resetDetailTab()
    },
    [resetDetailTab, setRefDetailId, setSelection],
  )

  const goToPrev = useCallback(() => {
    if (currentIdx > 0) {
      const prev = stack.items[currentIdx - 1] ?? null
      selectStackItem(prev)
      // No explicit clear — DrawableLayer remounts under the new image's key
      // and restores that image's cached items (empty for never-edited ones).
      return
    }
    if (previousStackTarget) {
      setRefDetailId(null)
      resetDetailTab()
      onNavigateToStackItem?.(previousStackTarget)
    }
  }, [
    currentIdx,
    onNavigateToStackItem,
    previousStackTarget,
    resetDetailTab,
    selectStackItem,
    setRefDetailId,
    stack.items,
  ])

  const goToNext = useCallback(() => {
    if (currentIdx >= 0 && currentIdx < stack.items.length - 1) {
      const next = stack.items[currentIdx + 1] ?? null
      selectStackItem(next)
      return
    }
    if (nextStackTarget) {
      setRefDetailId(null)
      resetDetailTab()
      onNavigateToStackItem?.(nextStackTarget)
    }
  }, [currentIdx, nextStackTarget, onNavigateToStackItem, resetDetailTab, selectStackItem, setRefDetailId, stack.items])

  const handleRemoveCurrent = useCallback(
    (id: string) => {
      const nextImageItem = stack.items.find(
        (item, index) => index > currentIdx && item.type === 'image' && item.id !== id,
      )
      const prevImageItem = stack.items.findLast(
        (item, index) => index < currentIdx && item.type === 'image' && item.id !== id,
      )
      const replacement = nextImageItem ?? prevImageItem ?? null

      if (replacement) selectStackItem(replacement)
      else onClose()

      void Promise.resolve(onRemove(id))
    },
    [currentIdx, onClose, onRemove, selectStackItem, stack.items],
  )

  const hasPrev = canNavigate && (currentIdx > 0 || Boolean(previousStackTarget && onNavigateToStackItem))
  const hasNext =
    canNavigate && (currentIdx < stack.items.length - 1 || Boolean(nextStackTarget && onNavigateToStackItem))

  // Auto-select the new edit batch inside the stack strip. The selection starts
  // on the pending slot, then follows the same batch/order when it becomes an image.
  const navedBatchIdRef = useRef<string | null>(null)
  const copiedEditTargetIdsRef = useRef(new Set<string>())
  const activeEditSourceIdRef = useRef<string | null>(null)
  const [activeEditBatchId, setActiveEditBatchId] = useState<string | null>(null)
  const setActiveEditBatch = useCallback((batchId: string | null, sourceImageId?: string) => {
    activeEditSourceIdRef.current = batchId ? (sourceImageId ?? activeEditSourceIdRef.current) : null
    setActiveEditBatchId(batchId)
  }, [])

  useExternalSync(() => {
    if (!activeEditBatchId) return
    const firstItem = stack.items.find((item) => item.batchId === activeEditBatchId)
    if (firstItem && navedBatchIdRef.current !== activeEditBatchId) {
      navedBatchIdRef.current = activeEditBatchId
      setSelection(toSelectionValue(firstItem))
      setRefDetailId(null)
    }

    const sourceId = activeEditSourceIdRef.current
    if (sourceId) {
      for (const item of stack.items) {
        if (item.batchId !== activeEditBatchId || item.type !== 'image') continue
        if (copiedEditTargetIdsRef.current.has(item.image.id)) continue
        copyEditState(sourceId, item.image.id)
        copiedEditTargetIdsRef.current.add(item.image.id)
      }
    }
  }, [activeEditBatchId, stack.items, setRefDetailId, setSelection])

  return {
    hasPrev,
    hasNext,
    selectStackItem,
    goToPrev,
    goToNext,
    handleRemoveCurrent,
    activeEditBatchId,
    setActiveEditBatch,
  }
}
