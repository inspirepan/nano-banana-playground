import { Fragment, memo, useMemo, useRef, useState, type ReactNode } from 'react'

import { MODEL_CONFIGS } from '../../config/models'
import { useExternalSync } from '../../hooks/effects'
import { useI18n } from '../../i18n'
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
  onRetry,
}: {
  item: StackItem | null
  onCancelSlot: (slotId: string) => void
  onCancelJob: (jobId: string) => void
  onDismissJob: (jobId: string) => void
  onRetry: () => void
}) {
  const { t } = useI18n()
  const slot = item?.type === 'slot' ? item.slot : null
  const job = item?.type === 'slot' ? item.job : null
  const label =
    slot?.status === 'failed'
      ? t('imageDetail.queue.status.failed')
      : slot?.status === 'canceled'
        ? t('imageDetail.queue.status.canceled')
        : slot?.status === 'retrying'
          ? t('imageDetail.queue.status.retrying')
          : slot?.status === 'running'
            ? t('imageDetail.queue.status.generating')
            : t('imageDetail.queue.status.queued')
  const detail = slot?.error ?? (slot?.status === 'canceled' ? t('imageDetail.queue.canceledDetail') : null)
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-(--color-text-3)">
      {slot?.status === 'failed' || slot?.status === 'canceled' ? (
        <Icon name="close" size={16} strokeWidth={1.8} />
      ) : (
        <span className="spinner" />
      )}
      <div className="text-sm text-(--color-text-2)">{label}</div>
      {detail && <div className="max-w-[420px] text-sm leading-[1.5] text-(--color-text-2)">{detail}</div>}
      {slot &&
        job &&
        (slot.status === 'queued' || slot.status === 'running' || slot.status === 'retrying') &&
        (job.slots.length === 1 ? (
          <button type="button" className="chip danger mt-2" onClick={() => onCancelSlot(slot.id)}>
            {t('common.cancel')}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="chip danger" onClick={() => onCancelSlot(slot.id)}>
              {t('imageDetail.queue.cancelCurrent')}
            </button>
            <button type="button" className="chip ghost" onClick={() => onCancelJob(job.id)}>
              {t('imageDetail.queue.cancelAll')}
            </button>
          </div>
        ))}
      {slot && job && (slot.status === 'failed' || slot.status === 'canceled') && (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" className="chip" onClick={onRetry} title={t('imageDetail.action.retryOriginal')}>
            <Icon name="refresh" size={12} strokeWidth={1.8} />
            {t('common.retry')}
          </button>
          <button type="button" className="chip ghost" onClick={() => onDismissJob(job.id)}>
            {t('imageDetail.action.closeTask')}
          </button>
        </div>
      )}
    </div>
  )
}

type StackStripBatch = {
  id: string
  createdAt: number
  items: StackItem[]
  prompt: string | null
  imageIdLabel: string | null
  imageIdTitle: string | null
  kind: 'initial' | 'edit'
}

function agentImageIdOf(item: StackItem): string | null {
  if (item.type === 'image') {
    return item.image.source.type === 'generated' && item.image.source.imageIdSource === 'agent' ? item.image.id : null
  }

  if (item.job.request.outputImageIdSource !== 'agent') return null
  return item.slot.outputImageId ?? item.job.request.outputImageIds?.[item.slot.index] ?? null
}

function numericSuffixCandidates(id: string): string[] {
  const candidates = [id]
  let current = id
  while (true) {
    const match = /^(.*)_\d+$/.exec(current)
    if (!match?.[1]) return candidates
    current = match[1]
    candidates.push(current)
  }
}

function matchesNumericSequence(id: string, base: string): boolean {
  if (id === base) return true
  if (!id.startsWith(`${base}_`)) return false
  return /^\d+$/.test(id.slice(base.length + 1))
}

function batchImageIdLabel(ids: string[]): string | null {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return null
  if (uniqueIds.length === 1) return uniqueIds[0]

  return (
    numericSuffixCandidates(uniqueIds[0]).find((candidate) =>
      uniqueIds.every((id) => matchesNumericSequence(id, candidate)),
    ) ?? uniqueIds[0]
  )
}

