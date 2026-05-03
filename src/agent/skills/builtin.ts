import { parseSkillFrontmatter, type SkillFrontmatter } from './frontmatter'
import { normalizeSkillIcon } from './icons'
import { normalizeSkillFiles, normalizeSkillName } from './normalize'
import type { AgentSkill, AgentSkillFile } from './types'

const BUILTIN_SKILL_MARKDOWN = import.meta.glob('./builtin/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function skillNameFromModulePath(path: string): string | null {
  const match = path.match(/^\.\/builtin\/([^/]+)\//)
  return match ? normalizeSkillName(match[1]) : null
}

function relativeSkillPath(path: string, skillName: string): string {
  return path.replace(`./builtin/${skillName}/`, '')
}

export function getBuiltinAgentSkills(): AgentSkill[] {
  const grouped = new Map<string, AgentSkillFile[]>()
  for (const [modulePath, content] of Object.entries(BUILTIN_SKILL_MARKDOWN)) {
    const name = skillNameFromModulePath(modulePath)
    if (!name) continue
    const files = grouped.get(name) ?? []
    files.push({ path: relativeSkillPath(modulePath, name), content })
    grouped.set(name, files)
  }

  const now = 0
  return Array.from(grouped.entries())
    .map(([folderName, rawFiles]) => {
      const files = normalizeSkillFiles(rawFiles)
      const root = files.find((file) => file.path === 'SKILL.md')
      const parsed = root ? parseSkillFrontmatter(root.content) : { frontmatter: {} as SkillFrontmatter }
      const name = normalizeSkillName(parsed.frontmatter.name || folderName)
      const description = parsed.frontmatter.description?.trim() || `Use this skill for ${name}.`
      return {
        name,
        agentDescription: description,
        displayName: parsed.frontmatter.displayName ?? {},
        displayDescription: {
          'zh-CN':
            parsed.frontmatter.displayDescription?.['zh-CN'] ||
            parsed.frontmatter.displayDescription?.en ||
            description,
          en:
            parsed.frontmatter.displayDescription?.en ||
            parsed.frontmatter.displayDescription?.['zh-CN'] ||
            description,
        },
        icon: normalizeSkillIcon(parsed.frontmatter.icon),
        previewImage: parsed.frontmatter.previewImage,
        source: 'system',
        enabled: true,
        files,
        createdAt: now,
        updatedAt: now,
      } satisfies AgentSkill
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
