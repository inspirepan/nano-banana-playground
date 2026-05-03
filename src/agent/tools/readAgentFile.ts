import { Type } from '@mariozechner/pi-ai'

import description from './readAgentFile.md?raw'
import { type AgentRuntimeTool, type AgentToolResult } from './shared'
import { translate } from '../../i18n'
import { formatAgentVirtualFileSegment, loadAgentVirtualFile } from '../virtualFiles'

export type ReadAgentFileToolArgs = {
  path: string
  offset?: number
  limit?: number
}

export type ReadAgentFileExecutor = (toolCallId: string, args: ReadAgentFileToolArgs) => Promise<AgentToolResult>

export function prepareReadAgentFileArgs(args: unknown): ReadAgentFileToolArgs {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  return {
    path: typeof record.path === 'string' ? record.path.trim() : '',
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

export async function formatReadAgentFileResult(
  sessionId: string,
  args: ReadAgentFileToolArgs,
): Promise<AgentToolResult> {
  const path = args.path.trim()
  if (!path) {
    const text = '<tool_use_error>Missing path.</tool_use_error>'
    return { content: [{ type: 'text', text }], details: { status: 'error', reason: 'missing_path' } }
  }
  if (!path.startsWith('agent://')) {
    const text = '<tool_use_error>ReadAgentFile only supports agent:// virtual file paths.</tool_use_error>'
    return { content: [{ type: 'text', text }], details: { status: 'error', reason: 'unsupported_path', path } }
  }

  const file = await loadAgentVirtualFile(sessionId, path)
  if (!file) {
    const text = '<tool_use_error>Agent virtual file does not exist in this session.</tool_use_error>'
    return { content: [{ type: 'text', text }], details: { status: 'error', reason: 'not_found', path } }
  }

  const segment = formatAgentVirtualFileSegment(file, args.offset, args.limit)
  return { content: [{ type: 'text', text: segment.text }], details: segment.details }
}

export function createReadAgentFileTool({ readAgentFile }: { readAgentFile: ReadAgentFileExecutor }): AgentRuntimeTool {
  return {
    name: 'ReadAgentFile',
    label: translate('configLib.agent.tool.readAgentFile'),
    description: description.trim(),
    parameters: Type.Object({
      path: Type.String({ description: 'Exact agent:// virtual file path to read.' }),
      offset: Type.Optional(Type.Number({ description: '1-indexed line offset. Defaults to 1.' })),
      limit: Type.Optional(Type.Number({ description: 'Number of lines to read. Defaults to 2000.' })),
    }),
    prepareArguments: prepareReadAgentFileArgs,
    execute: (toolCallId: string, args: ReadAgentFileToolArgs) =>
      readAgentFile(toolCallId, prepareReadAgentFileArgs(args)),
  } as AgentRuntimeTool
}
