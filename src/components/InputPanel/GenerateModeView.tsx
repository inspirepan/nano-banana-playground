import { useCallback, useState, type RefObject } from 'react'

import { MODEL_CONFIGS, type ModelConfig, type Provider } from '../../config/models'
import { getProviderConfig } from '../../config/providers'
import type { ApiKeyStatus } from '../../hooks/useApiKey'
import { useI18n } from '../../i18n'
import { getPrimaryModifierKeyLabel } from '../../lib/keyboard'
import { openAISize } from '../../lib/openai'
import { getPricePerImage } from '../../lib/pricing'
import type { PlaygroundImage } from '../../lib/types'
import { AspectRatioSelector } from '../AspectRatioSelector'
import { ChipGroup } from '../ChipGroup'
import { BrandIcon, Icon } from '../Icon'
import { ReferenceImageUpload } from '../ReferenceImageUpload'
import { Tooltip } from '../Tooltip'
import { buildOptionBlocks, getOptionSummaryLabels } from './optionBlocks'
import { INPUT_LABEL_CLASS, OptionSection, Section, ToggleGroupSection } from './sections'
import { autoResizeTextarea } from './textarea'

type Props = {
  model: ModelConfig
  resolution: string
  aspectRatio: string
  batchCount: number
  options: Record<string, unknown>
  prompt: string
  referenceImages: PlaygroundImage[]
  referenceImageError: string | null
  apiKey: string
  keyStatuses: Record<Provider, ApiKeyStatus>
  dragOver: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  canUndo: boolean
  canRedo: boolean
  onOpenApiKeys: () => void
  onSwitchModel: (id: string) => void
  onResolutionChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
  onPromptChange: (v: string) => void
  onBatchCountChange: (v: number) => void
  onOptionChange: (id: string, value: unknown) => void
  onAddReferenceImages: (files: File[]) => void
  onRemoveReferenceImage: (id: string) => void
  onClearAllReferences: () => void
  onClearReferenceImageError: () => void
  onGenerate: () => void
  pushHistory: (value: string) => void
  handleHistoryUndo: () => void
  handleHistoryRedo: () => void
}

