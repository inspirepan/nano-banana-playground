import { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import type { StructuredPrompt, PromptScheme } from '../lib/types'

type FieldKey = keyof StructuredPrompt

type FieldConfig = {
  key: FieldKey
  label: string
  placeholder: string
}

const GENERATE_FIELDS: FieldConfig[] = [
  { key: 'subject', label: '主体', placeholder: '主角或物体描述' },
  { key: 'action', label: '动作/姿态', placeholder: '主体在做什么' },
  { key: 'scene', label: '场景/背景', placeholder: '环境或背景描述' },
  { key: 'composition', label: '构图/取景', placeholder: '机位、景别、画面布局' },
  { key: 'style', label: '风格/媒介', placeholder: '照片、插画、3D 等' },
  { key: 'lighting', label: '光影/氛围', placeholder: '光源类型和情绪氛围' },
  { key: 'colorPalette', label: '色彩', placeholder: '色调或配色描述' },
  { key: 'textInImage', label: '画中文字', placeholder: '需要在画面中渲染的文字' },
  { key: 'constraints', label: '约束/避免', placeholder: '不要出现的元素' },
]

const EDIT_FIELDS: FieldConfig[] = [
  { key: 'editType', label: '编辑类型', placeholder: '风格迁移、物体编辑、背景替换...' },
  { key: 'primaryRequest', label: '编辑请求', placeholder: '需要做什么修改' },
  { key: 'referenceRole', label: '参考图说明', placeholder: '每张参考图的用途' },
  { key: 'targetScene', label: '目标场景', placeholder: '编辑后的场景描述' },
  { key: 'style', label: '目标风格', placeholder: '编辑后的风格描述' },
  { key: 'invariants', label: '保持不变', placeholder: '哪些部分不能改动' },
  { key: 'constraints', label: '约束/避免', placeholder: '不要出现的元素' },
]

const GENERATE_CORE: Set<FieldKey> = new Set(['subject', 'scene', 'style'])
const EDIT_CORE: Set<FieldKey> = new Set(['primaryRequest', 'referenceRole', 'invariants'])
const TEXTAREA_ROUNDING_BUFFER = 1

function autoResize(el: HTMLTextAreaElement) {
  const minHeight = Number.parseFloat(window.getComputedStyle(el).minHeight) || 0
  const borderBoxOffset = el.offsetHeight - el.clientHeight

  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight + borderBoxOffset + TEXTAREA_ROUNDING_BUFFER, minHeight)}px`
}

type Props = {
  schemes: PromptScheme[]
  currentIndex: number
  costPerImage: number | null
  isGenerating: boolean
  onSelectScheme: (index: number) => void
  onChangeScheme: (index: number, fields: StructuredPrompt) => void
  onGenerateAll: () => void
  onCancel: () => void
  onDraftBatchOverride: (count: number | null) => void
}

export function StructuredPromptForm({
  schemes,
  currentIndex,
  costPerImage,
  isGenerating,
  onSelectScheme,
  onChangeScheme,
  onGenerateAll,
  onCancel,
  onDraftBatchOverride,
}: Props) {
  const current = schemes[currentIndex]
  if (!current) return null

  const fields = current.fields
  const isEdit = fields.mode === 'edit'
  const fieldDefs = isEdit ? EDIT_FIELDS : GENERATE_FIELDS
  const coreFields = isEdit ? EDIT_CORE : GENERATE_CORE

  const [expanded, setExpanded] = useState<Set<FieldKey>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const resizeAllTextareas = useCallback(() => {
    containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(autoResize)
  }, [])

  // Re-measure all textareas after layout to handle flex/scroll containers
  useLayoutEffect(() => {
    resizeAllTextareas()
  }, [fields, resizeAllTextareas])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let lastWidth = container.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width
      if (Math.abs(nextWidth - lastWidth) < 1) return
      lastWidth = nextWidth
      resizeAllTextareas()
    })

    observer.observe(container)
    void document.fonts.ready.then(resizeAllTextareas)

    return () => observer.disconnect()
  }, [resizeAllTextareas])

  const updateField = (key: FieldKey, value: string) => {
    onChangeScheme(currentIndex, { ...fields, [key]: value })
  }

  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) autoResize(el)
  }, [])

  const isFieldVisible = (key: FieldKey): boolean => {
    if (coreFields.has(key)) return true
    if ((fields[key] as string).trim() !== '') return true
    if (expanded.has(key)) return true
    return false
  }

  const hiddenFields = fieldDefs.filter(({ key }) => !isFieldVisible(key))

  return (
    <div ref={containerRef} className="flex flex-col gap-3 p-3">
      {/* Scheme cards */}
      {schemes.length > 1 && (
        <div className="flex flex-col gap-2 ml-1">
          <p className="text-2xs text-on-surface-variant/60 leading-snug">
            AI 生成了 {schemes.length} 个创意方案，选择一个查看和编辑，或一键全部生成
          </p>
          {schemes.map((scheme, i) => {
            const isSelected = i === currentIndex
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectScheme(i)}
                className={`flex items-start gap-2 text-left px-3 py-2 rounded-xl transition-colors w-full
                  ${isSelected
                    ? 'bg-primary-dim hover:bg-primary/15 active:bg-primary/20'
                    : 'bg-surface-container-high hover:bg-on-surface/8 active:bg-on-surface/12'
                  }`}
              >
                <span className={`mt-1 inline-block w-3.5 h-3.5 rounded-full border-2 shrink-0
                  ${isSelected
                    ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_var(--color-primary-dim)]'
                    : 'border-on-surface-variant/40 bg-transparent'
                  }`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold leading-none ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                    {scheme.title}
                  </div>
                  <div className={`mt-1 text-2xs leading-snug ${isSelected ? 'text-primary/70' : 'text-on-surface-variant'}`}>
                    {scheme.description}
                  </div>
                </div>
              </button>
            )
          })}
          {/* Generate all / Cancel button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-full transition-colors
                         bg-error text-on-primary hover:bg-error/90 active:bg-error/80
                         text-xs font-medium"
            >
              取消生成
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onDraftBatchOverride(null); onGenerateAll() }}
              onMouseEnter={() => onDraftBatchOverride(schemes.length)}
              onMouseLeave={() => onDraftBatchOverride(null)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-full transition-colors
                         bg-tertiary-dim text-tertiary hover:bg-tertiary hover:text-on-tertiary active:opacity-90
                         text-xs font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.46 8l.79-1.75L22 5.46c.39-.18.39-.73 0-.91l-1.75-.79L19.46 2c-.18-.39-.73-.39-.91 0l-.79 1.75-1.76.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.74.39.92 0zM11.5 9.5L9.91 6c-.35-.78-1.47-.78-1.82 0L6.5 9.5 3 11.09c-.78.36-.78 1.47 0 1.82l3.5 1.59L8.09 18c.36.78 1.47.78 1.82 0l1.59-3.5 3.5-1.59c.78-.36.78-1.47 0-1.82L11.5 9.5z" />
              </svg>
              各生成一张 ({schemes.length} 张)
            </button>
          )}
          {costPerImage !== null && (
            <p className="text-center text-2xs text-on-surface-variant/60">
              预估费用约 ${(costPerImage * schemes.length).toFixed(3)}
              <span className="ml-1 opacity-70">({schemes.length} 张 x ${costPerImage.toFixed(3)})</span>
            </p>
          )}
        </div>
      )}

      {/* Mode indicator */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => updateField('mode', 'generate')}
          className={`px-3 py-1 text-xs rounded-full transition-colors
            ${!isEdit ? 'bg-primary-dim text-primary font-semibold hover:bg-primary/15 active:bg-primary/20' : 'bg-surface-container-high text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}
        >
          生成
        </button>
        <button
          type="button"
          onClick={() => updateField('mode', 'edit')}
          className={`px-3 py-1 text-xs rounded-full transition-colors
            ${isEdit ? 'bg-primary-dim text-primary font-semibold hover:bg-primary/15 active:bg-primary/20' : 'bg-surface-container-high text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}
        >
          编辑
        </button>
      </div>

      {/* Fields for current scheme */}
      {fieldDefs.map(({ key, label, placeholder }) => {
        if (!isFieldVisible(key)) return null
        const value = fields[key] as string

        return (
          <div key={key}>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">
              {label}
            </label>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                updateField(key, e.target.value)
                autoResize(e.target)
              }}
              placeholder={placeholder}
              rows={1}
              className="w-full box-border min-h-11 px-3 py-2 text-sm leading-5 bg-surface-container-high rounded-xl
                         border-b-2 border-b-transparent
                         hover:bg-surface-container-high
                         focus:bg-surface-container-high focus:border-b-primary focus:outline-none
                         placeholder:text-on-surface-variant/50 resize-none transition-colors
                         overflow-hidden md:min-h-0 md:py-2 md:text-xs md:leading-4"
            />
          </div>
        )
      })}

      {/* Buttons to reveal hidden empty fields */}
      {hiddenFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hiddenFields.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setExpanded((prev) => new Set(prev).add(key))}
              className="px-3 py-1 text-xs rounded-full transition-colors
                         bg-surface-container-high text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12"
            >
              + {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
