import { Fragment, memo, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'

import { useExternalSync } from '../../hooks/effects'
import { useI18n, type Translate } from '../../i18n'
import type { ImageStack, StackItem } from '../../lib/stacks'
import { StackItemThumb } from '../StackItemThumb'

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

function stackStripBatchHeadline({
  batch,
  previousBatches,
  t,
}: {
  batch: StackStripBatch
  previousBatches: StackStripBatch[]
  t: Translate
}): string {
  const initialIndex = previousBatches.filter((item) => item.kind === 'initial').length + 1
  const editIndex = previousBatches.filter((item) => item.kind === 'edit').length + 1
  if (batch.kind === 'initial') {
    return initialIndex === 1
      ? t('imageDetail.batch.initial')
      : t('imageDetail.batch.initialIndexed', { index: initialIndex })
  }
  return t('imageDetail.batch.edit', { index: editIndex })
}

function StackStripBatchGroup({
  batch,
  previousBatches,
  itemNumberById,
  selectedId,
  selectedItemRef,
  showSeparator,
  onSelect,
}: {
  batch: StackStripBatch
  previousBatches: StackStripBatch[]
  itemNumberById: Map<string, number>
  selectedId: string | null
  selectedItemRef: MutableRefObject<HTMLDivElement | null>
  showSeparator: boolean
  onSelect: (item: StackItem) => void
}) {
  const { t } = useI18n()
  const headline = stackStripBatchHeadline({ batch, previousBatches, t })

  return (
    <Fragment>
      {showSeparator && (
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
                  compactSlotStatus
                  onSelect={onSelect}
                />
              </div>
            )
          })}
        </div>
      </div>
    </Fragment>
  )
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
          {batches.map((batch, batchIndex) => (
            <StackStripBatchGroup
              key={batch.id}
              batch={batch}
              previousBatches={batches.slice(0, batchIndex)}
              itemNumberById={itemNumberById}
              selectedId={selectedId}
              selectedItemRef={selectedItemRef}
              showSeparator={batchIndex > 0}
              onSelect={onSelect}
            />
          ))}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
        {trailingNode && (
          <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 md:flex">{trailingNode}</div>
        )}
      </div>
    </div>
  )
})
