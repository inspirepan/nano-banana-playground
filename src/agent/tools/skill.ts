import { Type } from '@mariozechner/pi-ai'

import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import description from './skill.md?raw'
import { translate } from '../../i18n'
import { parseSkillFrontmatter } from '../skills/frontmatter'
import { normalizeSkillName } from '../skills/normalize'
import { buildSkillFileTree, findAgentSkill } from '../skills/registry'

export type SkillToolArgs = {
  skill: string
}

export type SkillExecutor = (toolCallId: string, args: SkillToolArgs) => Promise<AgentToolResult>

export function prepareSkillArgs(args: unknown): SkillToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const raw = typeof record.skill === 'string' ? record.skill : ''
  return { skill: normalizeSkillName(raw.replace(/^\/+/, '')) }
}

export function formatLoadedSkillText(skillName: string): AgentToolResult {
  const skill = findAgentSkill(skillName, { enabledOnly: true })
  if (!skill) {
    const text = '<tool_use_error>Unknown or disabled skill.</tool_use_error>'
    return { content: [{ type: 'text', text }], details: { status: 'error', skill: skillName } }
  }
  const root = skill.files.find((file) => file.path === 'SKILL.md')
  if (!root) {
    const text = '<tool_use_error>Skill has no SKILL.md file.</tool_use_error>'
    return { content: [{ type: 'text', text }], details: { status: 'error', skill: skill.name } }
  }
  const { body } = parseSkillFrontmatter(root.content)
  const tree = buildSkillFileTree(skill.files)
  const text = [
    `<skill name="${skill.name}" source="${skill.source}">`,
    `Base directory for this skill: virtual://skills/${skill.name}`,
    '',
    'Available markdown files:',
    tree,
    '',
    body.trim(),
    '</skill>',
  ].join('\n')
  return {
    content: [{ type: 'text', text }],
    details: {
      status: 'loaded',
      skill: skill.name,
      source: skill.source,
      icon: skill.icon,
      files: skill.files.map((file) => file.path),
    },
  }
}

export function createSkillTool({ loadSkill }: { loadSkill: SkillExecutor }): AgentRuntimeTool {
  return {
    name: 'Skill',
    label: translate('configLib.agent.tool.skill'),
    description: description.trim(),
    parameters: Type.Object({
      skill: Type.String({ description: 'Skill name, for example "skill-creator" or "baoyu-cover-image".' }),
    }),
    prepareArguments: prepareSkillArgs,
    execute: (toolCallId: string, args: SkillToolArgs) => loadSkill(toolCallId, prepareSkillArgs(args)),
  } as AgentRuntimeTool
}
