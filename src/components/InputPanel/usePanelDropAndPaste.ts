import { useCallback, useRef, useState } from 'react'

import { isHeifFile } from '../../lib/fileToImage'
import type { PlaygroundImage } from '../../lib/types'

type Params = {
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
}

type PanelDragHandlers = {
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

// Drag/drop + paste plumbing for the generate panel. dragCountRef offsets the
// nested-element enter/leave noise so the overlay stays stable; paste only
// preempts default when at least one image is found and synthesizes a name
// for anonymous clipboard files.
export function usePanelDropAndPaste({ onAddReferenceImages, onAddReferenceImage }: Params) {
  const [dragOver, setDragOver] = useState(false)
  const dragCountRef = useRef(0)

  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    if (dragCountRef.current === 1) setDragOver(true)
  }, [])

  const handlePanelDragLeave = useCallback(() => {
    dragCountRef.current--
    if (dragCountRef.current === 0) setDragOver(false)
  }, [])

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handlePanelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCountRef.current = 0
      setDragOver(false)

      const imageJson = e.dataTransfer.getData('application/x-playground-image')
      if (imageJson) {
        try {
          const img: PlaygroundImage = JSON.parse(imageJson)
          onAddReferenceImage(img)
          return
        } catch {
          /* fall through */
        }
      }

      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || isHeifFile(f))
      if (files.length > 0) onAddReferenceImages(files)
    },
    [onAddReferenceImages, onAddReferenceImage],
  )

  const handlePanelPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const imageFiles = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith('image/'))
        .map((item, index) => {
          const file = item.getAsFile()
          if (!file) return null
          if (file.name) return file
          const ext = file.type.split('/')[1] || 'png'
          return new File([file], `pasted-image-${Date.now()}-${index + 1}.${ext}`, {
            type: file.type,
            lastModified: Date.now(),
          })
        })
        .filter((file): file is File => file !== null)

      if (imageFiles.length === 0) return
      e.preventDefault()
      onAddReferenceImages(imageFiles)
    },
    [onAddReferenceImages],
  )

  const panelDragHandlers: PanelDragHandlers = {
    onDragEnter: handlePanelDragEnter,
    onDragLeave: handlePanelDragLeave,
    onDragOver: handlePanelDragOver,
    onDrop: handlePanelDrop,
  }

  return { dragOver, panelDragHandlers, handlePanelPaste }
}
