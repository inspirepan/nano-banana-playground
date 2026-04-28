import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const GRID_GAP = 8
const TARGET_CELL_WIDTH = 76
const MIN_GRID_COLS = 6
const MAX_GRID_COLS = 16
const DEFAULT_GRID_COLS = 8

type GridSpan = {
  cols: number
  rows: number
}

function getGridCols(width: number): number {
  const cols = Math.floor((width + GRID_GAP) / (TARGET_CELL_WIDTH + GRID_GAP))
  return Math.max(MIN_GRID_COLS, Math.min(MAX_GRID_COLS, cols))
}

function parseAspectRatio(ratio: string): number {
  const [width, height] = ratio.split(':').map(Number)
  const value = width / height
  return Number.isFinite(value) && value > 0 ? value : 1
}

function getGridSpan(aspectRatio: string): GridSpan {
  const ratio = parseAspectRatio(aspectRatio)
  if (ratio >= 0.95 && ratio <= 1.05) return { cols: 3, rows: 3 }
  if (ratio <= 0.35) return { cols: 2, rows: 4 }
  if (ratio >= 2.85) return { cols: 4, rows: 2 }

  let bestSpan: GridSpan = { cols: 2, rows: 2 }
  let bestScore = Number.POSITIVE_INFINITY

  for (let cols = 2; cols <= 5; cols++) {
    for (let rows = 2; rows <= 5; rows++) {
      const aspectScore = Math.abs(Math.log(cols / rows / ratio))
      const areaScore = (cols * rows - 4) * 0.006
      const score = aspectScore + areaScore
      if (score < bestScore) {
        bestScore = score
        bestSpan = { cols, rows }
      }
    }
  }

  return bestSpan
}

function normalizeGridSpan(span: GridSpan, gridCols: number): GridSpan {
  if (span.cols <= gridCols) return span

  const scale = gridCols / span.cols
  return {
    cols: gridCols,
    rows: Math.max(2, Math.round(span.rows * scale)),
  }
}

const GridColsContext = createContext(DEFAULT_GRID_COLS)

type ImageGridProps = {
  children: ReactNode
  // Cap the base row height. Useful when the grid is embedded in a narrow
  // panel and the default square-to-column sizing makes tiles feel oversized.
  maxRowHeight?: number
}

export function ImageGrid({ children, maxRowHeight }: ImageGridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [gridCols, setGridCols] = useState(DEFAULT_GRID_COLS)
  const [rowHeight, setRowHeight] = useState(TARGET_CELL_WIDTH)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const width = element.clientWidth
      const cols = getGridCols(width)
      const colWidth = (width - (cols - 1) * GRID_GAP) / cols
      const baseRowHeight = Math.max(48, Math.round(colWidth))
      const nextRowHeight = maxRowHeight !== undefined ? Math.min(baseRowHeight, maxRowHeight) : baseRowHeight

      setGridCols((prev) => (prev === cols ? prev : cols))
      setRowHeight((prev) => (prev === nextRowHeight ? prev : nextRowHeight))
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [maxRowHeight])

  return (
    <GridColsContext.Provider value={gridCols}>
      <div
        ref={ref}
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
          gridAutoFlow: 'dense',
        }}
      >
        {children}
      </div>
    </GridColsContext.Provider>
  )
}

type GridCellProps = {
  children: ReactNode
  aspectRatio?: string
  cols?: number
  rows?: number
}

export function GridCell({ children, aspectRatio, cols, rows }: GridCellProps) {
  const gridCols = useContext(GridColsContext)
  const baseSpan = aspectRatio ? getGridSpan(aspectRatio) : { cols: cols ?? 1, rows: rows ?? 1 }
  const span = normalizeGridSpan(baseSpan, gridCols)

  return (
    <div
      style={{
        gridColumn: `span ${span.cols}`,
        gridRow: `span ${span.rows}`,
      }}
    >
      {children}
    </div>
  )
}
