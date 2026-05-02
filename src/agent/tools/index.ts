import { createAskUserQuestionTool, type AskUserQuestionExecutor } from './askUserQuestion'
import { createCreateSkillTool, type CreateSkillExecutor } from './createSkill'
import { createGenImageTool, type GenImageExecutor } from './genImage'
import { createReadImageTool, type ReadImageExecutor } from './readImage'
import { createReadSkillFileTool, type ReadSkillFileExecutor } from './readSkillFile'
import type { AgentRuntimeTool } from './shared'
import { createSkillTool, type SkillExecutor } from './skill'
import type { ModelConfig } from '../../config/models'

export { createGenImageTool, prepareGenImageArgs } from './genImage'
export type { GenImageExecutor, GenImageToolArgs } from './genImage'
export { createReadImageTool, prepareReadImageArgs } from './readImage'
export type { ReadImageExecutor, ReadImageToolArgs } from './readImage'
export { createAskUserQuestionTool, formatAskUserQuestionResult, prepareAskUserQuestionArgs } from './askUserQuestion'
export type {
  AskUserQuestionAnswer,
  AskUserQuestionExecutor,
  AskUserQuestionItem,
  AskUserQuestionOption,
  AskUserQuestionToolArgs,
} from './askUserQuestion'
export { createCreateSkillTool, prepareCreateSkillArgs } from './createSkill'
export type { CreateSkillExecutor, CreateSkillToolArgs } from './createSkill'
export { createReadSkillFileTool, formatReadSkillFileResult, prepareReadSkillFileArgs } from './readSkillFile'
export type { ReadSkillFileExecutor, ReadSkillFileToolArgs } from './readSkillFile'
export { createSkillTool, formatLoadedSkillText, prepareSkillArgs } from './skill'
export type { SkillExecutor, SkillToolArgs } from './skill'
export type { AgentImageToolResult, AgentRuntimeTool, AgentToolResult } from './shared'

type CreateAgentToolsParams = {
  imageModels: ModelConfig[]
  genImage: GenImageExecutor
  readImage: ReadImageExecutor
  askUserQuestion: AskUserQuestionExecutor
  loadSkill: SkillExecutor
  readSkillFile: ReadSkillFileExecutor
  createSkill: CreateSkillExecutor
}

export function createAgentTools(params: CreateAgentToolsParams): AgentRuntimeTool[] {
  return [
    createGenImageTool({ imageModels: params.imageModels, genImage: params.genImage }),
    createReadImageTool({ readImage: params.readImage }),
    createAskUserQuestionTool({ askUserQuestion: params.askUserQuestion }),
    createSkillTool({ loadSkill: params.loadSkill }),
    createReadSkillFileTool({ readSkillFile: params.readSkillFile }),
    createCreateSkillTool({ createSkill: params.createSkill }),
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
