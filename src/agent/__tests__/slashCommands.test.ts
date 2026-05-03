import { describe, expect, it } from 'vitest'

import { isNewConversationCommand, parseAgentSlashCommands } from '../slashCommands'

describe('parseAgentSlashCommands', () => {
  const skills = new Set(['article-cover-image', 'comic-strip'])

  it('extracts enabled skill commands and keeps the user prompt', () => {
    expect(parseAgentSlashCommands('/article-cover-image 画一张封面', skills)).toEqual({
      text: '画一张封面',
      skillNames: ['article-cover-image'],
      hasNewCommand: false,
    })
  })

  it('deduplicates skills and leaves unknown commands in the prompt', () => {
    expect(parseAgentSlashCommands('/comic-strip /unknown /comic-strip 做四格漫画', skills)).toEqual({
      text: '/unknown 做四格漫画',
      skillNames: ['comic-strip'],
      hasNewCommand: false,
    })
  })

  it('can leave /new untouched for send-time skill parsing', () => {
    expect(parseAgentSlashCommands('/new hello', skills, { includeNewCommand: false })).toEqual({
      text: '/new hello',
      skillNames: [],
      hasNewCommand: false,
    })
  })
})

describe('isNewConversationCommand', () => {
  it('matches only the standalone /new command', () => {
    expect(isNewConversationCommand(' /new ')).toBe(true)
    expect(isNewConversationCommand('/new hello')).toBe(false)
  })
})
