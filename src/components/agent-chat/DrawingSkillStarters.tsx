import { useCallback, useState } from 'react'
import { displayNameForLanguage, type AgentSkillSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { SkillIcon } from '../SkillIcon'

const MOBILE_SKILL_STARTER_MEDIA = '(max-width: 639px)'

export function DrawingSkillStarters({
  skills,
  confirmBeforePick,
  onPick,
}: {
  skills: AgentSkillSummary[]
  confirmBeforePick: boolean
  onPick: (skill: AgentSkillSummary) => void
}) {
  const { t, language } = useI18n()
  const [confirmingSkillName, setConfirmingSkillName] = useState<string | null>(null)
  const centerMobileStarter = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || typeof window === 'undefined' || !window.matchMedia(MOBILE_SKILL_STARTER_MEDIA).matches) return
      if (skills.length < 2 || node.scrollWidth <= node.clientWidth) return

      const target = node.children.item(Math.floor(skills.length / 2))
      if (!(target instanceof HTMLElement)) return

      node.scrollLeft = Math.max(0, target.offsetLeft - (node.clientWidth - target.offsetWidth) / 2)
    },
    [skills.length],
  )

  const handlePick = (skill: AgentSkillSummary) => {
    if (confirmBeforePick && confirmingSkillName !== skill.name) {
      setConfirmingSkillName(skill.name)
      return
    }
    setConfirmingSkillName(null)
    onPick(skill)
  }

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <div
        ref={centerMobileStarter}
        className="scroll-fade-x grid auto-cols-[124px] grid-flow-col grid-rows-1 snap-x gap-2.5 overflow-x-auto px-7 py-2 scroll-pl-7 [--scroll-fade-end-size:3rem] [--scroll-fade-start-size:3rem] sm:auto-cols-[136px] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {skills.map((skill) => {
          const confirming = confirmBeforePick && confirmingSkillName === skill.name
          return (
            <button
              key={skill.name}
              type="button"
              onClick={() => handlePick(skill)}
              className="img-card group h-[166px] w-full snap-start text-left outline-none transition-[box-shadow,filter,transform] duration-[160ms] ease-[var(--ease-out)] active:scale-[0.98] focus-visible:shadow-[0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)] sm:h-[178px]"
            >
              {skill.previewImage ? (
                <img
                  src={skill.previewImage}
                  alt=""
                  className="h-full w-full object-cover transition-[filter] duration-[160ms] ease-[var(--ease-out)] group-hover:brightness-[1.04]"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-(--color-bg-sunken) text-(--color-text-3)">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
                    <SkillIcon name={skill.icon} size={28} strokeWidth={1.35} />
                  </span>
                </span>
              )}
              {skill.previewImage ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_top,rgb(0_0_0_/_0.58),transparent)]" />
              ) : null}
              {confirming ? (
                <span className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-(--color-surface)/90 px-2 pb-2 text-left backdrop-blur-[2px]">
                  <span className="text-xs font-medium leading-tight text-(--color-text)">
                    {t('agentChat.empty.skillStarter.overwriteTitle')}
                  </span>
                  <span className="mt-1 text-xs leading-tight text-(--color-accent-text)">
                    {t('agentChat.empty.skillStarter.overwriteConfirm')}
                  </span>
                </span>
              ) : (
                <span className="absolute inset-x-2 bottom-2 flex min-h-6 items-end">
                  <span
                    className={`block truncate text-xs font-medium leading-tight ${skill.previewImage ? 'text-white drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.9)]' : 'text-(--color-text)'}`}
                  >
                    {displayNameForLanguage(skill, language)}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
