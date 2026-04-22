import { BUILTIN_STYLE_PRESETS, type StylePreset } from '../config/styles'

const USER_PRESETS_KEY = 'nb-style-presets'

export type UserStylePreset = StylePreset & { builtin?: false }

// User presets stored in localStorage; id prefix 'u-' disambiguates from builtins.
function loadUser(): UserStylePreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY)
    if (raw) return JSON.parse(raw) as UserStylePreset[]
  } catch { /* ignore */ }
  return []
}

function saveUser(presets: UserStylePreset[]): void {
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets))
}

export function getAllStylePresets(): Array<StylePreset & { builtin: boolean }> {
  const user = loadUser()
  return [
    ...BUILTIN_STYLE_PRESETS.map((p) => ({ ...p, builtin: true as const })),
    ...user.map((p) => ({ ...p, builtin: false as const })),
  ]
}

export function getStylePresetById(id: string): StylePreset | null {
  const builtin = BUILTIN_STYLE_PRESETS.find((p) => p.id === id)
  if (builtin) return builtin
  return loadUser().find((p) => p.id === id) ?? null
}

export function getUserStylePresets(): UserStylePreset[] {
  return loadUser()
}

export function createUserStylePreset(input: Omit<StylePreset, 'id'>): UserStylePreset {
  const preset: UserStylePreset = {
    id: `u-${crypto.randomUUID()}`,
    label: input.label.trim() || '未命名风格',
    category: input.category?.trim() || undefined,
    description: input.description?.trim() || undefined,
    promptSnippet: input.promptSnippet,
  }
  saveUser([...loadUser(), preset])
  return preset
}

export function updateUserStylePreset(id: string, patch: Partial<Omit<StylePreset, 'id'>>): void {
  const list = loadUser()
  const target = list.find((p) => p.id === id)
  if (!target) return
  if (patch.label !== undefined) target.label = patch.label.trim() || target.label
  if (patch.category !== undefined) target.category = patch.category.trim() || undefined
  if (patch.description !== undefined) target.description = patch.description.trim() || undefined
  if (patch.promptSnippet !== undefined) target.promptSnippet = patch.promptSnippet
  saveUser(list)
}

export function deleteUserStylePreset(id: string): void {
  saveUser(loadUser().filter((p) => p.id !== id))
}

export function isBuiltinStylePreset(id: string): boolean {
  return BUILTIN_STYLE_PRESETS.some((p) => p.id === id)
}
