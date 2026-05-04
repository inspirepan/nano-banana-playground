import { getStorageItem, removeStorageItem, setStorageItem } from './storage'
import type { AgentThinkingLevel } from '../config/agentModels'
import type { SansFontId } from '../config/fonts'
import type { LanguagePreference } from '../config/languages'
import type { ColorThemeId, Theme } from '../config/theme'

const THEME_KEY = 'nano-banana-theme'
const COLOR_THEME_KEY = 'nano-banana-color-theme'
const SANS_FONT_KEY = 'nano-banana-sans-font'
const LANGUAGE_KEY = 'nano-banana-language'
const AGENT_PANEL_WIDE_KEY = 'nano-banana-agent-panel-wide'
const AGENT_PANEL_WIDE_TIP_KEY = 'nano-banana-agent-panel-wide-tip'
const GENERATION_CONCURRENCY_KEY = 'nano-banana-generation-concurrency'
const DETAIL_SIDEBAR_COLLAPSED_KEY = 'nano-banana-detail-sidebar-collapsed'
const PREFERRED_IMAGE_MODEL_KEY = 'nano-banana-preferred-image-model'
const PREFERRED_AGENT_MODEL_KEY = 'nano-banana-agent-model'
const PREFERRED_AGENT_THINKING_LEVEL_KEY = 'nano-banana-agent-thinking-level'
const COMPOSER_SUBMIT_MODE_KEY = 'nano-banana-composer-submit-mode'

function read(key: string): string | null {
  return getStorageItem('localStorage', key)
}

function write(key: string, value: string): boolean {
  return setStorageItem('localStorage', key, value)
}

export function readThemePreference(): string | null {
  return read(THEME_KEY)
}

export function writeThemePreference(theme: Theme): boolean {
  return write(THEME_KEY, theme)
}

export function readColorThemePreference(): string | null {
  return read(COLOR_THEME_KEY)
}

export function writeColorThemePreference(colorTheme: ColorThemeId): boolean {
  return write(COLOR_THEME_KEY, colorTheme)
}

export function readSansFontPreference(): string | null {
  return read(SANS_FONT_KEY)
}

export function writeSansFontPreference(sansFont: SansFontId): boolean {
  return write(SANS_FONT_KEY, sansFont)
}

export function readLanguagePreference(): string | null {
  return read(LANGUAGE_KEY)
}

export function writeLanguagePreference(languagePreference: LanguagePreference): boolean {
  return write(LANGUAGE_KEY, languagePreference)
}

export function readAgentPanelWidePreference(): boolean {
  return read(AGENT_PANEL_WIDE_KEY) === '1'
}

export function writeAgentPanelWidePreference(wide: boolean): boolean {
  return write(AGENT_PANEL_WIDE_KEY, wide ? '1' : '0')
}

export function readAgentWideTipDismissedPreference(): boolean {
  return readAgentPanelWidePreference() || read(AGENT_PANEL_WIDE_TIP_KEY) === '1'
}

export function writeAgentWideTipDismissedPreference(): boolean {
  return write(AGENT_PANEL_WIDE_TIP_KEY, '1')
}

export function readGenerationConcurrencyPreference(): string | null {
  return read(GENERATION_CONCURRENCY_KEY)
}

export function writeGenerationConcurrencyPreference(value: number): boolean {
  return write(GENERATION_CONCURRENCY_KEY, String(value))
}

export function readDetailSidebarCollapsedPreference(): boolean {
  return read(DETAIL_SIDEBAR_COLLAPSED_KEY) === '1'
}

export function writeDetailSidebarCollapsedPreference(collapsed: boolean): boolean {
  return write(DETAIL_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
}

export function readPreferredImageModelPreference(): string | null {
  return read(PREFERRED_IMAGE_MODEL_KEY)
}

export function writePreferredImageModelPreference(modelId: string): boolean {
  return write(PREFERRED_IMAGE_MODEL_KEY, modelId)
}

export function clearPreferredImageModelPreference(): void {
  removeStorageItem('localStorage', PREFERRED_IMAGE_MODEL_KEY)
}

export function readPreferredAgentModelPreference(): string | null {
  return read(PREFERRED_AGENT_MODEL_KEY)
}

export function writePreferredAgentModelPreference(modelId: string): boolean {
  return write(PREFERRED_AGENT_MODEL_KEY, modelId)
}

export function readPreferredAgentThinkingLevelPreference(): string | null {
  return read(PREFERRED_AGENT_THINKING_LEVEL_KEY)
}

export function writePreferredAgentThinkingLevelPreference(level: AgentThinkingLevel): boolean {
  return write(PREFERRED_AGENT_THINKING_LEVEL_KEY, level)
}

export function readComposerSubmitModePreference(): string | null {
  return read(COMPOSER_SUBMIT_MODE_KEY)
}

export function writeComposerSubmitModePreference(mode: string): boolean {
  return write(COMPOSER_SUBMIT_MODE_KEY, mode)
}
