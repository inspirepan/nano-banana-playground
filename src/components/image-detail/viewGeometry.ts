export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Inset = { top?: number; right?: number; bottom?: number; left?: number }

export const MIN_SCALE = 0.5
export const MAX_SCALE = 6
export const FIT_SCALE = 1

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function getCenter(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Pixel offset that translates an item from container-center to safe-area-
// center. When something has a top inset, the safe area shifts down → the
// shift y is positive.
export function getInsetCenterShift(inset?: Inset): Point {
  const top = inset?.top ?? 0
  const right = inset?.right ?? 0
  const bottom = inset?.bottom ?? 0
  const left = inset?.left ?? 0
  return { x: (left - right) / 2, y: (top - bottom) / 2 }
}

export function getViewportSize(element: HTMLDivElement | null, inset?: Inset): Size {
  if (!element) return { width: 0, height: 0 }
  const top = inset?.top ?? 0
  const right = inset?.right ?? 0
  const bottom = inset?.bottom ?? 0
  const left = inset?.left ?? 0
  return {
    width: Math.max(0, element.clientWidth - left - right),
    height: Math.max(0, element.clientHeight - top - bottom),
  }
}

export function getContainedSize(viewport: Size, naturalSize: Size): Size {
  if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) return { width: 0, height: 0 }
  const ratio = Math.min(viewport.width / naturalSize.width, viewport.height / naturalSize.height)
  return { width: naturalSize.width * ratio, height: naturalSize.height * ratio }
}

export function clampOffset(offset: Point, scale: number, viewport: Size, fitSize: Size): Point {
  if (!viewport.width || !viewport.height || !fitSize.width || !fitSize.height || scale <= FIT_SCALE) {
    return { x: 0, y: 0 }
  }
  const maxX = Math.max(0, (fitSize.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (fitSize.height * scale - viewport.height) / 2)
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) }
}

export function getRelativePoint(
  element: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  inset?: Inset,
): Point {
  if (!element) return { x: 0, y: 0 }
  const rect = element.getBoundingClientRect()
  const shift = getInsetCenterShift(inset)
  // Returned coords are relative to the safe-area center so the same offset
  // math (zoom anchoring, clampOffset) keeps working regardless of insets.
  return {
    x: clientX - rect.left - rect.width / 2 - shift.x,
    y: clientY - rect.top - rect.height / 2 - shift.y,
  }
}
