import { createAskUserQuestionTool, type AskUserQuestionExecutor } from './askUserQuestion'
import { createGenImageTool, type GenImageExecutor } from './genImage'
import { createReadImageTool, type ReadImageExecutor } from './readImage'
import type { AgentRuntimeTool } from './shared'
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
export type { AgentImageToolResult, AgentRuntimeTool, AgentToolResult } from './shared'

type CreateAgentToolsParams = {
  imageModels: ModelConfig[]
  genImage: GenImageExecutor
  readImage: ReadImageExecutor
  askUserQuestion: AskUserQuestionExecutor
}

export function createAgentTools(params: CreateAgentToolsParams): AgentRuntimeTool[] {
  return [
    createGenImageTool({ imageModels: params.imageModels, genImage: params.genImage }),
    createReadImageTool({ readImage: params.readImage }),
    createAskUserQuestionTool({ askUserQuestion: params.askUserQuestion }),
  ]
}

// Deprecated: kept for callers that only want image tools. Prefer createAgentTools.
export function createAgentImageTools(params: Omit<CreateAgentToolsParams, 'askUserQuestion'>): AgentRuntimeTool[] {
  return [
    createGenImageTool({ imageModels: params.imageModels, genImage: params.genImage }),
    createReadImageTool({ readImage: params.readImage }),
  ]
}
