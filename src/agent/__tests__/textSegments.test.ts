import { describe, expect, it } from 'vitest'

import { formatTextSegment, readableTextLines, TEXT_SEGMENT_MAX_LINE_CHARS } from '../textSegments'

describe('text segment formatting', () => {
  it('splits long physical lines into readable virtual lines', () => {
    const lines = readableTextLines('x'.repeat(TEXT_SEGMENT_MAX_LINE_CHARS + 5))

    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveLength(TEXT_SEGMENT_MAX_LINE_CHARS)
    expect(lines[1]).toHaveLength(5)
  })

  it('formats a paginated numbered segment', () => {
    const segment = formatTextSegment('alpha\nbeta\ngamma', 2, 1)

    expect(segment.text).toContain('     2→beta')
    expect(segment.text).toContain('1 more lines truncated')
    expect(segment.details).toMatchObject({ offset: 2, limit: 1, lineCount: 3, returnedLines: 1, truncated: true })
  })

  it('caps output by total character count as well as line count', () => {
    const segment = formatTextSegment(Array.from({ length: 100 }, () => 'x'.repeat(1000)).join('\n'), 1, 100)

    expect(segment.text.length).toBeLessThan(41_000)
    expect(segment.details.truncated).toBe(true)
  })
})
