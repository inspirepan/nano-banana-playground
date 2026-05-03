import { describe, expect, it } from 'vitest'

import { imageDownloadFileName } from '../downloadFileName'
import type { PlaygroundImageMeta } from '../types'

describe('imageDownloadFileName', () => {
  it('uses the generated image model name in the file name', () => {
    const image: PlaygroundImageMeta = {
      id: 'abcdef1234567890',
      mimeType: 'image/png',
      timestamp: Date.UTC(2026, 0, 2, 3, 4, 5),
      source: {
        type: 'generated',
        modelId: 'gpt-image-2',
        prompt: 'prompt',
        resolution: '1K',
        aspectRatio: '1:1',
        referenceImageIds: [],
        batchId: 'batch-1',
      },
    }

    const fileName = imageDownloadFileName(image, 'png')

    expect(fileName).toContain('-gpt-image-2-abcdef123456.png')
    expect(fileName).not.toContain('nano-banana')
  })
})
