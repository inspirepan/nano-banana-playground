import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { GeneratedSource, GroundingMetadata, PlaygroundImageMeta } from '../lib/types'
import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import { getActualCost } from '../lib/pricing'
import { ensureBlobLoaded, useImageSrc } from '../hooks/useImageSrc'
import { loadImageMetas } from '../lib/history'
import { Icon } from './Icon'

// Normalize generated-source metadata into a single `options` bag, folding in
// legacy top-level fields (`quality`, `searchTools`) from pre-refactor records.
function effectiveOptions(source: GeneratedSource): Record<string, unknown> {
  const bag: Record<string, unknown> = { ...(source.options ?? {}) }
  if (source.quality !== undefined && bag.quality === undefined) {
    bag.quality = source.quality
  }
  if (source.searchTools && bag.webSearch === undefined && bag.imageSearch === undefined) {
    if (source.searchTools.web) bag.webSearch = true
    if (source.searchTools.image) bag.imageSearch = true
  }
  return bag
}

// Format an option value for display in the metadata table.
function formatOptionValue(model: ModelConfig | null | undefined, optionId: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '' || value === false) return null
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt?.type === 'select' && typeof value === 'string') {
    return opt.choices.find((c) => c.value === value)?.label ?? value
  }
  if (opt?.type === 'toggle') {
    return value === true ? '已启用' : null
  }
  // Legacy / unknown options — render raw.
  if (typeof value === 'boolean') return value ? '是' : null
  return String(value)
}

// Pick a human label for an option; falls back to the raw id for legacy keys.
function optionLabel(model: ModelConfig | null | undefined, optionId: string): string {
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt) return opt.label
  // Legacy fallbacks for options no longer declared by the active model.
  if (optionId === 'quality') return '质量'
  if (optionId === 'webSearch') return 'Web 搜索'
  if (optionId === 'imageSearch') return '图片搜索'
  if (optionId === 'background') return '背景'
  if (optionId === 'thinkingLevel') return '思考等级'
  return optionId
}

const MIN_SCALE = 0.5
const MAX_SCALE = 6
const FIT_SCALE = 1

type Props = {
  image: PlaygroundImageMeta
  history: PlaygroundImageMeta[]
  onClose: () => void
  onAddToRef: (image: PlaygroundImageMeta) => void
  onRegenerate: (image: PlaygroundImageMeta) => void
  onRemove: (id: string) => void
}

type Point = { x: number; y: number }
type Size = { width: number; height: number }

// Labels for syntax highlighting (same list as InputPanel)
const HIGHLIGHT_LABELS = [
  '参考图说明', '画面中的文字', '画中文字', '编辑类型', '编辑请求',
  '目标场景', '目标风格', '保持不变', '构图', '风格', '光影', '色彩', '约束', '避免',
]

const MOBILE_SHEET_INITIAL_VH = 34
const MOBILE_SHEET_EXPANDED_VH = 45
const MOBILE_SHEET_PEEK_PX = 56

function getMobileSheetHeights(viewportHeight: number) {
  const expandedHeight = Math.max(
    MOBILE_SHEET_PEEK_PX,
    Math.round(viewportHeight * MOBILE_SHEET_EXPANDED_VH / 100),
  )
  const initialHeight = Math.max(
    MOBILE_SHEET_PEEK_PX,
    Math.min(expandedHeight, Math.round(viewportHeight * MOBILE_SHEET_INITIAL_VH / 100)),
  )
  return { initialHeight, expandedHeight }
}

function renderPromptLines(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => {
    for (const lbl of HIGHLIGHT_LABELS) {
      const needle = `${lbl}：`
      if (line.startsWith(needle)) {
        return (
          <div key={i}>
            <span
              className="rounded-[3px] px-[3px] font-medium"
              style={{ background: 'var(--color-accent-wash)', color: 'var(--color-accent)' }}
            >
              {lbl}
            </span>：{line.slice(needle.length)}
          </div>
        )
      }
    }
    return <div key={i}>{line || ' '}</div>
  })
}

function MetaRow({ label, value, mono, last }: { label: string; value: ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <div
      className="flex items-baseline gap-3 py-1.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}
    >
      <div className="text-[11px] text-(--color-text-3) w-[76px] shrink-0 font-medium">{label}</div>
      <div className={`${mono ? 'mono' : ''} text-[12px] text-(--color-text) flex-1 break-words text-right`}>
        {value}
      </div>
    </div>
  )
}

