import {
  AGENT_MODEL_CONFIGS,
  AGENT_THINKING_OPTIONS,
  DEFAULT_AGENT_MODEL,
  type AgentThinkingLevel,
} from './agentModels'
import { getStorageItem, setStorageItem } from '../lib/storage'

export const PREFERRED_AGENT_MODEL_STORAGE_KEY = 'nano-banana-agent-model'
export const PREFERRED_AGENT_THINKING_LEVEL_STORAGE_KEY = 'nano-banana-agent-thinking-level'

const DEFAULT_THINKING_LEVEL: AgentThinkingLevel = 'low'

export function getPreferredAgentModelId(): string {
  const stored = getStorageItem('localStorage', PREFERRED_AGENT_MODEL_STORAGE_KEY)
  if (stored && AGENT_MODEL_CONFIGS.some((m) => m.id === stored)) return stored
  return DEFAULT_AGENT_MODEL.id
}

export function setPreferredAgentModelId(id: string): void {
  if (!AGENT_MODEL_CONFIGS.some((m) => m.id === id)) return
  setStorageItem('localStorage', PREFERRED_AGENT_MODEL_STORAGE_KEY, id)
}

export function getPreferredAgentThinkingLevel(): AgentThinkingLevel {
  const stored = getStorageItem('localStorage', PREFERRED_AGENT_THINKING_LEVEL_STORAGE_KEY)
  if (stored && AGENT_THINKING_OPTIONS.some((option) => option.value === stored)) {
    return stored as AgentThinkingLevel
  }
  return DEFAULT_THINKING_LEVEL
}

export function setPreferredAgentThinkingLevel(level: AgentThinkingLevel): void {
  if (!AGENT_THINKING_OPTIONS.some((option) => option.value === level)) return
  setStorageItem('localStorage', PREFERRED_AGENT_THINKING_LEVEL_STORAGE_KEY, level)
}
