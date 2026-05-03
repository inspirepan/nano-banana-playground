import { useCallback, useState } from 'react'

import type { ImageStack } from '../../lib/stacks'

type Params = {
  onRemove: (id: string) => void
}

type Result = {
  confirmDeleteStackId: string | null
  deletingStackId: string | null
  handleRequestDeleteStack: (stackId: string) => void
  handleCancelDeleteStack: () => void
  handleDeleteStackClick: (stack: ImageStack) => void
}

// confirm flag is cleared with a functional updater so concurrent deletions
// only clear the flag for the stack that finished.
export function useStackDeletion({ onRemove }: Params): Result {
  const [confirmDeleteStackId, setConfirmDeleteStackId] = useState<string | null>(null)
  const [deletingStackId, setDeletingStackId] = useState<string | null>(null)

  const handleRequestDeleteStack = useCallback((stackId: string) => {
    setConfirmDeleteStackId(stackId)
  }, [])

  const handleCancelDeleteStack = useCallback(() => {
    setConfirmDeleteStackId(null)
  }, [])

  const handleDeleteStack = useCallback(
    async (stack: ImageStack) => {
      if (deletingStackId) return
      setDeletingStackId(stack.id)
      try {
        for (const image of stack.images) {
          await Promise.resolve(onRemove(image.id))
        }
        setConfirmDeleteStackId((current) => (current === stack.id ? null : current))
      } finally {
        setDeletingStackId(null)
      }
    },
    [deletingStackId, onRemove],
  )

  const handleDeleteStackClick = useCallback(
    (stack: ImageStack) => {
      handleDeleteStack(stack).catch(() => undefined)
    },
    [handleDeleteStack],
  )

  return {
    confirmDeleteStackId,
    deletingStackId,
    handleRequestDeleteStack,
    handleCancelDeleteStack,
    handleDeleteStackClick,
  }
}
