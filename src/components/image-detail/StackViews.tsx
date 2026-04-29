import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { MODEL_CONFIGS } from '../../config/models'
import { downloadImagesZip } from '../../lib/exportImages'
import { formatTime } from '../../lib/queueJobDisplay'
import type { ImageStack, StackItem } from '../../lib/stacks'
import { Icon } from '../Icon'
import { StackItemThumb } from '../StackItemThumb'

type GalleryMode = 'view' | 'manage'

type StackGalleryBatch = {
  id: string
  createdAt: number
  updatedAt: number
  items: StackItem[]
  prompt: string | null
  modelName: string | null
  resolution: string | null
  aspectRatio: string | null
  imageCount: number
  activeSlotCount: number
  failedSlotCount: number
}

function modelNameOf(modelId: string): string {
  return MODEL_CONFIGS.find((model) => model.id === modelId)?.name ?? modelId
}

function isActiveSlotItem(item: StackItem): boolean {
  return item.type === 'slot' && ['queued', 'running', 'retrying'].includes(item.slot.status)
}

function buildStackGalleryBatches(items: StackItem[]): StackGalleryBatch[] {
  const map = new Map<string, StackGalleryBatch>()

  for (const item of items) {
    let batch = map.get(item.batchId)
    if (!batch) {
      batch = {
        id: item.batchId,
        createdAt: item.timestamp,
        updatedAt: item.timestamp,
        items: [],
        prompt: null,
        modelName: null,
        resolution: null,
        aspectRatio: null,
        imageCount: 0,
        activeSlotCount: 0,
        failedSlotCount: 0,
      }
      map.set(item.batchId, batch)
    }

    batch.createdAt = Math.min(batch.createdAt, item.timestamp)
    batch.updatedAt = Math.max(batch.updatedAt, item.timestamp)
    batch.items.push(item)

    if (item.type === 'image') {
      batch.imageCount += 1
      if (item.image.source.type === 'generated') {
        batch.prompt ??= item.image.source.prompt
        batch.modelName ??= modelNameOf(item.image.source.modelId)
        batch.resolution ??= item.image.source.resolution
        batch.aspectRatio ??= item.image.source.aspectRatio
      }
    } else {
      if (isActiveSlotItem(item)) batch.activeSlotCount += 1
      if (item.slot.status === 'failed') batch.failedSlotCount += 1
      batch.prompt ??= item.job.request.prompt
      batch.modelName ??= item.job.request.model.name
      batch.resolution ??= item.job.request.resolution
      batch.aspectRatio ??= item.job.request.aspectRatio
    }
  }

  return Array.from(map.values())
    .map((batch) => ({
      ...batch,
      items: [...batch.items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id))
}

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
      <div className="text-sm text-(--color-text-2)">{label}</div>
      {slot?.error && <div className="max-w-[420px] text-sm leading-[1.5] text-(--color-text-4)">{slot.error}</div>}
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

type StackStripBatch = {
  id: string
  createdAt: number
  items: StackItem[]
  prompt: string | null
}

function buildStackStripBatches(items: StackItem[]): StackStripBatch[] {
  const map = new Map<string, StackStripBatch>()
  const order: string[] = []
  for (const item of items) {
    let batch = map.get(item.batchId)
    if (!batch) {
      batch = { id: item.batchId, createdAt: item.timestamp, items: [], prompt: null }
      map.set(item.batchId, batch)
      order.push(item.batchId)
    }
    batch.items.push(item)
    batch.createdAt = Math.min(batch.createdAt, item.timestamp)
    if (!batch.prompt) {
      if (item.type === 'image' && item.image.source.type === 'generated') {
        batch.prompt = item.image.source.prompt
      } else if (item.type === 'slot') {
        batch.prompt = item.job.request.prompt
      }
    }
  }
  return order.map((id) => map.get(id) as StackStripBatch)
}

function formatHourMinute(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function StackStrip({
  stack,
  selectedId,
  onSelect,
  onCancelActiveJobs,
  leadingNode,
  trailingNode,
  floating = false,
}: {
  stack: ImageStack
  selectedId: string | null
  onSelect: (item: StackItem) => void
  onCancelActiveJobs: () => void
  leadingNode?: ReactNode
  trailingNode?: ReactNode
  floating?: boolean
}) {
  const stripScrollRef = useRef<HTMLDivElement | null>(null)
  const selectedItemRef = useRef<HTMLDivElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const itemNumberById = useMemo(() => new Map(stack.items.map((item, index) => [item.id, index + 1])), [stack.items])
  const batches = useMemo(() => buildStackStripBatches(stack.items), [stack.items])
  const hasActiveJobs = stack.jobs.some((job) =>
    job.slots.some((slot) => slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying'),
  )

  useEffect(() => {
    const scroller = stripScrollRef.current
    const selected = selectedItemRef.current
    if (!scroller || !selected) return

    const targetLeft = selected.offsetLeft + selected.offsetWidth - scroller.clientWidth + 10
    const maxLeft = scroller.scrollWidth - scroller.clientWidth
    scroller.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior: 'smooth' })
  }, [selectedId, stack.items.length, collapsed])

  return (
    <div
      className="shrink-0 overflow-x-auto px-3.5 py-2 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]"
      style={
        floating
          ? {
              // Translucent so the canvas image bleeds through when zoomed.
              backgroundColor: 'color-mix(in srgb, var(--color-bg) 62%, transparent)',
              backdropFilter: 'blur(24px) saturate(150%)',
              WebkitBackdropFilter: 'blur(24px) saturate(150%)',
            }
          : {
              backgroundColor: 'var(--color-bg-sunken)',
              backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-surface) 46%, transparent), color-mix(in srgb, var(--color-surface) 46%, transparent)), linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
              backgroundSize: 'auto, 28px 28px, 28px 28px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }
      }
    >
      <div className="flex items-stretch gap-2">
        {leadingNode && <div className="hidden shrink-0 self-center md:flex">{leadingNode}</div>}
        <div
          ref={stripScrollRef}
          className="strip-scroller -m-1 flex min-w-0 flex-1 items-stretch overflow-x-auto p-1 pr-2"
          data-collapsed={collapsed || undefined}
        >
          {batches.map((batch, batchIdx) => {
            const headline = batchIdx === 0 ? '初始' : `编辑 ${batchIdx}`
            return (
              <div key={batch.id} className="strip-batch flex shrink-0 flex-col" data-collapsed={collapsed || undefined}>
                <div className="strip-header-collapse" data-collapsed={collapsed || undefined}>
                  <div className="min-w-0 overflow-hidden">
                    <div
                      className="strip-header-content min-w-0 px-0.5"
                      style={{ maxWidth: 240 }}
                      data-collapsed={collapsed || undefined}
                    >
                      <div className="flex items-center gap-1 text-sm leading-[1.3] text-(--color-text-2)">
                        <span className="font-medium">{headline}</span>
                        <span className="text-(--color-text-4)">·</span>
                        <span className="text-(--color-text-3)">{formatHourMinute(batch.createdAt)}</span>
                      </div>
                      <div
                        className="mt-0.5 truncate text-sm leading-[1.35] text-(--color-text-4)"
                        title={batch.prompt ?? undefined}
                      >
                        {batch.prompt ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {batch.items.map((item) => {
                    const active = selectedId === item.id
                    return (
                      <div key={item.id} ref={active ? selectedItemRef : undefined} className="shrink-0">
                        <StackItemThumb
                          item={item}
                          number={itemNumberById.get(item.id)}
                          active={active}
                          outerRing
                          onSelect={onSelect}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {trailingNode && (
            <div className="hidden flex-wrap items-center justify-end gap-1.5 md:flex">{trailingNode}</div>
          )}
          <div className="min-h-0 flex-1" />
          <div className="flex items-center gap-1">
            {hasActiveJobs && (
              <button
                type="button"
                onClick={onCancelActiveJobs}
                className="chip danger text-sm"
                style={{ height: 24, padding: '0 8px' }}
              >
                取消全部
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="chip ghost strip-toggle"
              style={{ height: 24, padding: '0 6px' }}
              title={collapsed ? '展开' : '收起'}
              aria-label={collapsed ? '展开' : '收起'}
            >
              <Icon
                name="chevron_down"
                size={14}
                strokeWidth={1.8}
                className="strip-toggle-icon"
                data-collapsed={collapsed || undefined}
              />
            </button>
          </div>
        </div>
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
  const batches = useMemo(() => buildStackGalleryBatches(stack.items), [stack.items])
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
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-semibold tracking-[-0.01em]">
            {mode === 'manage' ? '批量管理' : '全部图片'}
          </div>
          <div className="mt-0.5 text-sm text-(--color-text-3)">
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
      <div className="space-y-5">
        {batches.map((batch) => (
          <section key={batch.id} className="min-w-0">
            <div className="mb-2.5 min-w-0 px-0.5 py-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="whitespace-nowrap text-sm text-(--color-text-3)">{formatTime(batch.createdAt)}</span>
                {batch.modelName && (
                  <span className="whitespace-nowrap text-sm font-medium text-(--color-text-2)">{batch.modelName}</span>
                )}
                {batch.resolution && batch.aspectRatio && (
                  <span className="whitespace-nowrap text-sm text-(--color-text-3)">
                    {batch.resolution} · {batch.aspectRatio}
                  </span>
                )}
                <span className="whitespace-nowrap text-sm text-(--color-text-3)">{batch.imageCount} 张</span>
                {batch.activeSlotCount > 0 && (
                  <span className="whitespace-nowrap text-sm text-(--color-accent)">
                    生成中 {batch.activeSlotCount}
                  </span>
                )}
                {batch.failedSlotCount > 0 && (
                  <span className="whitespace-nowrap text-sm" style={{ color: 'var(--color-danger)' }}>
                    失败 {batch.failedSlotCount}
                  </span>
                )}
              </div>
              {batch.prompt && (
                <div
                  className="mt-1.5 overflow-hidden text-sm leading-[1.55] text-(--color-text-3)"
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                  title={batch.prompt}
                >
                  {batch.prompt}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {batch.items.map((item) => (
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
          </section>
        ))}
      </div>
    </div>
  )
}
