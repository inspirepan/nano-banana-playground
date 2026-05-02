export type SkillFrontmatter = {
  name?: string
  description?: string
  icon?: string
}

function readYamlString(lines: string[], startIndex: number): { value: string; nextIndex: number } {
  const first = lines[startIndex] ?? ''
  const raw = first.replace(/^\s*[^:]+:\s*/, '')
  if (raw === '>' || raw === '|') {
    const parts: string[] = []
    let index = startIndex + 1
    while (index < lines.length && /^\s+/.test(lines[index] ?? '')) {
      parts.push((lines[index] ?? '').trim())
      index++
    }
    return { value: parts.join(raw === '>' ? ' ' : '\n').trim(), nextIndex: index }
  }
  return { value: raw.replace(/^['"]|['"]$/g, '').trim(), nextIndex: startIndex + 1 }
}

export function parseSkillFrontmatter(markdown: string): { frontmatter: SkillFrontmatter; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---\n')) return { frontmatter: {}, body: normalized }
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) return { frontmatter: {}, body: normalized }

  const frontmatterText = normalized.slice(4, end)
  const body = normalized.slice(end).replace(/^\n---\s*\n?/, '')
  const lines = frontmatterText.split('\n')
  const frontmatter: SkillFrontmatter = {}
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (/^\s*name\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      frontmatter.name = result.value
      index = result.nextIndex
      continue
    }
    if (/^\s*description\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      frontmatter.description = result.value
      index = result.nextIndex
      continue
    }
    if (/^\s*icon\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      frontmatter.icon = result.value
      index = result.nextIndex
      continue
    }
    index++
  }

  return { frontmatter, body }
}
