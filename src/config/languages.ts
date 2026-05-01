export type Language = 'zh-CN' | 'en'
export type LanguagePreference = 'auto' | Language

export const LANGUAGE_STORAGE_KEY = 'nano-banana-language'

export const LANGUAGE_PREFERENCES: { id: LanguagePreference; label: Record<Language, string> }[] = [
  { id: 'auto', label: { 'zh-CN': '自动', en: 'Auto' } },
  { id: 'zh-CN', label: { 'zh-CN': '简体中文', en: '简体中文' } },
  { id: 'en', label: { 'zh-CN': 'English', en: 'English' } },
]

export const LANGUAGE_PREFERENCE_IDS = LANGUAGE_PREFERENCES.map((item) => item.id)

export function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value !== null && (LANGUAGE_PREFERENCE_IDS as string[]).includes(value)
}

export function resolveLanguagePreference(
  preference: LanguagePreference,
  browserLanguages?: readonly string[],
): Language {
  if (preference !== 'auto') return preference

  const languages = browserLanguages ?? (typeof navigator === 'undefined' ? [] : navigator.languages)
  for (const language of languages) {
    const normalized = language.toLowerCase()
    if (normalized.startsWith('zh')) return 'zh-CN'
    if (normalized.startsWith('en')) return 'en'
  }

  return 'zh-CN'
}
