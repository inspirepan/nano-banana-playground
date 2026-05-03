import { createAskUserQuestionTool, type AskUserQuestionExecutor } from './askUserQuestion'
import { createCreateSkillTool, type CreateSkillExecutor } from './createSkill'
import { createGenImageTool, type GenImageExecutor } from './genImage'
import { createReadAgentFileTool, type ReadAgentFileExecutor } from './readAgentFile'
import { createReadImageTool, type ReadImageExecutor } from './readImage'
import { createReadSkillFileTool, type ReadSkillFileExecutor } from './readSkillFile'
import type { AgentRuntimeTool } from './shared'
import { createSkillTool, type SkillExecutor } from './skill'
import { createWebFetchTool, type WebFetchExecutor } from './webFetch'
import { createWebSearchTool, type WebSearchExecutor } from './webSearch'
import type { ModelConfig } from '../../config/models'

export { createGenImageTool, prepareGenImageArgs } from './genImage'
export type { GenImageExecutor, GenImageToolArgs } from './genImage'
export { createReadAgentFileTool, formatReadAgentFileResult, prepareReadAgentFileArgs } from './readAgentFile'
export type { ReadAgentFileExecutor, ReadAgentFileToolArgs } from './readAgentFile'
export { createReadImageTool, prepareReadImageArgs } from './readImage'
export type { ReadImageExecutor, ReadImageToolArgs } from './readImage'
export {
  createAskUserQuestionTool,
  formatAskUserQuestionArgumentError,
  formatAskUserQuestionResult,
  prepareAskUserQuestionArgs,
} from './askUserQuestion'
export type {
  AskUserQuestionAnswer,
  AskUserQuestionExecutor,
  AskUserQuestionItem,
  AskUserQuestionOption,
  AskUserQuestionToolArgs,
  PreparedAskUserQuestionToolArgs,
} from './askUserQuestion'
export { createCreateSkillTool, prepareCreateSkillArgs } from './createSkill'
export type { CreateSkillExecutor, CreateSkillToolArgs } from './createSkill'
export { createReadSkillFileTool, formatReadSkillFileResult, prepareReadSkillFileArgs } from './readSkillFile'
export type { ReadSkillFileExecutor, ReadSkillFileToolArgs } from './readSkillFile'
export { createSkillTool, formatLoadedSkillText, prepareSkillArgs } from './skill'
export type { SkillExecutor, SkillToolArgs } from './skill'
export { createWebFetchTool, prepareWebFetchArgs, runWebFetch } from './webFetch'
export type { WebFetchExecutor, WebFetchToolArgs } from './webFetch'
export { createWebSearchTool, prepareWebSearchArgs, runWebSearch } from './webSearch'
export type { WebSearchExecutor, WebSearchToolArgs } from './webSearch'
export type { AgentImageToolResult, AgentRuntimeTool, AgentToolResult } from './shared'

type CreateAgentToolsParams = {
  imageModels: ModelConfig[]
  genImage: GenImageExecutor
  readAgentFile: ReadAgentFileExecutor
  readImage: ReadImageExecutor
  askUserQuestion: AskUserQuestionExecutor
  loadSkill: SkillExecutor
  readSkillFile: ReadSkillFileExecutor
  createSkill: CreateSkillExecutor
  webSearch: WebSearchExecutor
  webFetch: WebFetchExecutor
}

export function createAgentTools(params: CreateAgentToolsParams): AgentRuntimeTool[] {
  return [
    createGenImageTool({ imageModels: params.imageModels, genImage: params.genImage }),
    createReadAgentFileTool({ readAgentFile: params.readAgentFile }),
    createReadImageTool({ readImage: params.readImage }),
    createAskUserQuestionTool({ askUserQuestion: params.askUserQuestion }),
    createSkillTool({ loadSkill: params.loadSkill }),
    createReadSkillFileTool({ readSkillFile: params.readSkillFile }),
    createCreateSkillTool({ createSkill: params.createSkill }),
    createWebSearchTool({ webSearch: params.webSearch }),
    createWebFetchTool({ webFetch: params.webFetch }),
  ]
}

// Deprecated: kept for callers that only want image tools. Prefer createAgentTools.
export function createAgentImageTools(
  params: Pick<CreateAgentToolsParams, 'imageModels' | 'genImage' | 'readImage'>,
): AgentRuntimeTool[] {
  return [
    createGenImageTool({ imageModels: params.imageModels, genImage: params.genImage }),
    createReadImageTool({ readImage: params.readImage }),
  ]
}
