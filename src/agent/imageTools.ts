import type { Agent } from '@mariozechner/pi-agent'
import type { ImageContent, TextContent } from '@mariozechner/pi-ai'
import { Type } from '@mariozechner/pi-ai'

import type { ModelConfig } from '../config/models'

type AgentRuntimeTool = Agent['state']['tools'][number]

export type GenImageToolArgs = {
  image_id: string
  prompt: string
  model: string
  resolution: string
  ratio: string
  n: number
  reference_image_ids: string[]
}

export type ReadImageToolArgs = {
  image_id: string
  offset?: number
  limit?: number
}

export type AgentImageToolResult = {
  content: (TextContent | ImageContent)[]
  details: unknown
}

type CreateAgentImageToolsParams = {
  imageModels: ModelConfig[]
  genImage: (toolCallId: string, args: GenImageToolArgs, signal?: AbortSignal) => Promise<AgentImageToolResult>
  readImage: (toolCallId: string, args: ReadImageToolArgs) => Promise<AgentImageToolResult>
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function prepareGenImageArgs(args: unknown): GenImageToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  return {
    image_id: typeof record.image_id === 'string' ? record.image_id : '',
    prompt: typeof record.prompt === 'string' ? record.prompt : '',
    model: typeof record.model === 'string' ? record.model : '',
    resolution: typeof record.resolution === 'string' ? record.resolution : '',
    ratio: typeof record.ratio === 'string' ? record.ratio : '',
    n: typeof record.n === 'number' ? record.n : Number(record.n ?? 1),
    reference_image_ids: toStringArray(record.reference_image_ids),
  }
}

function prepareReadImageArgs(args: unknown): ReadImageToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  return {
    image_id: typeof record.image_id === 'string' ? record.image_id : '',
    offset:
      record.offset === undefined
        ? undefined
        : typeof record.offset === 'number'
          ? record.offset
          : Number(record.offset),
    limit:
      record.limit === undefined ? undefined : typeof record.limit === 'number' ? record.limit : Number(record.limit),
  }
}

export function createAgentImageTools(params: CreateAgentImageToolsParams): AgentRuntimeTool[] {
  const modelList = params.imageModels
    .map(
      (model) =>
        `${model.id} (${model.name}; resolutions: ${model.resolutions.join('/')}; ratios: ${model.aspectRatios.join('/')}; max n: ${model.maxBatchCount})`,
    )
    .join('; ')
  return [
    {
      name: 'GenImage',
      label: '生成图片',
      description: `Create an image generation task for user approval. The task returns immediately with reserved image IDs; actual generation continues asynchronously after approval or auto-approval, and the app will notify you when the task reaches a terminal state. Use short readable image_id values because they become future image references. Available model IDs: ${modelList}. If you need another model, ask the user instead of inventing a model ID.`,
      parameters: Type.Object({
        image_id: Type.String({ description: 'Semantic output image ID. Required and non-empty.' }),
        prompt: Type.String({ description: 'Image generation prompt. Required and non-empty.' }),
        model: Type.String({ description: 'Image model ID from the playground model list.' }),
        resolution: Type.String({ description: 'Target resolution supported by the model.' }),
        ratio: Type.String({ description: 'Target aspect ratio.' }),
        n: Type.Number({ description: 'Number of images to generate.' }),
        reference_image_ids: Type.Array(Type.String(), {
          description: 'IDs of uploaded, reference, history, or generated images to use as references.',
        }),
      }),
      prepareArguments: prepareGenImageArgs,
      execute: (toolCallId: string, args: GenImageToolArgs, signal?: AbortSignal) =>
        params.genImage(toolCallId, prepareGenImageArgs(args), signal),
    } as AgentRuntimeTool,
    {
      name: 'ReadImage',
      label: '读取图片',
      description:
        'Read an image by image_id. Omit offset or pass offset <= 0 the first time to receive image metadata, generation context, prompt lines, and the image content. Pass offset > 0 to read only additional prompt lines without sending the image again.',
      parameters: Type.Object({
        image_id: Type.String({ description: 'Image ID to read.' }),
        offset: Type.Optional(
          Type.Number({ description: '1-indexed prompt line offset. offset > 0 reads prompt text only.' }),
        ),
        limit: Type.Optional(Type.Number({ description: 'Number of prompt lines to read. Defaults to 2000.' })),
      }),
      prepareArguments: prepareReadImageArgs,
      execute: (toolCallId: string, args: ReadImageToolArgs) =>
        params.readImage(toolCallId, prepareReadImageArgs(args)),
    } as AgentRuntimeTool,
  ]
}
