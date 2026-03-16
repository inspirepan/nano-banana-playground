import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import type { PersistedPromptMode, PlaygroundImage, PromptScheme } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { augmentPromptStream } from '../lib/api'
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
          <span key={i}><span className="text-tertiary">{label}</span>：{rest}</span>
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

function autoResizeTextarea(el: HTMLTextAreaElement, scrollContainer?: HTMLElement | null) {
  const prevScroll = scrollContainer?.scrollTop
  const borderHeight = el.offsetHeight - el.clientHeight
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight + borderHeight + 1, TEXTAREA_MIN_HEIGHT)}px`
  if (scrollContainer && prevScroll !== undefined) scrollContainer.scrollTop = prevScroll
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
  const [schemesCollapsed, setSchemesCollapsed] = useState(false)
  const hasPrompt = prompt.trim() !== ''

  const canGenerate = apiKey.trim() !== '' && hasPrompt && !isGenerating && !isAugmenting

  const [augmentError, setAugmentError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

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

  const canAugment = apiKey.trim() !== '' && hasPrompt

  useEffect(() => {
    if ((!isAugmenting || schemes.length > 0) && textareaRef.current) autoResizeTextarea(textareaRef.current, panelRef.current)
  }, [prompt, isAugmenting, schemes.length])

  // --- Augment (streaming) ---
  const handleAugment = useCallback(async (useOriginal = false) => {
    if (!canAugment && !useOriginal) return
    const sourcePrompt = useOriginal && originalPrompt ? originalPrompt : prompt
    if (!sourcePrompt.trim()) return

    if (!useOriginal) {
      onOriginalPromptChange(sourcePrompt)
    }

    setIsAugmenting(true)
    setAugmentError(null)
    setSchemesCollapsed(false)
    onSchemesChange([])
    onCurrentSchemeIndexChange(0)

    const controller = new AbortController()
    abortRef.current = controller
    // 120s timeout — thinking + streaming can take a while
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)])

    let gotSchemes = false
    let firstScheme = true
    try {
      await augmentPromptStream(apiKey, sourcePrompt, referenceImages, (schemes, done) => {
        if (schemes.length > 0) {
          gotSchemes = true
          onSchemesChange(schemes)
          if (firstScheme) {
            firstScheme = false
            onCurrentSchemeIndexChange(0)
            onPromptChange(schemes[0].text)
          }
        }
        if (done) {
          onModeChange('structured')
        }
      }, signal)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).name === 'TimeoutError'
          ? '请求超时，请检查网络连接或代理配置后重试'
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
  }, [apiKey, prompt, originalPrompt, referenceImages, canAugment, onPromptChange, onModeChange, onSchemesChange, onCurrentSchemeIndexChange, onOriginalPromptChange])

  const handleCancelAugment = useCallback(() => {
    abortRef.current?.abort()
    setIsAugmenting(false)
  }, [])

  // --- Scheme management ---
  const handleSelectScheme = useCallback((index: number) => {
    onCurrentSchemeIndexChange(index)
    if (schemes[index]) onPromptChange(schemes[index].text)
  }, [schemes, onPromptChange, onCurrentSchemeIndexChange])

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

  // --- Cost estimate ---
  const estimatedCost = pricePerImage !== undefined ? pricePerImage * batchCount : null

  return (
    <div ref={panelRef}
      onDragEnter={handlePanelDragEnter}
      onDragLeave={handlePanelDragLeave}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
      className="w-full md:flex-1 md:shrink-0 md:min-w-[360px] flex flex-col px-2 py-4 md:h-full md:overflow-y-auto relative">
      {/* Reference Images */}
      <div className="shrink-0">
        <ReferenceImageUpload
          images={referenceImages}
          maxTotal={maxRef}
          dragOver={dragOver}
          onAdd={onAddReferenceImages}
          onRemove={onRemoveReferenceImage}
        />
      </div>

      {/* Prompt section */}
      <div className="mt-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 min-h-[32px] shrink-0">
          <label className="text-sm font-medium text-on-surface-variant">提示词</label>
        </div>

        {/* Prompt content */}
        <div className="flex flex-col">

        {isAugmenting && schemes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 bg-surface-container rounded-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-on-surface-variant">正在使用 <span className="opacity-50">Gemini 3 Flash</span> 增强提示词...</p>
            <button type="button" onClick={handleCancelAugment}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">取消</button>
          </div>
        )}

        {(!isAugmenting || schemes.length > 0) && (
          <>
            {/* Augment result card */}
            {schemes.length > 0 && (mode === 'structured' || isAugmenting) && (
              <div className="mb-4 rounded-2xl border border-outline-variant/40 bg-surface-container/50 px-4 py-3 flex flex-col gap-3">
                {schemesCollapsed && !isAugmenting ? (
                  /* Collapsed: compact summary bar */
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-tertiary-dim text-tertiary">
                      {schemes[currentSchemeIndex]?.title}
                    </span>
                    <button type="button" onClick={() => setSchemesCollapsed(false)}
                      className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors">
                      切换方案
                    </button>
                    <div className="flex-1" />
                    <div className="relative group/close">
                      <button type="button" onClick={handleDiscardAugment}
                        className="flex items-center justify-center w-4 h-4 translate-y-px rounded-full text-on-surface-variant/50 hover:text-on-surface transition-colors">
                        <span className="material-symbols-rounded text-sm leading-none">close</span>
                      </button>
                      <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/close:opacity-100 transition-opacity duration-150 delay-500 z-50">
                        退出增强模式
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Expanded: full scheme selector */
                  <>
                    {/* Header: title + action links */}
                    <div className="flex items-center gap-3">
                      {isAugmenting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-tertiary border-t-transparent rounded-full animate-spin shrink-0" />
                          <p className="text-sm text-on-surface-variant">
                            已生成 {schemes.length} 个方案...
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-on-surface-variant">
                          {schemes.length > 1 ? `${schemes.length} 个增强方案` : 'AI 已增强提示词'}
                        </p>
                      )}
                      <div className="flex-1" />
                      {isAugmenting ? (
                        <button type="button" onClick={handleCancelAugment}
                          className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors">
                          取消
                        </button>
                      ) : (
                        <>
                          <div className="relative group/reaugment">
                            <button type="button" onClick={() => handleAugment(true)} disabled={!originalPrompt}
                              className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-40 disabled:pointer-events-none">
                              重新增强
                            </button>
                            <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/reaugment:opacity-100 transition-opacity duration-150 delay-500 group-hover/reaugment:delay-500 z-50">
                              基于原始提示词重新增强
                            </div>
                          </div>
                          {schemes.length > 1 && (
                            <div className="relative group/gen-all">
                              <button type="button" disabled={isGenerating}
                                onClick={() => { onDraftBatchOverride(null); handleGenerateAll() }}
                                onMouseEnter={() => { if (!isGenerating) { onDraftBatchOverride(schemes.length, schemes.map((s) => s.title)); onDraftPreviewHover(true) } }}
                                onMouseLeave={() => { onDraftBatchOverride(null); onDraftPreviewHover(false) }}
                                className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-40 disabled:pointer-events-none">
                                各生成一张
                              </button>
                              <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap
                                              bg-on-surface text-surface text-xs px-2 py-1 rounded
                                              opacity-0 group-hover/gen-all:opacity-100 transition-opacity duration-150 delay-500 z-50">
                                每个方案各生成 1 张，共 {schemes.length} 张
                              </div>
                            </div>
                          )}
                          <div className="relative group/discard">
                            <button type="button" onClick={handleDiscardAugment}
                              className="flex items-center justify-center w-4 h-4 translate-y-px rounded-full text-on-surface-variant/50 hover:text-on-surface transition-colors">
                              <span className="material-symbols-rounded text-sm leading-none">close</span>
                            </button>
                            <div className="absolute bottom-full right-0 mb-1 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/discard:opacity-100 transition-opacity duration-150 delay-500 group-hover/discard:delay-500 z-50">
                              退出增强模式
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Scheme chips */}
                    {schemes.length >= 1 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {schemes.map((scheme, i) => {
                          const isSelected = i === currentSchemeIndex
                          return (
                            <div key={i} className="relative group">
                              <button type="button" onClick={() => handleSelectScheme(i)}
                                disabled={isAugmenting}
                                className={`px-3 py-3 text-sm font-medium rounded-xl transition-colors
                                  ${isSelected
                                    ? 'bg-tertiary-dim text-tertiary hover:bg-tertiary/15 active:bg-tertiary/20'
                                    : 'bg-surface text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'
                                  } ${isAugmenting ? 'pointer-events-none' : ''}`}>
                                {scheme.title}
                              </button>
                              {scheme.description && !isAugmenting && (
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
                        {isAugmenting && (
                          <div className="w-3 h-3 border-[1.5px] border-on-surface-variant/30 border-t-on-surface-variant/70 rounded-full animate-spin" />
                        )}
                      </div>
                    )}
                    {/* Selected scheme description */}
                    {!isAugmenting && schemes[currentSchemeIndex]?.description && (
                      <p className="text-sm text-on-surface-variant leading-relaxed px-3">
                        {schemes[currentSchemeIndex].description}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Text editor with label highlighting */}
            <div className="relative">
              <div className="relative rounded-2xl bg-surface-container hover:bg-surface-container-high focus-within:bg-surface-container-high transition-colors min-h-[120px]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 px-4 py-4 pb-12 text-sm text-on-surface whitespace-pre-wrap break-words pointer-events-none overflow-hidden rounded-2xl"
                >
                  {prompt
                    ? renderHighlighted(prompt)
                    : <span className="text-on-surface-variant/50">描述你想生成的图片...</span>
                  }
                </div>
                <textarea ref={textareaRef} value={prompt}
                  onChange={(e) => { onPromptChange(e.target.value); autoResizeTextarea(e.target, panelRef.current) }}
                  readOnly={isAugmenting}
                  rows={1}
                  style={{ caretColor: 'var(--color-on-surface)' }}
                  className="relative box-border w-full px-4 py-4 pb-12 text-sm text-transparent bg-transparent focus:outline-none resize-none overflow-hidden" />
              </div>
              <div className="absolute left-4 right-4 bottom-3 flex items-center gap-3">
                <button type="button" onClick={handleHistoryUndo} disabled={!canUndo} title="撤销"
                  className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-30 disabled:pointer-events-none">
                  撤销
                </button>
                <button type="button" onClick={handleHistoryRedo} disabled={!canRedo} title="重做"
                  className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:opacity-30 disabled:pointer-events-none">
                  重做
                </button>
                <button type="button" onClick={handleClear} disabled={!hasPrompt}
                  className={`text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors disabled:pointer-events-none ${hasPrompt ? '' : 'invisible'}`}>
                  清空
                </button>
                <div className="flex-1" />
                {mode === 'text' && !isAugmenting && (
                  <div className="relative group/augment">
                    <button type="button" onClick={() => handleAugment(false)} disabled={!canAugment}
                      className={`text-xs text-tertiary hover:text-tertiary/80 transition-colors disabled:pointer-events-none ${canAugment ? '' : 'invisible'}`}>
                      增强
                    </button>
                    <div className={`absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded transition-opacity duration-150 delay-500 group-hover/augment:delay-500 z-50 ${canAugment ? 'opacity-0 group-hover/augment:opacity-100' : 'opacity-0'}`}>
                      使用 Gemini 3 Flash 增强提示词
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
          <label className="block text-sm font-medium text-on-surface-variant mb-3">数量</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => onBatchCountChange(n)}
                className={`px-3 py-3 text-sm rounded-xl tabular-nums transition-colors
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

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-40 rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 pointer-events-none" />
      )}

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
