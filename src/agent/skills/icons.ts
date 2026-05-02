import { iconNames, type IconName as LucideDynamicIconName } from 'lucide-react/dynamic'

export type AgentSkillIconName = LucideDynamicIconName

export const DEFAULT_SKILL_ICON: AgentSkillIconName = 'sparkles'

const ICON_NAMES = new Set<string>(iconNames)

export function normalizeSkillIcon(value: string | undefined | null): AgentSkillIconName {
  const normalized = (value ?? '').trim().toLowerCase()
  return ICON_NAMES.has(normalized) ? (normalized as AgentSkillIconName) : DEFAULT_SKILL_ICON
}
