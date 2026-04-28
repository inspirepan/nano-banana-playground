import type { ReactNode } from 'react'

import type { ModelConfig } from '../../config/models'
import { useImageSrc } from '../../hooks/useImageSrc'
import type { GenerationSlot } from '../../hooks/usePlayground'
import type { GeneratedSource, GroundingMetadata, PlaygroundImageMeta } from '../../lib/types'
import { Icon } from '../Icon'

const HIGHLIGHT_LABELS = [
  '参考图说明',
  '画面中的文字',
  '画中文字',
  '编辑类型',
  '编辑请求',
  '目标场景',
  '目标风格',
  '保持不变',
  '构图',
  '风格',
  '光影',
  '色彩',
  '约束',
  '避免',
]

type DetailSidebarProps = {
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  currentSlot: GenerationSlot | null
  modelName: string | null
  modelApiId: string | null
  modelConfig: ModelConfig | null | undefined
  actualCost: number | null
  stackId: string
  stackInfo: { pos: number; total: number } | false | null
  canNavigate: boolean
  copiedPrompt: boolean
  refDetailId: string | null
  findRefImage: (id: string) => PlaygroundImageMeta | undefined
  onToggleRefDetail: (id: string) => void
  onAddRef: () => void
  onRegenerate: () => void
  onCopyPrompt: () => void
  onRemove: (id: string) => void | Promise<void>
  onClose: () => void
}

