import { displayNameForLanguage, type AgentSkillSummary } from '../../agent'
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
        {skills.map((skill) => (
          <button
            key={skill.name}
            type="button"
            onClick={() => onPick(skill)}
            className="chip h-7 rounded-full px-3.5 text-sm"
          >
            <SkillIcon name={skill.icon} size={13} strokeWidth={2} />
            {displayNameForLanguage(skill, language)}
          </button>
        ))}
      </div>
    </div>
  )
}
