import {
  DEFAULT_SANS_FONT,
  SANS_FONT_IDS,
  SANS_FONTS,
  googleFontPreviewsHref,
  googleFontsHref,
  type SansFontId,
} from '../config/fonts'
import { isLanguagePreference, LANGUAGE_STORAGE_KEY, type Language, type LanguagePreference } from '../config/languages'
import { COLOR_THEME_IDS, type ColorThemeId, type Theme } from '../config/theme'

export type { SansFontId } from '../config/fonts'
export type { LanguagePreference } from '../config/languages'

export const BASE_TITLE = 'Imagine Playground'
export const TITLE_RESET_DELAY_MS = 8000
export const GOOGLE_FONTS_LINK_ID = 'nano-banana-google-fonts'
export const GOOGLE_FONT_PREVIEWS_LINK_ID = 'nano-banana-google-font-previews'
export const DESKTOP_INPUT_PANEL_WIDTH = '480px'
export const DESKTOP_AGENT_PANEL_WIDE_WIDTH = 'clamp(480px, 75vw, calc(100vw - 300px))'
export const DESKTOP_AGENT_PANEL_WIDE_PADDING_X = '128px'
export const DESKTOP_AGENT_PANEL_SIDEBAR_MEDIA = '(min-width: 1760px)'

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nano-banana-theme')
  const theme = stored === 'light' || stored === 'warm' || stored === 'dark' || stored === 'system' ? stored : 'system'
  if (theme === 'warm') document.documentElement.classList.add('warm')
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
  return theme
}

export function getInitialColorTheme(): ColorThemeId {
  const stored = localStorage.getItem('nano-banana-color-theme')
  const id = stored && (COLOR_THEME_IDS as string[]).includes(stored) ? (stored as ColorThemeId) : 'default'
  if (id !== 'default') document.documentElement.classList.add(`theme-${id}`)
  return id
}

export function getInitialSansFont(): SansFontId {
  const stored = localStorage.getItem('nano-banana-sans-font')
  const id = stored && (SANS_FONT_IDS as string[]).includes(stored) ? (stored as SansFontId) : DEFAULT_SANS_FONT
  document.documentElement.classList.add(
    SANS_FONTS.find((font) => font.id === id)?.className ?? SANS_FONTS[0].className,
  )
  return id
}

export function getInitialLanguagePreference(): LanguagePreference {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isLanguagePreference(stored) ? stored : 'auto'
}

export function getInitialAgentPanelWide(): boolean {
  return localStorage.getItem('nano-banana-agent-panel-wide') === '1'
}

export function getInitialAgentWideTipDismissed(): boolean {
  if (localStorage.getItem('nano-banana-agent-panel-wide') === '1') return true
  return localStorage.getItem('nano-banana-agent-panel-wide-tip') === '1'
}

export function ensureGoogleFontsPreconnect() {
  let preconnect = document.querySelector<HTMLLinkElement>('link[data-nano-banana-fonts-preconnect="fonts-googleapis"]')
  if (!preconnect) {
    preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = 'https://fonts.googleapis.com'
    preconnect.dataset.nanoBananaFontsPreconnect = 'fonts-googleapis'
    document.head.appendChild(preconnect)
  }

  let gstatic = document.querySelector<HTMLLinkElement>('link[data-nano-banana-fonts-preconnect="fonts-gstatic"]')
  if (!gstatic) {
    gstatic = document.createElement('link')
    gstatic.rel = 'preconnect'
    gstatic.href = 'https://fonts.gstatic.com'
    gstatic.crossOrigin = 'anonymous'
    gstatic.dataset.nanoBananaFontsPreconnect = 'fonts-gstatic'
    document.head.appendChild(gstatic)
  }
}

export function ensureGoogleFontsLink(id: string, href: string) {
  ensureGoogleFontsPreconnect()
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  link.href = href
}

export function applyColorThemePreference(colorTheme: ColorThemeId) {
  const root = document.documentElement
  COLOR_THEME_IDS.forEach((id) => root.classList.remove(`theme-${id}`))
  if (colorTheme !== 'default') root.classList.add(`theme-${colorTheme}`)
  localStorage.setItem('nano-banana-color-theme', colorTheme)
}

export function applySansFontPreference(sansFont: SansFontId, loadPreviews: boolean) {
  const root = document.documentElement
  SANS_FONTS.forEach((font) => root.classList.remove(font.className))
  root.classList.add(SANS_FONTS.find((font) => font.id === sansFont)?.className ?? SANS_FONTS[0].className)
  ensureGoogleFontsLink(GOOGLE_FONTS_LINK_ID, googleFontsHref(sansFont))
  if (loadPreviews) {
    ensureGoogleFontsLink(GOOGLE_FONT_PREVIEWS_LINK_ID, googleFontPreviewsHref())
  } else {
    document.getElementById(GOOGLE_FONT_PREVIEWS_LINK_ID)?.remove()
  }
  localStorage.setItem('nano-banana-sans-font', sansFont)
}

export function applyLanguagePreference(languagePreference: LanguagePreference, language: Language) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, languagePreference)
  document.documentElement.lang = language
}

export function syncThemePreference(theme: Theme): (() => void) | void {
  const root = document.documentElement
  const applyDark = (isDark: boolean) => {
    root.classList.remove('warm')
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
  }
  const applyWarm = () => {
    root.classList.remove('dark')
    root.classList.add('warm')
    root.style.colorScheme = 'light'
  }
  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyDark(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    localStorage.setItem('nano-banana-theme', 'system')
    return () => mq.removeEventListener('change', apply)
  }
  if (theme === 'warm') {
    applyWarm()
    localStorage.setItem('nano-banana-theme', theme)
    return
  }
  applyDark(theme === 'dark')
  localStorage.setItem('nano-banana-theme', theme)
}
