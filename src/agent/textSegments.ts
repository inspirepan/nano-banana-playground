export const TEXT_SEGMENT_DEFAULT_LIMIT = 2000
export const TEXT_SEGMENT_MAX_CHARS = 40_000
export const TEXT_SEGMENT_MAX_LINE_CHARS = 2000

export type TextSegmentDetails = {
  offset: number
  limit: number
  lineCount: number
  originalChars: number
  returnedLines: number
  truncated: boolean
}

export type TextSegment = {
  text: string
  details: TextSegmentDetails
}

export function readableTextLines(content: string): string[] {
  if (content.length === 0) return []
  const lines: string[] = []
  for (const line of content.split(/\r?\n/)) {
    if (line.length <= TEXT_SEGMENT_MAX_LINE_CHARS) {
      lines.push(line)
      continue
    }
    for (let index = 0; index < line.length; index += TEXT_SEGMENT_MAX_LINE_CHARS) {
      lines.push(line.slice(index, index + TEXT_SEGMENT_MAX_LINE_CHARS))
    }
  }
  return lines
}

export function textSegmentLineCount(content: string): number {
  return readableTextLines(content).length
}

export function normalizeTextSegmentPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const integer = Math.floor(value)
  return integer > 0 ? integer : fallback
}

function formatNumberedLine(lineNumber: number, line: string): string {
  return `${lineNumber.toString().padStart(6)}→${line}`
}

export function formatTextSegment(content: string, offset?: number, limit?: number): TextSegment {
  const lineOffset = normalizeTextSegmentPositiveInteger(offset, 1)
  const lineLimit = normalizeTextSegmentPositiveInteger(limit, TEXT_SEGMENT_DEFAULT_LIMIT)
  const lines = readableTextLines(content)
  const startIndex = lineOffset - 1

  const baseDetails = {
    offset: lineOffset,
    limit: lineLimit,
    lineCount: lines.length,
    originalChars: content.length,
  }

  if (lines.length === 0) {
    return {
      text: '<system-reminder>Warning: the file exists but is empty.</system-reminder>',
      details: { ...baseDetails, returnedLines: 0, truncated: false },
    }
  }

  if (startIndex >= lines.length) {
    return {
      text: `<system-reminder>Warning: the file exists but is shorter than the provided offset (${lineOffset}). The file has ${lines.length} lines.</system-reminder>`,
      details: { ...baseDetails, returnedLines: 0, truncated: false },
    }
  }

  const output: string[] = []
  let returnedLines = 0
  let outputChars = 0
  let truncatedByChars = false
  const maxEndIndex = Math.min(lines.length, startIndex + lineLimit)
  for (let index = startIndex; index < maxEndIndex; index++) {
    const next = formatNumberedLine(index + 1, lines[index])
    const nextLength = outputChars + (output.length > 0 ? 1 : 0) + next.length
    if (nextLength > TEXT_SEGMENT_MAX_CHARS && output.length > 0) {
      truncatedByChars = true
      break
    }
    output.push(next)
    outputChars = nextLength
    returnedLines++
  }

  const nextLine = startIndex + returnedLines + 1
  const truncated = truncatedByChars || nextLine <= lines.length
  if (truncated) {
    const remaining = Math.max(0, lines.length - startIndex - returnedLines)
    const reason = truncatedByChars ? `${TEXT_SEGMENT_MAX_CHARS} character limit` : `${lineLimit} line limit`
    output.push(
      `… (${remaining} more lines truncated due to ${reason}, file has ${lines.length} lines total, use offset/limit to read other parts)`,
    )
  }

  return {
    text: output.join('\n'),
    details: { ...baseDetails, returnedLines, truncated },
  }
}
