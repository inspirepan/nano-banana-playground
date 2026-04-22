import { useState, useRef, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react'
import type { PlaygroundImage } from '../lib/types'
import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { openAISize } from '../lib/openai'
import { getPricePerImage } from '../lib/pricing'
import { ChipGroup } from './ChipGroup'
import { AspectRatioSelector } from './AspectRatioSelector'
import { ReferenceImageUpload } from './ReferenceImageUpload'
import { Icon } from './Icon'

// ——— Section helper ———
function Section({ label, right, hint, children }: { label: string; right?: ReactNode; hint?: ReactNode; children: ReactNode }) {
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

type Props = {
  model: ModelConfig
  resolution: string
  aspectRatio: string
  quality: string
  batchCount: number
  prompt: string
  referenceImages: PlaygroundImage[]
  generationState: GenerationState
  apiKey: string
  apiKeyStatus?: ApiKeyStatus
  googleKeyStatus: ApiKeyStatus
  openaiKeyStatus: ApiKeyStatus
  onOpenApiKeys: () => void
  onSwitchModel: (id: string) => void
  onResolutionChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
  onQualityChange: (v: string) => void
  onPromptChange: (v: string) => void
  onBatchCountChange: (v: number) => void
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
  onRemoveReferenceImage: (id: string) => void
  onGenerate: () => void
  onCancel: () => void
}

export function InputPanel({
  model,
  resolution,
  aspectRatio,
  quality,
  batchCount,
  prompt,
  referenceImages,
  generationState,
  apiKey,
  googleKeyStatus,
  openaiKeyStatus,
  onOpenApiKeys,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
  onQualityChange,
  onPromptChange,
  onBatchCountChange,
  onAddReferenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onGenerate,
  onCancel,
}: Props) {
  const isGenerating = generationState === 'generating'
  const maxRef = model.maxReferenceImages + model.maxCharacterImages
  const pricePerImage = getPricePerImage(model, resolution, aspectRatio, quality)

  const hasPrompt = prompt.trim() !== ''
  const canGenerate = apiKey.trim() !== '' && hasPrompt && !isGenerating

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

  const pushHistory = useCallback((value: string) => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const h = historyRef.current
      if (h.entries[h.index] === value) return
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(value)
      h.index = h.entries.length - 1
      syncHistoryState()
    }, 500)
  }, [syncHistoryState])

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

  useEffect(() => () => { window.clearTimeout(debounceRef.current) }, [])

  // Cmd+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault()
        if (isGenerating) onCancel()
        else if (canGenerate) onGenerate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isGenerating, canGenerate, onCancel, onGenerate])

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

  const handlePanelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0
    setDragOver(false)

    const imageJson = e.dataTransfer.getData('application/x-playground-image')
    if (imageJson) {
      try {
        const img: PlaygroundImage = JSON.parse(imageJson)
        onAddReferenceImage(img)
        return
      } catch { /* fall through */ }
    }

    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length > 0) onAddReferenceImages(files)
  }, [onAddReferenceImages, onAddReferenceImage])

  const handlePanelPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
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
  }, [onAddReferenceImages])

  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null

  const currentKeyStatus = model.provider === 'google' ? googleKeyStatus : openaiKeyStatus
  const keyDisplay: Record<string, { color: string; bg: string; text: string }> = {
    valid:      { color: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)', text: '已验证' },
    validating: { color: 'var(--color-text-3)', bg: 'var(--color-surface-2)', text: '验证中' },
    invalid:    { color: 'var(--color-danger)', bg: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', text: '无效' },
    empty:      { color: 'var(--color-text-3)', bg: 'var(--color-surface-2)', text: '未配置' },
  }
  const keyInfo = keyDisplay[currentKeyStatus] ?? keyDisplay.empty
  const maskedKey = apiKey ? `${apiKey.slice(0, 4)}******${apiKey.slice(-3)}` : ''

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
        <div className="text-[15px] font-semibold tracking-[-0.01em] mb-0.5">新生成任务</div>
        <div className="text-[12px] text-(--color-text-3)">配置参数，撰写提示词，最多生成 {model.maxBatchCount} 张。</div>
      </div>

      {/* API key card */}
      <Section
        label="API 密钥"
        right={
          <button type="button" onClick={onOpenApiKeys} className="chip ghost" style={{ height: 22, padding: '0 6px', fontSize: 11.5 }}>
            修改配置
          </button>
        }
      >
        <div className="card flex items-center gap-2.5 px-3 py-2">
          <Icon name="key" size={13} />
          <span className="text-[12.5px] font-medium">{model.provider === 'google' ? 'Gemini' : 'OpenAI'}</span>
          {maskedKey && <span className="mono text-[11px] text-(--color-text-3)">{maskedKey}</span>}
          <div className="flex-1" />
          <span
            className="tag"
            style={{ color: keyInfo.color, background: keyInfo.bg }}
          >
            {currentKeyStatus === 'valid' && <Icon name="check" size={10} strokeWidth={2} />}
            {currentKeyStatus === 'validating' && <span className="spinner" style={{ width: 9, height: 9, borderWidth: 1.2 }} />}
            {keyInfo.text}
          </span>
        </div>
      </Section>

      {/* MODEL segmented */}
      <Section
        label="模型"
        right={<span className="mono text-[11px] text-(--color-text-4)">{model.apiModel}</span>}
      >
        <div
          className="segmented"
          style={{
            ['--seg-count' as string]: MODEL_CONFIGS.length,
            ['--seg-index' as string]: Math.max(0, MODEL_CONFIGS.findIndex((m) => m.id === model.id)),
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
              {m.provider === 'google' ? (
                <span className="text-[11px]">🍌</span>
              ) : (
                <OpenAILogo />
              )}
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
        pixelLabel={model.provider === 'openai'
          ? (ratio, res) => openAISize(res, ratio).replace('x', '×')
          : undefined}
      />

      <div className="h-[18px] " />

      {/* Quality (OpenAI only) */}
      {model.provider === 'openai' && (
        <Section label="质量">
          <ChipGroup
            options={model.qualities}
            value={quality}
            onChange={onQualityChange}
            mono={false}
            columns={model.qualities.length}
          />
        </Section>
      )}

      {/* Reference images */}
      <div className="mb-[18px]">
        <ReferenceImageUpload
          images={referenceImages}
          maxTotal={maxRef}
          dragOver={dragOver}
          onAdd={onAddReferenceImages}
          onRemove={onRemoveReferenceImage}
        />
      </div>

      {/* Prompt */}
      <Section
        label="提示词"
        right={
          <div className="flex gap-0.5">
            <button type="button" onClick={handleHistoryUndo} disabled={!historyState.canUndo} title="撤销" className="icon-btn">
              <Icon name="undo" size={13} />
            </button>
            <button type="button" onClick={handleHistoryRedo} disabled={!historyState.canRedo} title="重做" className="icon-btn">
              <Icon name="redo" size={13} />
            </button>
          </div>
        }
      >
        <div className="prompt-wrap">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => { onPromptChange(e.target.value); pushHistory(e.target.value); autoResizeTextarea(e.target) }}
            placeholder="描述你想生成的图片…  例：一只在霓虹雨夜里啃香蕉的机械猫"
            rows={1}
            className="block w-full bg-transparent px-3 py-2.5 text-[13.5px] leading-[1.55] resize-none focus:outline-none"
          />
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-(--color-border) text-[11.5px] text-(--color-text-3)">
            <span className="mono text-[11px] text-(--color-text-4)">{prompt.length} 字</span>
            <div className="flex-1" />
            {prompt.length > 0 && (
              <button
                type="button"
                onClick={() => { onPromptChange(''); pushHistory(''); textareaRef.current?.focus() }}
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
      <Section
        label="数量"
        right={
          estimatedCost !== null && (
            <span className="mono text-[11px] text-(--color-text-3)">
              ≈ ${estimatedCost.toFixed(3)}
            </span>
          )
        }
      >
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
        <button
          type="button"
          onClick={isGenerating ? onCancel : () => onGenerate()}
          disabled={!isGenerating && !canGenerate}
          className={`cta w-full ${isGenerating ? 'danger' : ''}`}
        >
          {isGenerating ? (
            '取消生成'
          ) : (
            <>
              <Icon name="wand" size={13} strokeWidth={1.8} />
              <span>生成 {batchCount} 张</span>
              <span className="flex-1" />
              <span className="flex gap-0.5"><kbd>⌘</kbd><kbd>⏎</kbd></span>
            </>
          )}
        </button>
        {!isGenerating && !apiKey.trim() && (
          <div className="mt-1.5 text-[11px] text-(--color-text-4) text-center">
            请先配置 API Key
          </div>
        )}
      </div>

      {dragOver && (
        <div className="absolute inset-0 z-40 rounded-[8px] border-2 border-dashed pointer-events-none"
             style={{ borderColor: 'var(--color-accent)', background: 'var(--color-accent-wash)' }} />
      )}
    </div>
  )
}
