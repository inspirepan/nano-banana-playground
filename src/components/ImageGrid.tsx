import { useRef, useState, useEffect } from 'react'

const GRID_COLS = 4
const GRID_GAP = 12

// Map aspect ratio to grid cell spans
export function getGridSpan(ratio: number): { cols: number; rows: number } {
  if (ratio >= 6) return { cols: 3, rows: 1 }    // 8:1
  if (ratio >= 3) return { cols: 2, rows: 1 }    // 4:1
  if (ratio > 1.6) return { cols: 2, rows: 1 }   // 16:9, 21:9
  if (ratio >= 0.55) return { cols: 1, rows: 1 } // 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4
  if (ratio >= 0.2) return { cols: 1, rows: 2 }  // 9:16, 1:4
  return { cols: 1, rows: 3 }                     // 1:8
}

export function parseAspectRatio(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number)
  return w / h
}

// Compute row height so images fill cells without blank space.
// For a cell spanning (cols x rows), the cell pixel size is:
//   width  = cols * colWidth + (cols-1) * gap
//   height = rows * rowHeight + (rows-1) * gap
// We want width/height = ratio, solve for rowHeight:
//   rowHeight = (cellWidth) / (ratio * rows) - (rows-1)*gap/rows  (approx)
// Simplified: rowHeight = cellWidth / (ratio * rows)
// where cellWidth = cols * colWidth + (cols-1) * gap
function computeRowHeight(colWidth: number, ratio: number): number {
  const span = getGridSpan(ratio)
  const cellWidth = span.cols * colWidth + (span.cols - 1) * GRID_GAP
  const cellHeight = cellWidth / ratio
  // Account for row gaps in multi-row spans
  const rowHeight = (cellHeight - (span.rows - 1) * GRID_GAP) / span.rows
  return Math.max(40, Math.round(rowHeight))
}

type Props = {
  ratio: number
  children: React.ReactNode
}

export function ImageGrid({ ratio, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(160)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const width = el.clientWidth
      const colWidth = (width - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS
      setRowHeight(computeRowHeight(colWidth, ratio))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ratio])

  return (
    <div
      ref={ref}
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridAutoRows: rowHeight,
      }}
    >
      {children}
    </div>
  )
}

export function GridCell({ cols, rows, children }: { cols: number; rows: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        gridColumn: `span ${Math.min(cols, GRID_COLS)}`,
        gridRow: `span ${rows}`,
      }}
    >
      {children}
    </div>
  )
}
