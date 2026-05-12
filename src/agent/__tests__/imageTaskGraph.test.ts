import { describe, expect, it } from 'vitest'

import {
  findActiveAgentImageTaskDependencies,
  findAgentImageTaskDependencies,
  findAgentImageTaskDependencyCycle,
  findBlockedWaitingAgentImageTasks,
  findStartableWaitingAgentImageTasks,
} from '../imageTaskGraph'
import type { AgentImageTask } from '../imageTasks'

function task(params: {
  id: string
  outputIds: string[]
  referenceIds?: string[]
  status?: AgentImageTask['status']
  resultIds?: string[]
}): AgentImageTask {
  return {
    id: params.id,
    toolCallId: `tool-${params.id}`,
    agentTurnId: 'turn-1',
    createdAt: 1,
    status: params.status ?? 'queued',
    request: {
      prompt: `prompt-${params.id}`,
      requestedImageId: params.outputIds[0] ?? params.id,
      reservedImageIds: params.outputIds,
      modelId: 'gemini-3.1-flash-image-preview' as AgentImageTask['request']['modelId'],
      resolution: '1K',
      aspectRatio: '1:1',
      batchCount: params.outputIds.length || 1,
      referenceImageIds: params.referenceIds ?? [],
      options: {},
    },
    resultImageIds: params.resultIds ?? [],
    renamedImageIds: false,
  }
}

describe('image task dependency graph', () => {
  it('maps referenced reserved image ids back to their producing tasks', () => {
    const source = task({ id: 'task-a', outputIds: ['A'], status: 'running' })
    const dependent = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A', 'A'], status: 'waiting_dependencies' })

    expect(findAgentImageTaskDependencies([dependent, source], dependent)).toEqual([{ imageId: 'A', task: source }])
    expect(findActiveAgentImageTaskDependencies([dependent, source], dependent)).toEqual([
      { imageId: 'A', task: source },
    ])
  })

  it('detects dependency cycles instead of assuming the task graph is a DAG', () => {
    const a = task({ id: 'task-a', outputIds: ['A'], referenceIds: ['B'], status: 'waiting_dependencies' })
    const b = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A'], status: 'waiting_dependencies' })

    expect(findAgentImageTaskDependencyCycle([a, b])).toEqual(['task-a', 'task-b', 'task-a'])
    expect(findAgentImageTaskDependencyCycle([a, b], 'task-b')).toEqual(['task-b', 'task-a', 'task-b'])
  })

  it('keeps waiting tasks blocked while an upstream task is still active', () => {
    const source = task({ id: 'task-a', outputIds: ['A'], status: 'running' })
    const dependent = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A'], status: 'waiting_dependencies' })

    expect(findStartableWaitingAgentImageTasks([dependent, source])).toEqual([])
    expect(findBlockedWaitingAgentImageTasks([dependent, source])).toEqual([])
  })

  it('does not block on an active batch task after the exact referenced image has been produced', () => {
    const source = task({
      id: 'task-a',
      outputIds: ['A_1', 'A_2'],
      status: 'running',
      resultIds: ['A_1'],
    })
    const dependent = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A_1'], status: 'waiting_dependencies' })

    expect(findActiveAgentImageTaskDependencies([dependent, source], dependent)).toEqual([])
    expect(findStartableWaitingAgentImageTasks([dependent, source])).toEqual([dependent])
  })

  it('still waits for missing images from the same active batch even if another referenced slot is ready', () => {
    const source = task({
      id: 'task-a',
      outputIds: ['A_1', 'A_2'],
      status: 'running',
      resultIds: ['A_1'],
    })
    const dependent = task({
      id: 'task-b',
      outputIds: ['B'],
      referenceIds: ['A_1', 'A_2'],
      status: 'waiting_dependencies',
    })

    expect(findActiveAgentImageTaskDependencies([dependent, source], dependent)).toEqual([
      { imageId: 'A_2', task: source },
    ])
    expect(findStartableWaitingAgentImageTasks([dependent, source])).toEqual([])
  })

  it('keeps the newest producer when a released image id is reserved again', () => {
    const currentProducer = task({ id: 'task-new', outputIds: ['A'], status: 'running' })
    const oldProducer = task({ id: 'task-old', outputIds: ['A'], status: 'failed', resultIds: [] })
    const dependent = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A'], status: 'waiting_dependencies' })

    expect(findAgentImageTaskDependencies([dependent, currentProducer, oldProducer], dependent)).toEqual([
      { imageId: 'A', task: currentProducer },
    ])
    expect(findBlockedWaitingAgentImageTasks([dependent, currentProducer, oldProducer])).toEqual([])
  })

  it('marks waiting tasks as startable once all dependencies have produced their referenced images', () => {
    const source = task({ id: 'task-a', outputIds: ['A'], status: 'completed', resultIds: ['A'] })
    const dependent = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A'], status: 'waiting_dependencies' })

    expect(findStartableWaitingAgentImageTasks([dependent, source])).toEqual([dependent])
    expect(findBlockedWaitingAgentImageTasks([dependent, source])).toEqual([])
  })

  it('blocks waiting tasks when an upstream terminal task did not produce the referenced image', () => {
    const source = task({ id: 'task-a', outputIds: ['A'], status: 'failed', resultIds: [] })
    const dependent = task({ id: 'task-b', outputIds: ['B'], referenceIds: ['A'], status: 'waiting_dependencies' })

    expect(findStartableWaitingAgentImageTasks([dependent, source])).toEqual([])
    expect(findBlockedWaitingAgentImageTasks([dependent, source])).toEqual([
      { task: dependent, dependency: { imageId: 'A', task: source } },
    ])
  })

  it('allows partial upstream success when the exact referenced image exists', () => {
    const source = task({ id: 'task-a', outputIds: ['A_1', 'A_2'], status: 'failed', resultIds: ['A_1'] })
    const readyDependent = task({
      id: 'task-b',
      outputIds: ['B'],
      referenceIds: ['A_1'],
      status: 'waiting_dependencies',
    })
    const blockedDependent = task({
      id: 'task-c',
      outputIds: ['C'],
      referenceIds: ['A_2'],
      status: 'waiting_dependencies',
    })

    expect(findStartableWaitingAgentImageTasks([readyDependent, blockedDependent, source])).toEqual([readyDependent])
    expect(findBlockedWaitingAgentImageTasks([readyDependent, blockedDependent, source])).toEqual([
      { task: blockedDependent, dependency: { imageId: 'A_2', task: source } },
    ])
  })
})
