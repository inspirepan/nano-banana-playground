import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import type { PersistedPromptMode, PlaygroundImage, PromptMode, PromptScheme } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { augmentPrompt } from '../lib/api'
import { ReferenceImageUpload } from './ReferenceImageUpload'

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
          <span key={i}><span className="rounded bg-tertiary-dim text-tertiary">{label}</span>：{rest}</span>
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
const TEXTAREA_BOTTOM_PAD = 36

function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight + TEXTAREA_BOTTOM_PAD, TEXTAREA_MIN_HEIGHT)}px`
}

type Props = {
  model: ModelConfig
  resolution: string
  batchCount: number
  prompt: string
  mode: PersistedPromptMode
  schemes: PromptScheme[]
  currentSchemeIndex: number
  originalPrompt: string | null
  referenceImages: PlaygroundImage[]
  generationState: GenerationState
  apiKey: string
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

export function PromptPanel({
  model,
  resolution,
  batchCount,
  prompt,
  mode,
  schemes,
  currentSchemeIndex,
  originalPrompt,
  referenceImages,
  generationState,
  apiKey,
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

  const pricePerImage = model.imagePriceByResolution[resolution]

  const [isAugmenting, setIsAugmenting] = useState(false)
  const currentMode: PromptMode = isAugmenting ? 'augmenting' : mode

  const canGenerate = apiKey.trim() !== '' && prompt.trim() !== '' && !isGenerating && currentMode !== 'augmenting'

  const [augmentError, setAugmentError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ text: string; timer: number } | null>(null)

  // --- Undo/redo history ---
  const historyRef = useRef({ entries: [prompt], index: 0 })
  const debounceRef = useRef<number>(0)
  const navigatingRef = useRef(false)
  const [, setHistoryTick] = useState(0)

  const canUndo = historyRef.current.index > 0
  const canRedo = historyRef.current.index < historyRef.current.entries.length - 1

  useEffect(() => {
    if (navigatingRef.current) { navigatingRef.current = false; return }
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const h = historyRef.current
      if (h.entries[h.index] === prompt) return
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(prompt)
      h.index = h.entries.length - 1
      setHistoryTick((t) => t + 1)
    }, 500)
    return () => window.clearTimeout(debounceRef.current)
  }, [prompt])

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
    navigatingRef.current = true
    onPromptChange(h.entries[h.index])
    setHistoryTick((t) => t + 1)
  }, [prompt, onPromptChange])

  const handleHistoryRedo = useCallback(() => {
    const h = historyRef.current
    if (h.index >= h.entries.length - 1) return
    h.index++
    navigatingRef.current = true
    onPromptChange(h.entries[h.index])
    setHistoryTick((t) => t + 1)
  }, [onPromptChange])

  const canAugment = apiKey.trim() !== '' && prompt.trim() !== ''

  useEffect(() => {
    if (currentMode !== 'augmenting' && textareaRef.current) autoResizeTextarea(textareaRef.current)
  }, [prompt, currentMode])

  // --- Augment ---
  const handleAugment = useCallback(async (useOriginal = false) => {
    if (!canAugment && !useOriginal) return
    const sourcePrompt = useOriginal && originalPrompt ? originalPrompt : prompt
    if (!sourcePrompt.trim()) return

    if (!useOriginal) {
      onOriginalPromptChange(sourcePrompt)
    }

    setIsAugmenting(true)
    setAugmentError(null)

    const controller = new AbortController()
    abortRef.current = controller
    // 30s timeout — handles cases where API is unreachable (e.g. no proxy)
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)])

    try {
      const result = await augmentPrompt(apiKey, sourcePrompt, referenceImages, signal)
      onSchemesChange(result)
      onCurrentSchemeIndexChange(0)
      onPromptChange(result[0].text)
      onModeChange('structured')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).name === 'TimeoutError'
          ? '请求超时（30s），请检查网络连接或代理配置后重试'
          : (e as Error).message
        setAugmentError(msg)
        onModeChange(useOriginal ? 'structured' : 'text')
      }
    } finally {
      setIsAugmenting(false)
    }
  }, [apiKey, prompt, originalPrompt, referenceImages, canAugment, onPromptChange, onModeChange, onSchemesChange, onCurrentSchemeIndexChange, onOriginalPromptChange])

  const handleCancelAugment = useCallback(() => {
    abortRef.current?.abort()
    setIsAugmenting(false)
  }, [])

  // --- Scheme management ---
  const handleSelectScheme = useCallback((index: number) => {
    // Save current text back to current scheme before switching
    const next = [...schemes]
    next[currentSchemeIndex] = { ...next[currentSchemeIndex], text: prompt }
    onSchemesChange(next)
    onCurrentSchemeIndexChange(index)
    if (next[index]) onPromptChange(next[index].text)
  }, [schemes, prompt, currentSchemeIndex, onPromptChange, onCurrentSchemeIndexChange, onSchemesChange])

  const handleGenerateAll = useCallback(() => {
    const prompts = schemes.map((s, i) => i === currentSchemeIndex ? prompt : s.text)
    onGenerate(prompts)
  }, [schemes, prompt, currentSchemeIndex, onGenerate])

  const handleDiscardAugment = useCallback(() => {
    if (originalPrompt !== null) onPromptChange(originalPrompt)
    onOriginalPromptChange(null)
    onSchemesChange([])
    onModeChange('text')
  }, [originalPrompt, onPromptChange, onModeChange, onSchemesChange, onOriginalPromptChange])

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

  // --- Cost estimate ---
  const estimatedCost = pricePerImage !== undefined ? pricePerImage * batchCount : null

  return (
    <div className="w-full md:flex-1 md:shrink-0 md:min-w-[360px] flex flex-col py-4 md:h-full md:overflow-y-auto">
      {/* Reference Images */}
      <div className="shrink-0">
        <ReferenceImageUpload
          images={referenceImages}
          maxTotal={maxRef}
          onAdd={onAddReferenceImages}
          onAddImage={onAddReferenceImage}
          onRemove={onRemoveReferenceImage}
        />
      </div>

      {/* Prompt section */}
      <div className="mt-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 min-h-[28px] shrink-0">
          <label className="text-xs font-medium text-on-surface-variant">提示词</label>
          <div className="flex items-center gap-2">
            {currentMode === 'structured' && (
              <>
                <div className="relative group/reaugment">
                  <button type="button" onClick={() => handleAugment(true)} disabled={!originalPrompt}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-tertiary-dim text-tertiary hover:bg-tertiary hover:text-on-tertiary active:opacity-90 disabled:opacity-40 disabled:pointer-events-none">
                    <span className="material-symbols-rounded text-sm">refresh</span>
                    重新润色
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/reaugment:opacity-100 transition-opacity duration-150 delay-500 group-hover/reaugment:delay-500 z-50">
                    基于原始提示词重新润色
                  </div>
                </div>
                {originalPrompt !== null && (
                  <div className="relative group/discard">
                    <button type="button" onClick={handleDiscardAugment}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-error-dim text-error hover:bg-error hover:text-on-primary active:opacity-90">
                      <span className="material-symbols-rounded text-sm">undo</span>
                      撤销润色
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/discard:opacity-100 transition-opacity duration-150 delay-500 group-hover/discard:delay-500 z-50">
                      恢复原始提示词
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Prompt content */}
        <div className="flex flex-col">

        {currentMode === 'augmenting' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 bg-surface-container rounded-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-on-surface-variant">正在润色提示词...
              <span className="opacity-50 ml-1">Gemini 3 Flash</span>
            </p>
            <button type="button" onClick={handleCancelAugment}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">取消</button>
          </div>
        )}

        {currentMode !== 'augmenting' && (
          <>
            {/* Scheme chips - only for multiple schemes */}
            {currentMode === 'structured' && schemes.length > 1 && (
              <div className="mb-3 flex flex-col gap-1.5">
                <p className="text-2xs text-on-surface-variant leading-snug ml-1">
                  AI 生成了 {schemes.length} 个创意方案，选择查看或一键全部生成
                </p>
                {/* Chips row: scheme chips + generate-all */}
                <div className="flex flex-wrap items-center gap-2">
                  {schemes.map((scheme, i) => {
                    const isSelected = i === currentSchemeIndex
                    return (
                      <div key={i} className="relative group">
                        <button type="button" onClick={() => handleSelectScheme(i)}
                          className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors
                            ${isSelected
                              ? 'bg-primary-dim text-primary hover:bg-primary/15 active:bg-primary/20'
                              : 'bg-surface-container text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'
                            }`}>
                          {scheme.title}
                        </button>
                        {scheme.description && (
                          <div className="absolute bottom-full left-0 mb-2 w-48
                                          pointer-events-none bg-on-surface text-surface text-xs
                                          px-2 py-1 rounded leading-snug
                                          opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-500 z-50">
                            {scheme.description}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div className="relative group/gen-all">
                    <button type="button" disabled={isGenerating}
                      onClick={() => { onDraftBatchOverride(null); handleGenerateAll() }}
                      onMouseEnter={() => { if (!isGenerating) { onDraftBatchOverride(schemes.length, schemes.map((s) => s.title)); onDraftPreviewHover(true) } }}
                      onMouseLeave={() => { onDraftBatchOverride(null); onDraftPreviewHover(false) }}
                      className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-full transition-colors
                                 font-medium bg-tertiary-dim text-tertiary hover:bg-tertiary hover:text-on-tertiary active:opacity-90
                                 disabled:opacity-40 disabled:pointer-events-none">
                      各生成一张
                    </button>
                    <div className="absolute bottom-full left-0 mb-2 pointer-events-none whitespace-nowrap
                                    bg-on-surface text-surface text-xs px-2 py-1 rounded
                                    opacity-0 group-hover/gen-all:opacity-100 transition-opacity duration-150 delay-500 z-50">
                      每个方案各生成 1 张，共 {schemes.length} 张
                    </div>
                  </div>
                </div>
                {/* Selected scheme description */}
                {schemes[currentSchemeIndex]?.description && (
                  <p className="text-xs text-on-surface-variant leading-snug ml-1 mt-2">
                    {schemes[currentSchemeIndex].description}
                  </p>
                )}
              </div>
            )}

            {/* Text editor with label highlighting */}
            <div className="relative">
              <div className="relative rounded-xl border-b-2 border-b-outline-variant bg-surface-container hover:bg-surface-container-high focus-within:bg-surface-container-high focus-within:border-b-primary transition-colors">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 px-3 py-3 pb-10 text-sm text-on-surface whitespace-pre-wrap break-words pointer-events-none overflow-hidden rounded-xl"
                >
                  {prompt
                    ? renderHighlighted(prompt)
                    : <span className="text-on-surface-variant/50">描述你想生成的图片...</span>
                  }
                </div>
                <textarea ref={textareaRef} value={prompt}
                  onChange={(e) => { onPromptChange(e.target.value); autoResizeTextarea(e.target) }}
                  placeholder="描述你想生成的图片..." rows={1}
                  style={{ caretColor: 'var(--color-on-surface)' }}
                  className="relative w-full px-3 py-3 pb-10 text-sm text-transparent bg-transparent focus:outline-none placeholder:text-transparent resize-none overflow-hidden" />
              </div>
              <div className="absolute left-2 right-2 bottom-3 flex items-center gap-2 mb-1">
                <button type="button" onClick={handleHistoryUndo} disabled={!canUndo} title="撤销"
                  className="flex items-center justify-center w-6 h-6 rounded-full transition-colors text-on-surface-variant hover:bg-surface-container-high disabled:opacity-25 disabled:pointer-events-none">
                  <span className="material-symbols-rounded text-sm">undo</span>
                </button>
                <button type="button" onClick={handleHistoryRedo} disabled={!canRedo} title="重做"
                  className="flex items-center justify-center w-6 h-6 rounded-full transition-colors text-on-surface-variant hover:bg-surface-container-high disabled:opacity-25 disabled:pointer-events-none">
                  <span className="material-symbols-rounded text-sm">redo</span>
                </button>
                {prompt.trim() && (
                  <button type="button" onClick={handleClear}
                    className="px-3 py-1 text-xs rounded-full transition-colors bg-surface-container-high text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12">
                    清空
                  </button>
                )}
                <div className="flex-1" />
                {currentMode === 'text' && canAugment && (
                  <div className="relative group/augment">
                    <button type="button" onClick={() => handleAugment(false)}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-tertiary-dim text-tertiary hover:bg-tertiary hover:text-on-tertiary active:opacity-90">
润色
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/augment:opacity-100 transition-opacity duration-150 delay-500 group-hover/augment:delay-500 z-50">
                      使用 Gemini 3 Flash 润色提示词
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {augmentError && <p className="mt-2 text-xs text-error">{augmentError}</p>}
        </div>{/* end prompt content */}
      </div>{/* end prompt section */}

      {/* Batch count + generate button + cost */}
      <div className="flex flex-col gap-4 mt-4">
        {/* Batch count */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-2">数量</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => onBatchCountChange(n)}
                className={`px-4 py-1.5 text-sm rounded-full tabular-nums transition-colors
                  ${batchCount === n ? 'bg-primary-dim text-primary font-semibold hover:bg-primary/15 active:bg-primary/20' : 'bg-surface-container text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}>
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
            if (currentMode === 'structured' && schemes[currentSchemeIndex]) {
              const title = schemes[currentSchemeIndex].title
              onDraftLabelsOverride(Array.from({ length: batchCount }, () => title))
            } else if (currentMode === 'text' && prompt.trim()) {
              const firstLine = prompt.trimStart().split('\n')[0]
              const short = firstLine.length > 10 ? firstLine.slice(0, 10) + '…' : firstLine
              onDraftLabelsOverride(Array.from({ length: batchCount }, () => short))
            }
          }}
          onMouseLeave={() => { onDraftPreviewHover(false); onDraftLabelsOverride(null) }}
        >
          <button type="button"
            onClick={isGenerating ? onCancel : () => onGenerate()}
            disabled={!isGenerating && !canGenerate}
            className={`w-full py-3 text-sm font-medium rounded-full transition-colors
              ${isGenerating ? 'bg-error text-on-primary hover:bg-error/90 active:bg-error/80'
                : canGenerate ? 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary/80'
                : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'}`}>
            {isGenerating ? '取消' : '生成'}
          </button>
          {!isGenerating && !apiKey.trim() && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-on-surface text-surface text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity">
              请先配置 API Key
            </div>
          )}
        </div>

        {/* Cost estimate */}
        {estimatedCost !== null && (
          <p className="text-center text-xs text-on-surface-variant/60 -mt-2">
            预估费用约 ${estimatedCost.toFixed(3)}
            <span className="ml-1 opacity-70">({batchCount} 张 x ${pricePerImage!.toFixed(3)})</span>
          </p>
        )}
      </div>

      {/* Undo snackbar */}
      {undoToast && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit z-50 flex items-center gap-2 pl-4 pr-2 py-3 bg-on-surface text-surface text-sm rounded shadow-lg animate-[slideUp_200ms_ease-out]">
          <span>提示词已清空</span>
          <button type="button" onClick={handleUndo}
            className="px-3 py-1 text-sm font-medium rounded-full text-inverse-primary hover:bg-surface/10 active:bg-surface/15 transition-colors">撤销</button>
          <button type="button" onClick={handleDismissToast} className="p-1 rounded-full hover:bg-surface/10 transition-colors">
            <span className="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      )}
    </div>
  )
}
