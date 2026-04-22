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
import type { Provider } from '../config/models'

function ApiKeysButton({
  currentProvider,
  currentStatus,
  googleStatus,
  openaiStatus,
  onOpen,
}: {
  currentProvider: Provider
  currentStatus: ApiKeyStatus
  googleStatus: ApiKeyStatus
  openaiStatus: ApiKeyStatus
  onOpen: () => void
}) {
  const needsAttention = currentStatus !== 'valid' && currentStatus !== 'validating'
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left
        ${needsAttention
          ? 'bg-primary-dim text-primary hover:bg-primary/15 active:bg-primary/20'
          : 'bg-surface-container text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}
    >
      <Icon name="key" className="h-4 w-4" />
      <span className="text-base font-medium">API Keys</span>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <KeyBadge label="Gemini" status={googleStatus} dim={currentProvider !== 'google'} />
        <KeyBadge label="OpenAI" status={openaiStatus} dim={currentProvider !== 'openai'} />
      </div>
    </button>
  )
}

function getModelButtonLabel(model: ModelConfig) {
  if (model.provider === 'google') {
    return model.name.replace(/^Nano\s+/, '')
  }

  return model.name
}

function KeyBadge({ label, status, dim }: { label: string; status: ApiKeyStatus; dim: boolean }) {
  const isValid = status === 'valid'
  const isInvalid = status === 'invalid'
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${dim ? 'opacity-60' : ''}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isValid ? 'bg-success' : isInvalid ? 'bg-error' : 'bg-on-surface-variant/40'
        }`}
      />
      <span className="text-on-surface-variant">{label}</span>
    </span>
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
          <span key={i}><span className="text-tertiary bg-tertiary-dim rounded px-0.5">{label}</span>：{rest}</span>
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
  apiKeyStatus: ApiKeyStatus
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
  apiKeyStatus,
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
  onDraftLabelsOverride,
}: Props) {
  const isGenerating = generationState === 'generating'
  const maxRef = model.maxReferenceImages + model.maxCharacterImages

  const pricePerImage = getPricePerImage(model, resolution, aspectRatio, quality)
  const augmentModelLabel = model.provider === 'openai' ? 'GPT-5.4 mini' : 'Gemini 3 Flash'

  const [isAugmenting, setIsAugmenting] = useState(false)
  const [schemesCollapsed, setSchemesCollapsed] = useState(false)
  const hasPrompt = prompt.trim() !== ''

  const canGenerate = apiKey.trim() !== '' && hasPrompt && !isGenerating && !isAugmenting

  const [augmentError, setAugmentError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Typewriter animation state
  const [revealedLength, setRevealedLength] = useState<number | null>(null)
  const typewriterRef = useRef({ target: '', raf: 0, current: 0 })

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ text: string; timer: number } | null>(null)

  // --- Undo/redo history ---
  const historyRef = useRef({ entries: [prompt], index: 0 })
  const debounceRef = useRef<number>(0)
  const [, setHistoryTick] = useState(0)

  const canUndo = historyRef.current.index > 0
  const canRedo = historyRef.current.index < historyRef.current.entries.length - 1

  // Debounced push to undo history — called from prompt-changing entry points
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

  // Resize before paint so height is always correct when content changes (including after augment)
  useLayoutEffect(() => {
    if ((!isAugmenting || schemes.length > 0) && textareaRef.current) autoResizeTextarea(textareaRef.current)
  }, [prompt, isAugmenting, schemes.length, revealedLength])

  // Typewriter: animate text reveal during augmentation
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

  // Cmd+Enter shortcut for generate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault()
        if (isGenerating) { onCancel() }
        else if (canGenerate) { if (schemes.length > 0) setSchemesCollapsed(true); onGenerate() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isGenerating, canGenerate, schemes.length, onCancel, onGenerate])

  const displayPrompt = revealedLength !== null ? prompt.slice(0, revealedLength) : prompt
  const isTyping = revealedLength !== null && isAugmenting

  // --- Augment (streaming) ---
  const handleAugment = useCallback(async (useOriginal = false) => {
    if (!canAugment && !useOriginal) return
    const sourcePrompt = useOriginal && originalPrompt !== null ? originalPrompt : prompt
    if (!sourcePrompt.trim() && referenceImages.length === 0) return

    // When prompt is empty but images are present, hint the model to work from images
    const effectivePrompt = sourcePrompt.trim() || '用户的原始提示词是空的，请你基于图片提供几个创意方案'

    if (!useOriginal) {
      onOriginalPromptChange(sourcePrompt)
    }

    setIsAugmenting(true)
    setAugmentError(null)
    setSchemesCollapsed(false)
    onSchemesChange([])
    onCurrentSchemeIndexChange(0)

    // Seed typewriter target so the effect won't trigger on the existing prompt
    cancelAnimationFrame(typewriterRef.current.raf)
    typewriterRef.current = { target: prompt, raf: 0, current: 0 }

    const controller = new AbortController()
    abortRef.current = controller
    // 5min timeout — thinking + streaming can take a while
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])

    let gotSchemes = false
    let firstScheme = true
    try {
      await augmentPromptStream(model.provider, apiKey, effectivePrompt, referenceImages, (schemes, done) => {
        if (schemes.length > 0) {
          gotSchemes = true
          onSchemesChange(schemes)
          if (firstScheme) {
            firstScheme = false
            onCurrentSchemeIndexChange(0)
            setRevealedLength(0)
            onPromptChange(schemes[0].text)
            pushHistory(schemes[0].text)
          }
        }
        if (done) {
          onModeChange('structured')
        }
      }, signal)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).name === 'TimeoutError'
          ? '请求超时（5min），请检查网络连接或代理配置后重试'
          : (e as Error).message
        setAugmentError(msg)
        onModeChange(gotSchemes ? 'structured' : (useOriginal ? 'structured' : 'text'))
      } else if (gotSchemes) {
        // User cancelled but we have partial results — keep them
        onModeChange('structured')
      }
    } finally {
      setIsAugmenting(false)
    }
  }, [model.provider, apiKey, prompt, originalPrompt, referenceImages, canAugment, onPromptChange, onModeChange, onSchemesChange, onCurrentSchemeIndexChange, onOriginalPromptChange, pushHistory])

  const handleCancelAugment = useCallback(() => {
    abortRef.current?.abort()
    setIsAugmenting(false)
  }, [])

  // --- Scheme management ---
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
    setSchemesCollapsed(false)
  }, [onModeChange, onSchemesChange, onOriginalPromptChange])

  // --- Clear / Undo toast ---
  const handleClear = useCallback(() => {
    const saved = prompt
    onPromptChange('')
    const timer = window.setTimeout(() => setUndoToast(null), 5000)
    setUndoToast((prev) => {
      if (prev) window.clearTimeout(prev.timer)
      return { text: saved, timer }
    })
  }, [prompt, onPromptChange])

  const handleUndo = useCallback(() => {
    if (!undoToast) return
    onPromptChange(undoToast.text)
    window.clearTimeout(undoToast.timer)
    setUndoToast(null)
  }, [undoToast, onPromptChange])

  const handleDismissToast = useCallback(() => {
    if (undoToast) window.clearTimeout(undoToast.timer)
    setUndoToast(null)
  }, [undoToast])

  // --- Drag-and-drop for reference images (panel-wide) ---
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

    // Check for playground image data (dragged from history)
    const imageJson = e.dataTransfer.getData('application/x-playground-image')
    if (imageJson) {
      try {
        const img: PlaygroundImage = JSON.parse(imageJson)
        onAddReferenceImage(img)
        return
      } catch { /* fall through to file handling */ }
    }

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    )
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

  // --- Cost estimate ---
  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null

  return (
    <div ref={panelRef}
      onDragEnter={handlePanelDragEnter}
      onDragLeave={handlePanelDragLeave}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
      onPaste={handlePanelPaste}
      className="w-full flex flex-col gap-4 px-2 py-4 md:px-4 relative">

      {/* API Keys trigger */}
      <ApiKeysButton
        currentProvider={model.provider}
        currentStatus={apiKeyStatus}
        googleStatus={googleKeyStatus}
        openaiStatus={openaiKeyStatus}
        onOpen={onOpenApiKeys}
      />

      {/* Model */}
      <div>
        <label className="mb-3 block text-base font-medium text-on-surface-variant">模型</label>
        <div className="grid grid-cols-3 gap-2">
          {MODEL_CONFIGS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSwitchModel(m.id)}
              title={m.name}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2.5 py-3 text-sm font-medium transition-colors
                ${model.id === m.id
                  ? 'bg-primary-dim text-primary ring-1 ring-primary/18 hover:bg-primary/15 active:bg-primary/20'
                  : 'bg-surface-container text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'
                }`}
            >
              {m.provider === 'google' && <span className="shrink-0">🍌</span>}
              <span className="min-w-0 truncate whitespace-nowrap">{getModelButtonLabel(m)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Resolution */}
      <ChipGroup
        label="分辨率"
        options={model.resolutions}
        value={resolution}
        onChange={onResolutionChange}
      />

      {/* Aspect Ratio */}
      <AspectRatioSelector
        options={model.aspectRatios}
        value={aspectRatio}
        resolution={resolution}
        onChange={onAspectRatioChange}
        pixelLabel={model.provider === 'openai'
          ? (ratio, res) => openAISize(res, ratio).replace('x', '×')
          : undefined}
      />

      {/* Quality (OpenAI only) */}
      {model.provider === 'openai' && (
        <ChipGroup
          label="质量"
          options={model.qualities}
          value={quality}
          onChange={onQualityChange}
        />
      )}

      {/* Reference Images */}
      <ReferenceImageUpload
        images={referenceImages}
        maxTotal={maxRef}
        dragOver={dragOver}
        onAdd={onAddReferenceImages}
        onRemove={onRemoveReferenceImage}
      />

      {/* Prompt section */}
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 min-h-[32px] shrink-0">
          <label className="text-base font-medium text-on-surface-variant">提示词</label>
        </div>

        {/* Prompt content */}
        <div className="flex flex-col">

        {isAugmenting && schemes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 bg-surface-container rounded-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">正在使用 <span className="text-primary">{augmentModelLabel}</span> 增强提示词...</p>
            <button type="button" onClick={handleCancelAugment}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">取消</button>
          </div>
        )}

        {(!isAugmenting || schemes.length > 0) && (
          <>
            {/* Augment result card */}
            {schemes.length > 0 && (mode === 'structured' || isAugmenting) && (
              <div className="mb-4 rounded-2xl border border-outline-variant/40 bg-surface-container/50 px-4 py-3 flex flex-col">
                {/* Header row — always visible, content swaps instantly */}
                <div className="flex items-center gap-2 min-h-[28px]">
                  {schemesCollapsed && !isAugmenting ? (
                    <>
                      <span className="rounded-lg bg-tertiary-dim px-3 py-1.5 text-base font-medium text-tertiary">
                        {schemes[currentSchemeIndex]?.title}
                      </span>
                      <button type="button" onClick={() => setSchemesCollapsed(false)}
                        className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors">
                        切换方案
                      </button>
                      <div className="flex-1" />
                      <div className="relative group/close">
                        <button type="button" onClick={handleDiscardAugment}
                          className="flex items-center justify-center w-4 h-4 translate-y-px rounded-full text-on-surface-variant/50 hover:text-on-surface transition-colors">
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap rounded bg-on-surface px-2 py-1 text-sm text-surface opacity-0 transition-opacity delay-500 duration-150 group-hover/close:opacity-100 z-50">
                          退出增强模式
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 w-full">
                      {isAugmenting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-tertiary border-t-transparent rounded-full animate-spin shrink-0" />
                        <p className="text-base text-on-surface-variant">已生成 {schemes.length} 个方案...</p>
                        </>
                      ) : (
                        <p className="text-base text-on-surface-variant">
                          {schemes.length > 1 ? `${schemes.length} 个增强方案` : 'AI 已增强提示词'}
                        </p>
                      )}
                      <div className="flex-1" />
                      {isAugmenting ? (
                        <button type="button" onClick={handleCancelAugment}
                          className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors">
                          取消
                        </button>
                      ) : (
                        <>
                          <div className="relative group/reaugment">
                            <button type="button" onClick={() => handleAugment(true)} disabled={originalPrompt === null}
                              className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-40 disabled:pointer-events-none">
                              重新增强
                            </button>
                            <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap rounded bg-on-surface px-2 py-1 text-sm text-surface opacity-0 transition-opacity delay-500 duration-150 group-hover/reaugment:opacity-100 group-hover/reaugment:delay-500 z-50">
                              基于原始提示词重新增强
                            </div>
                          </div>
                          {schemes.length > 1 && (
                            <div className="relative group/gen-all">
                              <button type="button" disabled={isGenerating}
                                onClick={() => { onDraftBatchOverride(null); handleGenerateAll() }}
                                onMouseEnter={() => { if (!isGenerating) { onDraftBatchOverride(schemes.length, schemes.map((s) => s.title)); onDraftPreviewHover(true) } }}
                                onMouseLeave={() => { onDraftBatchOverride(null); onDraftPreviewHover(false) }}
                                className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-40 disabled:pointer-events-none">
                                各生成一张
                              </button>
                              <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap
                                              bg-on-surface text-surface text-sm px-2 py-1 rounded
                                              opacity-0 group-hover/gen-all:opacity-100 transition-opacity duration-150 delay-500 z-50">
                                每个方案各生成 1 张，共 {schemes.length} 张
                              </div>
                            </div>
                          )}
                          <div className="relative group/discard">
                            <button type="button" onClick={handleDiscardAugment}
                              className="flex items-center justify-center w-4 h-4 translate-y-px rounded-full text-on-surface-variant/50 hover:text-on-surface transition-colors">
                              <Icon name="close" className="h-3.5 w-3.5" />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1 pointer-events-none whitespace-nowrap rounded bg-on-surface px-2 py-1 text-sm text-surface opacity-0 transition-opacity delay-500 duration-150 group-hover/discard:opacity-100 group-hover/discard:delay-500 z-50">
                              退出增强模式
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Animated body: chips + description */}
                <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${schemesCollapsed && !isAugmenting ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-3 pt-3">
                      {/* Scheme chips */}
                      {schemes.length >= 1 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {schemes.map((scheme, i) => {
                            const isSelected = i === currentSchemeIndex
                            return (
                              <button key={i} type="button" onClick={() => handleSelectScheme(i)}
                                disabled={isAugmenting}
                                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                                  ${isSelected
                                    ? 'bg-tertiary-dim text-tertiary hover:bg-tertiary/15 active:bg-tertiary/20'
                                    : 'bg-surface text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'
                                  } ${isAugmenting ? 'pointer-events-none' : ''}`}>
                                {scheme.title}
                              </button>
                            )
                          })}
                          {isAugmenting && (
                            <div className="w-3 h-3 border-[1.5px] border-on-surface-variant/30 border-t-on-surface-variant/70 rounded-full animate-spin" />
                          )}
                        </div>
                      )}
                      {/* Selected scheme description */}
                      {!isAugmenting && schemes[currentSchemeIndex]?.description && (
                        <p className="px-3 text-base leading-relaxed text-on-surface-variant">
                          {schemes[currentSchemeIndex].description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Text editor with label highlighting */}
            <div className="relative">
              <div className="relative rounded-2xl bg-surface-container hover:bg-surface-container-high focus-within:bg-surface-container-high transition-colors min-h-[120px]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 overflow-hidden rounded-2xl px-4 py-4 pb-12 text-base whitespace-pre-wrap break-words text-on-surface pointer-events-none"
                >
                  {prompt
                    ? <>{renderHighlighted(displayPrompt)}{isTyping && <span className="text-tertiary/70">|</span>}</>
                    : <span className="text-on-surface-variant/50">描述你想生成的图片...</span>
                  }
                </div>
                <textarea ref={textareaRef} value={displayPrompt}
                  onChange={(e) => { onPromptChange(e.target.value); pushHistory(e.target.value); autoResizeTextarea(e.target) }}
                  readOnly={isAugmenting}
                  rows={1}
                  style={{ caretColor: 'var(--color-on-surface)' }}
                  className="relative box-border w-full overflow-hidden bg-transparent px-4 py-4 pb-12 text-base text-transparent resize-none focus:outline-none" />
              </div>
              <div className="absolute left-4 right-4 bottom-3 flex items-center gap-3">
                <button type="button" onClick={handleHistoryUndo} disabled={!canUndo} title="撤销"
                  className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-30 disabled:pointer-events-none">
                  撤销
                </button>
                <button type="button" onClick={handleHistoryRedo} disabled={!canRedo} title="重做"
                  className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-30 disabled:pointer-events-none">
                  重做
                </button>
                <button type="button" onClick={handleClear} disabled={!hasPrompt}
                  className={`text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:pointer-events-none ${hasPrompt ? '' : 'invisible'}`}>
                  清空
                </button>
                <div className="flex-1" />
                {mode === 'text' && !isAugmenting && (
                  <div className="relative group/augment">
                    <button type="button" onClick={() => handleAugment(false)} disabled={!canAugment}
                      className={`text-sm text-tertiary hover:text-tertiary/80 transition-colors disabled:pointer-events-none ${canAugment ? '' : 'invisible'}`}>
                      增强
                    </button>
                    <div className={`absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap rounded bg-on-surface px-2 py-1 text-sm text-surface transition-opacity delay-500 duration-150 group-hover/augment:delay-500 z-50 ${canAugment ? 'opacity-0 group-hover/augment:opacity-100' : 'opacity-0'}`}>
                      使用 {augmentModelLabel} 增强提示词
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {augmentError && <p className="mt-2 text-sm text-error">{augmentError}</p>}
        </div>{/* end prompt content */}
      </div>{/* end prompt section */}

      {/* Batch count + generate button + cost */}
      <div className="flex flex-col gap-4">
        {/* Batch count */}
        <div>
          <label className="mb-3 block text-base font-medium text-on-surface-variant">数量</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => onBatchCountChange(n)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium tabular-nums transition-colors
                  ${batchCount === n ? 'bg-primary-dim text-primary font-medium hover:bg-primary/15 active:bg-primary/20' : 'bg-surface-container text-on-surface font-medium hover:bg-on-surface/8 active:bg-on-surface/12'}`}>
                x{n}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div
          className="relative group/btn"
          onMouseEnter={() => {
            if (!canGenerate) return
            onDraftPreviewHover(true)
            if (mode === 'structured' && schemes[currentSchemeIndex]) {
              const title = schemes[currentSchemeIndex].title
              onDraftLabelsOverride(Array.from({ length: batchCount }, () => title))
            } else if (mode === 'text' && prompt.trim()) {
              const firstLine = prompt.trimStart().split('\n')[0]
              const short = firstLine.length > 10 ? firstLine.slice(0, 10) + '…' : firstLine
              onDraftLabelsOverride(Array.from({ length: batchCount }, () => short))
            }
          }}
          onMouseLeave={() => { onDraftPreviewHover(false); onDraftLabelsOverride(null) }}
        >
          <button type="button"
            onClick={isGenerating ? onCancel : () => { if (schemes.length > 0) setSchemesCollapsed(true); onGenerate() }}
            disabled={!isGenerating && !canGenerate}
            className={`w-full py-3 text-base font-medium rounded-full transition-colors
              ${isGenerating ? 'bg-error text-on-primary hover:bg-error/90 active:bg-error/80'
                : canGenerate ? 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary/80'
                : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'}`}>
            {isGenerating ? '取消' : <>
              <span>生成</span>
              <span className={`inline-flex items-center ml-2 ${canGenerate ? 'text-on-primary/50' : 'text-on-surface-variant/30'}`} aria-hidden="true">
                <span className="inline-flex whitespace-pre text-sm leading-none">
                  <kbd className="inline-flex font-sans"><span className="min-w-[1em] text-center">⌘</span></kbd> <kbd className="inline-flex font-sans"><span className="min-w-[1em] text-center">⏎</span></kbd>
                </span>
              </span>
            </>}
          </button>
          {!isGenerating && !apiKey.trim() && (
            <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-on-surface px-3 py-2 text-sm text-surface pointer-events-none opacity-0 transition-opacity group-hover/btn:opacity-100">
              请先配置 API Key
            </div>
          )}
        </div>

        {/* Cost estimate */}
        {estimatedCost !== null && (
          <p className="-mt-2 text-center text-sm text-on-surface-variant/60">
            预估费用约 ${estimatedCost.toFixed(3)}
            <span className="ml-1 opacity-70">({batchCount} 张 x ${pricePerImage!.toFixed(3)})</span>
          </p>
        )}
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-40 rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 pointer-events-none" />
      )}

      {/* Undo snackbar */}
      {undoToast && (
        <div className="fixed bottom-6 inset-x-0 z-50 mx-auto flex w-fit items-center gap-2 rounded bg-on-surface pl-4 pr-2 py-3 text-base text-surface shadow-lg animate-[slideUp_200ms_ease-out]">
          <span>提示词已清空</span>
          <button type="button" onClick={handleUndo}
            className="rounded-full px-3 py-1 text-base font-medium text-inverse-primary transition-colors hover:bg-surface/10 active:bg-surface/15">撤销</button>
          <button type="button" onClick={handleDismissToast} className="flex items-center justify-center p-1 rounded-full hover:bg-surface/10 transition-colors">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
