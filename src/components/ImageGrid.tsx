import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useMediaQuery } from '../hooks/effects'

const GRID_GAP = 8
const TARGET_CELL_WIDTH = 76
const MIN_GRID_COLS_DESKTOP = 6
const MIN_GRID_COLS_MOBILE = 6
const MAX_GRID_COLS = 16
const DEFAULT_GRID_COLS = 8

type GridSpan = {
  cols: number
  rows: number
}

type GridPlacement = GridSpan & {
  colStart: number
  rowStart: number
}

type ImageGridLayout = 'mosaic' | 'justified'

function getGridCols(width: number, minCols: number): number {
  const cols = Math.floor((width + GRID_GAP) / (TARGET_CELL_WIDTH + GRID_GAP))
  return Math.max(minCols, Math.min(MAX_GRID_COLS, cols))
}

function parseAspectRatio(ratio: string): number {
  const [width, height] = ratio.split(':').map(Number)
  const value = width / height
  return Number.isFinite(value) && value > 0 ? value : 1
}

function getGridSpan(aspectRatio: string): GridSpan {
  const ratio = parseAspectRatio(aspectRatio)
  if (ratio >= 0.95 && ratio <= 1.05) return { cols: 3, rows: 3 }

  // Keep common photo ratios in a compact, predictable band so the gallery
  // reads as a tool grid instead of a set of unrelated poster sizes.
  if (ratio >= 0.72 && ratio <= 0.85) return { cols: 3, rows: 4 }
  if (ratio >= 0.62 && ratio < 0.72) return { cols: 3, rows: 4 }
  if (ratio >= 0.54 && ratio < 0.62) return { cols: 3, rows: 5 }
  if (ratio >= 1.15 && ratio <= 1.55) return { cols: 4, rows: 3 }
  if (ratio > 1.55 && ratio <= 1.9) return { cols: 5, rows: 3 }
  if (ratio > 1.9 && ratio < 2.85) return { cols: 5, rows: 2 }

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

function getCellSpan(props: Pick<GridCellProps, 'aspectRatio' | 'cols' | 'rows'>, gridCols: number): GridSpan {
  const baseSpan = props.aspectRatio ? getGridSpan(props.aspectRatio) : { cols: props.cols ?? 1, rows: props.rows ?? 1 }
  return normalizeGridSpan(baseSpan, gridCols)
}

function packGridSpans(spans: GridSpan[], gridCols: number): GridPlacement[] {
  const columnHeights = Array.from({ length: gridCols }, () => 0)

  return spans.map((span) => {
    let bestCol = 0
    let bestRow = Number.POSITIVE_INFINITY

    for (let col = 0; col <= gridCols - span.cols; col++) {
      let row = 0
      for (let offset = 0; offset < span.cols; offset++) row = Math.max(row, columnHeights[col + offset])
      if (row < bestRow) {
        bestRow = row
        bestCol = col
      }
    }

    const nextHeight = bestRow + span.rows
    for (let offset = 0; offset < span.cols; offset++) columnHeights[bestCol + offset] = nextHeight

    return {
      ...span,
      colStart: bestCol + 1,
      rowStart: bestRow + 1,
    }
  })
}

type GridContext = { cols: number; layout: ImageGridLayout; justifiedRowHeight: number }

const GridColsContext = createContext<GridContext>({
  cols: DEFAULT_GRID_COLS,
  layout: 'mosaic',
  justifiedRowHeight: TARGET_CELL_WIDTH,
})

type ImageGridProps = {
  children: ReactNode
  layout?: ImageGridLayout
  // Cap the base row height. Useful when the grid is embedded in a narrow
  // panel and the default square-to-column sizing makes tiles feel oversized.
  maxRowHeight?: number
  justifiedRowHeight?: number
}

export function ImageGrid({ children, layout = 'mosaic', maxRowHeight, justifiedRowHeight }: ImageGridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [gridCols, setGridCols] = useState(DEFAULT_GRID_COLS)
  const [rowHeight, setRowHeight] = useState(TARGET_CELL_WIDTH)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const minCols = isMobile ? MIN_GRID_COLS_MOBILE : MIN_GRID_COLS_DESKTOP
  const targetJustifiedRowHeight = justifiedRowHeight ?? (isMobile ? 154 : 320)
  const contextValue = useMemo(
    () => ({ cols: gridCols, layout, justifiedRowHeight: targetJustifiedRowHeight }),
    [gridCols, layout, targetJustifiedRowHeight],
  )
  const packedChildren = useMemo(() => {
    if (layout === 'justified') return children

    const childArray = Children.toArray(children)
    const spans = childArray.map((child) =>
      isValidElement<GridCellProps>(child) ? getCellSpan(child.props, gridCols) : { cols: 1, rows: 1 },
    )
    const placements = packGridSpans(spans, gridCols)

    return childArray.map((child, index) =>
      isValidElement<GridCellProps>(child) ? cloneElement(child, { placement: placements[index] }) : child,
    )
  }, [children, gridCols, layout])

  useLayoutEffect(() => {
    if (layout === 'justified') return

    const element = ref.current
    if (!element) return

    const update = () => {
      const width = element.clientWidth
      const cols = getGridCols(width, minCols)
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
  }, [layout, maxRowHeight, minCols])

  return (
    <GridColsContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={layout === 'justified' ? 'flex flex-wrap gap-2' : 'grid gap-2'}
        style={
          layout === 'justified'
            ? undefined
            : {
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gridAutoRows: `${rowHeight}px`,
              }
        }
      >
        {packedChildren}
        {layout === 'justified' && <div aria-hidden="true" className="h-0 flex-grow-[999999]" />}
      </div>
    </GridColsContext.Provider>
  )
}

type GridCellProps = {
  children: ReactNode
  aspectRatio?: string
  cols?: number
  rows?: number
  placement?: GridPlacement
}

export function GridCell({ children, aspectRatio, cols, rows, placement }: GridCellProps) {
  const { cols: gridCols, layout, justifiedRowHeight } = useContext(GridColsContext)
  const ratio = aspectRatio ? parseAspectRatio(aspectRatio) : cols && rows ? cols / rows : 1

  if (layout === 'justified') {
    return (
      <div
        style={{
          aspectRatio: String(ratio),
          flexBasis: `${Math.round(ratio * justifiedRowHeight)}px`,
          flexGrow: ratio,
        }}
      >
        {children}
      </div>
    )
  }

  const span = placement ?? getCellSpan({ aspectRatio, cols, rows }, gridCols)

  return (
    <div
      style={{
        gridColumn: placement ? `${placement.colStart} / span ${span.cols}` : `span ${span.cols}`,
        gridRow: placement ? `${placement.rowStart} / span ${span.rows}` : `span ${span.rows}`,
      }}
    >
      {children}
    </div>
  )
}
