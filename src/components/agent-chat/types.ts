import type { AgentImageTask } from '../../agent'

export type AgentChatMenu = 'agentOptions' | 'sessions' | 'galleryPicker' | null

export type AgentImageTaskFocusOptions = {
  behavior?: 'open' | 'locate'
  itemId?: string
}

export type AgentImageTaskFocusHandler = (task: AgentImageTask, options?: AgentImageTaskFocusOptions) => void
