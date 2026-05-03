import { describe, expect, it } from 'vitest'

import {
  formatOffloadedTextPreview,
  offloadAgentToolResult,
  shouldOffloadText,
  TOOL_OUTPUT_MAX_CHARS,
} from '../toolResultOffload'

describe('tool result offload formatting', () => {
  it('detects output over the character threshold', () => {
    expect(shouldOffloadText('x'.repeat(TOOL_OUTPUT_MAX_CHARS + 1))).toBe(true)
    expect(shouldOffloadText('short')).toBe(false)
  })

  it('includes the virtual file path and head/tail preview', () => {
    const text = `${'a'.repeat(12_000)}middle${'z'.repeat(12_000)}`
    const preview = formatOffloadedTextPreview(text, 'agent://tool-output/call.txt')

    expect(preview).toContain('Full output saved to: agent://tool-output/call.txt')
    expect(preview).toContain('Use ReadAgentFile with offset/limit')
    expect(preview).toContain('aaaaaaaaaa')
    expect(preview).toContain('zzzzzzzzzz')
  })

  it('keeps long error results as errors instead of offloading them', async () => {
    const result = {
      content: [
        { type: 'text' as const, text: `<tool_use_error>${'x'.repeat(TOOL_OUTPUT_MAX_CHARS + 1)}</tool_use_error>` },
      ],
      details: { status: 'error' },
    }

    await expect(
      offloadAgentToolResult(result, { sessionId: 'session', toolCallId: 'call', toolName: 'WebFetch' }),
    ).resolves.toBe(result)
  })

  it('limits preview line count for many short lines', () => {
    const preview = formatOffloadedTextPreview(
      Array.from({ length: 3000 }, (_, index) => String(index)).join('\n'),
      'agent://x',
    )

    expect(preview.split('\n').length).toBeLessThan(2000)
  })
})
