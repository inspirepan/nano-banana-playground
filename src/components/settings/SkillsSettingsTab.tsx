import type { AgentSkill, AgentSkillCreateInput, AgentSkillSummary } from '../../agent'
import { useI18n } from '../../i18n'
import { AgentSkillSettings } from '../AgentSkillSettings'

type SkillsSettingsTabProps = {
  agentSkills: AgentSkillSummary[]
  onAgentSkillEnabledChange: (name: string, enabled: boolean) => void
  onDeleteAgentSkill: (name: string) => void
  onGetAgentSkillPackage: (name: string) => AgentSkill | null
  onCreateAgentSkill: (input: AgentSkillCreateInput) => void
}

export function SkillsSettingsTab({
  agentSkills,
  onAgentSkillEnabledChange,
  onDeleteAgentSkill,
  onGetAgentSkillPackage,
  onCreateAgentSkill,
}: SkillsSettingsTabProps) {
  const { t } = useI18n()

  return (
    <div className="px-5 py-4">
      <p className="mb-3 text-sm leading-relaxed text-(--color-text-3)">{t('settings.agentSkills.description')}</p>
      <div className="pl-2">
        <AgentSkillSettings
          skills={agentSkills}
          onEnabledChange={onAgentSkillEnabledChange}
          onDelete={onDeleteAgentSkill}
          onGetPackage={onGetAgentSkillPackage}
          onCreate={onCreateAgentSkill}
        />
      </div>
    </div>
  )
}
