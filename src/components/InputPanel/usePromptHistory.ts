import { useCallback, useRef, useState } from 'react'

import { useMountEffect } from '../../hooks/effects'

type Params = {
  prompt: string
  onPromptChange: (v: string) => void
}

// Prompt undo/redo with a 500ms debounce. When undo is invoked while the
// current prompt diverges from the latest history entry, the live value is
// pushed first so it is recoverable via redo.
export function usePromptHistory({ prompt, onPromptChange }: Params) {
  const historyRef = useRef({ entries: [prompt], index: 0 })
  const debounceRef = useRef<number>(0)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const syncHistoryState = useCallback(() => {
    const h = historyRef.current
    setHistoryState({
      canUndo: h.index > 0,
      canRedo: h.index < h.entries.length - 1,
    })
  }, [])

  const pushHistory = useCallback(
    (value: string) => {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        const h = historyRef.current
        if (h.entries[h.index] === value) return
        h.entries = h.entries.slice(0, h.index + 1)
        h.entries.push(value)
        h.index = h.entries.length - 1
        syncHistoryState()
      }, 500)
    },
    [syncHistoryState],
  )

  const handleHistoryUndo = useCallback(() => {
    const h = historyRef.current
    if (h.index <= 0) return
    window.clearTimeout(debounceRef.current)
    if (h.entries[h.index] !== prompt) {
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(prompt)
      h.index = h.entries.length - 1
    }
    h.index--
    onPromptChange(h.entries[h.index])
    syncHistoryState()
  }, [prompt, onPromptChange, syncHistoryState])

  const handleHistoryRedo = useCallback(() => {
    const h = historyRef.current
    if (h.index >= h.entries.length - 1) return
    h.index++
    onPromptChange(h.entries[h.index])
    syncHistoryState()
  }, [onPromptChange, syncHistoryState])

  useMountEffect(() => () => {
    window.clearTimeout(debounceRef.current)
  })

  return {
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    pushHistory,
    handleHistoryUndo,
    handleHistoryRedo,
  }
}
