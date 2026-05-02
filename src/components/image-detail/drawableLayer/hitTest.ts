import type { DrawItem, Point, StepItem } from '../../../lib/editStateCache'

export const ERASER_HIT_PADDING = 6 // extra natural-px tolerance around items

// Ratio of (bubble-center-to-tip distance) over radius. 2.0 gives a rounded
// bubble whose tangents to the anchor form a smooth teardrop tail.
export const STEP_TAIL_RATIO = 2.0

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function stepPinCenter(item: StepItem): Point {
  return { x: item.anchor.x, y: item.anchor.y - item.size * STEP_TAIL_RATIO }
}

export function hitTestItem(item: DrawItem, pt: Point): boolean {
  if (item.kind === 'path') {
    const threshold = item.size / 2 + ERASER_HIT_PADDING
    const pts = item.points
    if (pts.length === 1) return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= threshold
    for (let i = 1; i < pts.length; i++) {
      if (distanceToSegment(pt, pts[i - 1], pts[i]) <= threshold) return true
    }
    return false
  }
  if (item.kind === 'rect') {
    const x1 = Math.min(item.start.x, item.end.x)
    const y1 = Math.min(item.start.y, item.end.y)
    const x2 = Math.max(item.start.x, item.end.x)
    const y2 = Math.max(item.start.y, item.end.y)
    const pad = item.size / 2 + ERASER_HIT_PADDING
    return pt.x >= x1 - pad && pt.x <= x2 + pad && pt.y >= y1 - pad && pt.y <= y2 + pad
  }
  const c = stepPinCenter(item)
  if (Math.hypot(pt.x - c.x, pt.y - c.y) <= item.size + ERASER_HIT_PADDING) return true
  if (Math.hypot(pt.x - item.anchor.x, pt.y - item.anchor.y) <= item.size * 0.5 + ERASER_HIT_PADDING) return true
  return false
}

export function nextStepNumber(items: DrawItem[]): number {
  const used = new Set<number>()
  for (const it of items) {
    if (it.kind === 'step') used.add(it.n)
  }
  let n = 1
  while (used.has(n)) n++
  return n
}
