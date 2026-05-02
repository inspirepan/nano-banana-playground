import type { AgentSkillIconName } from './icons'
import type { Language } from '../../config/languages'

export type AgentSkillSource = 'system' | 'user'

export type AgentSkillFile = {
  path: string
  content: string
}

export type AgentSkillDisplayDescription = Record<Language, string>

export type AgentSkill = {
  name: string
  agentDescription: string
  displayDescription: AgentSkillDisplayDescription
  displayDescriptionKey?: string
  icon: AgentSkillIconName
  source: AgentSkillSource
  enabled: boolean
  files: AgentSkillFile[]
  createdAt: number
  updatedAt: number
}

export type AgentSkillSummary = Pick<
  AgentSkill,
  | 'name'
  | 'agentDescription'
  | 'displayDescription'
  | 'displayDescriptionKey'
  | 'icon'
  | 'source'
  | 'enabled'
  | 'createdAt'
  | 'updatedAt'
> & {
  fileCount: number
}

export type StoredUserSkill = {
  name: string
  agentDescription: string
  displayDescription: AgentSkillDisplayDescription
  icon: AgentSkillIconName
  enabled: boolean
  files: AgentSkillFile[]
  createdAt: number
  updatedAt: number
}

export type AgentSkillCreateInput = {
  name: string
  agentDescription: string
  displayDescription: AgentSkillDisplayDescription
  icon: AgentSkillIconName
  files: AgentSkillFile[]
  enabled: boolean
}
