export type Theme = 'light' | 'dark' | 'system'
export type ColorThemeId = 'default' | 'green' | 'orange' | 'mono'

export const COLOR_THEMES: { id: ColorThemeId; name: string; color: string }[] = [
  { id: 'default', name: 'Blue', color: '#1e4fa8' },
  { id: 'green', name: 'Emerald', color: '#1a7048' },
  { id: 'orange', name: 'Orange', color: '#c2643a' },
  { id: 'mono', name: 'Mono', color: '#1f1d1a' },
]

export const COLOR_THEME_IDS = COLOR_THEMES.map((t) => t.id)
