import { useCallback, useState } from 'react'

import {
  firstStackItemTarget,
  lastStackItemTarget,
  latestImages,
  type DetailNavigationTarget,
  type DetailTarget,
} from './outputPanelHelpers'
import type { ImageStack, StackItem } from '../../lib/stacks'

type Params = {
  stacks: ImageStack[]
  stackIndexById: Map<string, number>
}

type Result = {
  detailTarget: DetailTarget | null
  setDetailTarget: (target: DetailTarget | null) => void
  detailStackIndex: number
  detailStack: ImageStack | null
  previousStackTarget: DetailNavigationTarget | null
  nextStackTarget: DetailNavigationTarget | null
  openStackItem: (stack: ImageStack, item: StackItem) => void
  editStackItem: (stack: ImageStack, item: StackItem) => void
  openStackGallery: (stack: ImageStack) => void
  navigateDetailToTarget: (target: DetailNavigationTarget) => void
}

export function useStackDetailNavigation({ stacks, stackIndexById }: Params): Result {
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)

  const detailStackIndex = detailTarget ? (stackIndexById.get(detailTarget.stackId) ?? -1) : -1
  const detailStack = detailStackIndex >= 0 ? stacks[detailStackIndex] : null
  const previousStackTarget = detailStackIndex > 0 ? lastStackItemTarget(stacks[detailStackIndex - 1]) : null
  const nextStackTarget =
    detailStackIndex >= 0 && detailStackIndex < stacks.length - 1
      ? firstStackItemTarget(stacks[detailStackIndex + 1])
      : null

  const openStackItem = useCallback((stack: ImageStack, item: StackItem) => {
    setDetailTarget({ stackId: stack.id, itemId: item.id, viewMode: 'detail' })
  }, [])

  const editStackItem = useCallback((stack: ImageStack, item: StackItem) => {
    if (item.type !== 'image') return
    setDetailTarget({ stackId: stack.id, itemId: item.id, viewMode: 'detail', initialEditing: true })
  }, [])

  const openStackGallery = useCallback((stack: ImageStack) => {
    const newestImage = latestImages(stack)[0]
    const fallbackItem = stack.items[stack.items.length - 1]
    setDetailTarget({ stackId: stack.id, itemId: newestImage?.id ?? fallbackItem?.id, viewMode: 'gallery' })
  }, [])

  const navigateDetailToTarget = useCallback((target: DetailNavigationTarget) => {
    setDetailTarget({ stackId: target.stackId, itemId: target.itemId, viewMode: 'detail' })
  }, [])

  return {
    detailTarget,
    setDetailTarget,
    detailStackIndex,
    detailStack,
    previousStackTarget,
    nextStackTarget,
    openStackItem,
    editStackItem,
    openStackGallery,
    navigateDetailToTarget,
  }
}
