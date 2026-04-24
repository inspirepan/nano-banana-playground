// Per-image edit state kept in-memory across modal open/close cycles.
// Lives for the browser session only — intentionally not persisted to
// localStorage/IndexedDB since stroke payloads can grow large and users don't
// expect mid-edit state to survive a refresh.

export type DrawMode = 'annotate' | 'mask'
// `step` is the numbered annotation pin; we gate it to annotate mode in the
// toolbar since it makes no sense as a mask shape.
export type DrawTool = 'brush' | 'rect' | 'eraser' | 'step'

export type Point = { x: number; y: number }

type DrawItemBase = {
  id: string
  mode: DrawMode
  color: string
  size: number
}

export type PathItem = DrawItemBase & { kind: 'path'; points: Point[] }
export type RectItem = DrawItemBase & { kind: 'rect'; start: Point; end: Point }
// `n` is the user-visible number. We recompute the next number from the
// current items list each time, so deleting a pin frees up its number.
export type StepItem = DrawItemBase & { kind: 'step'; anchor: Point; n: number }
export type DrawItem = PathItem | RectItem | StepItem

export type ItemCounts = { annotate: number; mask: number }

export function computeItemCounts(items: DrawItem[]): ItemCounts {
  let annotate = 0
  let mask = 0
  for (const it of items) {
    if (it.mode === 'annotate') annotate++
    else mask++
  }
  return { annotate, mask }
}

export type EditState = {
  items: DrawItem[]
  prompt: string
}

const cache = new Map<string, EditState>()
const emptyState: EditState = { items: [], prompt: '' }

export function getEditState(imageId: string): EditState {
  return cache.get(imageId) ?? emptyState
}

export function setEditItems(imageId: string, items: DrawItem[]): void {
  const prev = cache.get(imageId) ?? emptyState
  if (items.length === 0 && !prev.prompt) {
    cache.delete(imageId)
    return
  }
  cache.set(imageId, { ...prev, items })
}

export function setEditPrompt(imageId: string, prompt: string): void {
  const prev = cache.get(imageId) ?? emptyState
  if (prev.items.length === 0 && !prompt) {
    cache.delete(imageId)
    return
  }
  cache.set(imageId, { ...prev, prompt })
}

export function copyEditState(fromImageId: string, toImageId: string): void {
  if (fromImageId === toImageId) return
  const prev = cache.get(fromImageId)
  if (!prev || (prev.items.length === 0 && !prev.prompt)) return
  cache.set(toImageId, { items: [...prev.items], prompt: prev.prompt })
}

export function clearEditState(imageId: string): void {
  cache.delete(imageId)
}
