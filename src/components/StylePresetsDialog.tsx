import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BUILTIN_STYLE_PRESETS } from '../config/styles'
import {
  createUserStylePreset,
  deleteUserStylePreset,
  getUserStylePresets,
  updateUserStylePreset,
} from '../lib/stylePresets'
import { Icon } from './Icon'

type Props = {
  open: boolean
  onClose: () => void
  onChanged: () => void
}

type Draft = {
  id: string | null  // null = new
  label: string
  category: string
  description: string
  promptSnippet: string
}

const EMPTY_DRAFT: Draft = { id: null, label: '', category: '', description: '', promptSnippet: '' }

export function StylePresetsDialog({ open, onClose, onChanged }: Props) {
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // revision bumps whenever CRUD mutates localStorage so the list re-reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const userPresets = useMemo(() => getUserStylePresets(), [revision])

  if (!open) return null

  const commit = () => {
    if (!draft) return
    const label = draft.label.trim()
    if (!label && !draft.id) return  // refuse empty on create
    if (draft.id) {
      updateUserStylePreset(draft.id, {
        label: draft.label,
        category: draft.category,
        description: draft.description,
        promptSnippet: draft.promptSnippet,
      })
    } else {
      createUserStylePreset({
        label: draft.label,
        category: draft.category || undefined,
        description: draft.description || undefined,
        promptSnippet: draft.promptSnippet,
      })
    }
    setDraft(null)
    setRevision((r) => r + 1)
    onChanged()
  }

  const remove = (id: string) => {
    deleteUserStylePreset(id)
    if (draft?.id === id) setDraft(null)
    setRevision((r) => r + 1)
    onChanged()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="风格预设"
        className="relative w-full max-w-2xl max-h-[85vh] rounded-[10px] bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),0_10px_28px_-12px_rgba(30,27,20,0.18),0_2px_6px_rgba(30,27,20,0.06)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-(--color-border) shrink-0">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">风格预设</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="关闭">
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Builtin */}
          <div>
            <div className="label mb-1.5">内置（只读）</div>
            <div className="flex flex-col gap-1.5">
              {BUILTIN_STYLE_PRESETS.map((p) => (
                <div key={p.id} className="rounded-[6px] px-3 py-2" style={{ background: 'var(--color-surface-2)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium">{p.label}</span>
                    {p.category && <span className="text-[11px] text-(--color-text-4)">· {p.category}</span>}
                  </div>
                  {p.description && (
                    <div className="mt-0.5 text-[11.5px] text-(--color-text-3)">{p.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* User */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="label">自定义</div>
              {!draft && (
                <button
                  type="button"
                  onClick={() => setDraft(EMPTY_DRAFT)}
                  className="chip ghost"
                  style={{ height: 24, padding: '0 8px', fontSize: 11.5 }}
                >
                  <Icon name="plus" size={12} /> 新建
                </button>
              )}
            </div>

            {userPresets.length === 0 && !draft && (
              <div className="text-[11.5px] text-(--color-text-4)">还没有自定义风格。点击"新建"添加你自己的风格片段。</div>
            )}

            <div className="flex flex-col gap-1.5">
              {userPresets.map((p) => (
                <div key={p.id} className="rounded-[6px] px-3 py-2" style={{ background: 'var(--color-surface)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium">{p.label}</span>
                    {p.category && <span className="text-[11px] text-(--color-text-4)">· {p.category}</span>}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setDraft({ id: p.id, label: p.label, category: p.category ?? '', description: p.description ?? '', promptSnippet: p.promptSnippet })}
                      className="bg-transparent border-0 p-0 text-[11.5px] text-(--color-text-3) hover:text-(--color-text) transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="bg-transparent border-0 p-0 text-[11.5px] text-(--color-text-3) hover:text-(--color-danger) transition-colors"
                    >
                      删除
                    </button>
                  </div>
                  {p.description && <div className="mt-0.5 text-[11.5px] text-(--color-text-3)">{p.description}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Edit form */}
          {draft && (
            <div className="rounded-[8px] px-4 py-3" style={{ background: 'var(--color-accent-soft)', boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}>
              <div className="text-[12px] font-medium mb-2">{draft.id ? '编辑风格' : '新建风格'}</div>
              <div className="flex flex-col gap-2">
                <Field label="名称">
                  <input
                    type="text"
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="炭笔素描 · Clean Light"
                    className="w-full rounded-[6px] bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] focus:outline-none"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                  />
                </Field>
                <Field label="分组（可选）">
                  <input
                    type="text"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    placeholder="Editorial Sketch"
                    className="w-full rounded-[6px] bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] focus:outline-none"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                  />
                </Field>
                <Field label="一句话说明（可选）">
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="鼠标悬停时显示"
                    className="w-full rounded-[6px] bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] focus:outline-none"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                  />
                </Field>
                <Field label="风格片段">
                  <textarea
                    value={draft.promptSnippet}
                    onChange={(e) => setDraft({ ...draft, promptSnippet: e.target.value })}
                    placeholder="会作为风格段落附加到增强提示词里，请尽量自包含、描述清晰"
                    rows={6}
                    className="w-full rounded-[6px] bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] leading-[1.55] focus:outline-none resize-y"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge)' }}
                  />
                </Field>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setDraft(null)} className="chip ghost" style={{ height: 26, padding: '0 10px', fontSize: 12 }}>
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={commit}
                    disabled={!draft.label.trim()}
                    className="chip accent-active"
                    style={{ height: 26, padding: '0 10px', fontSize: 12 }}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-[11.5px] leading-relaxed text-(--color-text-3)">
            自定义风格保存在当前浏览器的 localStorage。
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-(--color-text-3) tracking-[0.02em]">{label}</span>
      {children}
    </label>
  )
}
