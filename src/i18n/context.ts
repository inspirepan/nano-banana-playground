import { createContext, createElement, useMemo, type ReactNode } from 'react'

import { createTranslator, setActiveLanguage } from './core'
import type { Translate } from './types'
import { type Language, type LanguagePreference, resolveLanguagePreference } from '../config/languages'

export type I18nContextValue = {
  language: Language
  preference: LanguagePreference
  t: Translate
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  preference,
  browserLanguages,
  children,
}: {
  preference: LanguagePreference
  browserLanguages?: readonly string[]
  children: ReactNode
}) {
  const language = resolveLanguagePreference(preference, browserLanguages)
  setActiveLanguage(language)
  const value = useMemo<I18nContextValue>(
    () => ({ language, preference, t: createTranslator(language) }),
    [language, preference],
  )

  return createElement(I18nContext.Provider, { value }, children)
}
