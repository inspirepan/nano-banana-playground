import type { ReactNode } from 'react'

import { summarizeToolArgs, summarizeToolResult, toolLabel } from './utils'
import type { AgentMessageToolCall, AgentMessageToolResult } from '../../agent'
import { Icon } from '../Icon'

export function ToolCallRow({
  call,
  result,
}: {
  call: AgentMessageToolCall
  result: AgentMessageToolResult | undefined
}) {
  const failed = result?.isError === true
  const done = Boolean(result)
  const showStatusBadge = !done || failed
  return (
    <div className="flex items-start gap-2 rounded-[7px] px-1.5 py-1">
      {showStatusBadge && (
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px]"
          style={{
            background: failed ? 'var(--color-danger-soft)' : 'var(--color-surface-2)',
            color: failed ? 'var(--color-danger)' : 'var(--color-text-3)',
            boxShadow: 'inset 0 0 0 1px var(--ring-edge-soft)',
          }}
        >
          {failed ? (
            <Icon name="alert_circle" size={11} />
          ) : (
            <span className="spinner" style={{ width: 10, height: 10 }} />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-(--color-text-2)">{toolLabel(call.name)}</span>
          <span className="mono shrink-0 text-[11px] text-(--color-text-4)">{call.name}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-(--color-text-4)">{summarizeToolArgs(call)}</span>
        {result && (
          <span className="mt-1 block truncate text-sm text-(--color-text-3)">{summarizeToolResult(result)}</span>
        )}
      </span>
    </div>
  )
}

export function StandaloneToolResultRow({ result }: { result: AgentMessageToolResult }) {
  return (
    <div className="flex items-start gap-2 rounded-[7px] px-1.5 py-1">
      {result.isError && (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-(--color-danger-soft) text-(--color-danger) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          <Icon name="alert_circle" size={11} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium text-(--color-text-2)">{toolLabel(result.toolName)}</span>
        <span className="mt-0.5 block truncate text-sm text-(--color-text-3)">{summarizeToolResult(result)}</span>
      </span>
    </div>
  )
}

export function CompactToolGroup({ rows, isStreaming }: { rows: ReactNode[]; isStreaming: boolean }) {
  return (
    <div className="flex justify-start">
      <div className="mr-3 max-w-[88%]">
        <div className="mb-1.5 mono text-[11px] uppercase tracking-[0.12em] text-(--color-text-4)">Agent</div>
        <div className="rounded-[10px] bg-(--color-surface) px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          <div className="space-y-1.5">{rows}</div>
          {isStreaming && <div className="mt-1.5 text-sm text-(--color-text-4)">等待工具结果…</div>}
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
      <div className="mr-3 max-w-[94%] pl-3 text-(--color-text-4)">{label}</div>
    </div>
  )
}
