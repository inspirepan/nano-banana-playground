import { Type } from '@mariozechner/pi-ai'

import description from './readImage.md?raw'
import { type AgentImageToolResult, type AgentRuntimeTool } from './shared'

export type ReadImageToolArgs = {
  image_id: string
  offset?: number
  limit?: number
}

export type ReadImageExecutor = (toolCallId: string, args: ReadImageToolArgs) => Promise<AgentImageToolResult>

export function prepareReadImageArgs(args: unknown): ReadImageToolArgs {
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

export function createReadImageTool({ readImage }: { readImage: ReadImageExecutor }): AgentRuntimeTool {
  return {
    name: 'ReadImage',
    label: '读取图片',
    description: description.trim(),
    parameters: Type.Object({
      image_id: Type.String({ description: 'Image ID to read.' }),
      offset: Type.Optional(
        Type.Number({ description: '1-indexed prompt line offset. offset > 0 reads prompt text only.' }),
      ),
      limit: Type.Optional(Type.Number({ description: 'Number of prompt lines to read. Defaults to 2000.' })),
    }),
    prepareArguments: prepareReadImageArgs,
    execute: (toolCallId: string, args: ReadImageToolArgs) => readImage(toolCallId, prepareReadImageArgs(args)),
  } as AgentRuntimeTool
}
