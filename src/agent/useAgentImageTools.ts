import { useCallback, type RefObject } from 'react'

import { compressImageForAgentInput } from './imageCompression'
import {
  AGENT_PROMPT_DEFAULT_LINE_LIMIT,
  formatPromptLines,
  isTerminalAgentImageTaskStatus,
  promptLineCount,
  type AgentImageTask,
  type AgentTurnCallbackState,
} from './imageTasks'
import {
  activateAgentResponseMetadata,
  agentTaskStatusFromGenerationJob,
  buildAgentTaskCallbackText,
  errorFromGenerationJob,
  queueAgentResponseMetadata,
  toolTextResult,
} from './messageRecovery'
import { activeOptionsForModel, findModelConfig, normalizeAspectRatio, normalizeResolution } from './modelLookup'
import { AGENT_TASK_PROTOCOL_MESSAGES, type AgentSessionRuntime, type ProviderCredentials } from './runtimeTypes'
import type { AgentToolResult, GenImageToolArgs, ReadImageToolArgs } from './tools'
import type { AgentResolvedImage } from './useAgentImageRegistry'
import { resolveAgentModelConfig, type AgentModelProvider } from '../config/agentModels'
import { MODEL_CONFIGS, defaultOptionsFor, type ModelConfig } from '../config/models'
import { getProviderConfig } from '../config/providers'
import { useExternalSync } from '../hooks/effects'
import type { GenerationJob } from '../hooks/useGenerationQueue'
import { translate } from '../i18n'
import { stackIdForGenerationRequest } from '../lib/stackId'
import type { PlaygroundImage } from '../lib/types'

