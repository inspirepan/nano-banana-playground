import { useCallback } from 'react'
import type { StructuredPrompt } from '../lib/types'

type FieldKey = keyof StructuredPrompt

type FieldConfig = {
  key: FieldKey
  label: string
  placeholder: string
}

const FIELDS: FieldConfig[] = [
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

const CORE_FIELDS: Set<FieldKey> = new Set(['subject', 'scene', 'style'])

type Props = {
  fields: StructuredPrompt
  onChange: (fields: StructuredPrompt) => void
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function StructuredPromptForm({ fields, onChange }: Props) {
  const updateField = (key: FieldKey, value: string) => {
    onChange({ ...fields, [key]: value })
  }

  // Re-run autoResize when fields change (e.g. after API fills values)
  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) autoResize(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  const hiddenFields = FIELDS.filter(({ key }) =>
    !CORE_FIELDS.has(key) && fields[key].trim() === '',
  )

  return (
    <div className="flex flex-col gap-3">
      {FIELDS.map(({ key, label, placeholder }) => {
        const value = fields[key]
        if (!CORE_FIELDS.has(key) && value.trim() === '') return null

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
              onClick={() => onChange({ ...fields, [key]: ' ' })}
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
