import {
  AGENT_MODEL_CONFIGS,
  AGENT_THINKING_OPTIONS,
  DEFAULT_AGENT_MODEL,
  type AgentThinkingLevel,
} from './agentModels'

export const PREFERRED_AGENT_MODEL_STORAGE_KEY = 'nano-banana-agent-model'
export const PREFERRED_AGENT_THINKING_LEVEL_STORAGE_KEY = 'nano-banana-agent-thinking-level'

const DEFAULT_THINKING_LEVEL: AgentThinkingLevel = 'low'

export function getPreferredAgentModelId(): string {
  if (typeof window === 'undefined') return DEFAULT_AGENT_MODEL.id
  try {
    const stored = window.localStorage.getItem(PREFERRED_AGENT_MODEL_STORAGE_KEY)
    if (stored && AGENT_MODEL_CONFIGS.some((m) => m.id === stored)) return stored
  } catch {
    // ignore storage errors
  }
  return DEFAULT_AGENT_MODEL.id
}

export function setPreferredAgentModelId(id: string): void {
  if (typeof window === 'undefined') return
  if (!AGENT_MODEL_CONFIGS.some((m) => m.id === id)) return
  try {
    window.localStorage.setItem(PREFERRED_AGENT_MODEL_STORAGE_KEY, id)
  } catch {
    // ignore storage errors
  }
}

export function getPreferredAgentThinkingLevel(): AgentThinkingLevel {
  if (typeof window === 'undefined') return DEFAULT_THINKING_LEVEL
  try {
    const stored = window.localStorage.getItem(PREFERRED_AGENT_THINKING_LEVEL_STORAGE_KEY)
    if (stored && AGENT_THINKING_OPTIONS.some((option) => option.value === stored)) {
      return stored as AgentThinkingLevel
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_THINKING_LEVEL
}

export function setPreferredAgentThinkingLevel(level: AgentThinkingLevel): void {
  if (typeof window === 'undefined') return
  if (!AGENT_THINKING_OPTIONS.some((option) => option.value === level)) return
  try {
    window.localStorage.setItem(PREFERRED_AGENT_THINKING_LEVEL_STORAGE_KEY, level)
  } catch {
    // ignore storage errors
  }
}
