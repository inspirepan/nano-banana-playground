import type { Language } from '../config/languages'

export type TranslationParams = Record<string, string | number>

export type MessageDictionary = Record<string, Record<Language, string>>

export type Translate = (key: string, params?: TranslationParams) => string
