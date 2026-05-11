const STACK_TITLE_MAX_LENGTH = 56

export function stackTitleForPrompt(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= STACK_TITLE_MAX_LENGTH) return collapsed
  return `${collapsed.slice(0, STACK_TITLE_MAX_LENGTH - 3).trimEnd()}...`
}
