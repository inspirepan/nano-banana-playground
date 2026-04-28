import { useEffect, useRef, useState } from 'react'

import { downloadImagesZip } from '../../lib/exportImages'
import type { ImageStack, StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { StackItemThumb } from '../StackItemThumb'

type GalleryMode = 'view' | 'manage'

export function SlotHero({
  item,
  onCancelSlot,
  onCancelJob,
  onDismissJob,
}: {
  item: StackItem | null
  onCancelSlot: (slotId: string) => void
  onCancelJob: (jobId: string) => void
  onDismissJob: (jobId: string) => void
}) {
  const slot = item?.type === 'slot' ? item.slot : null
  const job = item?.type === 'slot' ? item.job : null
  const label =
    slot?.status === 'failed'
      ? '生成失败'
      : slot?.status === 'canceled'
        ? '已取消'
        : slot?.status === 'retrying'
          ? '重试中'
          : slot?.status === 'running'
            ? '生成中'
            : '排队中'
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-(--color-text-3)">
      {slot?.status === 'failed' || slot?.status === 'canceled' ? (
        <Icon name="close" size={16} strokeWidth={1.8} />
      ) : (
        <span className="spinner" />
      )}
      <div className="mono text-sm text-(--color-text-2)">{label}</div>
      {slot?.error && <div className="max-w-[420px] text-xs leading-[1.5] text-(--color-text-4)">{slot.error}</div>}
      {slot &&
        job &&
        (slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying') &&
        (job.slots.length === 1 ? (
          <button type="button" className="chip danger mt-2" onClick={() => onCancelSlot(slot.id)}>
            取消
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="chip danger" onClick={() => onCancelSlot(slot.id)}>
              取消当前
            </button>
            <button type="button" className="chip ghost" onClick={() => onCancelJob(job.id)}>
              取消全部
            </button>
          </div>
        ))}
      {slot && job && (slot.status === 'failed' || slot.status === 'canceled') && (
        <button type="button" className="chip ghost mt-2" onClick={() => onDismissJob(job.id)}>
          关闭任务
        </button>
      )}
    </div>
  )
}

export function StackStrip({
  stack,
  selectedId,
  onSelect,
  onCancelActiveJobs,
}: {
  stack: ImageStack
  selectedId: string | null
  onSelect: (item: StackItem) => void
  onCancelActiveJobs: () => void
}) {
  const selectedItemRef = useRef<HTMLDivElement | null>(null)
  const hasActiveJobs = stack.jobs.some((job) =>
    job.slots.some((slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'),
  )

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'smooth' })
  }, [selectedId, stack.items.length])

  return (
    <div
      className="shrink-0 overflow-x-auto border-b border-(--color-border) px-3.5 py-2"
      style={{
        backgroundColor: 'var(--color-bg-sunken)',
        backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-surface) 46%, transparent), color-mix(in srgb, var(--color-surface) 46%, transparent)), linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: 'auto, 28px 28px, 28px 28px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="-m-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-1">
          {stack.items.map((item) => {
            const active = selectedId === item.id
            return (
              <div key={item.id} ref={active ? selectedItemRef : undefined} className="shrink-0">
                <StackItemThumb item={item} active={active} outerRing onSelect={onSelect} />
              </div>
            )
          })}
        </div>
        {hasActiveJobs && (
          <button
            type="button"
            onClick={onCancelActiveJobs}
            className="chip danger shrink-0 text-xs"
            style={{ height: 24, padding: '0 8px' }}
          >
            取消全部
          </button>
        )}
      </div>
    </div>
  )
}

export function StackGallery({
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
  const selectedImages = selectableImages.filter((image) => selectedIds.has(image.id))
  const selectedCount = selectedImages.length
  const allSelected = selectableImages.length > 0 && selectedCount === selectableImages.length

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
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-semibold tracking-[-0.01em]">
            {mode === 'manage' ? '批量管理' : '全部图片'}
          </div>
          <div className="mt-0.5 text-xs text-(--color-text-3)">
            {stack.images.length} 张图片，{stack.activeSlotCount} 个生成中
            {mode === 'manage' && selectedCount > 0 ? `，已选 ${selectedCount} 张` : ''}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {mode === 'manage' ? (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={selectableImages.length === 0}
                className="chip shrink-0"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
              <button
                type="button"
                onClick={handleDownloadSelected}
                disabled={exporting || selectedCount === 0}
                className="chip shrink-0"
              >
                <Icon name="download" size={12} strokeWidth={1.8} />
                {exporting ? '打包中…' : '下载 ZIP'}
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedCount === 0}
                className="chip danger shrink-0"
              >
                <Icon name="trash" size={12} strokeWidth={1.8} />
                {confirmDelete ? `确认删除 ${selectedCount} 张` : '删除'}
              </button>
              <button type="button" onClick={exitManageMode} className="chip ghost shrink-0">
                完成
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={enterManageMode}
              disabled={selectableImages.length === 0}
              className="chip shrink-0"
            >
              批量管理
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {stack.items.map((item) => (
          <StackItemThumb
            key={item.id}
            item={item}
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
}
