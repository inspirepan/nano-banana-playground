import { useSyncExternalStore } from 'react'

import {
  getPreferredImageModelId,
  setPreferredImageModelId,
  subscribePreferredImageModelId,
} from '../config/preferredImageModel'

export function usePreferredImageModel(): {
  preferredImageModelId: string | null
  setPreferredImageModelId: (id: string | null) => void
} {
  const preferredImageModelId = useSyncExternalStore(
    subscribePreferredImageModelId,
    getPreferredImageModelId,
    getPreferredImageModelId,
  )
  return { preferredImageModelId, setPreferredImageModelId }
}
