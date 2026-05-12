import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { DrawableLayerHandle } from './DrawableLayer'
import type { EditMode } from './useImageDetailModalState'
import { useWindowEvent } from '../../hooks/effects'

export function useImageDetailKeyboard({
  editing,
  editMode,
  mobilePreviewOpen,
  mobileDrawOpen,
  canNavigate,
  drawableRef,
  setEditMode,
  setDrawRevision,
  setMobilePreviewOpen,
  setMobileDrawOpen,
  exitEdit,
  onClose,
  goToPrev,
  goToNext,
}: {
  editing: boolean
  editMode: EditMode
  mobilePreviewOpen: boolean
  mobileDrawOpen: boolean
  canNavigate: boolean
  drawableRef: RefObject<DrawableLayerHandle | null>
  setEditMode: Dispatch<SetStateAction<EditMode>>
  setDrawRevision: Dispatch<SetStateAction<number>>
  setMobilePreviewOpen: Dispatch<SetStateAction<boolean>>
  setMobileDrawOpen: Dispatch<SetStateAction<boolean>>
  exitEdit: () => void
  onClose: () => void
  goToPrev: () => void
  goToNext: () => void
}) {
  useWindowEvent('keydown', (e) => {
    // Ctrl/Cmd+Z triggers an undo on the drawable layer. Skip when the user
    // is typing into an input/textarea (e.g. the prompt or text-pin editor)
    // so undo stays a text-level operation there.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      if (editing && editMode !== 'view' && !isTextInput) {
        e.preventDefault()
        drawableRef.current?.undo()
        return
      }
    }
    if (e.key === 'Escape') {
      if (mobilePreviewOpen) {
        setMobilePreviewOpen(false)
        return
      }
      if (mobileDrawOpen) {
        setMobileDrawOpen(false)
        return
      }
      if (editMode !== 'view') {
        setEditMode('view')
        setDrawRevision((prev) => prev + 1)
        return
      }
      if (editing) {
        exitEdit()
        return
      }
      onClose()
      return
    }
    if (editing) return
    if (!canNavigate) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      goToPrev()
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      goToNext()
    }
  })
}
