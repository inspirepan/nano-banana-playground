import type { ReactNode } from 'react'

import { summarizeToolArgs, summarizeToolResult, toolLabel } from './utils'
import type { AgentMessageToolCall, AgentMessageToolResult } from '../../agent'
import { Tooltip } from '../Tooltip'

function formatToolArgValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatToolArgsTooltip(args: Record<string, unknown>): string {
  const entries = Object.entries(args)
  if (entries.length === 0) return ''
  return entries.map(([key, value]) => `${key}: ${formatToolArgValue(value)}`).join('\n')
}

function StatusDot({ done, failed }: { done: boolean; failed: boolean }) {
  if (!done) return <span className="tool-dot-running h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-text-4)" />
  if (failed) return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-danger)" />
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-success)" />
}

export function ToolCallRow({
  call,
  result,
  children,
}: {
  call: AgentMessageToolCall
  result: AgentMessageToolResult | undefined
  children?: ReactNode
}) {
  const failed = result?.isError === true
  const done = Boolean(result)
  const args = summarizeToolArgs(call)
  const argsTooltip = formatToolArgsTooltip(call.arguments)
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] px-1.5 py-1">
      <div className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <StatusDot done={done} failed={failed} />
          <span className="max-w-[55%] shrink-0 truncate font-medium text-(--color-text-2)">
            {toolLabel(call.name)}
          </span>
          {argsTooltip ? (
            <Tooltip text={argsTooltip} placement="top" maxWidth={420} className="min-w-0 flex-1">
              <span className="block min-w-0 truncate text-(--color-text-3)">{args}</span>
            </Tooltip>
          ) : (
            <span className="min-w-0 flex-1 truncate text-(--color-text-3)">{args}</span>
          )}
        </span>
        {result?.isError && (
          <span className="mt-1 block truncate text-sm text-(--color-danger)">{summarizeToolResult(result)}</span>
        )}
        {children}
      </div>
    </div>
  )
}

export function StandaloneToolResultRow({ result }: { result: AgentMessageToolResult }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] px-1.5 py-1">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-(--color-text-2)">
          <StatusDot done={true} failed={result.isError === true} />
          {toolLabel(result.toolName)}
        </span>
        {result.isError && (
          <span className="mt-0.5 block truncate text-sm text-(--color-danger)">{summarizeToolResult(result)}</span>
        )}
      </span>
    </div>
  )
}

export function CompactToolGroup({ rows }: { rows: ReactNode[] }) {
  return (
    <div className="flex justify-start">
      <div className="ml-1 mr-3 max-w-[88%]">
        <div className="rounded-[var(--radius-lg)] bg-(--color-surface) px-2.5 py-2 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)]">
          <div className="space-y-1.5">{rows}</div>
        </div>
      </div>
    </div>
  )
}

export function InlineToolNotice({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="mr-3 flex max-w-[94%] items-center gap-2 pl-3 text-(--color-text-4)">
        <span className="spinner" style={{ width: 10, height: 10 }} />
        <span>{label}</span>
      </div>
    </div>
  )
}

export function InlineToolDone({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="mr-3 max-w-[94%] pl-3 text-(--color-text-3)">{label}</div>
    </div>
  )
}
