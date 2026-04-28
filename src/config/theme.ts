export type Theme = 'light' | 'dark' | 'system'
export type ColorThemeId = 'default' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple' | 'mono'

export const COLOR_THEMES: { id: ColorThemeId; name: string; color: string }[] = [
  { id: 'default', name: 'Indigo', color: '#5e6ad2' },
  { id: 'green', name: 'Emerald', color: '#2f9e6a' },
  { id: 'yellow', name: 'Amber', color: '#b87503' },
  { id: 'pink', name: 'Rose', color: '#c4436d' },
  { id: 'orange', name: 'Orange', color: '#c0582a' },
  { id: 'purple', name: 'Violet', color: '#7c56d4' },
  { id: 'mono', name: 'Mono', color: '#1f1d1a' },
]

export const COLOR_THEME_IDS = COLOR_THEMES.map((t) => t.id)
