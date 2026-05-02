import type { AgentSkillSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { SkillIcon } from '../SkillIcon'

export function DrawingSkillStarters({
  skills,
  onPick,
}: {
  skills: AgentSkillSummary[]
  onPick: (skill: AgentSkillSummary) => void
}) {
  const { t, language } = useI18n()
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="label mb-2 text-center">{t('agentChat.empty.skillStarter.title')}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {skills.map((skill) => {
          const description = skill.displayDescriptionKey
            ? t(skill.displayDescriptionKey)
            : skill.displayDescription[language] || skill.displayDescription['zh-CN'] || skill.displayDescription.en
          const hasDisplayName = Boolean(skill.displayNameKey)
          const displayName = hasDisplayName ? t(skill.displayNameKey!) : skill.name
          return (
            <button
              key={skill.name}
              type="button"
              onClick={() => onPick(skill)}
              className="group max-w-[250px] rounded-[var(--radius-md)] bg-(--color-surface) px-3 py-2 text-left shadow-[0_0_0_1px_var(--ring-edge-soft),var(--shadow-lift)] transition-[box-shadow,background-color,transform] hover:-translate-y-px hover:bg-(--color-surface-2) hover:shadow-[0_0_0_1px_var(--ring-edge-strong),var(--shadow-float)]"
            >
              <span className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-(--color-accent)"
                  style={{ background: 'var(--color-accent-wash-2)' }}
                >
                  <SkillIcon name={skill.icon} size={11} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[12px] ${hasDisplayName ? 'font-medium' : 'mono font-semibold'} text-(--color-text-2) group-hover:text-(--color-accent)`}
                  >
                    {displayName}
                  </span>
                  <span className="mt-0.5 block overflow-hidden text-[12px] leading-[1.35] text-(--color-text-3) [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {description}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