export function DetailSidebar({
  currentImage,
  currentMeta,
  currentSlot,
  modelName,
  modelApiId,
  modelConfig,
  actualCost,
  stackId,
  stackInfo,
  canNavigate,
  copiedPrompt,
  refDetailId,
  findRefImage,
  onToggleRefDetail,
  onAddRef,
  onRegenerate,
  onCopyPrompt,
  onRemove,
  onClose,
}: DetailSidebarProps) {
  return (
    <>
      {currentImage && (
        <div className="mb-[18px] grid grid-cols-2 gap-1.5 md:hidden">
          <button type="button" className="chip justify-center" onClick={onAddRef} disabled={!currentImage}>
            <Icon name="plus" size={12} strokeWidth={1.8} />
            +参考
          </button>
          <button type="button" className="chip justify-center" onClick={onRegenerate} disabled={!currentMeta?.prompt}>
            <Icon name="refresh" size={12} strokeWidth={1.8} />
            还原参数
          </button>
        </div>
      )}

      {currentMeta?.prompt && (
        <div className="mb-[18px]">
          <div className="flex items-center mb-1.5">
            <span className="label">提示词</span>
            <div className="flex-1" />
            <button className="chip shrink-0 text-xs" style={{ height: 26 }} onClick={onCopyPrompt}>
              {/* Safari ignores flex layout on <button>; nesting fixes it. */}
              <span className="inline-flex items-center gap-1.5">
                <Icon name={copiedPrompt ? 'check' : 'copy'} size={12} strokeWidth={copiedPrompt ? 2.2 : 1.8} />
                {copiedPrompt ? '已复制' : '复制'}
              </span>
            </button>
          </div>
          <div
            className="rounded-[8px] p-3 text-sm leading-[1.6] text-(--color-text-2)"
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

      {currentMeta && currentMeta.referenceImageIds.length > 0 && (
        <div className="mb-[18px]">
          <div className="flex items-center mb-1.5">
            <span className="label">参考图</span>
            <span className="ml-1.5 text-xs text-(--color-text-4)">{currentMeta.referenceImageIds.length} 张</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {currentMeta.referenceImageIds.map((refId) => {
              const refImg = findRefImage(refId)
              if (!refImg) {
                return (
                  <div
                    key={refId}
                    className="aspect-square rounded-[6px] flex items-center justify-center text-(--color-text-4)"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)', background: 'var(--color-surface-2)' }}
                  >
                    ?
                  </div>
                )
              }
              return (
                <RefThumbnail
                  key={refId}
                  image={refImg}
                  isActive={refDetailId === refImg.id}
                  onClick={() => onToggleRefDetail(refImg.id)}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className="mb-[18px]">
        <div className="label mb-1">元数据</div>
        {currentMeta && (
          <>
            <MetaRow label="模型" value={modelName ?? currentMeta.modelId} />
            {modelApiId && <MetaRow label="模型 ID" value={modelApiId} mono />}
            <MetaRow label="分辨率" value={currentMeta.resolution} mono />
            <MetaRow label="宽高比" value={currentMeta.aspectRatio} mono />
            {renderOptionRows(currentMeta, modelConfig)}
            {actualCost !== null && <MetaRow label="费用" value={<span>${actualCost.toFixed(4)}</span>} mono />}
            {currentMeta.tokenUsage && modelConfig?.provider === 'openai' && (
              <>
                <MetaRow
                  label="文本输入 Token"
                  value={
                    currentMeta.tokenUsage.inputTextTokens?.toLocaleString() ??
                    currentMeta.tokenUsage.inputTokens.toLocaleString()
                  }
                  mono
                />
                {(currentMeta.tokenUsage.inputImageTokens ?? 0) > 0 && (
                  <MetaRow
                    label="图片输入 Token"
                    value={(currentMeta.tokenUsage.inputImageTokens ?? 0).toLocaleString()}
                    mono
                  />
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
        {currentImage?.source.type === 'upload' && <MetaRow label="来源" value={`上传: ${currentImage.source.fileName}`} />}
        {currentImage ? (
          <MetaRow label="创建时间" value={new Date(currentImage.timestamp).toLocaleString('zh-CN', { hour12: false })} mono />
        ) : (
          <MetaRow label="状态" value={currentSlot?.status === 'failed' ? '生成失败' : '等待生成'} />
        )}
        {currentMeta && stackInfo && (
          <MetaRow
            label="Stack"
            value={
              <span>
                <span className="mono">s_{stackId.slice(0, 6)}</span>
                <span className="mono text-(--color-text-4) ml-1.5">
                  #{stackInfo.pos}/{stackInfo.total}
                </span>
              </span>
            }
            last
          />
        )}
      </div>

      {currentMeta?.groundingMetadata && <GroundingSection metadata={currentMeta.groundingMetadata} />}

      {currentImage && canNavigate && (
        <button
          className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium transition-colors"
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
          onClick={() => {
            void onRemove(currentImage.id)
            onClose()
          }}
        >
          <Icon name="trash" size={12} strokeWidth={1.8} /> 从历史中删除
        </button>
      )}
    </>
  )
}

function renderOptionRows(source: GeneratedSource, model: ModelConfig | null | undefined) {
  const bag = effectiveOptions(source)
  const declaredIds = model?.options?.map((o) => o.id) ?? []
  const leftover = Object.keys(bag).filter((id) => !declaredIds.includes(id))
  return [...declaredIds, ...leftover].map((id) => {
    const formatted = formatOptionValue(model, id, bag[id])
    if (formatted === null) return null
    return <MetaRow key={id} label={optionLabel(model, id)} value={formatted} />
  })
}

function effectiveOptions(source: GeneratedSource): Record<string, unknown> {
  const bag: Record<string, unknown> = { ...(source.options ?? {}) }
  if (source.quality !== undefined && bag.quality === undefined) bag.quality = source.quality
  if (source.searchTools && bag.webSearch === undefined && bag.imageSearch === undefined) {
    if (source.searchTools.web) bag.webSearch = true
    if (source.searchTools.image) bag.imageSearch = true
  }
  return bag
}

function formatOptionValue(model: ModelConfig | null | undefined, optionId: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '' || value === false) return null
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt?.type === 'select' && typeof value === 'string') return opt.choices.find((c) => c.value === value)?.label ?? value
  if (opt?.type === 'toggle') return value === true ? '已启用' : null
  if (typeof value === 'boolean') return value ? '是' : null
  return String(value)
}

function optionLabel(model: ModelConfig | null | undefined, optionId: string): string {
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt) return opt.label
  if (optionId === 'quality') return '质量'
  if (optionId === 'webSearch') return 'Web 搜索'
  if (optionId === 'imageSearch') return '图片搜索'
  if (optionId === 'background') return '背景'
  if (optionId === 'thinkingLevel') return '思考等级'
  return optionId
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
            </span>
            ：{line.slice(needle.length)}
          </div>
        )
      }
    }
    return <div key={i}>{line || ' '}</div>
  })
}

function MetaRow({ label, value, mono, last }: { label: string; value: ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5" style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <div className="w-[76px] shrink-0 text-xs font-medium text-(--color-text-3)">{label}</div>
      <div className={`${mono ? 'mono' : ''} flex-1 break-words text-right text-sm text-(--color-text)`}>{value}</div>
    </div>
  )
}

function GroundingSection({ metadata }: { metadata: GroundingMetadata }) {
  const chunks = metadata.groundingChunks ?? []
  const sources: Array<{ uri: string; title: string; isImage: boolean }> = []
  for (const chunk of chunks) {
    const web = chunk.web
    const image = chunk.image
    const uri = web?.uri ?? image?.uri
    if (!uri) continue
    sources.push({ uri, title: web?.title ?? image?.title ?? uri, isImage: !web && !!image })
  }
  const queries = [...(metadata.webSearchQueries ?? []), ...(metadata.imageSearchQueries ?? [])]
  if (!metadata.searchEntryPoint?.renderedContent && sources.length === 0 && queries.length === 0) return null

  return (
    <div className="mb-[18px]">
      <div className="label mb-1">搜索来源</div>
      {metadata.searchEntryPoint?.renderedContent && (
        <div
          className="mb-2"
          // Google returns styled HTML for the search suggestion chip; must be rendered as-is.
          dangerouslySetInnerHTML={{ __html: metadata.searchEntryPoint.renderedContent }}
        />
      )}
      {sources.length > 0 && (
        <ul className="list-none p-0 m-0 space-y-1">
          {sources.map((s, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5 text-xs">
              <Icon name={s.isImage ? 'image' : 'search'} size={11} />
              <a href={s.uri} target="_blank" rel="noreferrer" className="truncate text-(--color-accent) hover:underline" title={s.uri}>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {queries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {queries.map((q, i) => (
            <span key={i} className="tag text-xs">
              {q}
            </span>
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
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge-strong)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--ring-edge)'
      }}
    >
      {src ? <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="w-full h-full skeleton-animated" />}
    </div>
  )
}