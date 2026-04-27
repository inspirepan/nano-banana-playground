import { useState, useRef, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react'
import type { PlaygroundImage } from '../lib/types'
import { MODEL_CONFIGS, type ModelConfig, type ModelOption, type ModelToggleOption } from '../config/models'
import type { GenerationQueueSummary } from '../hooks/usePlayground'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { openAISize } from '../lib/openai'
import { getPricePerImage } from '../lib/pricing'
import { isHeifFile } from '../lib/fileToImage'
import { ChipGroup } from './ChipGroup'
import { AspectRatioSelector } from './AspectRatioSelector'
import { ReferenceImageUpload } from './ReferenceImageUpload'
import { Tooltip } from './Tooltip'
import { Icon } from './Icon'

// ——— Section helper ———
function Section({
  label,
  right,
  hint,
  children,
}: {
  label: string
  right?: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-[18px]">
      <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
        <div className="flex items-center gap-2">
          <span className="label">{label}</span>
          {hint && <span className="text-[11px] text-(--color-text-4)">{hint}</span>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// OpenAI logo SVG used in the model segmented control
function OpenAILogo({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M22.28 9.82a5.95 5.95 0 0 0-.51-4.91 6.04 6.04 0 0 0-6.5-2.9A6.06 6.06 0 0 0 4.98 4.18a5.99 5.99 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.9 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.2 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.08Zm-9.02 12.63a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .39-.68v-6.74L17.7 12.3a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.48 4.51Zm-9.64-4.12a4.48 4.48 0 0 1-.54-3.03l.14.09 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.78 20a4.51 4.51 0 0 1-6.16-1.65Zm-1.19-9.9a4.5 4.5 0 0 1 2.35-1.98v5.68a.78.78 0 0 0 .39.67l5.8 3.35-2.2 1.27a.08.08 0 0 1-.08 0l-4.83-2.79a4.51 4.51 0 0 1-1.43-6.2Zm16.6 3.86L13.24 9 15.43 7.73a.07.07 0 0 1 .08 0l4.83 2.79a4.5 4.5 0 0 1-.68 8.12v-5.69a.78.78 0 0 0-.4-.67Zm2.18-3.27-.14-.09-4.77-2.77a.79.79 0 0 0-.79 0L9.57 9.54V7.2a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.67Zm-12.64 4.5-2.19-1.26a.07.07 0 0 1-.04-.06V6.63a4.5 4.5 0 0 1 7.38-3.47l-.14.08L8.8 6a.78.78 0 0 0-.39.68ZM9.76 11l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5Z" />
    </svg>
  )
}

// --- Auto-resize textarea ---
const TEXTAREA_MIN_HEIGHT = 120

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function autoResizeTextarea(el: HTMLTextAreaElement) {
  const scrollContainer = findScrollableAncestor(el)
  const prevScroll = scrollContainer?.scrollTop
  const borderHeight = el.offsetHeight - el.clientHeight
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight + borderHeight + 1, TEXTAREA_MIN_HEIGHT)}px`
  if (scrollContainer && prevScroll !== undefined) scrollContainer.scrollTop = prevScroll
}

function getModelShortLabel(model: ModelConfig) {
  if (model.provider === 'openai') return model.name
  return model.name.replace(/^Nano\s+/, '')
}

// Group model options so adjacent toggle options sharing a `group` render
// inside one Section; select options and ungrouped toggles render alone.
type OptionsBlock =
  | { kind: 'single'; option: ModelOption }
  | { kind: 'toggles'; label: string; hint?: string; options: ModelToggleOption[] }

function buildOptionBlocks(opts: ModelOption[]): OptionsBlock[] {
  const blocks: OptionsBlock[] = []
  let i = 0
  while (i < opts.length) {
    const head = opts[i]
    if (head.type === 'toggle' && head.group) {
      const group: ModelToggleOption[] = [head]
      let j = i + 1
      while (j < opts.length) {
        const next = opts[j]
        if (next.type !== 'toggle' || next.group !== head.group) break
        group.push(next)
        j++
      }
      blocks.push({
        kind: 'toggles',
        label: head.groupLabel ?? head.label,
        hint: head.hint,
        options: group,
      })
      i = j
    } else {
      blocks.push({ kind: 'single', option: head })
      i++
    }
  }
  return blocks
}

function getOptionSummaryLabels(model: ModelConfig, values: Record<string, unknown>) {
  const labels: string[] = []

  for (const option of model.options ?? []) {
    const value = values[option.id]
    if (value === option.default) continue

    if (option.type === 'toggle') {
      if (value === true) labels.push(option.label)
      continue
    }

    if (typeof value !== 'string') continue
    const choice = option.choices.find((item) => item.value === value)
    if (!choice || choice.value === option.default) continue
    labels.push(`${option.label} ${choice.label}`)
  }

  return labels
}

function OptionSection({
  option,
  value,
  onChange,
}: {
  option: ModelOption
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (option.type === 'select') {
    const current = typeof value === 'string' ? value : option.default
    const values = option.choices.map((c) => c.value)
    const labelFor = (v: string) => option.choices.find((c) => c.value === v)?.label ?? v
    const tooltipFor = (v: string) => option.choices.find((c) => c.value === v)?.tooltip
    return (
      <Section label={option.label} hint={option.hint}>
        <ChipGroup
          options={values}
          value={current}
          onChange={onChange}
          mono={false}
          columns={values.length}
          renderOption={(v) => <span>{labelFor(v)}</span>}
          tooltipFor={tooltipFor}
        />
      </Section>
    )
  }
  // Single ungrouped toggle: render as a one-chip row.
  const active = value === true
  const button = (
    <button type="button" className="chip justify-center w-full" data-active={active} onClick={() => onChange(!active)}>
      <span>{active ? '已启用' : '未启用'}</span>
    </button>
  )
  return (
    <Section label={option.label} hint={option.hint}>
      {option.tooltip ? <Tooltip text={option.tooltip}>{button}</Tooltip> : button}
    </Section>
  )
}

function ToggleGroupSection({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string
  hint?: string
  options: ModelToggleOption[]
  values: Record<string, unknown>
  onChange: (id: string, v: unknown) => void
}) {
  return (
    <Section label={label} hint={hint}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((opt) => {
          const active = values[opt.id] === true
          const button = (
            <button
              type="button"
              role="checkbox"
              aria-checked={active}
              className="chip justify-center w-full"
              data-active={active}
              onClick={() => onChange(opt.id, !active)}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-[3px] transition-colors"
                style={{
                  background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                  boxShadow: active
                    ? 'inset 0 0 0 1px var(--color-accent)'
                    : 'inset 0 0 0 1px var(--color-border-strong)',
                }}
              >
                {active && <Icon name="check" size={9} strokeWidth={3} style={{ color: 'var(--color-accent-fg)' }} />}
              </span>
              <span>{opt.label}</span>
            </button>
          )
          return opt.tooltip ? (
            <Tooltip key={opt.id} text={opt.tooltip}>
              {button}
            </Tooltip>
          ) : (
            <div key={opt.id}>{button}</div>
          )
        })}
      </div>
    </Section>
  )
}

type Props = {
  model: ModelConfig
  resolution: string
  aspectRatio: string
  batchCount: number
  options: Record<string, unknown>
  prompt: string
  referenceImages: PlaygroundImage[]
  referenceImageError: string | null
  generationQueueSummary: GenerationQueueSummary
  apiKey: string
  apiKeyStatus?: ApiKeyStatus
  googleKeyStatus: ApiKeyStatus
  openaiKeyStatus: ApiKeyStatus
  onOpenApiKeys: () => void
  onSwitchModel: (id: string) => void
  onResolutionChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
  onPromptChange: (v: string) => void
  onBatchCountChange: (v: number) => void
  onOptionChange: (id: string, value: unknown) => void
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
  onRemoveReferenceImage: (id: string) => void
  onClearAllReferences: () => void
  onClearReferenceImageError: () => void
  onGenerate: () => void
}

export function InputPanel({
  model,
  resolution,
  aspectRatio,
  batchCount,
  options,
  prompt,
  referenceImages,
  referenceImageError,
  generationQueueSummary,
  apiKey,
  googleKeyStatus,
  openaiKeyStatus,
  onOpenApiKeys,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
  onPromptChange,
  onBatchCountChange,
  onOptionChange,
  onAddReferenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onClearAllReferences,
  onClearReferenceImageError,
  onGenerate,
}: Props) {
  const maxRef = model.maxReferenceImages + model.maxCharacterImages
  const pricePerImage = getPricePerImage(model, resolution, aspectRatio, options)
  const optionBlocks = buildOptionBlocks(model.options ?? [])

  const hasPrompt = prompt.trim() !== ''
  const canGenerate = apiKey.trim() !== '' && hasPrompt
  const activeQueueCount =
    generationQueueSummary.queued + generationQueueSummary.running + generationQueueSummary.retrying

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // --- Undo/redo history ---
  const historyRef = useRef({ entries: [prompt], index: 0 })
  const debounceRef = useRef<number>(0)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const syncHistoryState = useCallback(() => {
    const h = historyRef.current
    setHistoryState({
      canUndo: h.index > 0,
      canRedo: h.index < h.entries.length - 1,
    })
  }, [])

  const pushHistory = useCallback(
    (value: string) => {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        const h = historyRef.current
        if (h.entries[h.index] === value) return
        h.entries = h.entries.slice(0, h.index + 1)
        h.entries.push(value)
        h.index = h.entries.length - 1
        syncHistoryState()
      }, 500)
    },
    [syncHistoryState],
  )

  const handleHistoryUndo = useCallback(() => {
    const h = historyRef.current
    if (h.index <= 0) return
    window.clearTimeout(debounceRef.current)
    if (h.entries[h.index] !== prompt) {
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(prompt)
      h.index = h.entries.length - 1
    }
    h.index--
    onPromptChange(h.entries[h.index])
    syncHistoryState()
  }, [prompt, onPromptChange, syncHistoryState])

  const handleHistoryRedo = useCallback(() => {
    const h = historyRef.current
    if (h.index >= h.entries.length - 1) return
    h.index++
    onPromptChange(h.entries[h.index])
    syncHistoryState()
  }, [onPromptChange, syncHistoryState])

  useLayoutEffect(() => {
    if (textareaRef.current) autoResizeTextarea(textareaRef.current)
  }, [prompt])

  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current)
    },
    [],
  )

  // Cmd+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault()
        if (canGenerate) onGenerate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canGenerate, onGenerate])

  // --- Drag-and-drop ---
  const [dragOver, setDragOver] = useState(false)
  const dragCountRef = useRef(0)

  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    if (dragCountRef.current === 1) setDragOver(true)
  }, [])

  const handlePanelDragLeave = useCallback(() => {
    dragCountRef.current--
    if (dragCountRef.current === 0) setDragOver(false)
  }, [])

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handlePanelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCountRef.current = 0
      setDragOver(false)

      const imageJson = e.dataTransfer.getData('application/x-playground-image')
      if (imageJson) {
        try {
          const img: PlaygroundImage = JSON.parse(imageJson)
          onAddReferenceImage(img)
          return
        } catch {
          /* fall through */
        }
      }

      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || isHeifFile(f))
      if (files.length > 0) onAddReferenceImages(files)
    },
    [onAddReferenceImages, onAddReferenceImage],
  )

  const handlePanelPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const imageFiles = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith('image/'))
        .map((item, index) => {
          const file = item.getAsFile()
          if (!file) return null
          if (file.name) return file
          const ext = file.type.split('/')[1] || 'png'
          return new File([file], `pasted-image-${Date.now()}-${index + 1}.${ext}`, {
            type: file.type,
            lastModified: Date.now(),
          })
        })
        .filter((file): file is File => file !== null)

      if (imageFiles.length === 0) return
      e.preventDefault()
      onAddReferenceImages(imageFiles)
    },
    [onAddReferenceImages],
  )

  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null
  const optionSummaryLabels = getOptionSummaryLabels(model, options)

  const currentKeyStatus = model.provider === 'google' ? googleKeyStatus : openaiKeyStatus
  const isCurrentKeyMissing = currentKeyStatus === 'empty' || apiKey.trim() === ''
  const providerLabel = model.provider === 'google' ? 'Gemini' : 'OpenAI'

  return (
    <div
      ref={panelRef}
      onDragEnter={handlePanelDragEnter}
      onDragLeave={handlePanelDragLeave}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
      onPaste={handlePanelPaste}
      className="relative px-[18px] py-[18px] pb-[120px]"
    >
      {/* Title + meta */}
      <div className="mb-[18px]">
        <div className="font-display text-[15px] font-semibold tracking-[-0.01em] mb-0.5">新生成任务</div>
        <div className="text-[12px] text-(--color-text-3)">配置参数，撰写提示词</div>
      </div>

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
            <span className="block text-[12.5px] font-medium">当前模型未配置 API 密钥</span>
            <span className="mt-0.5 block text-[11.5px] leading-[1.45] opacity-80">
              使用 {model.name} 需要先配置 {providerLabel} API Key。
            </span>
          </span>
          <span className="chip danger shrink-0" style={{ height: 22, padding: '0 7px', fontSize: 11.5 }}>
            去配置
          </span>
        </button>
      )}

      {/* MODEL segmented */}
      <Section label="模型" right={<span className="mono text-[11px] text-(--color-text-4)">{model.apiModel}</span>}>
        <div
          className="segmented"
          style={{
            ['--seg-count' as string]: MODEL_CONFIGS.length,
            ['--seg-index' as string]: Math.max(
              0,
              MODEL_CONFIGS.findIndex((m) => m.id === model.id),
            ),
          }}
        >
          {MODEL_CONFIGS.map((m) => (
            <button
              key={m.id}
              type="button"
              data-active={model.id === m.id}
              onClick={() => onSwitchModel(m.id)}
              title={m.name}
            >
              {m.provider === 'google' ? <span className="text-[11px]">🍌</span> : <OpenAILogo />}
              <span>{getModelShortLabel(m)}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Resolution chips */}
      <Section label="分辨率">
        <ChipGroup
          options={model.resolutions}
          value={resolution}
          onChange={onResolutionChange}
          mono={false}
          columns={model.resolutions.length}
        />
      </Section>

      {/* Aspect ratio grid */}
      <AspectRatioSelector
        options={model.aspectRatios}
        value={aspectRatio}
        resolution={resolution}
        onChange={onAspectRatioChange}
        pixelLabel={model.provider === 'openai' ? (ratio, res) => openAISize(res, ratio).replace('x', '×') : undefined}
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
          onAdd={onAddReferenceImages}
          onRemove={onRemoveReferenceImage}
          onClearAll={onClearAllReferences}
          onClearError={onClearReferenceImageError}
        />
      </div>

      {/* Prompt */}
      <Section
        label="提示词"
        right={
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={handleHistoryUndo}
              disabled={!historyState.canUndo}
              title="撤销"
              className="icon-btn"
            >
              <Icon name="undo" size={13} />
            </button>
            <button
              type="button"
              onClick={handleHistoryRedo}
              disabled={!historyState.canRedo}
              title="重做"
              className="icon-btn"
            >
              <Icon name="redo" size={13} />
            </button>
          </div>
        }
      >
        <div className="prompt-wrap">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              onPromptChange(e.target.value)
              pushHistory(e.target.value)
              autoResizeTextarea(e.target)
            }}
            placeholder="描述你想生成的图片…  例：一只在霓虹雨夜里啃香蕉的机械猫"
            rows={1}
            className="block w-full bg-transparent px-3 py-2.5 text-[16px] md:text-[13.5px] leading-[1.55] resize-none focus:outline-none"
          />
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-(--color-border) text-[11.5px] text-(--color-text-3)">
            <span className="mono text-[11px] text-(--color-text-4)">{prompt.length} 字</span>
            <div className="flex-1" />
            {prompt.length > 0 && (
              <button
                type="button"
                onClick={() => {
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
                }}
                title="清空提示词"
                aria-label="清空提示词"
                className="inline-flex items-center gap-1 bg-transparent border-0 p-0 text-[11px] text-(--color-text-4) hover:text-(--color-text-2) transition-colors"
              >
                <Icon name="close" size={11} />
                清空
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* Batch count */}
      <Section label="数量">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${model.maxBatchCount}, 1fr)` }}>
          {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="chip justify-center"
              data-active={batchCount === n}
              onClick={() => onBatchCountChange(n)}
            >
              <span className="mono">×{n}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <div className="relative">
        <div className="mb-2.5 pt-2.5 border-t border-dashed border-(--color-border)">
          <div className="flex items-baseline justify-between mb-2">
            <span className="label">参数概览</span>
            {estimatedCost !== null && (
              <span className="mono text-[11.5px] text-(--color-text-2)">≈ ${estimatedCost.toFixed(3)}</span>
            )}
          </div>
          <dl className="grid grid-cols-[52px_1fr] gap-x-3 gap-y-[5px] text-[11.5px] leading-[1.5]">
            <dt className="text-(--color-text-4)">模型</dt>
            <dd className="text-(--color-text-2)">{model.name}</dd>
            <dt className="text-(--color-text-4)">尺寸</dt>
            <dd className="text-(--color-text-2)">
              <span className="mono">{resolution}</span>
              <span className="mx-1.5 text-(--color-text-4)">/</span>
              <span className="mono">{aspectRatio}</span>
            </dd>
            <dt className="text-(--color-text-4)">数量</dt>
            <dd className="text-(--color-text-2)">
              <span className="mono">×{batchCount}</span>
            </dd>
            {referenceImages.length > 0 && (
              <>
                <dt className="text-(--color-text-4)">参考图</dt>
                <dd className="text-(--color-text-2)">
                  <span className="mono">{referenceImages.length}</span> 张
                </dd>
              </>
            )}
            {optionSummaryLabels.length > 0 && (
              <>
                <dt className="text-(--color-text-4)">选项</dt>
                <dd className="text-(--color-text-2)">{optionSummaryLabels.join('、')}</dd>
              </>
            )}
            {activeQueueCount > 0 && (
              <>
                <dt className="text-(--color-text-4)">队列</dt>
                <dd className="text-(--color-text-2)">
                  <span className="mono">{activeQueueCount}</span> 张等待/运行中
                </dd>
              </>
            )}
          </dl>
        </div>
        <button type="button" onClick={() => onGenerate()} disabled={!canGenerate} className="cta w-full">
          <Icon name="wand" size={13} strokeWidth={1.8} />
          <span>
            {activeQueueCount > 0 ? '加入队列' : `使用 ${model.name} 生成`} {batchCount} 张
          </span>
          <span className="flex-1" />
          <span className="flex gap-0.5">
            <kbd>⌘</kbd>
            <kbd>⏎</kbd>
          </span>
        </button>
        {!apiKey.trim() && <div className="mt-1.5 text-[11px] text-(--color-text-4) text-center">请先配置 API Key</div>}
      </div>

      {dragOver && (
        <div
          className="absolute inset-0 z-40 rounded-[8px] border-2 border-dashed pointer-events-none"
          style={{ borderColor: 'var(--color-accent)', background: 'var(--color-accent-wash)' }}
        />
      )}
    </div>
  )
}
