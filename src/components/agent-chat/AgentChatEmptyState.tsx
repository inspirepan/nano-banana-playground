import { useRef, type PointerEvent } from 'react'

import type { AgentSkillSummary } from '../../agent'
import { MODEL_CONFIGS } from '../../config/models'
import { getProviderConfig } from '../../config/providers'
import { useI18n } from '../../i18n'
import { BrandIcon, Icon } from '../Icon'
import { CollapsibleDrawingSkillStarters } from './DrawingSkillStarters'

const ASPECT_RATIO_QUICK_PICKS = ['1:1', '16:9', '9:16', '3:4', '4:3', '21:9', '2:3', '3:2'] as const
const RESOLUTION_QUICK_PICKS = ['1K', '2K', '4K'] as const

type Props = {
  drawingSkills: AgentSkillSummary[]
  onPickSkill: (skill: AgentSkillSummary) => void
  onInsertText: (text: string) => void
}

// Aspect glyph mirrors `.aspect-tile .glyph` (2px radius, inset hairline ring)
// from AspectRatioSelector so the two call sites read as the same control.
function AspectGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(':').map(Number)
  const max = 10
  let gw: number
  let gh: number
  const r = w / h
  if (r === 1) {
    gw = 8
    gh = 8
  } else if (r > 1) {
    gw = max
    gh = Math.max(3, Math.round(max / r))
  } else {
    gh = max
    gw = Math.max(3, Math.round(max * r))
  }
  return (
    <span className="flex h-[12px] w-[12px] shrink-0 items-center justify-center" aria-hidden>
      <span
        className="bg-transparent shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
        style={{
          width: gw,
          height: gh,
          borderRadius: 2,
        }}
      />
    </span>
  )
}

export function QuickCompletePanel({ onInsertText }: { onInsertText: (text: string) => void }) {
  const { t } = useI18n()
  const pointerHandledInsertRef = useRef(false)

  const handlePointerInsert = (event: PointerEvent<HTMLButtonElement>, text: string) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    if (!(document.activeElement instanceof HTMLTextAreaElement)) return

    event.preventDefault()
    pointerHandledInsertRef.current = true
    onInsertText(text)
  }

  const handleClickInsert = (text: string) => {
    if (pointerHandledInsertRef.current) {
      pointerHandledInsertRef.current = false
      return
    }
    onInsertText(text)
  }

  return (
    <div className="mx-auto w-full max-w-[980px] overflow-hidden rounded-[var(--radius-lg)] bg-(--color-bg) shadow-[inset_0_0_0_1px_var(--ring-edge)]">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.72fr)]">
        <section className="min-w-0 p-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-(--color-text-2)">
            <Icon name="bot" size={13} className="text-(--color-text-3)" />
            <span>{t('agentChat.empty.quick.model')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODEL_CONFIGS.map((modelConfig) => (
              <button
                key={modelConfig.id}
                type="button"
                onPointerDown={(event) => handlePointerInsert(event, modelConfig.name)}
                onClick={() => handleClickInsert(modelConfig.name)}
                className="chip min-w-0 gap-1.5 bg-transparent px-2.5 text-sm"
                style={{ height: 32 }}
              >
                <BrandIcon
                  name={getProviderConfig(modelConfig.provider).brandIcon}
                  size={13}
                  className="shrink-0 text-(--color-text-3)"
                />
                <span className="truncate">{modelConfig.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Dividers collapse to the top edge on mobile (stacked) and the left
           edge on md+ (side-by-side) so adjacent sections always sit flush. */}
        <section className="min-w-0 p-2 shadow-[inset_0_1px_0_var(--ring-edge-soft)] md:shadow-[inset_1px_0_0_var(--ring-edge-soft)]">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-(--color-text-2)">
            <Icon name="crop" size={13} className="text-(--color-text-3)" />
            <span>{t('agentChat.empty.quick.aspect')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_RATIO_QUICK_PICKS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onPointerDown={(event) => handlePointerInsert(event, ratio)}
                onClick={() => handleClickInsert(ratio)}
                className="chip gap-1.5 bg-transparent px-2.5 text-sm tabular-nums"
                style={{ height: 32 }}
              >
                <AspectGlyph ratio={ratio} />
                <span>{ratio}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0 p-2 shadow-[inset_0_1px_0_var(--ring-edge-soft)] md:shadow-[inset_1px_0_0_var(--ring-edge-soft)]">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-(--color-text-2)">
            <Icon name="maximize" size={13} className="text-(--color-text-3)" />
            <span>{t('agentChat.empty.quick.resolution')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RESOLUTION_QUICK_PICKS.map((resolution) => (
              <button
                key={resolution}
                type="button"
                onPointerDown={(event) => handlePointerInsert(event, resolution)}
                onClick={() => handleClickInsert(resolution)}
                className="chip gap-1.5 bg-transparent px-2.5 text-sm tabular-nums"
                style={{ height: 32 }}
              >
                <span>{resolution}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function AgentChatEmptyState({ drawingSkills, onPickSkill, onInsertText }: Props) {
  const { t } = useI18n()
  return (
    <div className="flex w-full min-w-0 flex-col justify-center gap-8 md:gap-6">
      {drawingSkills.length > 0 ? (
        <CollapsibleDrawingSkillStarters skills={drawingSkills} onPick={onPickSkill} />
      ) : (
        <div className="text-center">
          <div className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
            {t('agentChat.empty.title')}
          </div>
          <div className="mx-auto mt-1 max-w-[32ch] text-sm leading-[1.5] text-pretty text-(--color-text-3)">
            {t('agentChat.empty.description')}
          </div>
        </div>
      )}
      {/* Mobile: quick panel sits above the bottom composer inside the scroll
         area. Desktop centers composer with empty state, so quick panel is
         rendered below the composer by AgentChatPanel instead. */}
      <div className="md:hidden">
        <QuickCompletePanel onInsertText={onInsertText} />
      </div>
    </div>
  )
}
