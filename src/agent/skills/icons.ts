import type { IconName as LucideDynamicIconName } from 'lucide-react/dynamic'

export type AgentSkillIconName = LucideDynamicIconName

export const DEFAULT_SKILL_ICON: AgentSkillIconName = 'sparkles'

export function normalizeSkillIcon(value: string | undefined | null): AgentSkillIconName {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized ? (normalized as AgentSkillIconName) : DEFAULT_SKILL_ICON
}