export function useAgentImageTools({
  agentRuntimesRef,
  agentCredentialsRef,
  maybeDispatchAgentImageCallbacksRef,
  generationJobsRefForAgent,
  generationJobs,
  providerApiKeys,
  getCurrentRuntime,
  getProviderCredentials,
  enqueueGenerationJob,
  cancelGenerationJob,
  dismissGenerationJob,
  resolveAgentReferenceImages,
  resolveAgentImageById,
  reserveAgentImageIdsForRuntime,
  releasePendingAgentImageIds,
  applyAgentRuntimeConfig,
  setRuntimeError,
  setRuntimeImageTasks,
  scheduleRuntimeSidecarPersist,
  syncRuntimeSnapshot,
  isCurrentRuntime,
  setAgentImageTasksState,
}: {
  agentRuntimesRef: RefObject<Map<string, AgentSessionRuntime>>
  agentCredentialsRef: RefObject<Record<AgentModelProvider, ProviderCredentials>>
  maybeDispatchAgentImageCallbacksRef: { current: (runtime: AgentSessionRuntime) => void }
  generationJobsRefForAgent: RefObject<GenerationJob[]>
  generationJobs: GenerationJob[]
  providerApiKeys: Record<AgentModelProvider, string>
  getCurrentRuntime: () => AgentSessionRuntime | null
  getProviderCredentials: (provider: ModelConfig['provider']) => ProviderCredentials
  enqueueGenerationJob: (
    request: GenerationJob['request'],
    batchCount: number,
    stackId: string,
    parentImageId?: string,
  ) => string
  cancelGenerationJob: (jobId: string) => void
  dismissGenerationJob: (jobId: string) => void
  resolveAgentReferenceImages: (runtime: AgentSessionRuntime, ids: string[]) => Promise<PlaygroundImage[]>
  resolveAgentImageById: (runtime: AgentSessionRuntime, id: string) => Promise<AgentResolvedImage>
  reserveAgentImageIdsForRuntime: (
    runtime: AgentSessionRuntime,
    requestedImageId: string,
    count: number,
  ) => Promise<{
    requestedImageId: string
    reservedImageIds: string[]
    renamed: boolean
  }>
  releasePendingAgentImageIds: (ids: string[]) => void
  applyAgentRuntimeConfig: (runtime: AgentSessionRuntime) => void
  setRuntimeError: (runtime: AgentSessionRuntime, message: string | null) => void
  setRuntimeImageTasks: (
    runtime: AgentSessionRuntime,
    updater: (prev: AgentImageTask[]) => AgentImageTask[],
  ) => AgentImageTask[]
  scheduleRuntimeSidecarPersist: (runtime: AgentSessionRuntime) => void
  syncRuntimeSnapshot: (runtime: AgentSessionRuntime) => void
  isCurrentRuntime: (runtime: AgentSessionRuntime) => boolean
  setAgentImageTasksState: (tasks: AgentImageTask[]) => void
}) {
  const sendAgentSystemEvent = useCallback(
    async (runtime: AgentSessionRuntime, text: string): Promise<boolean> => {
      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) {
        setRuntimeError(runtime, translate('configLib.agent.callbackMissingKey', { provider: config.providerLabel }))
        return false
      }

      applyAgentRuntimeConfig(runtime)
      runtime.currentAgentTurnId = crypto.randomUUID()
      if (runtime.agent.state.isStreaming || runtime.isCompacting) {
        queueAgentResponseMetadata(runtime, config.id)
        await runtime.agent.queueMessage({ role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() })
      } else {
        activateAgentResponseMetadata(runtime, config.id)
        await runtime.agent.prompt(text)
      }
      syncRuntimeSnapshot(runtime)
      if (runtime.ready && agentRuntimesRef.current.get(runtime.sessionId) === runtime) {
        maybeDispatchAgentImageCallbacksRef.current(runtime)
      }
      return true
    },
    [
      agentCredentialsRef,
      agentRuntimesRef,
      applyAgentRuntimeConfig,
      maybeDispatchAgentImageCallbacksRef,
      setRuntimeError,
      syncRuntimeSnapshot,
    ],
  )

  const maybeDispatchAgentImageCallbacks = useCallback(
    (runtime: AgentSessionRuntime, tasks = runtime.imageTasks) => {
      if (runtime.agent.state.isStreaming || runtime.isCompacting) return
      const readyCallbacks: Array<{ callbackState: AgentTurnCallbackState; tasks: AgentImageTask[] }> = []
      for (const callbackState of runtime.turnCallbacks.values()) {
        if (callbackState.callbackQueued || callbackState.taskIds.length === 0) continue
        const turnTasks = callbackState.taskIds
          .map((taskId) => tasks.find((task) => task.id === taskId))
          .filter((task): task is AgentImageTask => Boolean(task))
        if (turnTasks.length !== callbackState.taskIds.length) continue
        if (!turnTasks.every((task) => isTerminalAgentImageTaskStatus(task.status))) continue
        readyCallbacks.push({ callbackState, tasks: turnTasks })
      }

      if (readyCallbacks.length === 0) return

      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) {
        setRuntimeError(runtime, translate('configLib.agent.callbackMissingKey', { provider: config.providerLabel }))
        return
      }

      applyAgentRuntimeConfig(runtime)
      if (runtime.agent.state.isStreaming || runtime.isCompacting) return

      const callbackStates = readyCallbacks.map((item) => item.callbackState)
      const text = buildAgentTaskCallbackText(readyCallbacks.flatMap((item) => item.tasks))
      for (const callbackState of callbackStates) callbackState.callbackQueued = true
      scheduleRuntimeSidecarPersist(runtime)

      runtime.currentAgentTurnId = crypto.randomUUID()
      activateAgentResponseMetadata(runtime, config.id)
      const promptPromise = runtime.agent.prompt(text)
      syncRuntimeSnapshot(runtime)
      promptPromise
        .catch((error: unknown) => {
          for (const callbackState of callbackStates) callbackState.callbackQueued = false
          scheduleRuntimeSidecarPersist(runtime)
          const message = error instanceof Error ? error.message : String(error)
          setRuntimeError(runtime, message)
        })
        .finally(() => {
          syncRuntimeSnapshot(runtime)
          if (runtime.ready && agentRuntimesRef.current.get(runtime.sessionId) === runtime) {
            maybeDispatchAgentImageCallbacksRef.current(runtime)
          }
        })
    },
    [
      agentCredentialsRef,
      agentRuntimesRef,
      applyAgentRuntimeConfig,
      maybeDispatchAgentImageCallbacksRef,
      scheduleRuntimeSidecarPersist,
      setRuntimeError,
      syncRuntimeSnapshot,
    ],
  )

  useExternalSync(() => {
    maybeDispatchAgentImageCallbacksRef.current = maybeDispatchAgentImageCallbacks
  }, [maybeDispatchAgentImageCallbacks, maybeDispatchAgentImageCallbacksRef])

  const startAgentImageTask = useCallback(
    async (runtime: AgentSessionRuntime, task: AgentImageTask): Promise<{ ok: boolean; message: string }> => {
      setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) =>
          item.id === task.id && item.status === 'pending_approval' ? { ...item, status: 'approved' } : item,
        ),
      )

      const modelConfig = findModelConfig(task.request.modelId)
      if (!modelConfig) {
        const message = translate('configLib.agent.unknownGenImageModel', { model: task.request.modelId })
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      const credentials = getProviderCredentials(modelConfig.provider)
      if (!credentials.apiKey) {
        const message = translate('configLib.agent.modelMissingKey', {
          model: modelConfig.name,
          provider: getProviderConfig(modelConfig.provider).shortLabel,
        })
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      let referenceImages: PlaygroundImage[]
      try {
        referenceImages = await resolveAgentReferenceImages(runtime, task.request.referenceImageIds)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: 'failed', error: message } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return { ok: false, message }
      }

      if (!runtime.ready || agentRuntimesRef.current.get(runtime.sessionId) !== runtime) {
        return { ok: false, message: translate('configLib.agent.sessionDeleted') }
      }

      const currentTask = runtime.imageTasks.find((item) => item.id === task.id)
      if (!currentTask || isTerminalAgentImageTaskStatus(currentTask.status)) {
        return { ok: false, message: translate('configLib.agent.taskCanceled') }
      }

      const stackId =
        task.request.stackId ??
        stackIdForGenerationRequest({
          model: modelConfig,
          prompt: task.request.prompt,
          referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          batchCount: task.request.batchCount,
        })
      const batchId = enqueueGenerationJob(
        {
          apiKey: credentials.apiKey,
          baseUrl: credentials.baseUrl,
          model: modelConfig,
          prompt: task.request.prompt,
          referenceImages,
          resolution: task.request.resolution,
          aspectRatio: task.request.aspectRatio,
          options: task.request.options,
          outputImageIds: task.request.reservedImageIds,
          outputImageIdSource: 'agent',
        },
        task.request.batchCount,
        stackId,
        task.request.parentImageId,
      )
      setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: 'queued',
                generationJobId: batchId,
                error: undefined,
                request: { ...item.request, stackId },
              }
            : item,
        ),
      )
      return { ok: true, message: translate('configLib.agent.taskStarted') }
    },
    [
      agentRuntimesRef,
      enqueueGenerationJob,
      getProviderCredentials,
      maybeDispatchAgentImageCallbacks,
      resolveAgentReferenceImages,
      setRuntimeImageTasks,
    ],
  )

  const approveAgentImageTask = useCallback(
    (taskId: string) => {
      const runtime = getCurrentRuntime()
      const task = runtime?.imageTasks.find((item) => item.id === taskId)
      if (!runtime || !task || task.status !== 'pending_approval') return
      void startAgentImageTask(runtime, task)
    },
    [getCurrentRuntime, startAgentImageTask],
  )

  const cancelAgentImageTask = useCallback(
    (taskId: string) => {
      const runtime = getCurrentRuntime()
      const task = runtime?.imageTasks.find((item) => item.id === taskId)
      if (!runtime || !task) return
      if (task.status === 'pending_approval') {
        const next = setRuntimeImageTasks(runtime, (prev) =>
          prev.map((item) => (item.id === taskId ? { ...item, status: 'rejected' } : item)),
        )
        for (const id of task.request.reservedImageIds) runtime.imageRegistry.delete(id)
        maybeDispatchAgentImageCallbacks(runtime, next)
        return
      }
      if (task.generationJobId) {
        cancelGenerationJob(task.generationJobId)
        dismissGenerationJob(task.generationJobId)
      }
      const job = task.generationJobId
        ? generationJobsRefForAgent.current.find((item) => item.id === task.generationJobId)
        : undefined
      const resultImageIds = job?.slots.flatMap((slot) => (slot.image ? [slot.image.id] : [])) ?? task.resultImageIds
      const fulfilledIds = new Set(resultImageIds)
      for (const id of task.request.reservedImageIds) {
        if (!fulfilledIds.has(id)) runtime.imageRegistry.delete(id)
      }
      const next = setRuntimeImageTasks(runtime, (prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: 'canceled', resultImageIds } : item)),
      )
      maybeDispatchAgentImageCallbacks(runtime, next)
    },
    [
      cancelGenerationJob,
      dismissGenerationJob,
      generationJobsRefForAgent,
      getCurrentRuntime,
      maybeDispatchAgentImageCallbacks,
      setRuntimeImageTasks,
    ],
  )

  const runGenImageTool = useCallback(
    async (
      sessionId: string,
      toolCallId: string,
      args: GenImageToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) throw new Error('Agent session is no longer available.')
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const promptText = args.prompt.trim()
      if (!promptText) throw new Error('GenImage.prompt is required.')
      const modelConfig = findModelConfig(args.model)
      if (!modelConfig) {
        throw new Error(
          `Unknown GenImage model: ${args.model}. Available models: ${MODEL_CONFIGS.map((item) => item.id).join(', ')}`,
        )
      }
      const requestedCount = Number.isFinite(args.n) ? Math.floor(args.n) : 1
      const batchCount = Math.min(Math.max(1, requestedCount), modelConfig.maxBatchCount)
      const resolution = normalizeResolution(modelConfig, args.resolution)
      const aspect = normalizeAspectRatio(modelConfig, args.ratio)
      const referenceImageIds = args.reference_image_ids.filter((id) => id.trim()).map((id) => id.trim())
      const referenceImages = await resolveAgentReferenceImages(runtime, referenceImageIds)
      if (signal?.aborted) throw new Error('GenImage was aborted.')
      const editSource = referenceImages.find((image) => image.source.type === 'generated')
      const reserved = await reserveAgentImageIdsForRuntime(runtime, args.image_id, batchCount)
      try {
        const activeOptions = activeOptionsForModel(modelConfig, defaultOptionsFor(modelConfig))
        const task: AgentImageTask = {
          id: crypto.randomUUID(),
          toolCallId,
          agentTurnId: runtime.currentAgentTurnId ?? crypto.randomUUID(),
          createdAt: Date.now(),
          status: 'pending_approval',
          request: {
            prompt: promptText,
            requestedImageId: reserved.requestedImageId,
            reservedImageIds: reserved.reservedImageIds,
            modelId: modelConfig.id,
            resolution,
            aspectRatio: aspect,
            batchCount,
            referenceImageIds,
            options: activeOptions,
            stackId:
              editSource?.source.type === 'generated'
                ? (editSource.source.stackId ?? editSource.source.batchId)
                : undefined,
            parentImageId: editSource?.source.type === 'generated' ? editSource.id : undefined,
          },
          resultImageIds: [],
          renamedImageIds: reserved.renamed,
        }

        const callbackState = runtime.turnCallbacks.get(task.agentTurnId) ?? {
          agentTurnId: task.agentTurnId,
          taskIds: [],
          callbackQueued: false,
        }
        callbackState.taskIds.push(task.id)
        runtime.turnCallbacks.set(task.agentTurnId, callbackState)

        for (const id of reserved.reservedImageIds) {
          runtime.imageRegistry.set(id, {
            id,
            source: 'generated',
            status: 'reserved',
            createdAt: task.createdAt,
          })
        }
        setRuntimeImageTasks(runtime, (prev) => [task, ...prev])

        const startResult = runtime.autoApproveImageTasks ? await startAgentImageTask(runtime, task) : null
        const status = runtime.autoApproveImageTasks ? (startResult?.ok ? 'queued' : 'failed') : 'pending_approval'
        const message = runtime.autoApproveImageTasks
          ? startResult?.ok
            ? AGENT_TASK_PROTOCOL_MESSAGES.autoStarted
            : AGENT_TASK_PROTOCOL_MESSAGES.failedToStart
          : reserved.renamed
            ? AGENT_TASK_PROTOCOL_MESSAGES.pendingWithReserved(reserved.reservedImageIds)
            : AGENT_TASK_PROTOCOL_MESSAGES.pending
        const payload = {
          status,
          task_id: task.id,
          requested_image_id: reserved.requestedImageId,
          reserved_image_ids: reserved.reservedImageIds,
          renamed: reserved.renamed,
          message,
        }
        return toolTextResult(JSON.stringify(payload, null, 2), payload)
      } finally {
        releasePendingAgentImageIds(reserved.reservedImageIds)
      }
    },
    [
      agentRuntimesRef,
      releasePendingAgentImageIds,
      reserveAgentImageIdsForRuntime,
      resolveAgentReferenceImages,
      setRuntimeImageTasks,
      startAgentImageTask,
    ],
  )

  const runReadImageTool = useCallback(
    async (sessionId: string, _toolCallId: string, args: ReadImageToolArgs): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) throw new Error('Agent session is no longer available.')
      const imageId = args.image_id.trim()
      const missing = '<tool_use_error>Image does not exist.</tool_use_error>'
      if (!imageId) return toolTextResult(missing, { status: 'error', image_id: imageId })

      const result = await resolveAgentImageById(runtime, imageId)
      if (!result) return toolTextResult(missing, { status: 'error', image_id: imageId })
      if (result.status !== 'ready') {
        const payload = {
          image_id: imageId,
          status: 'not_ready',
          source: result.source,
          message: 'Image is not ready.',
        }
        return toolTextResult(JSON.stringify(payload, null, 2), payload)
      }

      const offset = args.offset !== undefined && Number.isFinite(args.offset) ? args.offset : 0
      const limit =
        args.limit !== undefined && Number.isFinite(args.limit) ? args.limit : AGENT_PROMPT_DEFAULT_LINE_LIMIT
      const generated = result.image.source.type === 'generated' ? result.image.source : null
      if (offset > 0) {
        if (!generated) {
          const text = '<tool_use_error>Image prompt is only available for generated images.</tool_use_error>'
          return toolTextResult(text, { status: 'error', image_id: imageId })
        }
        const header = `[prompt] image_id=${imageId} references=${generated.referenceImageIds.join(',')} total_lines=${promptLineCount(generated.prompt)}`
        const text = `${header}\n${formatPromptLines(generated.prompt, offset, limit)}`
        return toolTextResult(text, { status: 'ready', image_id: imageId, mode: 'prompt' })
      }

      const modelForImage = generated ? findModelConfig(generated.modelId) : null
      const promptOutputText = generated
        ? formatPromptLines(generated.prompt, 1, AGENT_PROMPT_DEFAULT_LINE_LIMIT)
        : undefined
      const imageForAgent = await compressImageForAgentInput({
        data: result.image.data,
        mimeType: result.image.mimeType,
      })
      const payload = {
        image_id: imageId,
        status: 'ready',
        source: result.source,
        mime_type: result.image.mimeType,
        generated: generated
          ? {
              model_id: generated.modelId,
              model_name: modelForImage?.name ?? generated.modelId,
              prompt_preview: generated.prompt.slice(0, 100),
              prompt_length: generated.prompt.length,
              prompt_total_lines: promptLineCount(generated.prompt),
              prompt_truncated: promptOutputText?.includes('more lines truncated') ?? false,
              prompt_output_text: promptOutputText,
              reference_image_ids: generated.referenceImageIds,
              resolution: generated.resolution,
              ratio: generated.aspectRatio,
              created_at: result.image.timestamp,
            }
          : undefined,
        message: 'Image is ready.',
      }
      return {
        content: [
          { type: 'text', text: JSON.stringify(payload, null, 2) },
          { type: 'image', data: imageForAgent.data, mimeType: imageForAgent.mimeType },
        ],
        details: payload,
      }
    },
    [agentRuntimesRef, resolveAgentImageById],
  )

  useExternalSync(() => {
    void providerApiKeys.anthropic
    void providerApiKeys.google
    void providerApiKeys.openai
    for (const runtime of agentRuntimesRef.current.values()) maybeDispatchAgentImageCallbacks(runtime)
  }, [
    agentRuntimesRef,
    maybeDispatchAgentImageCallbacks,
    providerApiKeys.anthropic,
    providerApiKeys.google,
    providerApiKeys.openai,
  ])

  useExternalSync(() => {
    for (const runtime of agentRuntimesRef.current.values()) {
      let changed = false
      const next = runtime.imageTasks.map((task) => {
        if (!task.generationJobId || isTerminalAgentImageTaskStatus(task.status)) return task
        const job = generationJobs.find((item) => item.id === task.generationJobId)
        if (!job) return task
        const resultImageIds = job.slots.flatMap((slot) => (slot.image ? [slot.image.id] : []))
        const nextStatus = agentTaskStatusFromGenerationJob(job)
        const nextError = errorFromGenerationJob(job)
        if (isTerminalAgentImageTaskStatus(nextStatus)) dismissGenerationJob(job.id)
        for (const slot of job.slots) {
          if (slot.image) {
            runtime.imageRegistry.set(slot.image.id, {
              id: slot.image.id,
              image: slot.image,
              source: 'generated',
              status: 'ready',
              createdAt: slot.image.timestamp,
            })
          }
        }
        if (
          nextStatus === task.status &&
          nextError === task.error &&
          resultImageIds.length === task.resultImageIds.length &&
          resultImageIds.every((id, index) => id === task.resultImageIds[index])
        ) {
          return task
        }
        changed = true
        const updated = { ...task, status: nextStatus, resultImageIds, error: nextError }
        if (isTerminalAgentImageTaskStatus(nextStatus)) {
          const fulfilledIds = new Set(resultImageIds)
          for (const id of task.request.reservedImageIds) {
            if (!fulfilledIds.has(id)) runtime.imageRegistry.delete(id)
          }
        }
        return updated
      })
      if (!changed) continue
      runtime.imageTasks = next
      if (isCurrentRuntime(runtime)) setAgentImageTasksState(next)
      scheduleRuntimeSidecarPersist(runtime)
      maybeDispatchAgentImageCallbacks(runtime, next)
    }
  }, [
    agentRuntimesRef,
    dismissGenerationJob,
    generationJobs,
    isCurrentRuntime,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
    setAgentImageTasksState,
  ])

  return {
    sendAgentSystemEvent,
    maybeDispatchAgentImageCallbacks,
    runGenImageTool,
    runReadImageTool,
    approveAgentImageTask,
    cancelAgentImageTask,
  }
}
