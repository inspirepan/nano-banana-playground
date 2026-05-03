import { describe, expect, it } from 'vitest'

import { agentVirtualFileLineCount, formatAgentVirtualFileSegment, type AgentVirtualFileRecord } from '../virtualFiles'

function file(content: string): AgentVirtualFileRecord {
  return {
    id: 'session:agent://tool-output/call.txt',
    sessionId: 'session',
    path: 'agent://tool-output/call.txt',
    kind: 'tool_output',
    content,
    contentType: 'text/plain',
    originalChars: content.length,
    lineCount: agentVirtualFileLineCount(content),
    createdAt: 1,
  }
}

describe('formatAgentVirtualFileSegment', () => {
  it('returns numbered lines with offset and limit', () => {
    const result = formatAgentVirtualFileSegment(file('alpha\nbeta\ngamma'), 2, 1)

    expect(result.text).toContain('     2→beta')
    expect(result.text).toContain('1 more lines truncated')
    expect(result.details.returnedLines).toBe(1)
    expect(result.details.truncated).toBe(true)
  })

  it('returns a warning when offset is beyond the file', () => {
    const result = formatAgentVirtualFileSegment(file('alpha\nbeta'), 5, 2)

    expect(result.text).toContain('shorter than the provided offset (5)')
    expect(result.details.returnedLines).toBe(0)
  })

  it('splits very long physical lines into readable virtual lines', () => {
    const result = formatAgentVirtualFileSegment(file('x'.repeat(2500)), 2, 1)

    expect(result.text).toContain(`     2→${'x'.repeat(500)}`)
    expect(result.details.lineCount).toBe(2)
    expect(result.details.truncated).toBe(false)
  })
})