function buildStackStripBatches(items: StackItem[]): StackStripBatch[] {
  const map = new Map<string, StackStripBatch>()
  const order: string[] = []
  const imageIdsByBatch = new Map<string, string[]>()
  for (const item of items) {
    let batch = map.get(item.batchId)
    if (!batch) {
      batch = {
        id: item.batchId,
        createdAt: item.timestamp,
        items: [],
        prompt: null,
        imageIdLabel: null,
        imageIdTitle: null,
        kind: 'initial',
      }
      map.set(item.batchId, batch)
      order.push(item.batchId)
    }
    batch.items.push(item)
    batch.createdAt = Math.min(batch.createdAt, item.timestamp)
    const imageId = agentImageIdOf(item)
    if (imageId) {
      const ids = imageIdsByBatch.get(item.batchId) ?? []
      ids.push(imageId)
      imageIdsByBatch.set(item.batchId, ids)
    }
    if (
      (item.type === 'image' && item.image.source.type === 'generated' && item.image.source.parentImageId) ||
      (item.type === 'slot' && item.job.parentImageId)
    ) {
      batch.kind = 'edit'
    }
    if (!batch.prompt) {
      if (item.type === 'image' && item.image.source.type === 'generated') {
        batch.prompt = item.image.source.prompt
      } else if (item.type === 'slot') {
        batch.prompt = item.job.request.prompt
      }
    }
  }
  return order.map((id) => {
    const batch = map.get(id) as StackStripBatch
    const imageIds = imageIdsByBatch.get(id) ?? []
    const label = batchImageIdLabel(imageIds)
    return {
      ...batch,
      imageIdLabel: label,
      imageIdTitle: imageIds.length > 1 ? Array.from(new Set(imageIds)).join(', ') : label,
    }
  })
}

