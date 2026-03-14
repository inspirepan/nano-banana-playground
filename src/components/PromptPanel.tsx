import { useState, useRef, useCallback, useEffect } from 'react'
import type { PlaygroundImage, StructuredPrompt } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { augmentPrompt } from '../lib/api'
import { ReferenceImageUpload } from './ReferenceImageUpload'
import { StructuredPromptForm } from './StructuredPromptForm'

type PromptMode = 'text' | 'augmenting' | 'structured'

const EMPTY_STRUCTURED: StructuredPrompt = {
  mode: 'generate',
  subject: '',
  action: '',
  scene: '',
  composition: '',
  style: '',
  lighting: '',
  colorPalette: '',
  textInImage: '',
  constraints: '',
  editType: '',
  primaryRequest: '',
  referenceRole: '',
  targetScene: '',
  invariants: '',
}

// --- Label mappings for text <-> structured round-tripping ---

// Generate mode labels
const GEN_LABEL_ENTRIES: [string, keyof StructuredPrompt][] = [
  ['构图', 'composition'],
  ['风格', 'style'],
  ['光影', 'lighting'],
  ['色彩', 'colorPalette'],
  ['画中文字', 'textInImage'],
  ['画面中的文字', 'textInImage'],
  ['约束', 'constraints'],
  ['避免', 'constraints'],
]

// Edit mode labels
const EDIT_LABEL_ENTRIES: [string, keyof StructuredPrompt][] = [
  ['编辑类型', 'editType'],
  ['编辑请求', 'primaryRequest'],
  ['参考图说明', 'referenceRole'],
  ['目标场景', 'targetScene'],
  ['目标风格', 'style'],
  ['风格', 'style'],
  ['保持不变', 'invariants'],
  ['约束', 'constraints'],
  ['避免', 'constraints'],
]

const ALL_LABEL_ENTRIES = [...GEN_LABEL_ENTRIES, ...EDIT_LABEL_ENTRIES]

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
    // Description block (unlabeled)
    const desc = [fields.subject, fields.action, fields.scene]
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n')
    if (desc) lines.push(desc)
    // Labeled sections
    if (fields.composition.trim()) lines.push(`构图：${fields.composition.trim()}`)
    if (fields.style.trim()) lines.push(`风格：${fields.style.trim()}`)
    if (fields.lighting.trim()) lines.push(`光影：${fields.lighting.trim()}`)
    if (fields.colorPalette.trim()) lines.push(`色彩：${fields.colorPalette.trim()}`)
    if (fields.textInImage.trim()) lines.push(`画中文字："${fields.textInImage.trim()}"`)
    if (fields.constraints.trim()) lines.push(`避免：${fields.constraints.trim()}`)
  }

  return lines.join('\n')
}

// Edit-only labels used to detect edit mode text
const EDIT_ONLY_LABELS = ['编辑类型', '编辑请求', '参考图说明', '保持不变', '目标场景', '目标风格']

function parsePrompt(text: string): StructuredPrompt | null {
  // Deduplicate labels: longer labels first to avoid partial matches
  const uniqueEntries = ALL_LABEL_ENTRIES.slice().sort((a, b) => b[0].length - a[0].length)

  // Find all label positions in the text
  const markers: { pos: number; end: number; key: keyof StructuredPrompt; label: string }[] = []
  const usedKeys = new Set<string>()
  for (const [label, key] of uniqueEntries) {
    const needle = `${label}：`
    const idx = text.indexOf(needle)
    // Take first occurrence, skip if this key already matched by a longer label
    const dedupeKey = `${key}:${idx}`
    if (idx !== -1 && !usedKeys.has(dedupeKey) && !markers.some((m) => m.key === key)) {
      markers.push({ pos: idx, end: idx + needle.length, key, label })
      usedKeys.add(dedupeKey)
    }
  }

  if (markers.length === 0) return null

  markers.sort((a, b) => a.pos - b.pos)

  // Detect mode: if any edit-only label is present, it's edit mode
  const isEdit = markers.some((m) => EDIT_ONLY_LABELS.includes(m.label))

  const fields: StructuredPrompt = { ...EMPTY_STRUCTURED, mode: isEdit ? 'edit' : 'generate' }

  // Text before first label -> subject (generate) or ignored (edit)
  const desc = text.slice(0, markers[0].pos).replace(/[\n\s]+$/, '').trim()
  if (desc && !isEdit) fields.subject = desc

  // Extract each labeled section
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].end
    const end = i + 1 < markers.length ? markers[i + 1].pos : text.length
    let value = text.slice(start, end).replace(/[\n\s]+$/, '').trim()
    const key = markers[i].key
    if (key === 'textInImage') {
      value = value.replace(/^["\u201C]|["\u201D]$/g, '')
    }
    fields[key] = value
  }

  return fields
}

