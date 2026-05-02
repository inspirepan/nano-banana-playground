import { getBuiltinAgentSkills } from './builtin'
import { parseSkillFrontmatter } from './frontmatter'
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
import { translate } from '../../i18n'

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
  return { ...skill, source: 'user' }
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

export function displayDescriptionForSkill(
  skill: Pick<AgentSkill, 'displayDescription' | 'displayDescriptionKey'>,
): string {
  if (skill.displayDescriptionKey) return translate(skill.displayDescriptionKey)
  return skill.displayDescription['zh-CN'] || skill.displayDescription.en || ''
}

export function displayDescriptionForLanguage(
  skill: Pick<AgentSkill, 'displayDescription' | 'displayDescriptionKey'>,
  language: Language,
): string {
  if (skill.displayDescriptionKey) return translate(skill.displayDescriptionKey)
  return skill.displayDescription[language] || skill.displayDescription['zh-CN'] || skill.displayDescription.en || ''
}

export function displayNameForSkill(skill: Pick<AgentSkill, 'name' | 'displayNameKey'>): string {
  if (skill.displayNameKey) return translate(skill.displayNameKey)
  return skill.name
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
  const icon = normalizeSkillIcon(input.icon)
  if (!displayDescription['zh-CN'] || !displayDescription.en) throw new Error('display descriptions are required.')
  const files = normalizeSkillFiles(input.files).slice(0, MAX_SKILL_FILES)
  if (!files.some((file) => file.path === 'SKILL.md')) {
    files.unshift({ path: 'SKILL.md', content: skillMarkdownFromInput(name, agentDescription) })
  }
  for (const file of files) {
    if (file.content.length > MAX_SKILL_FILE_CHARS) throw new Error(`Skill file is too large: ${file.path}`)
  }

  const root = files.find((file) => file.path === 'SKILL.md')
  if (root) {
    const parsed = parseSkillFrontmatter(root.content)
    if (!parsed.frontmatter.name || !parsed.frontmatter.description) {
      root.content = skillMarkdownFromInput(name, agentDescription, parsed.body.trim())
    }
  }

  const stored = upsertStoredUserSkill({
    name,
    agentDescription,
    displayDescription,
    icon,
    files,
    enabled: input.enabled,
  })
  setStoredSkillEnabled(name, input.enabled)
  return userSkillToAgentSkill(stored)
}

function skillMarkdownFromInput(name: string, description: string, body?: string): string {
  return `---\nname: ${name}\ndescription: ${description.replace(/\n/g, ' ')}\n---\n\n${body || `# ${name}\n\n${description}`}`
}
