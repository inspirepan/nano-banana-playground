import type { AgentSkillSummary } from '../../agent'
import { MODEL_CONFIGS } from '../../config/models'
import { getProviderConfig } from '../../config/providers'
import { useI18n } from '../../i18n'
import { BrandIcon, Icon } from '../Icon'
import { DrawingSkillStarters } from './DrawingSkillStarters'

const ASPECT_RATIO_QUICK_PICKS = ['1:1', '16:9', '9:16', '3:4', '4:3', '21:9', '2:3', '3:2'] as const
const RESOLUTION_QUICK_PICKS = ['1K', '2K', '4K'] as const

type Props = {
  drawingSkills: AgentSkillSummary[]
  onPickSkill: (skill: AgentSkillSummary) => void
  onInsertText: (text: string) => void
}

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
        className="rounded-[2px] bg-transparent"
        style={{
          width: gw,
          height: gh,
          boxShadow: 'inset 0 0 0 1px var(--color-border-strong)',
        }}
      />
    </span>
  )
}

export function AgentChatEmptyState({ drawingSkills, onPickSkill, onInsertText }: Props) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[280px] flex-col justify-center gap-20">
      {drawingSkills.length > 0 ? (
        <DrawingSkillStarters skills={drawingSkills} onPick={onPickSkill} />
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
      <div className="flex w-full flex-col items-stretch gap-2">
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          {ASPECT_RATIO_QUICK_PICKS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onInsertText(ratio)}
              className="chip group gap-1.5 px-2 text-sm tabular-nums"
              style={{ height: 26 }}
            >
              <Icon name="plus" size={11} className="shrink-0 text-(--color-text-4)" />
              <AspectGlyph ratio={ratio} />
              <span>{ratio}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          {RESOLUTION_QUICK_PICKS.map((resolution) => (
            <button
              key={resolution}
              type="button"
              onClick={() => onInsertText(resolution)}
              className="chip gap-1.5 px-2 text-sm tabular-nums"
              style={{ height: 26 }}
            >
              <Icon name="plus" size={11} className="shrink-0 text-(--color-text-4)" />
              <span>{resolution}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          {MODEL_CONFIGS.map((modelConfig) => (
            <button
              key={modelConfig.id}
              type="button"
              onClick={() => onInsertText(modelConfig.name)}
              className="chip gap-1.5 px-2 text-sm"
              style={{ height: 26 }}
            >
              <Icon name="plus" size={11} className="shrink-0 text-(--color-text-4)" />
              <BrandIcon
                name={getProviderConfig(modelConfig.provider).brandIcon}
                size={12}
                className="shrink-0 text-(--color-text-3)"
              />
              <span>{modelConfig.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
