import { Type } from '@mariozechner/pi-ai'

import descriptionTemplate from './genImage.md?raw'
import { type AgentImageToolResult, type AgentRuntimeTool, toStringArray } from './shared'
import type { ModelConfig } from '../../config/models'
import { translate } from '../../i18n'

export type GenImageToolArgs = {
  image_id: string
  prompt: string
  model: string
  resolution: string
  ratio: string
  n: number
  reference_image_ids: string[]
}

export type GenImageExecutor = (
  toolCallId: string,
  args: GenImageToolArgs,
  signal?: AbortSignal,
) => Promise<AgentImageToolResult>

export function prepareGenImageArgs(args: unknown): GenImageToolArgs {
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

function buildModelList(imageModels: ModelConfig[]): string {
  return imageModels
    .map(
      (model) =>
        `${model.id} (${model.name}; resolutions: ${model.resolutions.join('/')}; ratios: ${model.aspectRatios.join('/')}; max n: ${model.maxBatchCount})`,
    )
    .join('; ')
}

export function createGenImageTool({
  imageModels,
  genImage,
}: {
  imageModels: ModelConfig[]
  genImage: GenImageExecutor
}): AgentRuntimeTool {
  const description = descriptionTemplate.replace('{{models}}', buildModelList(imageModels)).trim()
  return {
    name: 'GenImage',
    label: translate('configLib.agent.tool.genImage'),
    description,
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
      genImage(toolCallId, prepareGenImageArgs(args), signal),
  } as AgentRuntimeTool
}
