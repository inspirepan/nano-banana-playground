// Collapse a list of image ids that share a numeric-suffix sequence (e.g.
// "flower", "flower_2", "flower_3") into a single base label ("flower"). Falls
// back to the first id when no common base is detected.

function numericSuffixCandidates(id: string): string[] {
  const candidates = [id]
  let current = id
  while (true) {
    const match = /^(.*)_\d+$/.exec(current)
    if (!match?.[1]) return candidates
    current = match[1]
    candidates.push(current)
  }
}

function matchesNumericSequence(id: string, base: string): boolean {
  if (id === base) return true
  if (!id.startsWith(`${base}_`)) return false
  return /^\d+$/.test(id.slice(base.length + 1))
}

export function compactImageIdLabel(ids: readonly string[]): string | null {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return null
  if (uniqueIds.length === 1) return uniqueIds[0]

  return (
    numericSuffixCandidates(uniqueIds[0]).find((candidate) =>
      uniqueIds.every((id) => matchesNumericSequence(id, candidate)),
    ) ?? uniqueIds[0]
  )
}
