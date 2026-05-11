import { getBuiltinAgentSkills } from './builtin'
import { parseSkillFrontmatter, type SkillFrontmatter } from './frontmatter'
import { normalizeSkillIcon } from './icons'
import {
  isSafeSkillPath,
  isValidSkillName,
  normalizeSkillFiles,
  normalizeSkillName,
  normalizeSkillPath,
} from './normalize'
import {
  deleteStoredUserSkill,
  loadSkillSettings,
  loadStoredUserSkills,
  setStoredSkillEnabled,
  upsertStoredUserSkill,
} from './storage'
import type { AgentSkill, AgentSkillCreateInput, AgentSkillFile, AgentSkillSummary } from './types'
import type { Language } from '../../config/languages'

const MAX_SKILL_FILES = 40
const MAX_SKILL_FILE_CHARS = 80_000

function summaryForSkill(skill: AgentSkill): AgentSkillSummary {
  const { files: _, ...summary } = skill
  return { ...summary, fileCount: skill.files.length }
}

function withSettingOverrides(skills: AgentSkill[]): AgentSkill[] {
  const settings = loadSkillSettings()
  return skills.map((skill) => ({ ...skill, enabled: settings[skill.name]?.enabled ?? skill.enabled }))
}

function userSkillToAgentSkill(skill: ReturnType<typeof loadStoredUserSkills>[number]): AgentSkill {
  const files = normalizeSkillFiles(skill.files)
  const root = files.find((file) => file.path === 'SKILL.md')
  const parsed = root ? parseSkillFrontmatter(root.content) : { frontmatter: {} as SkillFrontmatter }
  const name = normalizeSkillName(parsed.frontmatter.name || skill.name)
  const agentDescription =
    parsed.frontmatter.description?.trim() || skill.agentDescription?.trim() || `Use this skill for ${name}.`
  const displayDescription = localizedDescription(
    parsed.frontmatter.displayDescription,
    skill.displayDescription,
    agentDescription,
  )
  return {
    name,
    agentDescription,
    displayName: parsed.frontmatter.displayName ?? skill.displayName ?? {},
    displayDescription,
    starterExamples: parsed.frontmatter.starterExamples ?? skill.starterExamples ?? {},
    icon: normalizeSkillIcon(parsed.frontmatter.icon ?? skill.icon),
    previewImage: parsed.frontmatter.previewImage,
    source: 'user',
    enabled: skill.enabled,
    files,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }
}

function localizedDescription(
  primary: Partial<Record<Language, string>> | undefined,
  fallback: Partial<Record<Language, string>> | undefined,
  defaultText: string,
): Record<Language, string> {
  const zh =
    primary?.['zh-CN']?.trim() ||
    fallback?.['zh-CN']?.trim() ||
    primary?.en?.trim() ||
    fallback?.en?.trim() ||
    defaultText
  const en =
    primary?.en?.trim() ||
    fallback?.en?.trim() ||
    primary?.['zh-CN']?.trim() ||
    fallback?.['zh-CN']?.trim() ||
    defaultText
  return { 'zh-CN': zh, en }
}

export function loadAgentSkills(): AgentSkill[] {
  const builtins = withSettingOverrides(getBuiltinAgentSkills())
  const builtinNames = new Set(builtins.map((skill) => skill.name))
  const userSkills = loadStoredUserSkills()
    .filter((skill) => !builtinNames.has(skill.name))
    .map(userSkillToAgentSkill)
  return withSettingOverrides([...builtins, ...userSkills]).sort((a, b) => a.name.localeCompare(b.name))
}

export function getAgentSkillSummaries(): AgentSkillSummary[] {
  return loadAgentSkills().map(summaryForSkill)
}

export function findAgentSkill(name: string, options?: { enabledOnly?: boolean }): AgentSkill | null {
  const normalized = normalizeSkillName(name)
  return (
    loadAgentSkills().find((skill) => skill.name === normalized && (!options?.enabledOnly || skill.enabled)) ?? null
  )
}

export function setAgentSkillEnabled(name: string, enabled: boolean): AgentSkillSummary[] {
  setStoredSkillEnabled(name, enabled)
  return getAgentSkillSummaries()
}

export function deleteAgentSkill(name: string): AgentSkillSummary[] {
  const skill = findAgentSkill(name)
  if (skill?.source === 'user') deleteStoredUserSkill(skill.name)
  return getAgentSkillSummaries()
}

export function displayDescriptionForSkill(skill: Pick<AgentSkill, 'displayDescription'>): string {
  return skill.displayDescription['zh-CN'] || skill.displayDescription.en || ''
}

export function displayDescriptionForLanguage(
  skill: Pick<AgentSkill, 'displayDescription'>,
  language: Language,
): string {
  return skill.displayDescription[language] || skill.displayDescription['zh-CN'] || skill.displayDescription.en || ''
}

