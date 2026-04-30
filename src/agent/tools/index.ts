import { createGenImageTool, type GenImageExecutor } from './genImage'
import { createReadImageTool, type ReadImageExecutor } from './readImage'
import type { AgentRuntimeTool } from './shared'
import type { ModelConfig } from '../../config/models'

export { createGenImageTool, prepareGenImageArgs } from './genImage'
export type { GenImageExecutor, GenImageToolArgs } from './genImage'
export { createReadImageTool, prepareReadImageArgs } from './readImage'
export type { ReadImageExecutor, ReadImageToolArgs } from './readImage'
export type { AgentImageToolResult, AgentRuntimeTool } from './shared'

type CreateAgentImageToolsParams = {
  imageModels: ModelConfig[]
  genImage: GenImageExecutor
  readImage: ReadImageExecutor
}

export function createAgentImageTools(params: CreateAgentImageToolsParams): AgentRuntimeTool[] {
  return [
    createGenImageTool({ imageModels: params.imageModels, genImage: params.genImage }),
    createReadImageTool({ readImage: params.readImage }),
  ]
}
