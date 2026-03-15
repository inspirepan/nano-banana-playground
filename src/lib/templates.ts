const TEMPLATES_KEY = 'nb-templates'

export type PromptTemplate = {
  id: string
  title: string
  prompt: string
  createdAt: number
}

function loadAll(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (raw) return JSON.parse(raw) as PromptTemplate[]
  } catch { /* ignore */ }
  return []
}

function saveAll(templates: PromptTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function getTemplates(): PromptTemplate[] {
  return loadAll()
}

export function saveTemplate(title: string, prompt: string): PromptTemplate {
  const templates = loadAll()
  const template: PromptTemplate = {
    id: crypto.randomUUID(),
    title: title.trim() || '未命名模板',
    prompt,
    createdAt: Date.now(),
  }
  templates.unshift(template)
  saveAll(templates)
  return template
}

export function deleteTemplate(id: string): void {
  saveAll(loadAll().filter((t) => t.id !== id))
}

export function renameTemplate(id: string, title: string): void {
  const templates = loadAll()
  const t = templates.find((t) => t.id === id)
  if (t) t.title = title.trim() || t.title
  saveAll(templates)
}