export function displayNameForLanguage(skill: Pick<AgentSkill, 'name' | 'displayName'>, language: Language): string {
  return skill.displayName[language] || skill.displayName['zh-CN'] || skill.displayName.en || skill.name
}

export function displayNameForSkill(skill: Pick<AgentSkill, 'name' | 'displayName'>): string {
  return displayNameForLanguage(skill, 'zh-CN')
}

export function buildSkillFileTree(files: AgentSkillFile[]): string {
  return files
    .map((file) => `- ${file.path} (${file.content.length} chars)`)
    .sort((a, b) => (a.includes('SKILL.md') ? -1 : b.includes('SKILL.md') ? 1 : a.localeCompare(b)))
    .join('\n')
}

export function readAgentSkillFile(
  skillName: string,
  path: string,
): { skill: AgentSkill; file: AgentSkillFile } | null {
  const skill = findAgentSkill(skillName, { enabledOnly: true })
  if (!skill) return null
  const normalizedPath = normalizeSkillPath(path)
  if (!isSafeSkillPath(normalizedPath)) return null
  const file = skill.files.find((item) => item.path === normalizedPath)
  return file ? { skill, file } : null
}

export function createAgentSkill(input: AgentSkillCreateInput): AgentSkill {
  const name = normalizeSkillName(input.name)
  if (!isValidSkillName(name)) throw new Error('Skill name must use lowercase letters, digits, and hyphens.')
  if (findAgentSkill(name)?.source === 'system') throw new Error(`Cannot overwrite built-in skill: ${name}`)
  const agentDescription = input.agentDescription.trim()
  if (agentDescription.length < 20) throw new Error('agent_description is too short to be useful for skill discovery.')
  const displayDescription = {
    'zh-CN': input.displayDescription['zh-CN'].trim() || input.displayDescription.en.trim(),
    en: input.displayDescription.en.trim() || input.displayDescription['zh-CN'].trim(),
  }
  const displayName = {
    'zh-CN': input.displayName?.['zh-CN']?.trim() || input.displayName?.en?.trim() || '',
    en: input.displayName?.en?.trim() || input.displayName?.['zh-CN']?.trim() || '',
  }
  const icon = normalizeSkillIcon(input.icon)
  if (!displayDescription['zh-CN'] || !displayDescription.en) throw new Error('display descriptions are required.')
  const files = normalizeSkillFiles(input.files).slice(0, MAX_SKILL_FILES)
  if (!files.some((file) => file.path === 'SKILL.md')) {
    files.unshift({
      path: 'SKILL.md',
      content: skillMarkdownFromInput(name, agentDescription, icon, displayName, displayDescription),
    })
  }
  for (const file of files) {
    if (file.content.length > MAX_SKILL_FILE_CHARS) throw new Error(`Skill file is too large: ${file.path}`)
  }

  const root = files.find((file) => file.path === 'SKILL.md')
  if (root) {
    const parsed = parseSkillFrontmatter(root.content)
    if (
      !parsed.frontmatter.name ||
      !parsed.frontmatter.description ||
      !parsed.frontmatter.icon ||
      !parsed.frontmatter.displayDescription ||
      (displayName['zh-CN'] && !parsed.frontmatter.displayName)
    ) {
      root.content = skillMarkdownFromInput(
        name,
        agentDescription,
        icon,
        displayName,
        displayDescription,
        parsed.body.trim(),
      )
    }
  }

  const stored = upsertStoredUserSkill({
    name,
    agentDescription,
    displayName,
    displayDescription,
    icon,
    files,
    enabled: input.enabled,
  })
  setStoredSkillEnabled(name, input.enabled)
  return userSkillToAgentSkill(stored)
}

function yamlSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function skillMarkdownFromInput(
  name: string,
  description: string,
  icon: string,
  displayName: Partial<Record<Language, string>>,
  displayDescription: Record<Language, string>,
  body?: string,
): string {
  const lines = ['---', `name: ${name}`, `description: ${yamlSingleLine(description)}`, `icon: ${icon}`]
  if (displayName['zh-CN'] || displayName.en) {
    lines.push('display_name:')
    if (displayName['zh-CN']) lines.push(`  zh-CN: ${yamlSingleLine(displayName['zh-CN'])}`)
    if (displayName.en) lines.push(`  en: ${yamlSingleLine(displayName.en)}`)
  }
  lines.push(
    'display_description:',
    `  zh-CN: ${yamlSingleLine(displayDescription['zh-CN'])}`,
    `  en: ${yamlSingleLine(displayDescription.en)}`,
    '---',
  )
  return `${lines.join('\n')}\n\n${body || `# ${name}\n\n${description}`}`
}