export function ImageDetailModal({ image, history, onClose, onAddToRef, onRegenerate, onRemove }: Props) {
  const [currentIdx, setCurrentIdx] = useState(() => history.findIndex(h => h.id === image.id))

  const currentImage = currentIdx >= 0 ? history[currentIdx] : image
  const { ref: imgRef, src: currentSrc } = useImageSrc(currentImage.id, currentImage.mimeType)
  const currentMeta = currentImage.source.type === 'generated' ? currentImage.source : null
  const canNavigate = currentIdx >= 0

  const [toast, setToast] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [refDetailId, setRefDetailId] = useState<string | null>(null)
  const [refSrcMap, setRefSrcMap] = useState<Map<string, string>>(new Map())
  const refDetailSrc = refDetailId ? refSrcMap.get(refDetailId) ?? null : null

  // Resolve missing refs from IndexedDB
  const [dbRefMetas, setDbRefMetas] = useState<Map<string, PlaygroundImageMeta>>(new Map())
  const missingRefIds = useMemo(() => {
    if (!currentMeta) return []
    return currentMeta.referenceImageIds.filter((id) => !history.find((h) => h.id === id))
  }, [currentMeta, history])

  useEffect(() => {
    if (missingRefIds.length === 0) return
    loadImageMetas(missingRefIds).then(setDbRefMetas)
  }, [missingRefIds])

  const findRefImage = useCallback((id: string): PlaygroundImageMeta | undefined => {
    return history.find((h) => h.id === id) ?? dbRefMetas.get(id)
  }, [history, dbRefMetas])

  useEffect(() => {
    if (!refDetailId) return
    if (refSrcMap.has(refDetailId)) return
    const refImg = findRefImage(refDetailId)
    if (!refImg) return
    ensureBlobLoaded(refImg.id, refImg.mimeType).then((src) => {
      if (!src) return
      setRefSrcMap((prev) => {
        if (prev.has(refDetailId)) return prev
        const next = new Map(prev)
        next.set(refDetailId, src)
        return next
      })
    })
  }, [refDetailId, refSrcMap, findRefImage])

  const goToPrev = useCallback(() => {
    setCurrentIdx(i => Math.max(0, i - 1))
    setRefDetailId(null)
  }, [])

  const goToNext = useCallback(() => {
    setCurrentIdx(i => Math.min(history.length - 1, i + 1))
    setRefDetailId(null)
  }, [history.length])

  useEffect(() => {
    ensureBlobLoaded(currentImage.id, currentImage.mimeType)
  }, [currentImage.id, currentImage.mimeType])

  // Prefetch neighbor blobs and prime the browser image decode cache so left/
  // right pager switches swap frames without a blank flash.
  useEffect(() => {
    if (!canNavigate) return
    const neighbors: PlaygroundImageMeta[] = []
    if (currentIdx > 0) neighbors.push(history[currentIdx - 1])
    if (currentIdx < history.length - 1) neighbors.push(history[currentIdx + 1])
    let cancelled = false
    for (const n of neighbors) {
      ensureBlobLoaded(n.id, n.mimeType).then((dataUrl) => {
        if (cancelled || !dataUrl) return
        const pre = new Image()
        pre.decoding = 'async'
        pre.src = dataUrl
      })
    }
    return () => { cancelled = true }
  }, [canNavigate, currentIdx, history])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (!canNavigate) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [canNavigate, goToNext, goToPrev, onClose])

  // —— Mobile bottom-sheet: start lower to prioritize the image, but keep a
  // larger expanded stop for metadata-heavy batches.
  const [isMobileSheet, setIsMobileSheet] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  // null = use the initial lower resting height; a number overrides with an
  // explicit snapped pixel height after the first drag.
  const [sheetHeightPx, setSheetHeightPx] = useState<number | null>(null)
  const [sheetDragging, setSheetDragging] = useState(false)
  const sheetDragRef = useRef<{
    startY: number
    startHeight: number
    initialHeight: number
    expandedHeight: number
    pointerId: number
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobileSheet(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!isMobileSheet) setSheetHeightPx(null)
  }, [isMobileSheet])

  // Desktop-only: collapse the right metadata sidebar to give the canvas more room.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nano-banana-detail-sidebar-collapsed') === '1'
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('nano-banana-detail-sidebar-collapsed', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  const handleSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileSheet) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const { initialHeight, expandedHeight } = getMobileSheetHeights(window.innerHeight)
    sheetDragRef.current = {
      startY: e.clientY,
      startHeight: sheetHeightPx ?? initialHeight,
      initialHeight,
      expandedHeight,
      pointerId: e.pointerId,
    }
    setSheetDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const delta = e.clientY - drag.startY // +down, -up
    const next = Math.max(MOBILE_SHEET_PEEK_PX, Math.min(drag.expandedHeight, drag.startHeight - delta))
    setSheetHeightPx(next)
  }

  const handleSheetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    sheetDragRef.current = null
    setSheetDragging(false)
    const delta = e.clientY - drag.startY
    const current = Math.max(MOBILE_SHEET_PEEK_PX, Math.min(drag.expandedHeight, drag.startHeight - delta))
    const snapPoints = [MOBILE_SHEET_PEEK_PX, drag.initialHeight, drag.expandedHeight]
    const nextHeight = snapPoints.reduce((closest, candidate) => {
      return Math.abs(candidate - current) < Math.abs(closest - current) ? candidate : closest
    })
    setSheetHeightPx(nextHeight)
  }

  const modelConfig = currentMeta ? MODEL_CONFIGS.find((m) => m.id === currentMeta.modelId) : null
  const modelName = modelConfig?.name ?? currentMeta?.modelId ?? null
  const modelApiId = modelConfig?.apiModel ?? null

  const actualCost = (() => {
    if (!currentMeta || !modelConfig) return null
    return getActualCost(modelConfig, currentMeta.tokenUsage)
  })()

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1500) }

  const handleDownload = () => {
    if (!currentSrc) return
    const anchor = document.createElement('a')
    anchor.href = currentSrc
    anchor.download = `nano-banana-${currentImage.id.slice(0, 8)}.png`
    anchor.click()
    flash('开始下载 PNG')
  }

  const handleCopyPrompt = () => {
    if (!currentMeta?.prompt) return
    navigator.clipboard?.writeText(currentMeta.prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 1400)
  }

  const handleAddRef = () => {
    onAddToRef(currentImage)
    flash('已加为参考图')
  }

  const handleRegenerateAction = () => {
    onRegenerate(currentImage)
    onClose()
  }

  const hasPrev = canNavigate && currentIdx > 0
  const hasNext = canNavigate && currentIdx < history.length - 1

  // Size helper — show approximate px
  const pxDim = currentMeta
    ? `${currentMeta.resolution} · ${currentMeta.aspectRatio}`
    : ''

  const batchInfo = currentMeta && (() => {
    const sameBatch = history.filter((h) => h.source.type === 'generated' && h.source.batchId === currentMeta.batchId)
    const posInBatch = sameBatch.findIndex((h) => h.id === currentImage.id)
    return { pos: posInBatch + 1, total: sameBatch.length }
  })()

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col fade-in"
      style={{
        background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {/* Sentinel for preview loader */}
      <div ref={imgRef} className="fixed top-0 left-0 w-0 h-0 pointer-events-none" aria-hidden />

      {/* ——— Header ——— */}
      <div
        className="flex items-center gap-2 px-3.5 shrink-0 flex-nowrap"
        style={{
          height: 48,
          borderBottom: '1px solid var(--color-border)',
          background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
        }}
      >
        <button className="icon-btn shrink-0" onClick={onClose} title="关闭 (Esc)">
          <Icon name="close" size={13} strokeWidth={1.8} />
        </button>
        <div className="w-px h-[18px] bg-(--color-border) shrink-0" />

        {currentMeta ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12.5px] font-medium text-(--color-text) truncate">{modelName}</span>
            <span className="mono text-[12.5px] text-(--color-text-4) hidden md:inline whitespace-nowrap">{pxDim}</span>
          </div>
        ) : (
          <span className="text-[12.5px] font-medium text-(--color-text) truncate">上传图片</span>
        )}

        <div className="flex-1" />

        {/* Pager */}
        {canNavigate && (
          <div
            className="flex items-center gap-0.5 mr-1 rounded-[6px] shrink-0"
            style={{ background: 'var(--color-surface-2)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)', padding: 2 }}
          >
            <button
              className="icon-btn"
              onClick={goToPrev}
              disabled={!hasPrev}
              style={{ width: 22, height: 22 }}
              title="上一张 (←)"
            >
              <Icon name="chevron_left" size={12} strokeWidth={1.8} />
            </button>
            <span className="mono text-[11px] text-(--color-text-2) px-1 min-w-[50px] text-center font-medium">
              {currentIdx + 1}<span className="text-(--color-text-4)"> / {history.length}</span>
            </span>
            <button
              className="icon-btn"
              onClick={goToNext}
              disabled={!hasNext}
              style={{ width: 22, height: 22 }}
              title="下一张 (→)"
            >
              <Icon name="chevron_right" size={12} strokeWidth={1.8} />
            </button>
          </div>
        )}

        <button className="chip shrink-0" onClick={handleAddRef} title="加为参考">
          <Icon name="plus" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">参考</span>
        </button>
        {currentMeta?.prompt && (
          <button className="chip shrink-0" onClick={handleRegenerateAction} title="还原参数">
            <Icon name="refresh" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">还原参数</span>
          </button>
        )}
        <button className="chip shrink-0" onClick={handleDownload} title="下载 PNG">
          <Icon name="download" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">PNG</span>
        </button>
        <button
          className="chip shrink-0 hidden md:inline-flex"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? '展开详情面板' : '收起详情面板'}
          aria-pressed={!sidebarCollapsed}
        >
          <Icon name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'} size={12} strokeWidth={1.8} />
          {sidebarCollapsed ? '展开详情' : '收起详情'}
        </button>
      </div>

      {/* ——— Body ——— */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Canvas with grid background */}
        <div
          className="flex-1 min-w-0 relative"
          style={{
            backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
            backgroundSize: '28px 28px, 28px 28px',
            backgroundColor: 'var(--color-bg-sunken)',
          }}
        >
          {refDetailId && refDetailSrc ? (
            <div className="flex flex-row h-full gap-px">
              <div className="h-full flex-1 min-w-0 relative">
                <ZoomableImageView src={refDetailSrc} alt="" label="参考图" />
                <button
                  type="button"
                  onClick={() => setRefDetailId(null)}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-10 chip"
                  style={{ height: 26 }}
                >
                  <Icon name="close" size={12} />
                  关闭对比
                </button>
              </div>
              <div className="h-full flex-1 min-w-0 relative">
                <ZoomableImageView src={currentSrc ?? ''} alt={currentMeta?.prompt ?? ''} label="生成图" />
              </div>
            </div>
          ) : (
            <ZoomableImageView
              src={currentSrc ?? ''}
              alt={currentMeta?.prompt ?? ''}
              onSwipeLeft={hasNext ? goToNext : undefined}
              onSwipeRight={hasPrev ? goToPrev : undefined}
            />
          )}

          {/* Side nav arrows */}
          {!refDetailId && hasPrev && (
            <button
              onClick={goToPrev}
              aria-label="上一张"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
                color: 'var(--color-text-2)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <Icon name="chevron_left" size={14} strokeWidth={1.8} />
            </button>
          )}
          {!refDetailId && hasNext && (
            <button
              onClick={goToNext}
              aria-label="下一张"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
                color: 'var(--color-text-2)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <Icon name="chevron_right" size={14} strokeWidth={1.8} />
            </button>
          )}

          {toast && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 fade-in"
              style={{
                background: 'var(--color-text)',
                color: 'var(--color-bg)',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                boxShadow: '0 10px 28px -12px rgba(30,27,20,0.18), 0 2px 6px rgba(30,27,20,0.06)',
              }}
            >
              {toast}
            </div>
          )}
        </div>

        {/* Right metadata panel (mobile: draggable bottom sheet) */}
        <div
          className="w-full shrink-0 overflow-y-auto overflow-x-hidden border-t md:border-t-0 md:border-l border-(--color-border) md:h-auto"
          style={{
            background: 'var(--color-bg)',
            ...(isMobileSheet
              ? {
                  height: sheetHeightPx !== null ? `${sheetHeightPx}px` : `${MOBILE_SHEET_INITIAL_VH}vh`,
                  transition: sheetDragging ? 'none' : 'height 260ms cubic-bezier(0.22, 0.8, 0.4, 1)',
                }
              : {
                  width: sidebarCollapsed ? 0 : 340,
                  minWidth: 0,
                  transition: 'width 280ms cubic-bezier(0.22, 0.8, 0.4, 1)',
                }),
          }}
        >
          {/* Mobile drag handle */}
          <div
            className="md:hidden sticky top-0 z-10 flex justify-center items-center h-7 cursor-grab active:cursor-grabbing select-none"
            style={{ background: 'var(--color-bg)', touchAction: 'none' }}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
          >
            <div className="w-9 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
          </div>

          <div className="px-[18px] pt-1 md:pt-4 pb-10 md:w-[340px]">
          {/* Prompt */}
          {currentMeta?.prompt && (
            <div className="mb-[18px]">
              <div className="flex items-center mb-1.5">
                <span className="label">提示词</span>
                <div className="flex-1" />
                <button
                  className="chip shrink-0"
                  style={{ height: 26, fontSize: 12 }}
                  onClick={handleCopyPrompt}
                >
                  {/* Safari (WebKit) ignores flex layout on <button> itself;
                      nesting the flex container in a <span> works around it. */}
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name={copiedPrompt ? 'check' : 'copy'} size={12} strokeWidth={copiedPrompt ? 2.2 : 1.8} />
                    {copiedPrompt ? '已复制' : '复制'}
                  </span>
                </button>
              </div>
              <div
                className="p-3 rounded-[8px] text-[12.5px] leading-[1.6] text-(--color-text-2)"
                style={{
                  background: 'var(--color-surface)',
                  boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {renderPromptLines(currentMeta.prompt)}
              </div>
            </div>
          )}

          {/* Reference images */}
          {currentMeta && currentMeta.referenceImageIds.length > 0 && (
            <div className="mb-[18px]">
              <div className="flex items-center mb-1.5">
                <span className="label">参考图</span>
                <span className="text-[11px] text-(--color-text-4) ml-1.5">
                  {currentMeta.referenceImageIds.length} 张
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {currentMeta.referenceImageIds.map((refId) => {
                  const refImg = findRefImage(refId)
                  if (!refImg) return (
                    <div key={refId} className="aspect-square rounded-[6px] flex items-center justify-center text-(--color-text-4)" style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)', background: 'var(--color-surface-2)' }}>
                      ?
                    </div>
                  )
                  return (
                    <RefThumbnail
                      key={refId}
                      image={refImg}
                      isActive={refDetailId === refImg.id}
                      onClick={() => setRefDetailId((prev) => prev === refImg.id ? null : refImg.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="mb-[18px]">
            <div className="label mb-1">元数据</div>
            {currentMeta && (
              <>
                <MetaRow label="模型" value={modelName!} />
                {modelApiId && <MetaRow label="模型 ID" value={modelApiId} mono />}
                <MetaRow label="分辨率" value={currentMeta.resolution} mono />
                <MetaRow label="宽高比" value={currentMeta.aspectRatio} mono />
                {(() => {
                  const bag = effectiveOptions(currentMeta)
                  // Render rows in the order the active model declares options, then any
                  // legacy keys that don't appear in the current descriptors.
                  const declaredIds = modelConfig?.options?.map((o) => o.id) ?? []
                  const leftover = Object.keys(bag).filter((id) => !declaredIds.includes(id))
                  const ordered = [...declaredIds, ...leftover]
                  return ordered.map((id) => {
                    const formatted = formatOptionValue(modelConfig, id, bag[id])
                    if (formatted === null) return null
                    return <MetaRow key={id} label={optionLabel(modelConfig, id)} value={formatted} />
                  })
                })()}
                {actualCost !== null && (
                  <MetaRow
                    label="费用"
                    value={
                      <span>
                        ${actualCost.toFixed(4)}
                      </span>
                    }
                    mono
                  />
                )}
                {currentMeta.tokenUsage && modelConfig?.provider === 'openai' && (
                  <>
                    <MetaRow label="文本输入 Token" value={currentMeta.tokenUsage.inputTextTokens?.toLocaleString() ?? currentMeta.tokenUsage.inputTokens.toLocaleString()} mono />
                    {(currentMeta.tokenUsage.inputImageTokens ?? 0) > 0 && (
                      <MetaRow label="图片输入 Token" value={(currentMeta.tokenUsage.inputImageTokens ?? 0).toLocaleString()} mono />
                    )}
                    <MetaRow label="图片输出 Token" value={currentMeta.tokenUsage.imageOutputTokens.toLocaleString()} mono />
                    {currentMeta.tokenUsage.textOutputTokens > 0 && (
                      <MetaRow label="文本输出 Token" value={currentMeta.tokenUsage.textOutputTokens.toLocaleString()} mono />
                    )}
                  </>
                )}
                {currentMeta.tokenUsage && modelConfig?.provider === 'google' && (
                  <>
                    <MetaRow label="输入 Token" value={currentMeta.tokenUsage.inputTokens.toLocaleString()} mono />
                    <MetaRow label="图片 Token" value={currentMeta.tokenUsage.imageOutputTokens.toLocaleString()} mono />
                    {currentMeta.tokenUsage.textOutputTokens > 0 && (
                      <MetaRow label="思考 Token" value={currentMeta.tokenUsage.textOutputTokens.toLocaleString()} mono />
                    )}
                  </>
                )}
              </>
            )}
            {currentImage.source.type === 'upload' && (
              <MetaRow label="来源" value={`上传: ${currentImage.source.fileName}`} />
            )}
            <MetaRow
              label="创建时间"
              value={new Date(currentImage.timestamp).toLocaleString('zh-CN', { hour12: false })}
              mono
            />
            {currentMeta && batchInfo && (
              <MetaRow
                label="批次"
                value={
                  <span>
                    <span className="mono">b_{currentMeta.batchId.slice(0, 6)}</span>
                    <span className="mono text-(--color-text-4) ml-1.5">
                      #{batchInfo.pos}/{batchInfo.total}
                    </span>
                  </span>
                }
                last
              />
            )}
          </div>

          {/* Grounding sources (Google Search / Image Search) */}
          {currentMeta?.groundingMetadata && (
            <GroundingSection metadata={currentMeta.groundingMetadata} />
          )}

          {/* Danger delete */}
          {canNavigate && (
            <button
              className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium transition-colors"
              style={{
                height: 30,
                borderRadius: 6,
                boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
                background: 'var(--color-surface)',
                color: 'var(--color-danger)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))'
                e.currentTarget.style.boxShadow = 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 30%, transparent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-surface)'
                e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge)'
              }}
              onClick={() => { onRemove(currentImage.id); onClose() }}
            >
              <Icon name="trash" size={12} strokeWidth={1.8} /> 从历史中删除
            </button>
          )}
          </div>
        </div>
      </div>

      {/* ——— Footer shortcuts ——— */}
      <div
        className="hidden md:flex items-center gap-3.5 px-3.5 shrink-0 text-[11px] text-(--color-text-4)"
        style={{
          height: 30,
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-sunken)',
        }}
      >
        <span className="inline-flex items-center gap-1.5"><kbd>←</kbd><kbd>→</kbd> 切换</span>
        <span className="inline-flex items-center gap-1.5">滚轮 缩放</span>
        <span className="inline-flex items-center gap-1.5"><kbd>0</kbd> / 双击 重置</span>
        <span className="inline-flex items-center gap-1.5"><kbd>Esc</kbd> 关闭</span>
        <div className="flex-1" />
        <span className="mono">#{currentImage.id.slice(0, 8)}</span>
      </div>
    </div>,
    document.body,
  )
}

// Render Google Search grounding attribution. Required when image_search is
// enabled per the API usage terms (direct, single-click link back to each
// source landing page, plus the provided `searchEntryPoint` HTML chip).
function GroundingSection({ metadata }: { metadata: GroundingMetadata }) {
  const chunks = metadata.groundingChunks ?? []
  const sources: Array<{ uri: string; title: string; isImage: boolean }> = []
  for (const chunk of chunks) {
    const web = chunk.web
    const image = chunk.image
    const uri = web?.uri ?? image?.uri
    if (!uri) continue
    sources.push({
      uri,
      title: web?.title ?? image?.title ?? uri,
      isImage: !web && !!image,
    })
  }
  const queries = [
    ...(metadata.webSearchQueries ?? []),
    ...(metadata.imageSearchQueries ?? []),
  ]
  if (!metadata.searchEntryPoint?.renderedContent && sources.length === 0 && queries.length === 0) {
    return null
  }
  return (
    <div className="mb-[18px]">
      <div className="label mb-1">搜索来源</div>
      {metadata.searchEntryPoint?.renderedContent && (
        <div
          className="mb-2"
          // Google returns styled HTML for the search suggestion chip; must be
          // rendered as-is per their display requirements.
          dangerouslySetInnerHTML={{ __html: metadata.searchEntryPoint.renderedContent }}
        />
      )}
      {sources.length > 0 && (
        <ul className="list-none p-0 m-0 space-y-1">
          {sources.map((s, i) => (
            <li key={i} className="text-[12px] flex items-center gap-1.5 min-w-0">
              <Icon name={s.isImage ? 'image' : 'search'} size={11} />
              <a
                href={s.uri}
                target="_blank"
                rel="noreferrer"
                className="truncate text-(--color-accent) hover:underline"
                title={s.uri}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {queries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {queries.map((q, i) => (
            <span key={i} className="tag" style={{ fontSize: 10.5 }}>{q}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function RefThumbnail({ image, isActive, onClick }: { image: PlaygroundImageMeta; isActive: boolean; onClick: () => void }) {
  const { ref, src } = useImageSrc(image.id, image.mimeType, undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      onClick={onClick}
      className="aspect-square rounded-[6px] overflow-hidden cursor-pointer transition-colors"
      style={{
        boxShadow: isActive ? 'inset 0 0 0 1px var(--color-accent)' : 'inset 0 0 0 1px var(--ring-edge)',
        background: 'var(--color-surface-2)',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge-strong)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge)' }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full skeleton-animated" />
      )}
    </div>
  )
}

/* ========================================================================
   ZoomableImageView — wheel/drag/pinch zoom, with Linear-style Zoom HUD
   ======================================================================== */

function ZoomableImageView({ src, alt, label, onSwipeLeft, onSwipeRight }: {
  src: string
  alt: string
  label?: string
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pictureRef = useRef<HTMLImageElement>(null)
  const activePointersRef = useRef(new Map<number, Point>())
  const pointerStartsRef = useRef(new Map<number, Point>())
  const dragStartRef = useRef<{ point: Point; offset: Point } | null>(null)
  const pinchStartRef = useRef<{ center: Point; distance: number; scale: number; offset: Point } | null>(null)
  const naturalSizeRef = useRef<Size>({ width: 0, height: 0 })
  const fitSizeRef = useRef<Size>({ width: 0, height: 0 })
  const scaleRef = useRef(FIT_SCALE)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const lastTapRef = useRef<{ at: number; point: Point } | null>(null)
  const didPinchRef = useRef(false)

  const [scale, setScale] = useState(FIT_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [fitSize, setFitSize] = useState<Size>({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)

  const applyView = useCallback((nextScale: number, nextOffset: Point) => {
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    const viewport = getViewportSize(containerRef.current)
    const clampedOffset = clampOffset(nextOffset, clampedScale, viewport, fitSizeRef.current)

    scaleRef.current = clampedScale
    offsetRef.current = clampedOffset
    // Paint transform straight to the DOM so pinch/pan follows the finger
    // without waiting for React's render + reconcile cycle. State updates
    // below keep downstream UI (cursor, etc.) consistent on the next render.
    const picture = pictureRef.current
    if (picture) {
      picture.style.transform = `translate3d(${clampedOffset.x}px, ${clampedOffset.y}px, 0) scale(${clampedScale})`
    }
    setScale(clampedScale)
    setOffset(clampedOffset)
  }, [])

  const syncFitSize = useCallback(() => {
    const viewport = getViewportSize(containerRef.current)
    const nextFitSize = getContainedSize(viewport, naturalSizeRef.current)
    fitSizeRef.current = nextFitSize
    setFitSize(nextFitSize)
    applyView(scaleRef.current, offsetRef.current)
  }, [applyView])

  const resetView = useCallback(() => {
    activePointersRef.current.clear()
    pointerStartsRef.current.clear()
    dragStartRef.current = null
    pinchStartRef.current = null
    didPinchRef.current = false
    setIsDragging(false)
    setIsInteracting(false)
    applyView(FIT_SCALE, { x: 0, y: 0 })
  }, [applyView])

  const zoomAtPoint = useCallback((targetScale: number, anchor: Point) => {
    const currentScale = scaleRef.current
    const nextScale = clamp(targetScale, MIN_SCALE, MAX_SCALE)
    const ratio = nextScale / currentScale
    const currentOffset = offsetRef.current
    applyView(nextScale, {
      x: anchor.x - ratio * (anchor.x - currentOffset.x),
      y: anchor.y - ratio * (anchor.y - currentOffset.y),
    })
  }, [applyView])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(syncFitSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [syncFitSize])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
      // Chrome reports trackpad pinch gestures as wheel events with ctrlKey
      // set. Their deltaY is small, so a larger coefficient is needed to
      // match the feel of a mouse scroll-wheel zoom.
      const factor = event.ctrlKey ? 0.02 : 0.0015
      const delta = Math.exp(-event.deltaY * factor)
      zoomAtPoint(scaleRef.current * delta, point)
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [zoomAtPoint])

  // When src swaps (pager switch), clear any leftover zoom/pan so the new
  // image starts from fit. onLoad will re-sync fitSize once it decodes.
  useEffect(() => {
    resetView()
  }, [src, resetView])

  // Keyboard 0 = reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '0') { e.preventDefault(); resetView() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [resetView])

  return (
    <div className="relative h-full min-h-0 md:min-h-[640px] w-full overflow-hidden">
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden touch-none select-none"
        onDoubleClick={(event) => {
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          if (scaleRef.current > FIT_SCALE) { resetView(); return }
          zoomAtPoint(2.5, point)
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          event.currentTarget.setPointerCapture(event.pointerId)
          activePointersRef.current.set(event.pointerId, point)
          pointerStartsRef.current.set(event.pointerId, point)
          // Kill the idle 160ms transform transition immediately — otherwise the
          // first pinch/drag frame animates into place and feels laggy.
          if (pictureRef.current) pictureRef.current.style.transition = 'none'
          setIsInteracting(true)
          if (activePointersRef.current.size === 1) {
            dragStartRef.current = { point, offset: offsetRef.current }
            pinchStartRef.current = null
            setIsDragging(scaleRef.current > FIT_SCALE)
          }
          if (activePointersRef.current.size === 2) {
            const [first, second] = Array.from(activePointersRef.current.values())
            pinchStartRef.current = {
              center: getCenter(first, second),
              distance: Math.max(getDistance(first, second), 1),
              scale: scaleRef.current,
              offset: offsetRef.current,
            }
            dragStartRef.current = null
            didPinchRef.current = true
            setIsDragging(false)
          }
        }}
        onPointerMove={(event) => {
          if (!activePointersRef.current.has(event.pointerId)) return
          const point = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          activePointersRef.current.set(event.pointerId, point)

          if (activePointersRef.current.size === 2 && pinchStartRef.current) {
            const [first, second] = Array.from(activePointersRef.current.values())
            const start = pinchStartRef.current
            const distance = Math.max(getDistance(first, second), 1)
            const center = getCenter(first, second)
            const nextScale = clamp(start.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE)
            const ratio = nextScale / start.scale
            applyView(nextScale, {
              x: center.x - ratio * (start.center.x - start.offset.x),
              y: center.y - ratio * (start.center.y - start.offset.y),
            })
            return
          }

          if (activePointersRef.current.size === 1 && dragStartRef.current && scaleRef.current > MIN_SCALE) {
            const start = dragStartRef.current
            applyView(scaleRef.current, {
              x: start.offset.x + point.x - start.point.x,
              y: start.offset.y + point.y - start.point.y,
            })
          }
        }}
        onPointerUp={(event) => {
          const endPoint = getRelativePoint(containerRef.current, event.clientX, event.clientY)
          const startPoint = pointerStartsRef.current.get(event.pointerId)
          const wasTap = startPoint ? getDistance(startPoint, endPoint) < 12 : false
          const wasPinching = didPinchRef.current

          activePointersRef.current.delete(event.pointerId)
          pointerStartsRef.current.delete(event.pointerId)

          if (activePointersRef.current.size === 1) {
            const [remainingPoint] = Array.from(activePointersRef.current.values())
            dragStartRef.current = { point: remainingPoint, offset: offsetRef.current }
            pinchStartRef.current = null
            setIsInteracting(true)
          } else {
            dragStartRef.current = null
            pinchStartRef.current = null
            setIsDragging(false)
            setIsInteracting(false)
          }

          if (event.pointerType === 'touch' && wasTap && !wasPinching) {
            const now = Date.now()
            const lastTap = lastTapRef.current
            if (lastTap && now - lastTap.at < 280 && getDistance(lastTap.point, endPoint) < 28) {
              if (scaleRef.current > FIT_SCALE) resetView()
              else zoomAtPoint(2.5, endPoint)
              lastTapRef.current = null
            } else {
              lastTapRef.current = { at: now, point: endPoint }
            }
          }

          if (event.pointerType === 'touch' && !wasPinching && activePointersRef.current.size === 0 && scaleRef.current <= FIT_SCALE && startPoint) {
            const deltaX = endPoint.x - startPoint.x
            const deltaY = endPoint.y - startPoint.y
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
              if (deltaX < 0 && onSwipeLeft) onSwipeLeft()
              if (deltaX > 0 && onSwipeRight) onSwipeRight()
            }
          }

          if (activePointersRef.current.size < 2) didPinchRef.current = false
        }}
        onPointerCancel={() => {
          activePointersRef.current.clear()
          pointerStartsRef.current.clear()
          dragStartRef.current = null
          pinchStartRef.current = null
          didPinchRef.current = false
          setIsDragging(false)
          setIsInteracting(false)
        }}
        style={{ cursor: scale > FIT_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        {src ? (
          <img
            ref={pictureRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(event) => {
              naturalSizeRef.current = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              }
              resetView()
              syncFitSize()
            }}
            className="shrink-0 object-contain"
            style={{
              width: fitSize.width || undefined,
              height: fitSize.height || undefined,
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center',
              borderRadius: 8,
              boxShadow: '0 0 0 1px var(--ring-edge-strong), 0 30px 60px -24px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.06)',
              opacity: fitSize.width ? 1 : 0,
              transition: isDragging || isInteracting ? 'none' : fitSize.width ? 'transform 160ms ease-out, opacity 120ms ease-out' : 'none',
            }}
          />
        ) : (
          <div className="flex items-center justify-center">
            <span className="spinner" />
          </div>
        )}
      </div>

      {/* Label */}
      {label && (
        <div
          className="pointer-events-none absolute left-4 top-4 tag"
        >
          {label}
        </div>
      )}

      {/* Zoom HUD */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
          borderRadius: 8,
          padding: 3,
          boxShadow: '0 0 0 1px var(--ring-edge), 0 1px 2px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <button
          className="icon-btn"
          onClick={() => zoomAtPoint(scaleRef.current * 0.8, { x: 0, y: 0 })}
          style={{ width: 24, height: 22 }}
          title="缩小"
        >
          <Icon name="zoom_out_map" size={11} strokeWidth={1.8} />
        </button>
        <button
          onClick={resetView}
          className="mono"
          title="双击画布可重置 · 快捷键 0"
          style={{
            background: 'none', border: 0, color: 'var(--color-text-2)',
            fontSize: 11, minWidth: 48, textAlign: 'center', padding: '0 4px',
            fontWeight: 500, cursor: 'pointer',
          }}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          className="icon-btn"
          onClick={() => zoomAtPoint(scaleRef.current * 1.25, { x: 0, y: 0 })}
          style={{ width: 24, height: 22 }}
          title="放大"
        >
          <Icon name="zoom_in" size={11} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
function getDistance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y) }
function getCenter(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
function getViewportSize(element: HTMLDivElement | null): Size {
  if (!element) return { width: 0, height: 0 }
  return { width: element.clientWidth, height: element.clientHeight }
}
function getContainedSize(viewport: Size, naturalSize: Size): Size {
  if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) return { width: 0, height: 0 }
  const ratio = Math.min(viewport.width / naturalSize.width, viewport.height / naturalSize.height)
  return { width: naturalSize.width * ratio, height: naturalSize.height * ratio }
}
function clampOffset(offset: Point, scale: number, viewport: Size, fitSize: Size): Point {
  if (!viewport.width || !viewport.height || !fitSize.width || !fitSize.height || scale <= FIT_SCALE) return { x: 0, y: 0 }
  const maxX = Math.max(0, (fitSize.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (fitSize.height * scale - viewport.height) / 2)
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) }
}
function getRelativePoint(element: HTMLDivElement | null, clientX: number, clientY: number): Point {
  if (!element) return { x: 0, y: 0 }
  const rect = element.getBoundingClientRect()
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
}
