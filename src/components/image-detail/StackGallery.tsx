import { memo, useMemo, useState } from 'react'

import { useI18n } from '../../i18n'
import { downloadImagesZip } from '../../lib/exportImages'
import type { ImageStack, StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { StackItemThumb } from '../StackItemThumb'

type GalleryMode = 'view' | 'manage'

function StackGalleryToolbar({
  mode,
  selectedCount,
  allSelected,
  selectableImageCount,
  exporting,
  confirmDelete,
  onToggleSelectAll,
  onDownloadSelected,
  onDeleteSelected,
  onEnterManageMode,
  onExitManageMode,
}: {
  mode: GalleryMode
  selectedCount: number
  allSelected: boolean
  selectableImageCount: number
  exporting: boolean
  confirmDelete: boolean
  onToggleSelectAll: () => void
  onDownloadSelected: () => void
  onDeleteSelected: () => void
  onEnterManageMode: () => void
  onExitManageMode: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 flex min-h-9 flex-nowrap items-center gap-2 overflow-hidden bg-(--color-bg) px-4 pb-2 pt-1 md:-mx-5 md:px-5">
      {mode === 'manage' && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex h-7 items-center rounded-[var(--radius-sm)] bg-(--color-accent-wash) px-2 text-sm font-medium text-(--color-accent-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
            {selectedCount > 0
              ? t('imageDetail.gallery.selectedCount', { selected: selectedCount })
              : t('imageDetail.action.manageBatch')}
          </span>
        </div>
      )}
      <div className="min-w-2 flex-1" />
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {mode === 'manage' ? (
          <>
            <button
              type="button"
              onClick={onToggleSelectAll}
              disabled={selectableImageCount === 0}
              className="action-soft shrink-0"
            >
              {allSelected ? t('imageDetail.action.deselectAll') : t('imageDetail.action.selectAll')}
            </button>
            <button
              type="button"
              onClick={onDownloadSelected}
              disabled={exporting || selectedCount === 0}
              className="action-soft shrink-0"
            >
              <Icon name="download" size={12} strokeWidth={1.8} className="action-soft-icon" />
              {exporting ? t('imageDetail.gallery.exportingZip') : t('imageDetail.gallery.downloadZip')}
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={selectedCount === 0}
              className="chip danger shrink-0 text-sm"
            >
              <Icon name="trash" size={12} strokeWidth={1.8} />
              {confirmDelete ? t('imageDetail.gallery.confirmDelete', { count: selectedCount }) : t('common.delete')}
            </button>
            <button type="button" onClick={onExitManageMode} className="action-soft shrink-0">
              {t('imageDetail.action.done')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEnterManageMode}
            disabled={selectableImageCount === 0}
            className="action-soft shrink-0"
          >
            <Icon name="list_checks" size={12} strokeWidth={1.8} className="action-soft-icon" />
            {t('imageDetail.action.manageBatch')}
          </button>
        )}
      </div>
    </div>
  )
}

export const StackGallery = memo(function StackGallery({
  stack,
  initialMode,
  selectedId,
  onSelect,
  onRemove,
}: {
  stack: ImageStack
  initialMode: GalleryMode
  selectedId: string | null
  onSelect: (item: StackItem) => void
  onRemove: (id: string) => void | Promise<void>
}) {
  const [mode, setMode] = useState<GalleryMode>(initialMode)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const selectableImages = stack.images
  const selectedImages = useMemo(
    () => selectableImages.filter((image) => selectedIds.has(image.id)),
    [selectableImages, selectedIds],
  )
  const selectedCount = selectedImages.length
  const allSelected = selectableImages.length > 0 && selectedCount === selectableImages.length
  const itemNumberById = useMemo(() => new Map(stack.items.map((item, index) => [item.id, index + 1])), [stack.items])

  const toggleImage = (item: StackItem) => {
    if (item.type !== 'image') return
    setConfirmDelete(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.image.id)) next.delete(item.image.id)
      else next.add(item.image.id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setConfirmDelete(false)
    setSelectedIds(allSelected ? new Set() : new Set(selectableImages.map((image) => image.id)))
  }

  const handleDownloadSelected = async () => {
    if (exporting || selectedImages.length === 0) return
    setExporting(true)
    try {
      await downloadImagesZip(selectedImages, `nano-banana-stack-${stack.id.slice(0, 8)}.zip`)
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedImages.length === 0) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const ids = selectedImages.map((image) => image.id)
    await Promise.all(ids.map((id) => Promise.resolve(onRemove(id))))
    setSelectedIds(new Set())
    setConfirmDelete(false)
  }

  const enterManageMode = () => {
    setConfirmDelete(false)
    setMode('manage')
  }

  const exitManageMode = () => {
    setConfirmDelete(false)
    setSelectedIds(new Set())
    setMode('view')
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-5 md:py-4">
      <StackGalleryToolbar
        mode={mode}
        selectedCount={selectedCount}
        allSelected={allSelected}
        selectableImageCount={selectableImages.length}
        exporting={exporting}
        confirmDelete={confirmDelete}
        onToggleSelectAll={toggleSelectAll}
        onDownloadSelected={handleDownloadSelected}
        onDeleteSelected={handleDeleteSelected}
        onEnterManageMode={enterManageMode}
        onExitManageMode={exitManageMode}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {stack.items.map((item) => (
          <StackItemThumb
            key={item.id}
            item={item}
            number={itemNumberById.get(item.id)}
            active={mode === 'view' && selectedId === item.id}
            selectable={mode === 'manage' && item.type === 'image'}
            selected={mode === 'manage' && item.type === 'image' && selectedIds.has(item.image.id)}
            outerRing
            className="aspect-square h-auto w-full"
            onSelect={mode === 'manage' ? toggleImage : onSelect}
          />
        ))}
      </div>
    </div>
  )
})
