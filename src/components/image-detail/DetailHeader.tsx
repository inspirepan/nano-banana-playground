import type { GenerationSlot } from '../../hooks/usePlayground'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'

type ModalViewMode = 'detail' | 'gallery'

type DetailHeaderProps = {
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSlot: GenerationSlot | null
  modelName: string | null
  pxDim: string
  viewMode: ModalViewMode
  galleryBacksToDetail: boolean
  sidebarCollapsed: boolean
  onClose: () => void
  onBackToDetail: () => void
  onOpenManageGallery: () => void
  onAddRef: () => void
  onRegenerate: () => void
  onReroll: () => void
  onDownload: () => void
  onToggleSidebar: () => void
}

export function DetailHeader({
  currentImage,
  currentMeta,
  currentSlot,
  modelName,
  pxDim,
  viewMode,
  galleryBacksToDetail,
  sidebarCollapsed,
  onClose,
  onBackToDetail,
  onOpenManageGallery,
  onAddRef,
  onRegenerate,
  onReroll,
  onDownload,
  onToggleSidebar,
}: DetailHeaderProps) {
  return (
    <div
      className="flex items-center gap-2 px-3.5 shrink-0 flex-nowrap"
      style={{
        height: 48,
        boxShadow: 'inset 0 -1px 0 var(--ring-edge-soft)',
        background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
      }}
    >
      <button
        className="icon-btn shrink-0"
        onClick={galleryBacksToDetail ? onBackToDetail : onClose}
        title={galleryBacksToDetail ? '回到预览' : '关闭 (Esc)'}
        style={{ width: 32, height: 32 }}
      >
        <Icon name={galleryBacksToDetail ? 'chevron_left' : 'close'} size={13} strokeWidth={1.8} />
      </button>
      <div className="h-6 w-px shrink-0 bg-(--ring-edge-soft)" />

      {currentMeta ? (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
            {modelName}
          </span>
          <span className="mono shrink-0 text-sm leading-[1.25] text-(--color-text-4)">{pxDim}</span>
        </div>
      ) : (
        <span className="truncate text-base font-semibold leading-[1.25] tracking-[-0.01em] text-(--color-text) md:text-base md:font-medium md:tracking-normal">
          {currentSlot ? '生成任务' : '图片组'}
        </span>
      )}

      <div className="flex-1" />

      {viewMode === 'detail' && (
        <button
          className="chip shrink-0 text-sm font-normal md:text-[13px]"
          onClick={onOpenManageGallery}
          title="打开批量管理"
        >
          <Icon name="check_circle" size={14} strokeWidth={1.8} />
          <span>批量管理</span>
        </button>
      )}
      {viewMode === 'detail' && currentImage && (
        <>
          <button className="chip hidden shrink-0 font-normal md:inline-flex" onClick={onAddRef} title="加为参考">
            <Icon name="plus" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">参考</span>
          </button>
          {currentMeta?.prompt && (
            <>
              <button
                className="chip hidden shrink-0 font-normal md:inline-flex"
                onClick={onRegenerate}
                title="还原参数"
              >
                <Icon name="undo" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">还原参数</span>
              </button>
              <button
                className="chip hidden shrink-0 font-normal md:inline-flex"
                onClick={onReroll}
                title="按原参数重新生成"
              >
                <Icon name="refresh" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">重抽</span>
              </button>
            </>
          )}
          <button
            className="chip shrink-0 text-sm font-normal md:hidden"
            onClick={onDownload}
            title="下载 PNG"
            style={{ height: 36, padding: '0 12px' }}
          >
            <Icon name="download" size={14} strokeWidth={1.8} /> 下载
          </button>
          <button className="chip hidden shrink-0 font-normal md:inline-flex" onClick={onDownload} title="下载 PNG">
            <Icon name="download" size={12} strokeWidth={1.8} /> <span className="hidden md:inline">PNG</span>
          </button>
        </>
      )}
      {viewMode === 'detail' && (
        <button
          className="chip hidden shrink-0 font-normal md:inline-flex"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? '展开详情面板' : '收起详情面板'}
          aria-pressed={!sidebarCollapsed}
        >
          <Icon name={sidebarCollapsed ? 'chevron_left' : 'chevron_right'} size={12} strokeWidth={1.8} />
          {sidebarCollapsed ? '展开详情' : '收起详情'}
        </button>
      )}
    </div>
  )
}
