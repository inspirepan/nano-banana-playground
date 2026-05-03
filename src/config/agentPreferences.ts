import {
  AGENT_MODEL_CONFIGS,
  AGENT_THINKING_OPTIONS,
  DEFAULT_AGENT_MODEL,
  type AgentThinkingLevel,
} from './agentModels'
import {
  readPreferredAgentModelPreference,
  readPreferredAgentThinkingLevelPreference,
  writePreferredAgentModelPreference,
  writePreferredAgentThinkingLevelPreference,
} from '../lib/preferenceStore'

const DEFAULT_THINKING_LEVEL: AgentThinkingLevel = 'low'

export function getPreferredAgentModelId(): string {
  const stored = readPreferredAgentModelPreference()
  if (stored && AGENT_MODEL_CONFIGS.some((m) => m.id === stored)) return stored
  return DEFAULT_AGENT_MODEL.id
}

export function setPreferredAgentModelId(id: string): void {
  if (!AGENT_MODEL_CONFIGS.some((m) => m.id === id)) return
  writePreferredAgentModelPreference(id)
}

export function getPreferredAgentThinkingLevel(): AgentThinkingLevel {
  const stored = readPreferredAgentThinkingLevelPreference()
  if (stored && AGENT_THINKING_OPTIONS.some((option) => option.value === stored)) {
    return stored as AgentThinkingLevel
  }
  return DEFAULT_THINKING_LEVEL
}

export function setPreferredAgentThinkingLevel(level: AgentThinkingLevel): void {
  if (!AGENT_THINKING_OPTIONS.some((option) => option.value === level)) return
  writePreferredAgentThinkingLevelPreference(level)
}
