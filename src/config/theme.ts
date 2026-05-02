export type Theme = 'light' | 'warm' | 'dark' | 'system'
export type ColorThemeId = 'default' | 'teal' | 'green' | 'yellow' | 'orange' | 'pink' | 'crimson' | 'purple' | 'mono'

export const COLOR_THEMES: { id: ColorThemeId; name: string; color: string }[] = [
  { id: 'default', name: 'Blue', color: '#2f6feb' },
  { id: 'teal', name: 'Teal', color: '#0e8f87' },
  { id: 'green', name: 'Emerald', color: '#2f9e6a' },
  { id: 'yellow', name: 'Amber', color: '#b87503' },
  { id: 'orange', name: 'Orange', color: '#c2643a' },
  { id: 'pink', name: 'Rose', color: '#c4436d' },
  { id: 'crimson', name: 'Crimson', color: '#a8243a' },
  { id: 'purple', name: 'Violet', color: '#7c56d4' },
  { id: 'mono', name: 'Mono', color: '#1f1d1a' },
]

export const COLOR_THEME_IDS = COLOR_THEMES.map((t) => t.id)