export function GenerateModeView({
  model,
  resolution,
  aspectRatio,
  batchCount,
  options,
  prompt,
  referenceImages,
  referenceImageError,
  apiKey,
  keyStatuses,
  dragOver,
  textareaRef,
  canUndo,
  canRedo,
  onOpenApiKeys,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
  onPromptChange,
  onBatchCountChange,
  onOptionChange,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onClearAllReferences,
  onClearReferenceImageError,
  onGenerate,
  pushHistory,
  handleHistoryUndo,
  handleHistoryRedo,
}: Props) {
  const { t } = useI18n()
  const maxRef = model.maxReferenceImages + model.maxCharacterImages
  const pricePerImage = getPricePerImage(model, resolution, aspectRatio, options)
  const optionBlocks = buildOptionBlocks(model.options ?? [])

  const hasPrompt = prompt.trim() !== ''
  const canGenerate = apiKey.trim() !== '' && hasPrompt

  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null
  const optionSummaryLabels = getOptionSummaryLabels(model, options)
  const optionSummary = optionSummaryLabels.join(t('input.summary.optionSeparator'))
  const primaryModifierKey = getPrimaryModifierKeyLabel()
  const [suppressPromptPlaceholder, setSuppressPromptPlaceholder] = useState(false)

  const currentKeyStatus = keyStatuses[model.provider]
  const isCurrentKeyMissing = currentKeyStatus === 'empty' || apiKey.trim() === ''
  const providerLabel = getProviderConfig(model.provider).shortLabel

  const commitPromptValue = useCallback(
    (el: HTMLTextAreaElement) => {
      onPromptChange(el.value)
      pushHistory(el.value)
      autoResizeTextarea(el)
    },
    [onPromptChange, pushHistory],
  )

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      commitPromptValue(e.currentTarget)
    },
    [commitPromptValue],
  )

  const handlePromptCompositionStart = useCallback(() => {
    setSuppressPromptPlaceholder(true)
  }, [])

  const handlePromptCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      commitPromptValue(e.currentTarget)
      requestAnimationFrame(() => setSuppressPromptPlaceholder(false))
    },
    [commitPromptValue],
  )

  const handlePromptClear = useCallback(() => {
    onPromptChange('')
    pushHistory('')
    // Defer until after the textarea has shrunk so the scroll
    // target reflects the final layout, not the pre-clear size.
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [onPromptChange, pushHistory, textareaRef])

  return (
    <>
      {isCurrentKeyMissing && (
        <button
          type="button"
          onClick={onOpenApiKeys}
          className="card mb-[18px] flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
          style={{
            color: 'var(--color-danger)',
            background: 'var(--color-danger-soft)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 24%, transparent)',
          }}
        >
          <Icon name="alert_circle" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span className="flex-1">
            <span className="block text-base font-medium">{t('input.apiKey.missingTitle')}</span>
            <span className="mt-0.5 block text-sm leading-[1.45] opacity-80">
              {t('input.apiKey.missingBody', { model: model.name, provider: providerLabel })}
            </span>
          </span>
          <span className="chip danger shrink-0 text-sm" style={{ height: 22, padding: '0 7px' }}>
            {t('input.apiKey.configure')}
          </span>
        </button>
      )}

      {/* MODEL segmented */}
      <Section
        label={t('common.model')}
        right={<span className="mono text-sm text-(--color-text-4)">{model.apiModel}</span>}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {MODEL_CONFIGS.map((m) => (
            <Tooltip key={m.id} text={m.name} placement="top" className="min-w-0">
              <button
                type="button"
                data-active={model.id === m.id}
                onClick={() => onSwitchModel(m.id)}
                className="chip w-full min-w-0 justify-center px-2"
              >
                <BrandIcon name={getProviderConfig(m.provider).brandIcon} size={12} />
                <span className="min-w-0 truncate">{m.name}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      </Section>

      {/* Prompt */}
      <Section
        label={t('input.prompt.label')}
        right={
          <div className="flex gap-0.5">
            <Tooltip text={t('input.prompt.undo')} placement="top" className="inline-flex">
              <button
                type="button"
                onClick={handleHistoryUndo}
                disabled={!canUndo}
                aria-label={t('input.prompt.undo')}
                className="icon-btn"
              >
                <Icon name="undo" size={13} />
              </button>
            </Tooltip>
            <Tooltip text={t('input.prompt.redo')} placement="top" className="inline-flex">
              <button
                type="button"
                onClick={handleHistoryRedo}
                disabled={!canRedo}
                aria-label={t('input.prompt.redo')}
                className="icon-btn"
              >
                <Icon name="redo" size={13} />
              </button>
            </Tooltip>
          </div>
        }
      >
        <div className="prompt-wrap">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handlePromptChange}
            onCompositionStart={handlePromptCompositionStart}
            onCompositionEnd={handlePromptCompositionEnd}
            placeholder={suppressPromptPlaceholder && prompt === '' ? '' : t('input.prompt.placeholder')}
            rows={1}
            className="block w-full bg-transparent px-3 py-2.5 text-[16px] md:text-base leading-[1.55] resize-none focus:outline-none"
          />
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-(--color-text-3) shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
            <span className="text-sm tabular-nums text-(--color-text-3)">
              {t('input.prompt.charCount', { count: prompt.length })}
            </span>
            <div className="flex-1" />
            {prompt.length > 0 && (
              <Tooltip text={t('input.prompt.clear')} placement="top" className="inline-flex">
                <button
                  type="button"
                  onClick={handlePromptClear}
                  aria-label={t('input.prompt.clear')}
                  className="inline-flex items-center gap-1 bg-transparent border-0 p-0 text-sm text-(--color-text-4) hover:text-(--color-text-2) transition-colors"
                >
                  <Icon name="close" size={11} />
                  {t('common.clear')}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <div className="mb-[22px]">
        <div className="mb-5 pt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm text-(--color-text-4)">{t('input.summary.title')}</span>
            {estimatedCost !== null && (
              <span className="text-sm text-(--color-text-3) tabular-nums">≈ ${estimatedCost.toFixed(3)}</span>
            )}
          </div>
          <dl className="grid grid-cols-[52px_1fr] gap-x-3 gap-y-[3px] text-sm leading-[1.5]">
            <dt className="text-(--color-text-4)">{t('common.model')}</dt>
            <dd className="text-(--color-text-3)">{model.name}</dd>
            <dt className="text-(--color-text-4)">{t('input.summary.size')}</dt>
            <dd className="text-(--color-text-3) tabular-nums">
              <span>{resolution}</span>
              <span className="mx-1.5 text-(--color-text-4)">/</span>
              <span>{aspectRatio}</span>
            </dd>
            <dt className="text-(--color-text-4)">{t('input.count.label')}</dt>
            <dd className="text-(--color-text-3) tabular-nums">
              <span>×{batchCount}</span>
            </dd>
            {referenceImages.length > 0 && (
              <>
                <dt className="text-(--color-text-4)">{t('input.summary.referenceImages')}</dt>
                <dd className="text-(--color-text-3) tabular-nums">
                  {t('input.summary.referenceImageCount', { count: referenceImages.length })}
                </dd>
              </>
            )}
            {optionSummaryLabels.length > 0 && (
              <>
                <dt className="text-(--color-text-4)">{t('input.summary.options')}</dt>
                <dd className="text-(--color-text-3)">{optionSummary}</dd>
              </>
            )}
          </dl>
        </div>
        <button type="button" onClick={onGenerate} disabled={!canGenerate} className="cta w-full">
          <Icon name="wand" size={13} strokeWidth={1.8} />
          <span>{t('input.generateWithModel', { model: model.name, count: batchCount })}</span>
          <span className="flex-1" />
          <span className="hidden gap-0.5 md:flex">
            <kbd>{primaryModifierKey}</kbd>
            <kbd>⏎</kbd>
          </span>
        </button>
        {!apiKey.trim() && (
          <div className="mt-1.5 text-sm text-(--color-text-3) text-center">{t('input.apiKey.required')}</div>
        )}
      </div>

      <div className="pt-4 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
        <div className="mb-3 flex min-h-[20px] items-center">
          <span className={INPUT_LABEL_CLASS}>{t('input.advanced.title')}</span>
        </div>

        {/* Resolution chips */}
        <Section label={t('input.resolution.label')}>
          <div className="tabular-nums">
            <ChipGroup
              options={model.resolutions}
              value={resolution}
              onChange={onResolutionChange}
              mono={false}
              columns={model.resolutions.length}
            />
          </div>
        </Section>

        {/* Aspect ratio grid */}
        <AspectRatioSelector
          options={model.aspectRatios}
          value={aspectRatio}
          resolution={resolution}
          onChange={onAspectRatioChange}
          labelClassName={INPUT_LABEL_CLASS}
          pixelLabel={
            model.provider === 'openai' ? (ratio, res) => openAISize(res, ratio).replace('x', '×') : undefined
          }
        />

        <div className="h-[18px] " />

        {/* Model-declared options (quality, search tools, thinking level, ...) */}
        {optionBlocks.map((block, idx) => {
          if (block.kind === 'single') {
            return (
              <OptionSection
                key={block.option.id}
                option={block.option}
                value={options[block.option.id]}
                onChange={(v) => onOptionChange(block.option.id, v)}
              />
            )
          }
          return (
            <ToggleGroupSection
              key={`group-${idx}`}
              label={block.label}
              hint={block.hint}
              options={block.options}
              values={options}
              onChange={onOptionChange}
            />
          )
        })}

        {/* Reference images */}
        <div className="mb-[18px]">
          <ReferenceImageUpload
            images={referenceImages}
            maxTotal={maxRef}
            dragOver={dragOver}
            error={referenceImageError}
            labelClassName={INPUT_LABEL_CLASS}
            onAdd={onAddReferenceImages}
            onRemove={onRemoveReferenceImage}
            onClearAll={onClearAllReferences}
            onClearError={onClearReferenceImageError}
          />
        </div>

        {/* Batch count */}
        <Section label={t('input.count.label')}>
          <div
            className="grid gap-1.5 tabular-nums"
            style={{ gridTemplateColumns: `repeat(${model.maxBatchCount}, 1fr)` }}
          >
            {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className="chip justify-center"
                data-active={batchCount === n}
                onClick={() => onBatchCountChange(n)}
              >
                <span>×{n}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
