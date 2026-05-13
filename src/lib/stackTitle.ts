const STACK_TITLE_MAX_LENGTH = 56
const STACK_TITLE_GENERATION_MIN_LENGTH = 30

export function stackTitleForPrompt(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= STACK_TITLE_MAX_LENGTH) return collapsed
  return `${collapsed.slice(0, STACK_TITLE_MAX_LENGTH - 3).trimEnd()}...`
}

export function shouldGenerateStackTitle(text: string): boolean {
  return text.replace(/\s+/g, ' ').trim().length > STACK_TITLE_GENERATION_MIN_LENGTH
}
