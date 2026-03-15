import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import type { PersistedPromptMode, PlaygroundImage, StructuredPrompt, PromptMode, PromptScheme } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { augmentPrompt } from '../lib/api'
import { ReferenceImageUpload } from './ReferenceImageUpload'
import { StructuredPromptForm } from './StructuredPromptForm'
type StructuredPromptTextKey = Exclude<keyof StructuredPrompt, 'mode'>

const EMPTY_STRUCTURED: StructuredPrompt = {
  mode: 'generate',
  subject: '', action: '', scene: '', composition: '', style: '',
  lighting: '', colorPalette: '', textInImage: '', constraints: '',
  editType: '', primaryRequest: '', referenceRole: '', targetScene: '', invariants: '',
}

// --- Label mappings for text <-> structured round-tripping ---

const GEN_LABEL_ENTRIES: [string, StructuredPromptTextKey][] = [
  ['构图', 'composition'], ['风格', 'style'], ['光影', 'lighting'],
  ['色彩', 'colorPalette'], ['画中文字', 'textInImage'], ['画面中的文字', 'textInImage'],
  ['约束', 'constraints'], ['避免', 'constraints'],
]

const EDIT_LABEL_ENTRIES: [string, StructuredPromptTextKey][] = [
  ['编辑类型', 'editType'], ['编辑请求', 'primaryRequest'],
  ['参考图说明', 'referenceRole'], ['目标场景', 'targetScene'],
  ['目标风格', 'style'], ['风格', 'style'],
  ['保持不变', 'invariants'], ['约束', 'constraints'], ['避免', 'constraints'],
]

const ALL_LABEL_ENTRIES = [...GEN_LABEL_ENTRIES, ...EDIT_LABEL_ENTRIES]
const EDIT_ONLY_LABELS = ['编辑类型', '编辑请求', '参考图说明', '保持不变', '目标场景', '目标风格']

// Deduplicated label list for syntax highlighting, longest-first to avoid prefix conflicts
const HIGHLIGHT_LABELS = [...new Set(ALL_LABEL_ENTRIES.map(([label]) => label))]
  .sort((a, b) => b.length - a.length)

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
          <span key={i}><span className="rounded bg-primary-dim text-primary">{label}</span>：{rest}</span>
        )
        found = true
        break
      }
    }
    if (!found) parts.push(<span key={i}>{line}</span>)
  }
  return parts
}

function assemblePrompt(fields: StructuredPrompt): string {
  const lines: string[] = []
  if (fields.mode === 'edit') {
    if (fields.editType.trim()) lines.push(`编辑类型：${fields.editType.trim()}`)
    if (fields.primaryRequest.trim()) lines.push(`编辑请求：${fields.primaryRequest.trim()}`)
    if (fields.referenceRole.trim()) lines.push(`参考图说明：${fields.referenceRole.trim()}`)
    if (fields.targetScene.trim()) lines.push(`目标场景：${fields.targetScene.trim()}`)
    if (fields.style.trim()) lines.push(`目标风格：${fields.style.trim()}`)
    if (fields.invariants.trim()) lines.push(`保持不变：${fields.invariants.trim()}`)
    if (fields.constraints.trim()) lines.push(`避免：${fields.constraints.trim()}`)
  } else {
    const desc = [fields.subject, fields.action, fields.scene].map((s) => s.trim()).filter(Boolean).join('\n')
    if (desc) lines.push(desc)
    if (fields.composition.trim()) lines.push(`构图：${fields.composition.trim()}`)
    if (fields.style.trim()) lines.push(`风格：${fields.style.trim()}`)
    if (fields.lighting.trim()) lines.push(`光影：${fields.lighting.trim()}`)
    if (fields.colorPalette.trim()) lines.push(`色彩：${fields.colorPalette.trim()}`)
    if (fields.textInImage.trim()) lines.push(`画中文字：${fields.textInImage.trim()}`)
    if (fields.constraints.trim()) lines.push(`避免：${fields.constraints.trim()}`)
  }
  return lines.join('\n\n')
}

