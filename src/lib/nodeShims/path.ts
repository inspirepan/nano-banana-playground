export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/')
}
