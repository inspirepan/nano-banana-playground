import { useLayoutEffect, useRef } from 'react'

import { useI18n } from '../../../i18n'
import { Icon } from '../../Icon'

type Props = {
  prompt: string
  setPrompt: (value: string) => void
  placeholder: string
  autoFocus: boolean
}

export function EditPromptField({ prompt, setPrompt, placeholder, autoFocus }: Props) {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight + 2, 96)}px`
  }, [prompt])

  return (
    <div className="mb-[18px]">
      <div className="label mb-1.5">{t('imageDetail.editPrompt.label')}</div>
      <div className="prompt-wrap">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="block w-full resize-none bg-transparent px-3 py-2.5 text-[16px] leading-[1.55] focus:outline-none md:text-base"
          autoFocus={autoFocus}
        />
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-(--color-text-3) shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
          <span className="text-sm text-(--color-text-3)">
            {t('imageDetail.editPrompt.charCount', { count: prompt.length })}
          </span>
          <div className="flex-1" />
          {prompt.length > 0 && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-sm text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
            >
              <Icon name="close" size={11} /> {t('common.clear')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
