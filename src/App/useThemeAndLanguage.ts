import { useLayoutEffect, useState } from 'react'

import {
  applyColorThemePreference,
  applyLanguagePreference,
  getInitialColorTheme,
  getInitialLanguagePreference,
  getInitialTheme,
  syncThemePreference,
  type LanguagePreference,
} from './initThemePrefs'
import { resolveLanguagePreference } from '../config/languages'
import type { ColorThemeId, Theme } from '../config/theme'
import { useExternalSync } from '../hooks/effects'

// Centralizes theme / color theme / language state and the
// external syncs that mirror those preferences to <html> classes and storage.
export function useThemeAndLanguage() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [colorTheme, setColorTheme] = useState<ColorThemeId>(getInitialColorTheme)
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(getInitialLanguagePreference)
  const [browserLanguages, setBrowserLanguages] = useState<readonly string[]>(() => navigator.languages)

  const language = resolveLanguagePreference(languagePreference, browserLanguages)

  useLayoutEffect(() => {
    applyColorThemePreference(colorTheme)
  }, [colorTheme])

  useLayoutEffect(() => {
    applyLanguagePreference(languagePreference, language)
  }, [language, languagePreference])

  useExternalSync(() => {
    const updateBrowserLanguages = () => setBrowserLanguages(navigator.languages)
    window.addEventListener('languagechange', updateBrowserLanguages)
    return () => window.removeEventListener('languagechange', updateBrowserLanguages)
  }, [])

  useExternalSync(() => {
    return syncThemePreference(theme)
  }, [theme])

  return {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    languagePreference,
    setLanguagePreference,
    language,
    browserLanguages,
  }
}
