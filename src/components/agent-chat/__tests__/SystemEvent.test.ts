import { describe, expect, it } from 'vitest'

import { setActiveLanguage } from '../../../i18n/core'
import { summarizeSystemEvent, summarizeSystemEventParts } from '../SystemEvent'

setActiveLanguage('zh-CN')

describe('summarizeSystemEvent', () => {
  it('counts completed GenImage result ids exactly', () => {
    expect(
      summarizeSystemEvent(`<system>
tool GenImage call call_1 has been finished.
status: completed
requested_image_id: poster
reserved_image_ids: poster, poster_2
image_ids: poster, poster_2
</system>`),
    ).toBe('生成任务完成，生成了 2 张：poster, poster_2')
  })

  it('marks completed GenImage ids as clickable mono parts tied to the originating tool call', () => {
    expect(
      summarizeSystemEventParts(`<system>
tool GenImage call call_1 has been finished.
status: completed
requested_image_id: poster
reserved_image_ids: poster, poster_2
image_ids: poster, poster_2
</system>`),
    ).toEqual([
      { text: '生成任务完成，生成了 2 张：' },
      { text: 'poster', mono: true, imageId: 'poster', toolCallId: 'call_1' },
      { text: ', ' },
      { text: 'poster_2', mono: true, imageId: 'poster_2', toolCallId: 'call_1' },
    ])
  })

  it('reports failed GenImage counts and lists the unreserved ids', () => {
    expect(
      summarizeSystemEvent(`<system>
tool GenImage call call_1 has been finished.
status: failed
requested_image_id: poster
reserved_image_ids: poster, poster_2
image_ids:
error: Request failed
</system>`),
    ).toBe('生成任务失败，失败 2 张：poster, poster_2')
  })

  it('marks failed GenImage ids as clickable mono parts tied to the originating tool call', () => {
    expect(
      summarizeSystemEventParts(`<system>
tool GenImage call call_1 has been finished.
status: failed
requested_image_id: poster
reserved_image_ids: poster, poster_2
image_ids:
error: Request failed
</system>`),
    ).toEqual([
      { text: '生成任务失败，' },
      { text: '失败 2 张：' },
      { text: 'poster', mono: true, imageId: 'poster', toolCallId: 'call_1' },
      { text: ', ' },
      { text: 'poster_2', mono: true, imageId: 'poster_2', toolCallId: 'call_1' },
    ])
  })

  it('aggregates multiple GenImage callbacks in one system event, listing succeeded and failed ids separately', () => {
    expect(
      summarizeSystemEvent(`<system>
tool GenImage call call_1 has been finished.
status: completed
requested_image_id: cover
reserved_image_ids: cover
image_ids: cover

tool GenImage call call_2 has been finished.
status: failed
requested_image_id: page
reserved_image_ids: page, page_2
image_ids: page
error: Request failed
</system>`),
    ).toBe('生成任务失败，成功 2 张：cover, page，失败 1 张：page_2')
  })
})
