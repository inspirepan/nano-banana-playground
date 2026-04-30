import type { Agent } from '@mariozechner/pi-agent'
import type { ImageContent, TextContent } from '@mariozechner/pi-ai'

export type AgentRuntimeTool = Agent['state']['tools'][number]

export type AgentImageToolResult = {
  content: (TextContent | ImageContent)[]
  details: unknown
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
