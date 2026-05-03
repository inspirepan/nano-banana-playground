import type { ReactNode } from 'react'

import type { ModelConfig } from '../../config/models'
import { useImageSrc } from '../../hooks/useImageSrc'
import type { GenerationJob, GenerationSlot } from '../../hooks/usePlayground'
import { useI18n, type Translate } from '../../i18n'
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
  currentJob: GenerationJob | null
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
  onStartEdit?: () => void
  onAddRef: () => void
  onRegenerate: () => void
  onReroll: () => void
  onDownload: () => void
  onCopyPrompt: () => void
  onRemove: (id: string) => void | Promise<void>
}

export function DetailSidebar({
  currentImage,
  currentMeta,
  currentSlot,
  currentJob,
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
  onStartEdit,
  onAddRef,
  onRegenerate,
  onReroll,
  onDownload,
  onCopyPrompt,
  onRemove,
}: DetailSidebarProps) {
  const { language, t } = useI18n()
  const prompt = currentMeta?.prompt ?? currentJob?.request.prompt ?? null
  const semanticImageId =
    currentImage?.source.type === 'generated' && currentImage.source.imageIdSource === 'agent' ? currentImage.id : null
  const semanticImageIdDisplay = semanticImageId ? Array.from(semanticImageId).slice(0, 20).join('') : null

  return (
    <>
      {currentImage && (
        <div className="mb-[18px]">
          <div className="detail-mobile-actions -mx-1 flex items-center">
            <button
              type="button"
              className="action-soft detail-mobile-action flex-1"
              onClick={onAddRef}
              disabled={!currentImage}
              title={t('imageDetail.action.addReferenceTitle')}
            >
              <Icon name="plus" size={13} strokeWidth={1.8} className="action-soft-icon" />
              {t('imageDetail.action.addReference')}
            </button>
            <button
              type="button"
              className="action-soft detail-mobile-action flex-1"
              onClick={onDownload}
              title={t('imageDetail.action.downloadPng')}
            >
              <Icon name="download" size={13} strokeWidth={1.8} className="action-soft-icon" />
              {t('common.download')}
            </button>
            {onStartEdit ? (
              <button
                type="button"
                className="action-soft detail-mobile-action flex-1"
                onClick={onStartEdit}
                title={t('imageDetail.action.editImage')}
              >
                <Icon name="wand" size={13} strokeWidth={1.8} className="action-soft-icon" />
                {t('common.edit')}
              </button>
            ) : (
              <button
                type="button"
                className="action-soft detail-mobile-action flex-1"
                onClick={onRegenerate}
                disabled={!currentMeta?.prompt}
                title={t('imageDetail.action.restoreParams')}
              >
                <Icon name="undo" size={13} strokeWidth={1.8} className="action-soft-icon" />
                {t('imageDetail.action.restoreParams')}
              </button>
            )}
            <button
              type="button"
              className="action-soft detail-mobile-action flex-1"
              onClick={onReroll}
              disabled={!currentMeta?.prompt}
              title={t('imageDetail.action.regenerateOriginal')}
            >
              <Icon name="refresh" size={13} strokeWidth={1.8} className="action-soft-icon" />
              {t('imageDetail.action.redoOriginal')}
            </button>
          </div>
        </div>
      )}

      {prompt && (
        <div className="mb-[18px]">
          <div className="flex items-center mb-1.5">
            <span className="label">{t('imageDetail.section.prompt')}</span>
            <div className="flex-1" />
            <button
              type="button"
              className="action-soft shrink-0"
              style={{ height: 26 }}
              onClick={onCopyPrompt}
              title={t('imageDetail.action.copyPrompt')}
            >
              {/* Safari ignores flex layout on <button>; nesting fixes it. */}
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  name={copiedPrompt ? 'check' : 'copy'}
                  size={12}
                  strokeWidth={copiedPrompt ? 2.2 : 1.8}
                  className="action-soft-icon"
                />
                {copiedPrompt ? t('imageDetail.status.copied') : t('imageDetail.action.copy')}
              </span>
            </button>
          </div>
          <div
            className="rounded-[var(--radius-md)] p-3 text-sm leading-[1.6] text-(--color-text-2)"
            style={{
              background: 'var(--color-surface)',
              boxShadow: 'inset 0 0 0 1px var(--ring-edge)',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {renderPromptLines(prompt)}
          </div>
        </div>
      )}

      {currentMeta && currentMeta.referenceImageIds.length > 0 && (
        <div className="mb-[18px]">
          <div className="flex items-center mb-1.5">
            <span className="label">{t('imageDetail.meta.referenceImages')}</span>
            <span className="ml-1.5 text-sm text-(--color-text-3) tabular-nums">
              {t('imageDetail.reference.count', { count: currentMeta.referenceImageIds.length })}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {currentMeta.referenceImageIds.map((refId) => {
              const refImg = findRefImage(refId)
              if (!refImg) {
                return (
                  <div
                    key={refId}
                    className="aspect-square rounded-[var(--radius-sm)] flex items-center justify-center text-(--color-text-4)"
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

      <div className="mb-[18px] tabular-nums">
        <div className="label mb-1">{t('imageDetail.meta.metadata')}</div>
        {currentImage && <MetaRow label={t('imageDetail.meta.imageId')} value={currentImage.id} mono />}
        {currentMeta && (
          <>
            <MetaRow label={t('common.model')} value={modelName ?? currentMeta.modelId} />
            {modelApiId && <MetaRow label={t('imageDetail.meta.modelId')} value={modelApiId} mono />}
            <MetaRow label={t('imageDetail.meta.resolution')} value={currentMeta.resolution} />
            <MetaRow label={t('imageDetail.meta.aspectRatio')} value={currentMeta.aspectRatio} />
            {renderOptionRows(currentMeta, modelConfig, t)}
            {actualCost !== null && (
              <MetaRow label={t('imageDetail.meta.cost')} value={<span>${actualCost.toFixed(4)}</span>} />
            )}
            {currentMeta.tokenUsage && modelConfig?.provider === 'openai' && (
              <>
                <MetaRow
                  label={t('imageDetail.meta.textInputTokens')}
                  value={
                    currentMeta.tokenUsage.inputTextTokens?.toLocaleString() ??
                    currentMeta.tokenUsage.inputTokens.toLocaleString()
                  }
                />
                {(currentMeta.tokenUsage.inputImageTokens ?? 0) > 0 && (
                  <MetaRow
                    label={t('imageDetail.meta.imageInputTokens')}
                    value={(currentMeta.tokenUsage.inputImageTokens ?? 0).toLocaleString()}
                  />
                )}
                <MetaRow
                  label={t('imageDetail.meta.imageOutputTokens')}
                  value={currentMeta.tokenUsage.imageOutputTokens.toLocaleString()}
                />
                {currentMeta.tokenUsage.textOutputTokens > 0 && (
                  <MetaRow
                    label={t('imageDetail.meta.textOutputTokens')}
                    value={currentMeta.tokenUsage.textOutputTokens.toLocaleString()}
                  />
                )}
              </>
            )}
            {currentMeta.tokenUsage && modelConfig?.provider === 'google' && (
              <>
                <MetaRow
                  label={t('imageDetail.meta.inputTokens')}
                  value={currentMeta.tokenUsage.inputTokens.toLocaleString()}
                />
                <MetaRow
                  label={t('imageDetail.meta.imageTokens')}
                  value={currentMeta.tokenUsage.imageOutputTokens.toLocaleString()}
                />
                {currentMeta.tokenUsage.textOutputTokens > 0 && (
                  <MetaRow
                    label={t('imageDetail.meta.thinkingTokens')}
                    value={currentMeta.tokenUsage.textOutputTokens.toLocaleString()}
                  />
                )}
              </>
            )}
          </>
        )}
        {!currentMeta && currentSlot && currentJob && (
          <>
            <MetaRow label={t('imageDetail.meta.status')} value={slotStatusLabel(currentSlot, t)} />
            <MetaRow label={t('common.model')} value={currentJob.request.model.name} />
            <MetaRow label={t('imageDetail.meta.modelId')} value={currentJob.request.model.apiModel} mono />
            <MetaRow label={t('imageDetail.meta.resolution')} value={currentJob.request.resolution} />
            <MetaRow label={t('imageDetail.meta.aspectRatio')} value={currentJob.request.aspectRatio} />
            {renderRequestOptionRows(currentJob.request.options, currentJob.request.model, t)}
            <MetaRow
              label={t('imageDetail.meta.quantity')}
              value={`${currentSlot.index + 1}/${currentJob.slots.length}`}
            />
            <MetaRow
              label={t('imageDetail.meta.referenceImages')}
              value={t('imageDetail.reference.count', { count: currentJob.request.referenceImages.length })}
            />
            {currentJob.request.mask && <MetaRow label="Mask" value={t('imageDetail.meta.maskProvided')} />}
            <MetaRow
              label={t('imageDetail.meta.startedAt')}
              value={new Date(currentJob.createdAt).toLocaleString(language, { hour12: false })}
            />
            {currentSlot.status === 'retrying' && (
              <MetaRow
                label={t('imageDetail.meta.retry')}
                value={`${currentSlot.attempt}/${currentSlot.maxAttempts}`}
              />
            )}
            {currentSlot.error && <MetaRow label={t('imageDetail.meta.error')} value={currentSlot.error} />}
          </>
        )}
        {currentImage?.source.type === 'upload' && (
          <MetaRow
            label={t('imageDetail.meta.source')}
            value={t('imageDetail.meta.sourceUpload', { fileName: currentImage.source.fileName })}
          />
        )}
        {currentImage ? (
          <MetaRow
            label={t('imageDetail.meta.createdAt')}
            value={new Date(currentImage.timestamp).toLocaleString(language, { hour12: false })}
          />
        ) : !currentJob ? (
          <MetaRow
            label={t('imageDetail.meta.status')}
            value={
              currentSlot?.status === 'failed'
                ? t('imageDetail.queue.status.failed')
                : t('imageDetail.queue.status.waiting')
            }
          />
        ) : null}
        {currentMeta && stackInfo && (
          <MetaRow
            label={t('imageDetail.meta.stack')}
            value={
              <span>
                <span className="mono">s_{stackId.slice(0, 6)}</span>
                <span className="text-(--color-text-3) ml-1.5">
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
          className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium transition-colors"
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
          onClick={(e) => {
            e.currentTarget.blur()
            void onRemove(currentImage.id)
          }}
        >
          <Icon name="trash" size={12} strokeWidth={1.8} />
          <span>{t('imageDetail.action.deleteFromHistory')}</span>
          {semanticImageIdDisplay && (
            <span
              className="mono min-w-0 max-w-[120px] truncate rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[11px] font-normal leading-none"
              style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}
              title={semanticImageId ?? undefined}
            >
              {semanticImageIdDisplay}
            </span>
          )}
        </button>
      )}
    </>
  )
}

function renderOptionRows(source: GeneratedSource, model: ModelConfig | null | undefined, t: Translate) {
  const bag = effectiveOptions(source)
  return renderOptionBagRows(bag, model, t)
}

function renderRequestOptionRows(options: Record<string, unknown>, model: ModelConfig, t: Translate) {
  return renderOptionBagRows(options, model, t)
}

function renderOptionBagRows(bag: Record<string, unknown>, model: ModelConfig | null | undefined, t: Translate) {
  const declaredIds = model?.options?.map((o) => o.id) ?? []
  const declaredIdSet = new Set(declaredIds)
  const leftover = Object.keys(bag).filter((id) => !declaredIdSet.has(id))
  return [...declaredIds, ...leftover].map((id) => {
    const formatted = formatOptionValue(model, id, bag[id], t)
    if (formatted === null) return null
    return <MetaRow key={id} label={optionLabel(model, id, t)} value={formatted} />
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

function slotStatusLabel(slot: GenerationSlot, t: Translate): string {
  if (slot.status === 'queued') return t('imageDetail.queue.status.queued')
  if (slot.status === 'running') return t('imageDetail.queue.status.generating')
  if (slot.status === 'retrying') return t('imageDetail.queue.status.retrying')
  if (slot.status === 'failed') return t('imageDetail.queue.status.failed')
  if (slot.status === 'canceled') return t('imageDetail.queue.status.canceled')
  return t('imageDetail.queue.status.completed')
}

function formatOptionValue(
  model: ModelConfig | null | undefined,
  optionId: string,
  value: unknown,
  t: Translate,
): string | null {
  if (value === undefined || value === null || value === '' || value === false) return null
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt?.type === 'select' && typeof value === 'string')
    return opt.choices.find((c) => c.value === value)?.label ?? value
  if (opt?.type === 'toggle') return value === true ? t('imageDetail.option.enabled') : null
  if (typeof value === 'boolean') return value ? t('imageDetail.option.yes') : null
  return String(value)
}

function optionLabel(model: ModelConfig | null | undefined, optionId: string, t: Translate): string {
  const opt = model?.options?.find((o) => o.id === optionId)
  if (opt) return optionLabelById(optionId, t) ?? opt.label
  return optionLabelById(optionId, t) ?? optionId
}

function optionLabelById(optionId: string, t: Translate): string | null {
  if (optionId === 'quality') return t('imageDetail.option.quality')
  if (optionId === 'webSearch') return t('imageDetail.option.webSearch')
  if (optionId === 'imageSearch') return t('imageDetail.option.imageSearch')
  if (optionId === 'background') return t('imageDetail.option.background')
  if (optionId === 'thinkingLevel') return t('imageDetail.option.thinkingLevel')
  return null
}

function renderPromptLines(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => {
    for (const lbl of HIGHLIGHT_LABELS) {
      const needle = `${lbl}：`
      if (line.startsWith(needle)) {
        return (
          <div key={i}>
            <span
              className="rounded-[var(--radius-xs)] px-[3px] font-medium"
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
    <div
      className="flex items-baseline gap-3 py-1.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}
    >
      <div className="w-[76px] shrink-0 text-sm font-medium text-(--color-text-3)">{label}</div>
      <div className={`${mono ? 'mono' : ''} flex-1 break-words text-right text-sm text-(--color-text)`}>{value}</div>
    </div>
  )
}

function GroundingSection({ metadata }: { metadata: GroundingMetadata }) {
  const { t } = useI18n()
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
      <div className="label mb-1">{t('imageDetail.meta.searchSources')}</div>
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
            <li key={i} className="flex min-w-0 items-center gap-1.5 text-sm">
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
            <span key={i} className="tag text-sm">
              {q}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RefThumbnail({
  image,
  isActive,
  onClick,
}: {
  image: PlaygroundImageMeta
  isActive: boolean
  onClick: () => void
}) {
  const { ref, src } = useImageSrc(image.id, image.mimeType, undefined, { variant: 'preview' })
  return (
    <div
      ref={ref}
      onClick={onClick}
      className="aspect-square rounded-[var(--radius-sm)] overflow-hidden cursor-pointer transition-colors"
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
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full skeleton-animated" />
      )}
    </div>
  )
}
