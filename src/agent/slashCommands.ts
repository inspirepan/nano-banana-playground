export type ParsedAgentSlashCommands = {
  text: string
  skillNames: string[]
  hasNewCommand: boolean
}

type ParseAgentSlashCommandOptions = {
  includeNewCommand?: boolean
}

const SLASH_COMMAND_RE = /(^|\s)\/([A-Za-z0-9][A-Za-z0-9-]{1,62})(?=$|\s)/g

export function parseAgentSlashCommands(
  input: string,
  enabledSkillNames: ReadonlySet<string>,
  options: ParseAgentSlashCommandOptions = {},
): ParsedAgentSlashCommands {
  const skillNames: string[] = []
  const seenSkills = new Set<string>()
  let hasNewCommand = false

  const text = input
    .replace(SLASH_COMMAND_RE, (match, prefix: string, rawName: string) => {
      const name = rawName.toLowerCase()
      if (name === 'new' && options.includeNewCommand !== false) {
        hasNewCommand = true
        return prefix
      }
      if (!enabledSkillNames.has(name)) return match
      if (!seenSkills.has(name)) {
        seenSkills.add(name)
        skillNames.push(name)
      }
      return prefix
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, skillNames, hasNewCommand }
}

export function isNewConversationCommand(input: string): boolean {
  return input.trim().toLowerCase() === '/new'
}
