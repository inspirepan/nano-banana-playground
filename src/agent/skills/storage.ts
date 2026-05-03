import { normalizeSkillFiles, normalizeSkillName } from './normalize'
import type { AgentSkillCreateInput, StoredUserSkill } from './types'
import { getStorageItem, setStorageItem } from '../../lib/storage'

const USER_SKILLS_KEY = 'nano-banana-agent-user-skills-v1'
const SKILL_SETTINGS_KEY = 'nano-banana-agent-skill-settings-v1'

type SkillSettings = Record<string, { enabled: boolean }>

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = getStorageItem('localStorage', key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!setStorageItem('localStorage', key, JSON.stringify(value))) {
    throw new Error('Failed to save skill data.')
  }
}

function isStoredUserSkill(value: unknown): value is StoredUserSkill {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string' && Array.isArray(record.files) && typeof record.enabled === 'boolean'
}

export function loadStoredUserSkills(): StoredUserSkill[] {
  const parsed = readJson<unknown[]>(USER_SKILLS_KEY, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(isStoredUserSkill)
    .map((skill) => ({
      ...skill,
      name: normalizeSkillName(skill.name),
      files: normalizeSkillFiles(skill.files),
    }))
    .filter((skill) => skill.name && skill.files.some((file) => file.path === 'SKILL.md'))
}

export function saveStoredUserSkills(skills: StoredUserSkill[]): void {
  writeJson(USER_SKILLS_KEY, skills)
}

export function upsertStoredUserSkill(input: AgentSkillCreateInput): StoredUserSkill {
  const now = Date.now()
  const name = normalizeSkillName(input.name)
  const skills = loadStoredUserSkills()
  const existing = skills.find((skill) => skill.name === name)
  const next: StoredUserSkill = {
    name,
    enabled: input.enabled,
    files: normalizeSkillFiles(input.files),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  saveStoredUserSkills(
    [next, ...skills.filter((skill) => skill.name !== name)].sort((a, b) => a.name.localeCompare(b.name)),
  )
  return next
}

export function deleteStoredUserSkill(name: string): void {
  const normalized = normalizeSkillName(name)
  saveStoredUserSkills(loadStoredUserSkills().filter((skill) => skill.name !== normalized))
}

export function loadSkillSettings(): SkillSettings {
  return readJson<SkillSettings>(SKILL_SETTINGS_KEY, {})
}

export function setStoredSkillEnabled(name: string, enabled: boolean): void {
  const normalized = normalizeSkillName(name)
  const settings = loadSkillSettings()
  settings[normalized] = { enabled }
  writeJson(SKILL_SETTINGS_KEY, settings)
}
