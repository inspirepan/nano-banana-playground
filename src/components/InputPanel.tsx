import { useState, useRef, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react'
import type { PersistedPromptMode, PlaygroundImage, PromptScheme } from '../lib/types'
import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { augmentPromptStream, REQUEST_TIMEOUT_MS } from '../lib/api'
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

// Filled sparkles — used on the 增强 affordance for extra weight
function SparklesFilled({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {/* main star: filled */}
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      {/* accent cross marks: keep as strokes (fill=none so they render as lines) */}
      <path d="M20 3v4" fill="none" />
      <path d="M22 5h-4" fill="none" />
      <path d="M4 17v2" fill="none" />
      <path d="M5 18H3" fill="none" />
    </svg>
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

// Labels for syntax highlighting in text editor, longest-first to avoid prefix conflicts
const HIGHLIGHT_LABELS = [
  '参考图说明', '画面中的文字', '画中文字', '编辑类型', '编辑请求',
  '目标场景', '目标风格', '保持不变', '构图', '风格', '光影', '色彩', '约束', '避免',
]

function renderHighlighted(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parts.push('\n')
    const line = lines[i]
    let found = false
    for (const label of HIGHLIGHT_LABELS) {
      const needle = `${label}：`
      if (line.startsWith(needle)) {
        const rest = line.slice(needle.length).replace(/^ /, '')
        parts.push(
          <span key={i}>
            <span className="rounded-[3px] px-[3px] font-medium" style={{ background: 'var(--color-accent-wash)', color: 'var(--color-accent)' }}>{label}</span>
            ：{rest}
          </span>
        )
        found = true
        break
      }
    }
    if (!found) parts.push(<span key={i}>{line}</span>)
  }
  return parts
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
  mode: PersistedPromptMode
  schemes: PromptScheme[]
  currentSchemeIndex: number
  originalPrompt: string | null
  referenceImages: PlaygroundImage[]
  generationState: GenerationState
  apiKey: string
  apiBaseUrl: string
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
  onModeChange: (v: PersistedPromptMode) => void
  onSchemesChange: (schemes: PromptScheme[]) => void
  onCurrentSchemeIndexChange: (v: number) => void
  onOriginalPromptChange: (p: string | null) => void
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
  onRemoveReferenceImage: (id: string) => void
  onGenerate: (prompts?: string[]) => void
  onCancel: () => void
  onDraftBatchOverride: (count: number | null, labels?: string[]) => void
  onDraftPreviewHover: (show: boolean) => void
  onDraftLabelsOverride: (labels: string[] | null) => void
}

export function InputPanel({
  model,
  resolution,
  aspectRatio,
  quality,
  batchCount,
  prompt,
  mode,
  schemes,
  currentSchemeIndex,
  originalPrompt,
  referenceImages,
  generationState,
  apiKey,
  apiBaseUrl,
  googleKeyStatus,
  openaiKeyStatus,
  onOpenApiKeys,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
  onQualityChange,
  onPromptChange,
  onBatchCountChange,
  onModeChange,
  onSchemesChange,
  onCurrentSchemeIndexChange,
  onOriginalPromptChange,
  onAddReferenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onGenerate,
  onCancel,
  onDraftBatchOverride,
  onDraftPreviewHover,
}: Props) {
  const isGenerating = generationState === 'generating'
  const maxRef = model.maxReferenceImages + model.maxCharacterImages
  const pricePerImage = getPricePerImage(model, resolution, aspectRatio, quality)
  const augmentModelLabel = model.provider === 'openai' ? 'GPT-5.4 mini' : 'Gemini 3 Flash'

  const [isAugmenting, setIsAugmenting] = useState(false)
  const hasPrompt = prompt.trim() !== ''

  const canGenerate = apiKey.trim() !== '' && hasPrompt && !isGenerating && !isAugmenting

  const [augmentError, setAugmentError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Typewriter animation state
  const [revealedLength, setRevealedLength] = useState<number | null>(null)
  const typewriterRef = useRef({ target: '', raf: 0, current: 0 })

  // --- Undo/redo history ---
  const historyRef = useRef({ entries: [prompt], index: 0 })
  const debounceRef = useRef<number>(0)
  const [, setHistoryTick] = useState(0)

  const canUndo = historyRef.current.index > 0
  const canRedo = historyRef.current.index < historyRef.current.entries.length - 1

  const pushHistory = useCallback((value: string) => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const h = historyRef.current
      if (h.entries[h.index] === value) return
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(value)
      h.index = h.entries.length - 1
      setHistoryTick((t) => t + 1)
    }, 500)
  }, [])

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
    setHistoryTick((t) => t + 1)
  }, [prompt, onPromptChange])

  const handleHistoryRedo = useCallback(() => {
    const h = historyRef.current
    if (h.index >= h.entries.length - 1) return
    h.index++
    onPromptChange(h.entries[h.index])
    setHistoryTick((t) => t + 1)
  }, [onPromptChange])

  const canAugment = apiKey.trim() !== '' && (hasPrompt || referenceImages.length > 0)

  useLayoutEffect(() => {
    if ((!isAugmenting || schemes.length > 0) && textareaRef.current) autoResizeTextarea(textareaRef.current)
  }, [prompt, isAugmenting, schemes.length, revealedLength])

  useEffect(() => {
    if (!isAugmenting) {
      cancelAnimationFrame(typewriterRef.current.raf)
      typewriterRef.current = { target: '', raf: 0, current: 0 }
      setRevealedLength(null)
      return
    }
    if (typewriterRef.current.target === prompt) return
    cancelAnimationFrame(typewriterRef.current.raf)
    const tw = { target: prompt, raf: 0, current: 0 }
    typewriterRef.current = tw
    const charsPerFrame = Math.max(3, Math.ceil(prompt.length / 100))
    const tick = () => {
      tw.current = Math.min(tw.current + charsPerFrame, tw.target.length)
      if (tw.current >= tw.target.length) {
        setRevealedLength(null)
      } else {
        setRevealedLength(tw.current)
        tw.raf = requestAnimationFrame(tick)
      }
    }
    setRevealedLength(0)
    tw.raf = requestAnimationFrame(tick)
  }, [isAugmenting, prompt])

  useEffect(() => () => { cancelAnimationFrame(typewriterRef.current.raf); window.clearTimeout(debounceRef.current) }, [])

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

  const displayPrompt = revealedLength !== null ? prompt.slice(0, revealedLength) : prompt
  const isTyping = revealedLength !== null && isAugmenting

  // --- Augment (streaming) ---
  const handleAugment = useCallback(async (useOriginal = false) => {
    if (!canAugment && !useOriginal) return
    const sourcePrompt = useOriginal && originalPrompt !== null ? originalPrompt : prompt
    if (!sourcePrompt.trim() && referenceImages.length === 0) return

    const effectivePrompt = sourcePrompt.trim() || '用户的原始提示词是空的，请你基于图片提供几个创意方案'

    if (!useOriginal) {
      onOriginalPromptChange(sourcePrompt)
    }

    setIsAugmenting(true)
    setAugmentError(null)
    onSchemesChange([])
    onCurrentSchemeIndexChange(0)

    cancelAnimationFrame(typewriterRef.current.raf)
    typewriterRef.current = { target: prompt, raf: 0, current: 0 }

    const controller = new AbortController()
    abortRef.current = controller
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])

    let gotSchemes = false
    let firstScheme = true
    try {
      await augmentPromptStream(model.provider, apiKey, effectivePrompt, referenceImages, (newSchemes, done) => {
        if (newSchemes.length > 0) {
          gotSchemes = true
          onSchemesChange(newSchemes)
          if (firstScheme) {
            firstScheme = false
            onCurrentSchemeIndexChange(0)
            setRevealedLength(0)
            onPromptChange(newSchemes[0].text)
            pushHistory(newSchemes[0].text)
          }
        }
        if (done) onModeChange('structured')
      }, signal, apiBaseUrl)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).name === 'TimeoutError'
          ? '请求超时（5min），请检查网络连接或代理配置后重试'
          : (e as Error).message
        setAugmentError(msg)
        onModeChange(gotSchemes ? 'structured' : (useOriginal ? 'structured' : 'text'))
      } else if (gotSchemes) {
        onModeChange('structured')
      }
    } finally {
      setIsAugmenting(false)
    }
  }, [model.provider, apiKey, apiBaseUrl, prompt, originalPrompt, referenceImages, canAugment, onPromptChange, onModeChange, onSchemesChange, onCurrentSchemeIndexChange, onOriginalPromptChange, pushHistory])

  const handleCancelAugment = useCallback(() => {
    abortRef.current?.abort()
    setIsAugmenting(false)
  }, [])

  const handleSelectScheme = useCallback((index: number) => {
    onCurrentSchemeIndexChange(index)
    if (schemes[index]) {
      onPromptChange(schemes[index].text)
      pushHistory(schemes[index].text)
    }
  }, [schemes, onPromptChange, onCurrentSchemeIndexChange, pushHistory])

  const handleGenerateAll = useCallback(() => {
    const prompts = schemes.map((s) => s.text)
    onGenerate(prompts)
  }, [schemes, onGenerate])

  const handleDiscardAugment = useCallback(() => {
    onOriginalPromptChange(null)
    onSchemesChange([])
    onModeChange('text')
  }, [onModeChange, onSchemesChange, onOriginalPromptChange])

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
  const keyDisplay: Record<string, { color: string; bg: string; border: string; text: string }> = {
    valid:      { color: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)', border: 'color-mix(in srgb, var(--color-success) 30%, var(--color-border))', text: '已验证' },
    validating: { color: 'var(--color-text-3)', bg: 'var(--color-surface-2)', border: 'var(--color-border)', text: '验证中' },
    invalid:    { color: 'var(--color-danger)', bg: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: 'color-mix(in srgb, var(--color-danger) 30%, var(--color-border))', text: '无效' },
    empty:      { color: 'var(--color-text-3)', bg: 'var(--color-surface-2)', border: 'var(--color-border)', text: '未配置' },
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
            管理
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
            style={{ color: keyInfo.color, background: keyInfo.bg, borderColor: keyInfo.border }}
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

      <div className="h-[18px]" />

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
            <button type="button" onClick={handleHistoryUndo} disabled={!canUndo} title="撤销" className="icon-btn">
              <Icon name="undo" size={13} />
            </button>
            <button type="button" onClick={handleHistoryRedo} disabled={!canRedo} title="重做" className="icon-btn">
              <Icon name="redo" size={13} />
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          {/* Augment card */}
          {schemes.length > 0 && (mode === 'structured' || isAugmenting) && (
            <div
              className="fade-in rounded-[8px] px-3 py-2.5"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-accent-soft)' }}
            >
              <div className="flex items-center gap-1.5 mb-2 min-w-0">
                <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}><SparklesFilled size={12} /></span>
                <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--color-accent)' }}>
                  {isAugmenting ? `已生成 ${schemes.length} 个方案…` : `${schemes.length} 个方案`}
                </span>
                <span className="text-[11px] text-(--color-text-4) whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                  · {augmentModelLabel}
                </span>
                <div className="flex-1" />
                {isAugmenting ? (
                  <button type="button" onClick={handleCancelAugment} className="bg-transparent border-0 text-(--color-text-3) p-0 whitespace-nowrap text-[11.5px] shrink-0 hover:text-(--color-text) transition-colors">
                    取消
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAugment(true)}
                      disabled={originalPrompt === null}
                      className="bg-transparent border-0 text-(--color-text-3) p-0 whitespace-nowrap text-[11.5px] shrink-0 hover:text-(--color-text) transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      重新增强
                    </button>
                    {schemes.length > 1 && (
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => { onDraftBatchOverride(null); handleGenerateAll() }}
                        onMouseEnter={() => { if (!isGenerating) { onDraftBatchOverride(schemes.length, schemes.map((s) => s.title)); onDraftPreviewHover(true) } }}
                        onMouseLeave={() => { onDraftBatchOverride(null); onDraftPreviewHover(false) }}
                        className="bg-transparent border-0 text-(--color-text-3) p-0 whitespace-nowrap text-[11.5px] shrink-0 hover:text-(--color-text) transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        各生成一张
                      </button>
                    )}
                    <button type="button" onClick={handleDiscardAugment} className="bg-transparent border-0 text-(--color-text-4) p-0 shrink-0 hover:text-(--color-text) transition-colors" aria-label="退出增强">
                      <Icon name="close" size={11} />
                    </button>
                  </>
                )}
              </div>

              {/* Scheme chips */}
              {schemes.length >= 1 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {schemes.map((scheme, i) => {
                    const isSelected = i === currentSchemeIndex
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectScheme(i)}
                        disabled={isAugmenting}
                        className={`chip ${isSelected ? 'accent-active' : ''}`}
                        style={{ height: 24, fontSize: 11.5, padding: '0 8px' }}
                        data-active={isSelected}
                      >
                        {scheme.title}
                      </button>
                    )
                  })}
                  {isAugmenting && <span className="spinner" style={{ marginLeft: 4 }} />}
                </div>
              )}

              {!isAugmenting && schemes[currentSchemeIndex]?.description && (
                <div className="text-[12px] leading-[1.55] text-(--color-text-2)">
                  {schemes[currentSchemeIndex].description}
                </div>
              )}
            </div>
          )}

          {isAugmenting && schemes.length === 0 && (
            <div className="card p-4 flex flex-col items-center gap-2">
              <span className="spinner" />
              <div className="text-[12px] text-(--color-text-2)">
                <span className="font-medium" style={{ color: 'var(--color-accent)' }}>{augmentModelLabel}</span> 正在增强提示词
              </div>
              <button type="button" onClick={handleCancelAugment} className="bg-transparent border-0 text-[11.5px] text-(--color-text-3) hover:text-(--color-text) transition-colors">
                取消
              </button>
            </div>
          )}

          {/* Textarea */}
          <div className="prompt-wrap">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 px-3 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap break-words pointer-events-none"
                style={{ color: 'var(--color-text)', fontFamily: 'inherit' }}
              >
                {prompt
                  ? <>{renderHighlighted(displayPrompt)}{isTyping && <span style={{ color: 'var(--color-accent)', opacity: 0.7 }}>|</span>}</>
                  : <span className="text-(--color-text-4)">描述你想生成的图片…  例：一只在霓虹雨夜里啃香蕉的机械猫</span>
                }
              </div>
              <textarea
                ref={textareaRef}
                value={displayPrompt}
                onChange={(e) => { onPromptChange(e.target.value); pushHistory(e.target.value); autoResizeTextarea(e.target) }}
                readOnly={isAugmenting}
                rows={1}
                style={{ caretColor: 'var(--color-text)', color: 'transparent' }}
                className="relative box-border w-full bg-transparent px-3 py-2.5 text-[13.5px] leading-[1.55] resize-none focus:outline-none block"
              />
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-(--color-border) text-[11.5px] text-(--color-text-3)">
              <span className="mono text-[11px] text-(--color-text-4)">{prompt.length} 字</span>
              <div className="flex-1" />
              {mode === 'text' && !isAugmenting && canAugment && (
                <button
                  type="button"
                  onClick={() => handleAugment(false)}
                  className="bg-transparent border-0 p-0 inline-flex items-center gap-1 text-[11.5px] font-medium hover:brightness-110 transition-all"
                  style={{ color: 'var(--color-accent)' }}
                  title={`使用 ${augmentModelLabel} 增强提示词`}
                >
                  <SparklesFilled size={12} /> 增强
                </button>
              )}
            </div>
          </div>

          {augmentError && <div className="text-[11.5px] text-(--color-danger)">{augmentError}</div>}
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
