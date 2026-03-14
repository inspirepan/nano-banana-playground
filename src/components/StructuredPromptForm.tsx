import { useState, useCallback } from 'react'
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

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
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

  const updateField = (key: FieldKey, value: string) => {
    onChangeScheme(currentIndex, { ...fields, [key]: value })
  }

  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) autoResize(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  const isFieldVisible = (key: FieldKey): boolean => {
    if (coreFields.has(key)) return true
    if ((fields[key] as string).trim() !== '') return true
    if (expanded.has(key)) return true
    return false
  }

  const hiddenFields = fieldDefs.filter(({ key }) => !isFieldVisible(key))

  return (
    <div className="flex flex-col gap-3">
      {/* Scheme cards */}
      {schemes.length > 1 && (
        <div className="flex flex-col gap-2 ml-1">
          <p className="text-[11px] text-on-surface-variant/60 leading-snug">
            AI 生成了 {schemes.length} 个创意方案，选择一个查看和编辑，或一键全部生成
          </p>
          {schemes.map((scheme, i) => {
            const isSelected = i === currentIndex
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectScheme(i)}
                className={`flex items-start gap-2.5 text-left px-3 py-2.5 rounded-2xl transition-colors w-full
                  ${isSelected
                    ? 'bg-primary-dim'
                    : 'bg-surface-container hover:bg-surface-container-high'
                  }`}
              >
                <span className={`mt-0.5 inline-block w-3.5 h-3.5 rounded-full border-2 shrink-0
                  ${isSelected
                    ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_var(--color-primary-dim)]'
                    : 'border-on-surface-variant/40 bg-transparent'
                  }`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold leading-none ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                    {scheme.title}
                  </div>
                  <div className={`mt-1 text-[11px] leading-snug ${isSelected ? 'text-primary/70' : 'text-on-surface-variant'}`}>
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
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl transition-colors
                         bg-error text-on-primary hover:bg-error/90
                         text-xs font-medium"
            >
              取消生成
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerateAll}
              onMouseEnter={() => onDraftBatchOverride(schemes.length)}
              onMouseLeave={() => onDraftBatchOverride(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl transition-colors
                         bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white
                         dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-600 dark:hover:text-white
                         text-xs font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.46 8l.79-1.75L22 5.46c.39-.18.39-.73 0-.91l-1.75-.79L19.46 2c-.18-.39-.73-.39-.91 0l-.79 1.75-1.76.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.74.39.92 0zM11.5 9.5L9.91 6c-.35-.78-1.47-.78-1.82 0L6.5 9.5 3 11.09c-.78.36-.78 1.47 0 1.82l3.5 1.59L8.09 18c.36.78 1.47.78 1.82 0l1.59-3.5 3.5-1.59c.78-.36.78-1.47 0-1.82L11.5 9.5z" />
              </svg>
              各生成一张 ({schemes.length} 张)
            </button>
          )}
          {costPerImage !== null && (
            <p className="text-center text-[11px] text-on-surface-variant/60 -mt-0.5">
              预估费用约 ${(costPerImage * schemes.length).toFixed(3)}
              <span className="ml-1 opacity-70">({schemes.length} 张 x ${costPerImage.toFixed(3)})</span>
            </p>
          )}
        </div>
      )}

      {/* Mode indicator */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => updateField('mode', 'generate')}
          className={`px-3 py-1 text-xs rounded-full transition-colors
            ${!isEdit ? 'bg-primary-dim text-primary font-semibold' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
        >
          生成
        </button>
        <button
          type="button"
          onClick={() => updateField('mode', 'edit')}
          className={`px-3 py-1 text-xs rounded-full transition-colors
            ${isEdit ? 'bg-primary-dim text-primary font-semibold' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
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
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
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
              className="w-full px-3 py-2 text-sm bg-surface-container rounded-xl
                         border-b-2 border-b-transparent
                         hover:bg-surface-container-high
                         focus:bg-surface-container-high focus:border-b-primary focus:outline-none
                         placeholder:text-on-surface-variant/50 resize-none transition-colors
                         overflow-hidden"
            />
          </div>
        )
      })}

      {/* Buttons to reveal hidden empty fields */}
      {hiddenFields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hiddenFields.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setExpanded((prev) => new Set(prev).add(key))}
              className="px-2.5 py-1 text-xs rounded-full transition-colors
                         bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            >
              + {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
