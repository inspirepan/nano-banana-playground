import { messages } from './messages'
import type { Translate, TranslationParams } from './types'
import { type Language, resolveLanguagePreference } from '../config/languages'

let activeLanguage: Language = resolveLanguagePreference('auto')

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => String(params[key] ?? match))
}

export function createTranslator(language: Language): Translate {
  return (key, params) => {
    const entry = messages[key]
    const template = entry?.[language] ?? entry?.['zh-CN'] ?? key
    return interpolate(template, params)
  }
}

export function setActiveLanguage(language: Language) {
  activeLanguage = language
}

export function translate(key: string, params?: TranslationParams): string {
  return createTranslator(activeLanguage)(key, params)
}

export type { Translate }
