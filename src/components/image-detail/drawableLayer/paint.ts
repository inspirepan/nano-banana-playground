import { stepPinCenter, STEP_TAIL_RATIO } from './hitTest'
import type { DrawItem } from '../../../lib/editStateCache'

export const MASK_OVERLAY_COLOR = 'rgba(239, 68, 68, 0.5)'
export const DEFAULT_ANNOTATE_COLOR = '#ef4444'
export { STEP_TAIL_RATIO }

export function paintItem(ctx: CanvasRenderingContext2D, item: DrawItem, paintColor: string) {
  ctx.save()
  ctx.strokeStyle = paintColor
  ctx.fillStyle = paintColor
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (item.kind === 'path') {
    ctx.lineWidth = item.size
    const pts = item.points
    if (pts.length === 0) {
      ctx.restore()
      return
    }
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, item.size / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }
  } else if (item.kind === 'rect') {
    const x = Math.min(item.start.x, item.end.x)
    const y = Math.min(item.start.y, item.end.y)
    const w = Math.abs(item.end.x - item.start.x)
    const h = Math.abs(item.end.y - item.start.y)
    ctx.lineWidth = item.size
    ctx.strokeRect(x, y, w, h)
  } else {
    const r = item.size
    const center = stepPinCenter(item)
    const h = item.size * STEP_TAIL_RATIO
    const theta = Math.asin(r / h)
    const leftPhi = Math.PI - theta
    const rightPhi = theta
    ctx.fillStyle = paintColor
    ctx.beginPath()
    ctx.moveTo(center.x + r * Math.cos(leftPhi), center.y + r * Math.sin(leftPhi))
    ctx.arc(center.x, center.y, r, leftPhi, rightPhi, false)
    ctx.lineTo(item.anchor.x, item.anchor.y)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${r * 1.1}px system-ui, -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.n), center.x, center.y + r * 0.04)
  }

  ctx.restore()
}
