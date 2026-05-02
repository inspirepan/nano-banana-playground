import type { AgentSkillFile } from './types'

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{1,62}$/

export function normalizeSkillName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSkillName(value: string): boolean {
  return SKILL_NAME_RE.test(value)
}

export function normalizeSkillPath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/')
}

export function isSafeSkillPath(value: string): boolean {
  const path = normalizeSkillPath(value)
  if (!path || path.startsWith('/') || path.includes('\0')) return false
  if (path.split('/').some((segment) => segment === '..' || segment === '.')) return false
  return path === 'SKILL.md' || path.endsWith('.md')
}

export function normalizeSkillFiles(files: AgentSkillFile[]): AgentSkillFile[] {
  const byPath = new Map<string, AgentSkillFile>()
  for (const file of files) {
    const path = normalizeSkillPath(file.path)
    if (!isSafeSkillPath(path)) continue
    const content = typeof file.content === 'string' ? file.content : ''
    if (!content.trim()) continue
    byPath.set(path, { path, content })
  }
  return Array.from(byPath.values()).sort((a, b) => {
    if (a.path === 'SKILL.md') return -1
    if (b.path === 'SKILL.md') return 1
    return a.path.localeCompare(b.path)
  })
}
