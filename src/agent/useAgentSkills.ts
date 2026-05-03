import { useCallback, useState } from 'react'

import { toolTextResult } from './messageRecovery'
import {
  createAgentSkill,
  deleteAgentSkill as deleteAgentSkillFromRegistry,
  findAgentSkill,
  getAgentSkillSummaries,
  setAgentSkillEnabled as setAgentSkillEnabledInRegistry,
} from './skills/registry'
import type { AgentSkill, AgentSkillCreateInput, AgentSkillSummary } from './skills/types'
import {
  formatLoadedSkillText,
  formatReadAgentFileResult,
  formatReadSkillFileResult,
  runWebFetch,
  runWebSearch,
  type AgentToolResult,
  type CreateSkillToolArgs,
  type ReadAgentFileToolArgs,
  type ReadSkillFileToolArgs,
  type SkillToolArgs,
  type WebFetchToolArgs,
  type WebSearchToolArgs,
} from './tools'

export function useAgentSkills() {
  const [agentSkills, setAgentSkillsState] = useState<AgentSkillSummary[]>(getAgentSkillSummaries)

  const refreshAgentSkills = useCallback(() => {
    const next = getAgentSkillSummaries()
    setAgentSkillsState(next)
    return next
  }, [])

  const setAgentSkillEnabled = useCallback((name: string, enabled: boolean) => {
    setAgentSkillsState(setAgentSkillEnabledInRegistry(name, enabled))
  }, [])

  const deleteAgentSkill = useCallback((name: string) => {
    setAgentSkillsState(deleteAgentSkillFromRegistry(name))
  }, [])

  const getAgentSkillPackage = useCallback((name: string): AgentSkill | null => findAgentSkill(name), [])

  const createUserAgentSkill = useCallback(
    (input: AgentSkillCreateInput) => {
      createAgentSkill(input)
      refreshAgentSkills()
    },
    [refreshAgentSkills],
  )

  const runSkillTool = useCallback(
    async (_sessionId: string, _toolCallId: string, args: SkillToolArgs): Promise<AgentToolResult> => {
      return formatLoadedSkillText(args.skill)
    },
    [],
  )

  const runReadAgentFileTool = useCallback(
    async (sessionId: string, _toolCallId: string, args: ReadAgentFileToolArgs): Promise<AgentToolResult> => {
      return formatReadAgentFileResult(sessionId, args)
    },
    [],
  )

  const runReadSkillFileTool = useCallback(
    async (_sessionId: string, _toolCallId: string, args: ReadSkillFileToolArgs): Promise<AgentToolResult> => {
      return formatReadSkillFileResult(args.skill, args.path, args.offset, args.limit)
    },
    [],
  )

  const runCreateSkillTool = useCallback(
    async (_sessionId: string, _toolCallId: string, args: CreateSkillToolArgs): Promise<AgentToolResult> => {
      const skill = createAgentSkill(args)
      refreshAgentSkills()
      const payload = {
        status: 'saved',
        skill_name: skill.name,
        icon: skill.icon,
        enabled: skill.enabled,
        file_count: skill.files.length,
        message:
          'Skill saved to the browser skill library. It will be listed in available skills for future new conversations.',
      }
      return toolTextResult(JSON.stringify(payload, null, 2), payload)
    },
    [refreshAgentSkills],
  )

  const runWebFetchTool = useCallback(
    async (
      sessionId: string,
      toolCallId: string,
      args: WebFetchToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      return runWebFetch(args, signal, { sessionId, toolCallId })
    },
    [],
  )

  const runWebSearchTool = useCallback(
    async (
      _sessionId: string,
      _toolCallId: string,
      args: WebSearchToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      return runWebSearch(args, signal)
    },
    [],
  )

  return {
    agentSkills,
    setAgentSkillEnabled,
    deleteAgentSkill,
    getAgentSkillPackage,
    createUserAgentSkill,
    runSkillTool,
    runReadAgentFileTool,
    runReadSkillFileTool,
    runCreateSkillTool,
    runWebSearchTool,
    runWebFetchTool,
  }
}