function parsePrompt(text: string): StructuredPrompt | null {
  const uniqueEntries = ALL_LABEL_ENTRIES.slice().sort((a, b) => b[0].length - a[0].length)
  const markers: { pos: number; end: number; key: StructuredPromptTextKey; label: string }[] = []
  for (const [label, key] of uniqueEntries) {
    const needle = `${label}：`
    let idx = -1
    if (text.startsWith(needle)) {
      idx = 0
    } else {
      const nlIdx = text.indexOf(`\n${needle}`)
      if (nlIdx !== -1) idx = nlIdx + 1
    }
    if (idx !== -1 && !markers.some((m) => m.key === key)) {
      markers.push({ pos: idx, end: idx + needle.length, key, label })
    }
  }
  if (markers.length === 0) return null
  markers.sort((a, b) => a.pos - b.pos)
  const isEdit = markers.some((m) => EDIT_ONLY_LABELS.includes(m.label))
  const fields: StructuredPrompt = { ...EMPTY_STRUCTURED, mode: isEdit ? 'edit' : 'generate' }
  const desc = text.slice(0, markers[0].pos).replace(/[\n\s]+$/, '').trim()
  if (desc && !isEdit) fields.subject = desc
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].end
    const end = i + 1 < markers.length ? markers[i + 1].pos : text.length
    const value = text.slice(start, end).replace(/[\n\s]+$/, '').trim()
    fields[markers[i].key] = value
  }
  return fields
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
  onDraftBatchOverride: (count: number | null) => void
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
  const canParseToStructured = currentMode === 'text' && parsePrompt(prompt) !== null

  useEffect(() => {
    if (currentMode === 'text' && textareaRef.current) autoResizeTextarea(textareaRef.current)
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

    try {
      const result = await augmentPrompt(apiKey, sourcePrompt, referenceImages, controller.signal)
      onSchemesChange(result)
      onCurrentSchemeIndexChange(0)
      onPromptChange(assemblePrompt(result[0].fields))
      onModeChange('structured')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setAugmentError((e as Error).message)
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
    onCurrentSchemeIndexChange(index)
    if (schemes[index]) {
      onPromptChange(assemblePrompt(schemes[index].fields))
    }
  }, [schemes, onPromptChange, onCurrentSchemeIndexChange])

  const handleChangeScheme = useCallback((index: number, fields: StructuredPrompt) => {
    const next = [...schemes]
    next[index] = { ...next[index], fields }
    onSchemesChange(next)
    onPromptChange(assemblePrompt(fields))
  }, [schemes, onSchemesChange, onPromptChange])

  const handleGenerateAll = useCallback(() => {
    const prompts = schemes.map((s) => assemblePrompt(s.fields))
    onGenerate(prompts)
  }, [schemes, onGenerate])

  // --- Mode switching ---
  const handleParseToStructured = useCallback(() => {
    if (schemes.length > 0) {
      const parsed = parsePrompt(prompt)
      if (parsed) {
        const updated = [...schemes]
        updated[currentSchemeIndex] = { ...updated[currentSchemeIndex], fields: parsed }
        onSchemesChange(updated)
      }
      onModeChange('structured')
      return
    }
    const parsed = parsePrompt(prompt)
    if (!parsed) return
    const scheme: PromptScheme = { title: '方案 1', description: '', fields: parsed }
    onSchemesChange([scheme])
    onCurrentSchemeIndexChange(0)
    onPromptChange(assemblePrompt(parsed))
    onModeChange('structured')
  }, [prompt, schemes, currentSchemeIndex, onPromptChange, onModeChange, onSchemesChange, onCurrentSchemeIndexChange])

  const handleBackToText = useCallback(() => {
    onModeChange('text')
  }, [onModeChange])

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
    <div className={`w-full md:flex-1 md:shrink-0 md:min-w-[360px] flex flex-col py-4 md:h-full${currentMode === 'text' ? ' md:overflow-y-auto' : ''}`}>
      {/* Reference Images - fixed */}
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
      <div className={`mt-4 flex flex-col${currentMode !== 'text' ? ' md:flex-1 md:min-h-0' : ''}`}>
        {/* Prompt header - fixed */}
        <div className="flex items-center justify-between mb-3 min-h-[28px] shrink-0">
          <label className="text-xs font-medium text-on-surface-variant">提示词</label>
          <div className="flex items-center gap-2">
            {currentMode === 'text' && canParseToStructured && (
              <div className="relative group/parse">
                <button type="button" onClick={handleParseToStructured}
                  className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors
                             bg-surface-container text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.001 1.001 0 0 0 0-1.41l-2.34-2.34a1.001 1.001 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                  结构化编辑
                </button>
                <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/parse:opacity-100 transition-opacity duration-150 delay-500 group-hover/parse:delay-500 z-50">
                  解析标签字段，切换到表单编辑
                </div>
              </div>
            )}
            {currentMode === 'structured' && (
              <>
                <div className="relative group/reaugment">
                  <button type="button" onClick={() => handleAugment(true)} disabled={!originalPrompt}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-tertiary-dim text-tertiary hover:bg-tertiary hover:text-on-tertiary active:opacity-90 disabled:opacity-40 disabled:pointer-events-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                    </svg>
                    重新增强
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/reaugment:opacity-100 transition-opacity duration-150 delay-500 group-hover/reaugment:delay-500 z-50">
                    基于原始提示词重新增强
                  </div>
                </div>
                <div className="relative group/backtxt">
                  <button type="button" onClick={handleBackToText}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-surface-container text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
                    </svg>
                    文本编辑
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/backtxt:opacity-100 transition-opacity duration-150 delay-500 group-hover/backtxt:delay-500 z-50">
                    切换到纯文本编辑模式
                  </div>
                </div>
                {originalPrompt !== null && (
                  <div className="relative group/discard">
                    <button type="button" onClick={handleDiscardAugment}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-error-dim text-error hover:bg-error hover:text-on-primary active:opacity-90">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                      放弃增强
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/discard:opacity-100 transition-opacity duration-150 delay-500 group-hover/discard:delay-500 z-50">
                      丢弃增强结果，恢复原始提示词
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Prompt content */}
        <div className={`flex flex-col${currentMode !== 'text' ? ' md:flex-1 md:min-h-0' : ''}`}>

        {currentMode === 'text' && (
          <div className="relative">
            {/* Container owns bg/border/focus-within states */}
            <div className="relative rounded-xl border-b-2 border-b-outline-variant bg-surface-container hover:bg-surface-container-high hover:border-b-outline focus-within:bg-surface-container-high focus-within:border-b-primary transition-colors">
              {/* Mirror: renders label badges behind the transparent textarea */}
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
              {prompt.trim() && (
                <button type="button" onClick={handleClear}
                  className="px-3 py-1 text-xs rounded-full transition-colors bg-surface-container-high text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12">
                  清空
                </button>
              )}
              <button type="button" onClick={handleHistoryUndo} disabled={!canUndo} title="撤销"
                className="flex items-center justify-center w-6 h-6 rounded-full transition-colors text-on-surface-variant hover:bg-surface-container-high disabled:opacity-25 disabled:pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
              </button>
              <button type="button" onClick={handleHistoryRedo} disabled={!canRedo} title="重做"
                className="flex items-center justify-center w-6 h-6 rounded-full transition-colors text-on-surface-variant hover:bg-surface-container-high disabled:opacity-25 disabled:pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" /></svg>
              </button>
              <div className="flex-1" />
              {canAugment && (
                <div className="relative group/augment">
                  <button type="button" onClick={() => handleAugment(false)}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors bg-tertiary-dim text-tertiary hover:bg-tertiary hover:text-on-tertiary active:opacity-90">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.46 8l.79-1.75L22 5.46c.39-.18.39-.73 0-.91l-1.75-.79L19.46 2c-.18-.39-.73-.39-.91 0l-.79 1.75-1.76.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.74.39.92 0zM11.5 9.5L9.91 6c-.35-.78-1.47-.78-1.82 0L6.5 9.5 3 11.09c-.78.36-.78 1.47 0 1.82l3.5 1.59L8.09 18c.36.78 1.47.78 1.82 0l1.59-3.5 3.5-1.59c.78-.36.78-1.47 0-1.82L11.5 9.5zm7.04 6.5l-.79 1.75-1.75.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.73.39.91 0l.79-1.75 1.76-.79c.39-.18.39-.73 0-.91l-1.75-.79-.79-1.76c-.18-.39-.74-.39-.92 0z" /></svg>
                    增强
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 pointer-events-none whitespace-nowrap bg-on-surface text-surface text-xs px-2 py-1 rounded opacity-0 group-hover/augment:opacity-100 transition-opacity duration-150 delay-500 group-hover/augment:delay-500 z-50">
                    Gemini 3 Flash 生成结构化提示词
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentMode === 'augmenting' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 bg-surface-container rounded-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-on-surface-variant">正在分析提示词...
              <span className="opacity-50 ml-1">Gemini 3 Flash</span>
            </p>
            <button type="button" onClick={handleCancelAugment}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">取消</button>
          </div>
        )}

        {currentMode === 'structured' && schemes.length > 0 && (
          <div className="bg-surface-container rounded-xl md:flex-1 md:min-h-0 md:overflow-y-auto">
            <StructuredPromptForm
              schemes={schemes}
              currentIndex={currentSchemeIndex}
              costPerImage={pricePerImage ?? null}
              isGenerating={isGenerating}
              onSelectScheme={handleSelectScheme}
              onChangeScheme={handleChangeScheme}
              onGenerateAll={handleGenerateAll}
              onDraftBatchOverride={onDraftBatchOverride}
            />
          </div>
        )}

        {augmentError && <p className="mt-2 text-xs text-error">{augmentError}</p>}
        </div>{/* end scrollable content */}
      </div>{/* end prompt section */}

      {/* Batch count + generate button + cost */}
      <div className={`flex flex-col gap-4 mt-4${currentMode !== 'text' ? ' shrink-0' : ''}`}>
        {/* Batch count */}
        {currentMode !== 'augmenting' && (
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">数量</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: model.maxBatchCount }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => onBatchCountChange(n)}
                  className={`px-4 py-1 text-sm rounded-full transition-colors
                    ${batchCount === n ? 'bg-primary-dim text-primary font-semibold hover:bg-primary/15 active:bg-primary/20' : 'bg-surface-container text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}>
                  x{n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="relative group/btn">
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
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-on-surface text-surface text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity">
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
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit z-50 flex items-center gap-2 pl-4 pr-2 py-3 bg-on-surface text-surface text-sm rounded-xl shadow-lg animate-[slideUp_200ms_ease-out]">
          <span>提示词已清空</span>
          <button type="button" onClick={handleUndo}
            className="px-3 py-1 text-sm font-medium rounded-lg text-inverse-primary hover:bg-surface/10 active:bg-surface/15 transition-colors">撤销</button>
          <button type="button" onClick={handleDismissToast} className="p-1 rounded-full hover:bg-surface/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
