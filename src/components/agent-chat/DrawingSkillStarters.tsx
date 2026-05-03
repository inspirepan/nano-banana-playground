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
  const railMask = 'linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%)'
  return (
    <div className="mx-auto w-full max-w-[960px]">
      <div className="mb-10 text-center">
        <span className="text-[11px] font-normal uppercase tracking-[0.5em] text-(--color-text-3)">
          {t('agentChat.empty.skillStarter.title')}
        </span>
      </div>
      <div
        className="flex snap-x gap-[2px] overflow-x-auto px-7 py-1.5 scroll-pl-7 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', WebkitMaskImage: railMask, maskImage: railMask }}
      >
        {skills.map((skill) => (
          <button
            key={skill.name}
            type="button"
            onClick={() => onPick(skill)}
            className={`group relative h-[192px] w-[140px] shrink-0 snap-start overflow-hidden text-left transition-[filter] hover:brightness-110 sm:w-[152px] ${skill.previewImage ? 'bg-(--color-accent-wash-2)' : 'bg-(--color-bg)'}`}
          >
            {skill.previewImage ? (
              <img src={skill.previewImage} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-(--color-text-3)">
                <SkillIcon name={skill.icon} size={36} strokeWidth={1.25} />
              </span>
            )}
            <span
              className="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-6"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 100%)' }}
            >
              <span className="block truncate text-xs font-normal leading-tight text-white drop-shadow-sm">
                {displayNameForLanguage(skill, language)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
