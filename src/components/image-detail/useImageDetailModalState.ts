import { useCallback, useState } from 'react'

import { BRUSH_PRESETS, type BrushPresetId } from './annotationPresets'
import type { DrawMode, DrawTool } from './DrawableLayer'
import { useExternalSync } from '../../hooks/effects'
import { computeItemCounts, getEditState, type ItemCounts } from '../../lib/editStateCache'

export type EditMode = 'view' | DrawMode
export type ModalViewMode = 'detail' | 'gallery'
export type GalleryMode = 'view' | 'manage'
export type GalleryReturnTarget = 'output' | 'detail'

export function useImageDetailModalState({
  initialViewMode,
  initialGalleryMode = 'view',
  initialEditing,
  currentImageId,
  isMobileLayout,
}: {
  initialViewMode: ModalViewMode
  initialGalleryMode?: GalleryMode
  initialEditing: boolean
  currentImageId: string
  isMobileLayout: boolean
}) {
  const [editing, setEditing] = useState(initialEditing)
  const [mobileDrawOpen, setMobileDrawOpen] = useState(false)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ModalViewMode>(initialViewMode)
  const [galleryInitialMode, setGalleryInitialMode] = useState<GalleryMode>(initialGalleryMode)
  const [galleryReturnTarget, setGalleryReturnTarget] = useState<GalleryReturnTarget>(() =>
    initialViewMode === 'gallery' ? 'output' : 'detail',
  )
  const [editMode, setEditMode] = useState<EditMode>(() => {
    if (typeof window === 'undefined') return 'view'
    return initialEditing && !window.matchMedia('(max-width: 767px)').matches ? 'mask' : 'view'
  })
  const [drawTool, setDrawTool] = useState<DrawTool>('brush')
  const [desktopMoveActive, setDesktopMoveActive] = useState(false)
  const setDrawToolSafe = useCallback((tool: DrawTool) => {
    setDrawTool(tool === 'rect' ? 'brush' : tool)
  }, [])
  const [brushPreset, setBrushPreset] = useState<BrushPresetId>('M')
  const brushSize = BRUSH_PRESETS.find((p) => p.id === brushPreset)?.size ?? 56
  const activeDrawMode: DrawMode = drawTool === 'step' ? 'annotate' : 'mask'
  const [drawableCounts, setDrawableCounts] = useState<ItemCounts>(() =>
    computeItemCounts(getEditState(currentImageId).items),
  )
  const [drawRevision, setDrawRevision] = useState(0)
  const [drawablePagerImageId, setDrawablePagerImageId] = useState(currentImageId)
  if (currentImageId !== drawablePagerImageId) {
    setDrawablePagerImageId(currentImageId)
    setDrawableCounts(computeItemCounts(getEditState(currentImageId).items))
  }

  const resetDetailTab = useCallback(() => {
    setEditing(false)
    setEditMode('view')
    setDrawTool('brush')
    setDesktopMoveActive(false)
    setMobileDrawOpen(false)
  }, [])

  const exitEdit = useCallback(() => {
    resetDetailTab()
    // Keep items cached per image so reopening restores in-progress annotations.
  }, [resetDetailTab])

  useExternalSync(() => {
    if (!isMobileLayout || !editing) setMobileDrawOpen(false)
  }, [isMobileLayout, editing])

  useExternalSync(() => {
    if (!isMobileLayout || !currentImageId) setMobilePreviewOpen(false)
  }, [isMobileLayout, currentImageId])

  return {
    editing,
    setEditing,
    mobileDrawOpen,
    setMobileDrawOpen,
    mobilePreviewOpen,
    setMobilePreviewOpen,
    viewMode,
    setViewMode,
    galleryInitialMode,
    setGalleryInitialMode,
    galleryReturnTarget,
    setGalleryReturnTarget,
    editMode,
    setEditMode,
    drawTool,
    setDrawTool: setDrawToolSafe,
    desktopMoveActive,
    setDesktopMoveActive,
    brushPreset,
    setBrushPreset,
    brushSize,
    activeDrawMode,
    drawableCounts,
    setDrawableCounts,
    drawRevision,
    setDrawRevision,
    resetDetailTab,
    exitEdit,
  }
}
