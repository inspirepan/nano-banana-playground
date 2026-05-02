import type { AgentSkillSummary } from '../../agent'

export function isDrawingSkill(skill: AgentSkillSummary): boolean {
  if (!skill.enabled) return false
  const text = [skill.name, skill.agentDescription, skill.displayDescription['zh-CN'], skill.displayDescription.en]
    .join(' ')
    .toLowerCase()
  return /image|generate|generation|cover|sketch|illustration|draw|drawing|visual|nano.?banana|生图|画图|绘图|插画|封面|视觉/.test(
    text,
  )
}
