import type { AgentSkillSummary } from './types'

const MAX_SKILL_DESCRIPTION_CHARS = 300

function truncateDescription(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > MAX_SKILL_DESCRIPTION_CHARS
    ? `${normalized.slice(0, MAX_SKILL_DESCRIPTION_CHARS - 1)}…`
    : normalized
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildAvailableSkillsSystemMessage(skills: AgentSkillSummary[]): string | null {
  const enabled = skills.filter((skill) => skill.enabled)
  if (enabled.length === 0) return null
  const lines = ['<system>', 'Available skills are listed below.']
  lines.push('Users can activate a skill by typing its slash command, for example /skill-name.')
  lines.push(
    'When a slash command activates a skill, its full instructions are already included in the same turn; follow those instructions directly.',
  )
  lines.push('When a skill matches the user request, call the Skill tool with that skill name before continuing.')
  lines.push(
    'If the current turn already includes loaded skill content from a slash command, follow it directly instead of calling the Skill tool again.',
  )
  lines.push('Use ReadSkillFile only for files inside an already loaded skill package.')
  lines.push('Use CreateSkill when the user asks to create, save, or persist a reusable skill.')
  lines.push('<available_skills>')
  for (const skill of enabled) {
    lines.push('  <skill>')
    lines.push(`    <name>${escapeXmlText(skill.name)}</name>`)
    lines.push(`    <description>${escapeXmlText(truncateDescription(skill.agentDescription))}</description>`)
    lines.push(`    <icon>${escapeXmlText(skill.icon)}</icon>`)
    lines.push(`    <source>${skill.source}</source>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  lines.push('</system>')
  return lines.join('\n')
}
