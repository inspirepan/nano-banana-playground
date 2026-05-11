import type { Language } from '../../config/languages'

type FrontmatterLocalizedText = Partial<Record<Language, string>>
type FrontmatterLocalizedStringList = Partial<Record<Language, string[]>>

export type SkillFrontmatter = {
  name?: string
  description?: string
  displayName?: FrontmatterLocalizedText
  displayDescription?: FrontmatterLocalizedText
  starterExamples?: FrontmatterLocalizedStringList
  icon?: string
  previewImage?: string
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

function languageFromYamlKey(value: string): Language | null {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase()
    .replace(/_/g, '-')
  if (normalized === 'en') return 'en'
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans') return 'zh-CN'
  return null
}

function readYamlLanguageMap(
  lines: string[],
  startIndex: number,
): { value: FrontmatterLocalizedText; nextIndex: number } {
  const first = lines[startIndex] ?? ''
  const raw = first.replace(/^\s*[^:]+:\s*/, '')
  const value: FrontmatterLocalizedText = {}
  if (raw.trim()) return { value, nextIndex: startIndex + 1 }

  let index = startIndex + 1
  while (index < lines.length && /^\s+/.test(lines[index] ?? '')) {
    const line = lines[index] ?? ''
    const match = line.match(/^\s+([^:]+):\s*(.*)$/)
    if (!match) {
      index++
      continue
    }
    const language = languageFromYamlKey(match[1] ?? '')
    if (language) value[language] = (match[2] ?? '').replace(/^['"]|['"]$/g, '').trim()
    index++
  }
  return { value, nextIndex: index }
}

function readYamlLanguageStringListMap(
  lines: string[],
  startIndex: number,
): { value: FrontmatterLocalizedStringList; nextIndex: number } {
  const first = lines[startIndex] ?? ''
  const raw = first.replace(/^\s*[^:]+:\s*/, '')
  const value: FrontmatterLocalizedStringList = {}
  if (raw.trim()) return { value, nextIndex: startIndex + 1 }

  let index = startIndex + 1
  let language: Language | null = null
  while (index < lines.length && /^\s+/.test(lines[index] ?? '')) {
    const line = lines[index] ?? ''
    const languageMatch = line.match(/^\s+([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (languageMatch) {
      language = languageFromYamlKey(languageMatch[1] ?? '')
      const inlineValue = (languageMatch[2] ?? '').replace(/^['"]|['"]$/g, '').trim()
      if (language) value[language] = inlineValue ? [inlineValue] : []
      index++
      continue
    }

    const listMatch = line.match(/^\s+-\s*(.*)$/)
    if (language && listMatch) {
      const item = (listMatch[1] ?? '').replace(/^['"]|['"]$/g, '').trim()
      if (item) value[language] = [...(value[language] ?? []), item]
    }
    index++
  }
  return { value, nextIndex: index }
}

function setLocalizedValue(target: FrontmatterLocalizedText, language: Language, value: string): void {
  const normalized = value.trim()
  if (normalized) target[language] = normalized
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
    if (/^\s*(preview[-_]?image|previewImage|thumbnail)\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      frontmatter.previewImage = result.value
      index = result.nextIndex
      continue
    }
    if (/^\s*(display[-_]?name|displayName)\s*:/.test(line)) {
      const result = readYamlLanguageMap(lines, index)
      frontmatter.displayName = result.value
      index = result.nextIndex
      continue
    }
    if (/^\s*(display[-_]?description|displayDescription)\s*:/.test(line)) {
      const result = readYamlLanguageMap(lines, index)
      frontmatter.displayDescription = result.value
      index = result.nextIndex
      continue
    }
    if (/^\s*(starter[-_]?examples|starterExamples)\s*:/.test(line)) {
      const result = readYamlLanguageStringListMap(lines, index)
      frontmatter.starterExamples = result.value
      index = result.nextIndex
      continue
    }
    if (/^\s*(display[-_]?name[-_]?zh|displayNameZh)\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      const displayName = frontmatter.displayName ?? {}
      setLocalizedValue(displayName, 'zh-CN', result.value)
      frontmatter.displayName = displayName
      index = result.nextIndex
      continue
    }
    if (/^\s*(display[-_]?name[-_]?en|displayNameEn)\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      const displayName = frontmatter.displayName ?? {}
      setLocalizedValue(displayName, 'en', result.value)
      frontmatter.displayName = displayName
      index = result.nextIndex
      continue
    }
    if (/^\s*(display[-_]?description[-_]?zh|displayDescriptionZh)\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      const displayDescription = frontmatter.displayDescription ?? {}
      setLocalizedValue(displayDescription, 'zh-CN', result.value)
      frontmatter.displayDescription = displayDescription
      index = result.nextIndex
      continue
    }
    if (/^\s*(display[-_]?description[-_]?en|displayDescriptionEn)\s*:/.test(line)) {
      const result = readYamlString(lines, index)
      const displayDescription = frontmatter.displayDescription ?? {}
      setLocalizedValue(displayDescription, 'en', result.value)
      frontmatter.displayDescription = displayDescription
      index = result.nextIndex
      continue
    }
    index++
  }

  return { frontmatter, body }
}
