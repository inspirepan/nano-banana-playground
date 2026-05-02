import { parseSkillFrontmatter, type SkillFrontmatter } from './frontmatter'
import { normalizeSkillIcon, type AgentSkillIconName } from './icons'
import { normalizeSkillFiles, normalizeSkillName } from './normalize'
import type { AgentSkill, AgentSkillFile } from './types'

const BUILTIN_SKILL_DISPLAY_KEYS: Record<string, string> = {
  'baoyu-cover-image': 'settings.agentSkills.builtin.baoyuCoverImage.description',
  'editorial-sketch-art': 'settings.agentSkills.builtin.editorialSketchArt.description',
  'skill-creator': 'settings.agentSkills.builtin.skillCreator.description',
}

const BUILTIN_SKILL_ICONS: Record<string, AgentSkillIconName> = {
  'baoyu-cover-image': 'image',
  'editorial-sketch-art': 'pencil-ruler',
  'skill-creator': 'badge-plus',
}

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
      const displayDescriptionKey = BUILTIN_SKILL_DISPLAY_KEYS[name]
      return {
        name,
        agentDescription: description,
        displayDescription: {
          'zh-CN': displayDescriptionKey ? '' : description,
          en: displayDescriptionKey ? '' : description,
        },
        displayDescriptionKey,
        icon: normalizeSkillIcon(parsed.frontmatter.icon ?? BUILTIN_SKILL_ICONS[name]),
        source: 'system',
        enabled: true,
        files,
        createdAt: now,
        updatedAt: now,
      } satisfies AgentSkill
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
