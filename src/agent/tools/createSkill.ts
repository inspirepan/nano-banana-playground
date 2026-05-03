import { Type } from '@mariozechner/pi-ai'

import description from './createSkill.md?raw'
import { type AgentToolResult, type AgentRuntimeTool } from './shared'
import { translate } from '../../i18n'
import { normalizeSkillIcon } from '../skills/icons'
import { normalizeSkillFiles, normalizeSkillName } from '../skills/normalize'
import type { AgentSkillCreateInput, AgentSkillFile } from '../skills/types'

export type CreateSkillToolArgs = AgentSkillCreateInput

export type CreateSkillExecutor = (toolCallId: string, args: CreateSkillToolArgs) => Promise<AgentToolResult>

function normalizeFile(value: unknown): AgentSkillFile | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const path = typeof record.path === 'string' ? record.path : ''
  const content = typeof record.content === 'string' ? record.content : ''
  return { path, content }
}

export function prepareCreateSkillArgs(args: unknown): CreateSkillToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const rawFiles = Array.isArray(record.files) ? record.files : []
  const files = normalizeSkillFiles(rawFiles.map(normalizeFile).filter((file): file is AgentSkillFile => file !== null))
  const nameZh =
    typeof record.display_name_zh === 'string'
      ? record.display_name_zh
      : typeof record.displayNameZh === 'string'
        ? record.displayNameZh
        : ''
  const nameEn =
    typeof record.display_name_en === 'string'
      ? record.display_name_en
      : typeof record.displayNameEn === 'string'
        ? record.displayNameEn
        : ''
  const zh =
    typeof record.display_description_zh === 'string'
      ? record.display_description_zh
      : typeof record.displayDescriptionZh === 'string'
        ? record.displayDescriptionZh
        : ''
  const en =
    typeof record.display_description_en === 'string'
      ? record.display_description_en
      : typeof record.displayDescriptionEn === 'string'
        ? record.displayDescriptionEn
        : ''
  return {
    name: normalizeSkillName(typeof record.name === 'string' ? record.name : ''),
    agentDescription:
      typeof record.agent_description === 'string'
        ? record.agent_description
        : typeof record.agentDescription === 'string'
          ? record.agentDescription
          : '',
    displayName: { 'zh-CN': nameZh, en: nameEn },
    displayDescription: { 'zh-CN': zh, en },
    icon: normalizeSkillIcon(
      typeof record.icon === 'string'
        ? record.icon
        : typeof record.icon_name === 'string'
          ? record.icon_name
          : typeof record.iconName === 'string'
            ? record.iconName
            : undefined,
    ),
    files,
    enabled: record.enabled === undefined ? true : record.enabled === true || record.enabled === 'true',
  }
}

export function createCreateSkillTool({ createSkill }: { createSkill: CreateSkillExecutor }): AgentRuntimeTool {
  return {
    name: 'CreateSkill',
    label: translate('configLib.agent.tool.createSkill'),
    description: description.trim(),
    parameters: Type.Object({
      name: Type.String({ description: 'Lowercase kebab-case skill name.' }),
      agent_description: Type.String({
        description: 'Discovery description shown to the agent before loading the skill.',
      }),
      display_name_zh: Type.String({ description: 'Simplified Chinese display name for the UI.' }),
      display_name_en: Type.String({ description: 'English display name for the UI.' }),
      display_description_zh: Type.String({
        description: 'One-line Simplified Chinese description for the settings UI.',
      }),
      display_description_en: Type.String({ description: 'One-line English description for the settings UI.' }),
      icon: Type.Optional(Type.String({ description: 'Lucide icon name in kebab-case, for example "image".' })),
      files: Type.Array(
        Type.Object({
          path: Type.String({ description: 'Relative markdown path, usually SKILL.md.' }),
          content: Type.String({ description: 'Markdown file content.' }),
        }),
        { description: 'Markdown files in the virtual skill package.' },
      ),
      enabled: Type.Optional(Type.Boolean({ description: 'Whether the skill should be enabled immediately.' })),
    }),
    prepareArguments: prepareCreateSkillArgs,
    execute: (toolCallId: string, args: CreateSkillToolArgs) => createSkill(toolCallId, prepareCreateSkillArgs(args)),
  } as AgentRuntimeTool
}
