import { useSyncExternalStore } from 'react'

import {
  getComposerSubmitMode,
  setComposerSubmitMode,
  subscribeComposerSubmitMode,
  type ComposerSubmitMode,
} from '../config/composerSubmitMode'

export function useComposerSubmitMode(): {
  composerSubmitMode: ComposerSubmitMode
  setComposerSubmitMode: (mode: ComposerSubmitMode) => void
} {
  const composerSubmitMode = useSyncExternalStore(
    subscribeComposerSubmitMode,
    getComposerSubmitMode,
    getComposerSubmitMode,
  )
  return { composerSubmitMode, setComposerSubmitMode }
}
