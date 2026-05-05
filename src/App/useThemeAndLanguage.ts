import { useLayoutEffect, useState } from 'react'

import {
  applyLanguagePreference,
  getInitialLanguagePreference,
  getInitialTheme,
  syncThemePreference,
  type LanguagePreference,
} from './initThemePrefs'
import { resolveLanguagePreference } from '../config/languages'
import type { Theme } from '../config/theme'
import { useExternalSync } from '../hooks/effects'

// Centralizes theme / language state and the
// external syncs that mirror those preferences to <html> classes and storage.
export function useThemeAndLanguage() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(getInitialLanguagePreference)
  const [browserLanguages, setBrowserLanguages] = useState<readonly string[]>(() => navigator.languages)

  const language = resolveLanguagePreference(languagePreference, browserLanguages)

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
    languagePreference,
    setLanguagePreference,
    language,
    browserLanguages,
  }
}
