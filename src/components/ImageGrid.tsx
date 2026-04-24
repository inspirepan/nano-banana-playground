import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const GRID_GAP = 12
const DEFAULT_GRID_COLS = 4

type GridSpan = {
  cols: number
  rows: number
}

const ASPECT_RATIO_SPANS: Record<string, GridSpan> = {
  '1:1': { cols: 1, rows: 1 },
  '2:3': { cols: 1, rows: 2 },
  '3:4': { cols: 1, rows: 2 },
  '4:5': { cols: 1, rows: 2 },
  '9:16': { cols: 1, rows: 2 },
  '1:4': { cols: 1, rows: 2 },
  '1:8': { cols: 1, rows: 3 },
  '3:2': { cols: 2, rows: 1 },
  '4:3': { cols: 2, rows: 1 },
  '5:4': { cols: 2, rows: 1 },
  '16:9': { cols: 2, rows: 1 },
  '4:1': { cols: 2, rows: 1 },
  '21:9': { cols: 3, rows: 1 },
  '8:1': { cols: 3, rows: 1 },
}

function getGridCols(width: number): number {
  if (width < 560) return 2
  return 4
}

function parseAspectRatio(ratio: string): number {
  const [width, height] = ratio.split(':').map(Number)
  return width / height
}

function getFallbackSpan(ratio: number): GridSpan {
  if (ratio >= 5) return { cols: 3, rows: 1 }
  if (ratio > 1.4) return { cols: 2, rows: 1 }
  if (ratio >= 0.8) return { cols: 1, rows: 1 }
  if (ratio >= 0.3) return { cols: 1, rows: 2 }
  return { cols: 1, rows: 3 }
}

function getGridSpan(aspectRatio: string): GridSpan {
  return ASPECT_RATIO_SPANS[aspectRatio] ?? getFallbackSpan(parseAspectRatio(aspectRatio))
}

function normalizeGridSpan(span: GridSpan, gridCols: number): GridSpan {
  if (gridCols === 2) {
    return {
      cols: Math.min(span.cols, 2),
      rows: Math.min(span.rows, 2),
    }
  }

  return {
    cols: Math.min(span.cols, gridCols),
    rows: span.rows,
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
  const [rowHeight, setRowHeight] = useState(120)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const width = element.clientWidth
      const cols = getGridCols(width)
      const colWidth = (width - (cols - 1) * GRID_GAP) / cols
      const baseRowHeight = Math.max(72, Math.round(colWidth))
      const nextRowHeight = maxRowHeight !== undefined
        ? Math.min(baseRowHeight, maxRowHeight)
        : baseRowHeight

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
        className="grid gap-3"
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
  const baseSpan = aspectRatio
    ? getGridSpan(aspectRatio)
    : { cols: cols ?? 1, rows: rows ?? 1 }
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
