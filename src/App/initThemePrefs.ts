import { isLanguagePreference, type Language, type LanguagePreference } from '../config/languages'
import type { Theme } from '../config/theme'
import {
  readAgentPanelWidePreference,
  readAgentWideTipDismissedPreference,
  readLanguagePreference,
  readThemePreference,
  writeLanguagePreference,
  writeThemePreference,
} from '../lib/preferenceStore'

export type { LanguagePreference } from '../config/languages'

export const BASE_TITLE = 'Playground'
export const TITLE_RESET_DELAY_MS = 8000
export const DESKTOP_INPUT_PANEL_WIDTH_PX = 480
export const DESKTOP_INPUT_PANEL_WIDTH = `${DESKTOP_INPUT_PANEL_WIDTH_PX}px`
export const DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX = 360
export const DESKTOP_AGENT_PANEL_WIDE_RATIO = 0.75
export const DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX = 296
export const DESKTOP_AGENT_CHAT_MIN_WIDTH_PX = 600
export const DESKTOP_AGENT_SIDE_SPACE_MIN_PX = 72
export const DESKTOP_AGENT_SIDE_SPACE_MAX_PX = 128

export function getInitialTheme(): Theme {
  const stored = readThemePreference()
  const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
  return theme
}

export function getInitialLanguagePreference(): LanguagePreference {
  const stored = readLanguagePreference()
  return isLanguagePreference(stored) ? stored : 'auto'
}

export function getInitialAgentPanelWide(): boolean {
  return readAgentPanelWidePreference()
}

export function getInitialAgentWideTipDismissed(): boolean {
  return readAgentWideTipDismissedPreference()
}

export function applyLanguagePreference(languagePreference: LanguagePreference, language: Language) {
  writeLanguagePreference(languagePreference)
  document.documentElement.lang = language
}

export function syncThemePreference(theme: Theme): (() => void) | void {
  const root = document.documentElement
  const applyDark = (isDark: boolean) => {
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
  }
  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyDark(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    writeThemePreference('system')
    return () => mq.removeEventListener('change', apply)
  }
  applyDark(theme === 'dark')
  writeThemePreference(theme)
}