// --- Auto-resize textarea ---
const TEXTAREA_MIN_HEIGHT = 120 // min px (roughly 5 lines)
const TEXTAREA_BOTTOM_PAD = 36 // space for bottom action buttons

function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  const target = Math.max(el.scrollHeight + TEXTAREA_BOTTOM_PAD, TEXTAREA_MIN_HEIGHT)
  el.style.height = `${target}px`
}

type Props = {
  model: ModelConfig
  resolution: string
  batchCount: number
  prompt: string
  referenceImages: PlaygroundImage[]
  generationState: GenerationState
  apiKey: string
  onPromptChange: (v: string) => void
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
  onRemoveReferenceImage: (id: string) => void
  onGenerate: () => void
  onCancel: () => void
}

export function PromptPanel({
  model,
  resolution,
  batchCount,
  prompt,
  referenceImages,
  generationState,
  apiKey,
  onPromptChange,
  onAddReferenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onGenerate,
  onCancel,
}: Props) {
  const isGenerating = generationState === 'generating'
  const canGenerate = apiKey.trim() !== '' && prompt.trim() !== '' && !isGenerating
  const maxRef = model.maxReferenceImages + model.maxCharacterImages

  const pricePerImage = model.imagePriceByResolution[resolution]
  const estimatedCost = pricePerImage !== undefined ? pricePerImage * batchCount : null

  const [mode, setMode] = useState<PromptMode>('text')
  const [structuredFields, setStructuredFields] = useState<StructuredPrompt>(EMPTY_STRUCTURED)
  const [augmentError, setAugmentError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ text: string; timer: number } | null>(null)

  const canAugment = apiKey.trim() !== '' && prompt.trim() !== ''
  const canParseToStructured = mode === 'text' && parsePrompt(prompt) !== null

  // Auto-resize textarea when prompt changes externally (e.g. after augment round-trip)
  useEffect(() => {
    if (mode === 'text' && textareaRef.current) {
      autoResizeTextarea(textareaRef.current)
    }
  }, [prompt, mode])

  const handleAugment = useCallback(async () => {
    if (!canAugment) return
    setMode('augmenting')
    setAugmentError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await augmentPrompt(apiKey, prompt, referenceImages, controller.signal)
      setStructuredFields(result)
      onPromptChange(assemblePrompt(result))
      setMode('structured')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setAugmentError((e as Error).message)
        setMode('text')
      }
    }
  }, [apiKey, prompt, referenceImages, canAugment, onPromptChange])

  const handleCancelAugment = useCallback(() => {
    abortRef.current?.abort()
    setMode('text')
  }, [])

  const handleFieldChange = useCallback(
    (fields: StructuredPrompt) => {
      setStructuredFields(fields)
      onPromptChange(assemblePrompt(fields))
    },
    [onPromptChange],
  )

  const handleParseToStructured = useCallback(() => {
    const parsed = parsePrompt(prompt)
    if (!parsed) return
    setStructuredFields(parsed)
    onPromptChange(assemblePrompt(parsed))
    setMode('structured')
  }, [prompt, onPromptChange])

  const handleBackToText = useCallback(() => {
    setMode('text')
  }, [])

  const handleClear = useCallback(() => {
    const saved = prompt
    onPromptChange('')
    // Show undo toast
    const timer = window.setTimeout(() => setUndoToast(null), 5000)
    // Clear any existing toast timer
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

  return (
    <div className="w-full md:w-[360px] md:shrink-0 flex flex-col gap-4 overflow-y-auto py-4 pr-4">
      {/* Reference Images */}
      <ReferenceImageUpload
        images={referenceImages}
        maxTotal={maxRef}
        onAdd={onAddReferenceImages}
        onAddImage={onAddReferenceImage}
        onRemove={onRemoveReferenceImage}
      />

      {/* Prompt area -- mode-dependent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-on-surface-variant">
            提示词
          </label>
          {mode === 'structured' && (
            <button
              type="button"
              onClick={handleBackToText}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              返回文本编辑
            </button>
          )}
        </div>

        {mode === 'text' && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => {
                onPromptChange(e.target.value)
                autoResizeTextarea(e.target)
              }}
              placeholder="描述你想生成的图片..."
              rows={1}
              className="w-full px-3 py-2.5 pb-10 text-sm bg-surface-container rounded-xl
                         border-b-2 border-b-outline-variant
                         hover:bg-surface-container-high hover:border-b-outline
                         focus:bg-surface-container-high focus:border-b-primary focus:outline-none
                         placeholder:text-on-surface-variant/50 resize-none transition-colors
                         overflow-hidden"
            />
            {/* Bottom action bar inside textarea */}
            <div className="absolute left-2 right-2 bottom-3 flex items-center gap-1.5 mb-1">
              {prompt.trim() && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1 text-xs rounded-full transition-colors
                             bg-amber-100 text-amber-800 hover:bg-amber-200
                             dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
                >
                  清空
                </button>
              )}
              <div className="flex-1" />
              {canParseToStructured && (
                <button
                  type="button"
                  onClick={handleParseToStructured}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full transition-colors
                             bg-primary-dim text-primary hover:bg-primary hover:text-on-primary"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.001 1.001 0 0 0 0-1.41l-2.34-2.34a1.001 1.001 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                  结构化编辑
                </button>
              )}
              {canAugment && (
                <button
                  type="button"
                  onClick={handleAugment}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full transition-colors
                             bg-primary-dim text-primary hover:bg-primary hover:text-on-primary"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.46 8l.79-1.75L22 5.46c.39-.18.39-.73 0-.91l-1.75-.79L19.46 2c-.18-.39-.73-.39-.91 0l-.79 1.75-1.76.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.74.39.92 0zM11.5 9.5L9.91 6c-.35-.78-1.47-.78-1.82 0L6.5 9.5 3 11.09c-.78.36-.78 1.47 0 1.82l3.5 1.59L8.09 18c.36.78 1.47.78 1.82 0l1.59-3.5 3.5-1.59c.78-.36.78-1.47 0-1.82L11.5 9.5zm7.04 6.5l-.79 1.75-1.75.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.73.39.91 0l.79-1.75 1.76-.79c.39-.18.39-.73 0-.91l-1.75-.79-.79-1.76c-.18-.39-.74-.39-.92 0z" />
                  </svg>
                  增强
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'augmenting' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8
                          bg-surface-container rounded-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-on-surface-variant">正在分析提示词...</p>
            <button
              type="button"
              onClick={handleCancelAugment}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              取消
            </button>
          </div>
        )}

        {mode === 'structured' && (
          <StructuredPromptForm
            fields={structuredFields}
            onChange={handleFieldChange}
          />
        )}

        {augmentError && (
          <p className="mt-2 text-xs text-error">{augmentError}</p>
        )}
      </div>

      {/* Generate Button */}
      <div className="relative group/btn shrink-0">
        <button
          type="button"
          onClick={isGenerating ? onCancel : onGenerate}
          disabled={!isGenerating && !canGenerate}
          className={`w-full py-2.5 text-sm font-medium rounded-full transition-colors
            ${
              isGenerating
                ? 'bg-error text-on-primary hover:bg-error/90'
                : canGenerate
                  ? 'bg-primary text-on-primary hover:bg-primary-hover'
                  : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'
            }`}
        >
          {isGenerating ? '取消' : '生成'}
        </button>
        {/* Tooltip: only shown when disabled due to missing API key */}
        {!isGenerating && !apiKey.trim() && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5
                          bg-on-surface text-surface text-xs rounded-lg
                          whitespace-nowrap pointer-events-none
                          opacity-0 group-hover/btn:opacity-100 transition-opacity">
            请先配置 API 密钥
          </div>
        )}
      </div>

      {/* Cost estimate */}
      {estimatedCost !== null && (
        <p className="text-center text-xs text-on-surface-variant/60 -mt-2">
          预估费用约 ${estimatedCost.toFixed(3)}
          <span className="ml-1 opacity-70">({batchCount} 张 × ${pricePerImage!.toFixed(3)})</span>
        </p>
      )}

      {/* Undo snackbar (MD3) */}
      {undoToast && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit z-50
                        flex items-center gap-2 pl-4 pr-2 py-2.5
                        bg-on-surface text-surface text-sm rounded-xl shadow-lg
                        animate-[slideUp_200ms_ease-out]">
          <span>提示词已清空</span>
          <button
            type="button"
            onClick={handleUndo}
            className="px-3 py-1 text-sm font-medium rounded-lg
                       text-[#a8c7fa] dark:text-[#1a73e8]
                       hover:bg-surface/10 transition-colors"
          >
            撤销
          </button>
          <button
            type="button"
            onClick={handleDismissToast}
            className="p-1 rounded-full hover:bg-surface/10 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
