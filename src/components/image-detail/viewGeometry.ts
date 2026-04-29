export type Point = { x: number; y: number }
export type Size = { width: number; height: number }

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

export function getViewportSize(element: HTMLDivElement | null): Size {
  if (!element) return { width: 0, height: 0 }
  return { width: element.clientWidth, height: element.clientHeight }
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

export function getRelativePoint(element: HTMLDivElement | null, clientX: number, clientY: number): Point {
  if (!element) return { x: 0, y: 0 }
  const rect = element.getBoundingClientRect()
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
}
