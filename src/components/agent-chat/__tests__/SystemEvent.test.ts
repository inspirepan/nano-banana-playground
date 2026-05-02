import { describe, expect, it } from 'vitest'

import { setActiveLanguage } from '../../../i18n/core'
import { summarizeSystemEvent } from '../SystemEvent'

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

  it('reports failed GenImage counts from reserved ids and result ids', () => {
    expect(
      summarizeSystemEvent(`<system>
tool GenImage call call_1 has been finished.
status: failed
requested_image_id: poster
reserved_image_ids: poster, poster_2
image_ids:
error: Request failed
</system>`),
    ).toBe('生成任务失败，失败 2 张')
  })

  it('aggregates multiple GenImage callbacks in one system event', () => {
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
    ).toBe('生成任务失败，成功 2 张，失败 1 张')
  })
})
