import { describe, expect, it } from 'vitest'

import { DEFAULT_MODEL } from '../../config/models'
import type { GenerationJob } from '../../hooks/usePlayground'
import { buildImageStacks } from '../stacks'
import type { PlaygroundImageMeta } from '../types'

function generatedImage(params: {
  id: string
  batchId: string
  stackId: string
  batchCreatedAt: number
  timestamp: number
  slotIndex?: number
}): PlaygroundImageMeta {
  return {
    id: params.id,
    mimeType: 'image/png',
    timestamp: params.timestamp,
    source: {
      type: 'generated',
      modelId: DEFAULT_MODEL.id,
      prompt: 'prompt',
      resolution: DEFAULT_MODEL.defaultResolution,
      aspectRatio: DEFAULT_MODEL.defaultAspectRatio,
      referenceImageIds: [],
      batchId: params.batchId,
      batchCreatedAt: params.batchCreatedAt,
      stackId: params.stackId,
      ...(params.slotIndex !== undefined ? { slotIndex: params.slotIndex } : {}),
    },
  }
}

function queuedJob(params: { id: string; stackId: string; createdAt: number }): GenerationJob {
  return {
    id: params.id,
    stackId: params.stackId,
    createdAt: params.createdAt,
    status: 'queued',
    request: {
      apiKey: 'test-key',
      model: DEFAULT_MODEL,
      prompt: 'prompt',
      referenceImages: [],
      resolution: DEFAULT_MODEL.defaultResolution,
      aspectRatio: DEFAULT_MODEL.defaultAspectRatio,
      options: {},
    },
    slots: [
      {
        id: `${params.id}-slot-0`,
        index: 0,
        status: 'queued',
        attempt: 1,
        maxAttempts: 1,
      },
    ],
  }
}

describe('buildImageStacks', () => {
  it('keeps a newer active job above an older job that finishes first', () => {
    const stacks = buildImageStacks(
      [
        generatedImage({
          id: 'image-1',
          batchId: 'job-1',
          stackId: 'stack-1',
          batchCreatedAt: 1000,
          timestamp: 3000,
        }),
      ],
      [queuedJob({ id: 'job-2', stackId: 'stack-2', createdAt: 2000 })],
    )

    expect(stacks.map((stack) => stack.id)).toEqual(['stack-2', 'stack-1'])
    expect(stacks.map((stack) => stack.updatedAt)).toEqual([2000, 1000])
  })
})
