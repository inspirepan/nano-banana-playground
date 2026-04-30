import type { Agent } from '@mariozechner/pi-agent'
import type { ImageContent, TextContent } from '@mariozechner/pi-ai'

export type AgentRuntimeTool = Agent['state']['tools'][number]

export type AgentToolResult = {
  content: (TextContent | ImageContent)[]
  details: unknown
}

export type AgentImageToolResult = AgentToolResult

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
