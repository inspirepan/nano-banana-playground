import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { describe, expect, it } from 'vitest'

import { buildChatRenderItems } from '../utils'

function userMessage(text: string): AgentMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  } as AgentMessage
}

describe('buildChatRenderItems', () => {
  it('hides restored AskUserQuestion answer notifications', () => {
    const items = buildChatRenderItems(
      [
        userMessage(`<system>
tool AskUserQuestion call call_1 has been answered.
</system>`),
      ],
      null,
    )

    expect(items).toEqual([])
  })

  it('keeps visible system events for generated images', () => {
    const message = userMessage(`<system>
tool GenImage call call_1 has been finished.
status: completed
reserved_image_ids: poster
image_ids: poster
</system>`)

    expect(buildChatRenderItems([message], null)).toEqual([
      { type: 'message', key: 'message-0', message, isStreaming: false },
    ])
  })
})