function formatHourMinute(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export const StackStrip = memo(function StackStrip({
  stack,
  selectedId,
  onSelect,
  leadingNode,
  trailingNode,
}: {
  stack: ImageStack
  selectedId: string | null
  onSelect: (item: StackItem) => void
  leadingNode?: ReactNode
  trailingNode?: ReactNode
}) {
  const { t } = useI18n()
  const stripScrollRef = useRef<HTMLDivElement | null>(null)
  const selectedItemRef = useRef<HTMLDivElement | null>(null)
  const itemNumberById = useMemo(() => new Map(stack.items.map((item, index) => [item.id, index + 1])), [stack.items])
  const batches = useMemo(() => buildStackStripBatches(stack.items), [stack.items])
  const selectedScrollKey = `${selectedId ?? 'none'}:${stack.items.length}`

  useExternalSync(() => {
    if (selectedScrollKey.length === 0) return
    const scroller = stripScrollRef.current
    const selected = selectedItemRef.current
    if (!scroller || !selected) return

    const targetLeft = selected.offsetLeft + selected.offsetWidth - scroller.clientWidth + 10
    const maxLeft = scroller.scrollWidth - scroller.clientWidth
    scroller.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior: 'smooth' })
  }, [selectedScrollKey])

  return (
    <div
      className="shrink-0 overflow-x-auto px-3.5 py-2 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]"
      style={{
        backgroundColor: 'var(--color-bg-sunken)',
        backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-surface) 46%, transparent), color-mix(in srgb, var(--color-surface) 46%, transparent)), linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: 'auto, 28px 28px, 28px 28px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2">
        {leadingNode && <div className="hidden shrink-0 md:flex">{leadingNode}</div>}
        <div
          ref={stripScrollRef}
          className="scroll-fade-x -m-1 flex min-w-0 flex-1 items-stretch gap-2.5 overflow-x-auto py-1 pl-3 pr-3 [--scroll-fade-end-size:0.9rem] [--scroll-fade-start-size:0.9rem]"
        >
          {batches.map((batch, batchIndex) => {
            const previousBatches = batches.slice(0, batchIndex)
            const initialIndex = previousBatches.filter((item) => item.kind === 'initial').length + 1
            const editIndex = previousBatches.filter((item) => item.kind === 'edit').length + 1
            const headline =
              batch.kind === 'initial'
                ? initialIndex === 1
                  ? t('imageDetail.batch.initial')
                  : t('imageDetail.batch.initialIndexed', { index: initialIndex })
                : t('imageDetail.batch.edit', { index: editIndex })
            return (
              <Fragment key={batch.id}>
                {batchIndex > 0 && (
                  <div
                    aria-hidden
                    className="hidden w-px shrink-0 self-stretch md:block"
                    style={{ background: 'var(--ring-edge-soft)' }}
                  />
                )}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <div className={`min-w-0 px-0.5 ${batch.items.length === 1 ? 'max-w-[112px]' : 'max-w-[160px]'}`}>
                    <div className="flex items-center gap-1 text-sm leading-[1.3] text-(--color-text-2)">
                      <span className="font-medium">{headline}</span>
                      <span className="text-(--color-text-4)">·</span>
                      <span className="text-(--color-text-3)">{formatHourMinute(batch.createdAt)}</span>
                    </div>
                    {batch.imageIdLabel && (
                      <div
                        className="mono mt-0.5 truncate text-xs leading-[1.35] text-(--color-text-3)"
                        title={batch.imageIdTitle ?? batch.imageIdLabel}
                      >
                        {batch.imageIdLabel}
                      </div>
                    )}
                    {!batch.imageIdLabel && (
                      <div
                        className="mt-0.5 truncate text-xs leading-[1.35] text-(--color-text-3)"
                        title={batch.prompt ?? undefined}
                      >
                        {batch.prompt ?? '—'}
                      </div>
                    )}
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
                            showImageIdLabel={false}
                            onSelect={onSelect}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Fragment>
            )
          })}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
        {trailingNode && (
          <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 md:flex">{trailingNode}</div>
        )}
      </div>
    </div>
  )
})

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
  const { t } = useI18n()
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
            {mode === 'manage' ? t('imageDetail.action.manageBatch') : t('imageDetail.gallery.allImages')}
          </div>
          <div className="mt-0.5 text-sm text-(--color-text-3)">
            {mode === 'manage' && selectedCount > 0
              ? t('imageDetail.gallery.summarySelected', {
                  images: stack.images.length,
                  active: stack.activeSlotCount,
                  selected: selectedCount,
                })
              : t('imageDetail.gallery.summary', { images: stack.images.length, active: stack.activeSlotCount })}
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
                {allSelected ? t('imageDetail.action.deselectAll') : t('imageDetail.action.selectAll')}
              </button>
              <button
                type="button"
                onClick={handleDownloadSelected}
                disabled={exporting || selectedCount === 0}
                className="chip shrink-0"
              >
                <Icon name="download" size={12} strokeWidth={1.8} />
                {exporting ? t('imageDetail.gallery.exportingZip') : t('imageDetail.gallery.downloadZip')}
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedCount === 0}
                className="chip danger shrink-0"
              >
                <Icon name="trash" size={12} strokeWidth={1.8} />
                {confirmDelete ? t('imageDetail.gallery.confirmDelete', { count: selectedCount }) : t('common.delete')}
              </button>
              <button type="button" onClick={exitManageMode} className="chip ghost shrink-0">
                {t('imageDetail.action.done')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={enterManageMode}
              disabled={selectableImages.length === 0}
              className="chip shrink-0"
            >
              {t('imageDetail.action.manageBatch')}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-5">
        {batches.map((batch) => (
          <section
            key={batch.id}
            className="min-w-0"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '220px' }}
          >
            <div className="mb-2.5 min-w-0 px-0.5 py-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="whitespace-nowrap text-sm text-(--color-text-3)">
                  {formatTime(batch.createdAt, t)}
                </span>
                {batch.modelName && (
                  <span className="whitespace-nowrap text-sm font-medium text-(--color-text-2)">{batch.modelName}</span>
                )}
                {batch.resolution && batch.aspectRatio && (
                  <span className="whitespace-nowrap text-sm text-(--color-text-3) tabular-nums">
                    {batch.resolution} · {batch.aspectRatio}
                  </span>
                )}
                <span className="whitespace-nowrap text-sm text-(--color-text-3) tabular-nums">
                  {t('imageDetail.batch.imageCount', { count: batch.imageCount })}
                </span>
                {batch.activeSlotCount > 0 && (
                  <span className="whitespace-nowrap text-sm text-(--color-accent)">
                    {t('imageDetail.batch.generatingCount', { count: batch.activeSlotCount })}
                  </span>
                )}
                {batch.failedSlotCount > 0 && (
                  <span className="whitespace-nowrap text-sm" style={{ color: 'var(--color-danger)' }}>
                    {t('imageDetail.batch.failedCount', { count: batch.failedSlotCount })}
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
})
