import { Type } from '@mariozechner/pi-ai'

import description from './readSkillFile.md?raw'
import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import { translate } from '../../i18n'
import { normalizeSkillName, normalizeSkillPath } from '../skills/normalize'
import { readAgentSkillFile } from '../skills/registry'

export type ReadSkillFileToolArgs = {
  skill: string
  path: string
}

export type ReadSkillFileExecutor = (toolCallId: string, args: ReadSkillFileToolArgs) => Promise<AgentToolResult>

export function prepareReadSkillFileArgs(args: unknown): ReadSkillFileToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  return {
    skill: normalizeSkillName(typeof record.skill === 'string' ? record.skill.replace(/^\/+/, '') : ''),
    path: normalizeSkillPath(typeof record.path === 'string' ? record.path : ''),
  }
}

export function formatReadSkillFileResult(skillName: string, path: string): AgentToolResult {
  const result = readAgentSkillFile(skillName, path)
  if (!result) {
    const text = '<tool_use_error>Skill file does not exist or is not allowed.</tool_use_error>'
    return { content: [{ type: 'text', text }], details: { status: 'error', skill: skillName, path } }
  }
  const text = [
    `<skill_file skill="${result.skill.name}" path="${result.file.path}">`,
    result.file.content,
    '</skill_file>',
  ].join('\n')
  return {
    content: [{ type: 'text', text }],
    details: { status: 'ready', skill: result.skill.name, path: result.file.path },
  }
}

export function createReadSkillFileTool({ readSkillFile }: { readSkillFile: ReadSkillFileExecutor }): AgentRuntimeTool {
  return {
    name: 'ReadSkillFile',
    label: translate('configLib.agent.tool.readSkillFile'),
    description: description.trim(),
    parameters: Type.Object({
      skill: Type.String({ description: 'Skill name.' }),
      path: Type.String({ description: 'Relative markdown file path inside the skill package.' }),
    }),
    prepareArguments: prepareReadSkillFileArgs,
    execute: (toolCallId: string, args: ReadSkillFileToolArgs) =>
      readSkillFile(toolCallId, prepareReadSkillFileArgs(args)),
  } as AgentRuntimeTool
}
