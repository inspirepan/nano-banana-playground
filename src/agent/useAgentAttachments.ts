import { useCallback } from 'react'

import type { AgentChatAttachment } from './agentChat'
import { AGENT_MAX_ATTACHMENTS, type AgentSessionRuntime } from './runtimeTypes'
import { resolveAgentModelConfig } from '../config/agentModels'
import { getBlobFromCache, putBlobInCache } from '../hooks/useImageSrc'
import { translate } from '../i18n'
import { readFileAsImageData } from '../lib/fileToImage'
import { loadImageBlob } from '../lib/history'
import type { PlaygroundImage, PlaygroundImageMeta } from '../lib/types'

export function useAgentAttachments({
  getCurrentRuntime,
  isCurrentRuntime,
  scheduleRuntimeSidecarPersist,
  setAgentAttachments,
  setAgentAttachmentError,
}: {
  getCurrentRuntime: () => AgentSessionRuntime | null
  isCurrentRuntime: (runtime: AgentSessionRuntime) => boolean
  scheduleRuntimeSidecarPersist: (runtime: AgentSessionRuntime) => void
  setAgentAttachments: (attachments: AgentChatAttachment[]) => void
  setAgentAttachmentError: (message: string | null) => void
}) {
  const addAgentAttachments = useCallback(
    (files: File[]) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const config = resolveAgentModelConfig(runtime.modelId)
      if (!config.supportsImages) {
        const message = translate('configLib.agent.modelImageUnsupported', { model: config.label })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }
      const remaining = AGENT_MAX_ATTACHMENTS - runtime.attachments.length
      if (remaining <= 0) {
        const message = translate('configLib.agent.maxAttachments', { count: AGENT_MAX_ATTACHMENTS })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }

      const toAdd = files.slice(0, remaining)
      void Promise.allSettled(
        toAdd.map((file) =>
          readFileAsImageData(file).then((result) => {
            if (!result) return null
            return {
              id: crypto.randomUUID(),
              data: result.base64,
              mimeType: result.mimeType,
              fileName: result.fileName,
              size: file.size,
            } satisfies AgentChatAttachment
          }),
        ),
      ).then((results) => {
        const attachments: AgentChatAttachment[] = []
        const errors: string[] = []
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            attachments.push(result.value)
          } else if (result.status === 'rejected') {
            errors.push((result.reason as Error).message)
          }
        }
        if (attachments.length > 0) {
          runtime.attachments = [...runtime.attachments, ...attachments].slice(0, AGENT_MAX_ATTACHMENTS)
          runtime.attachmentError = null
          if (isCurrentRuntime(runtime)) {
            setAgentAttachments(runtime.attachments)
            setAgentAttachmentError(null)
          }
          scheduleRuntimeSidecarPersist(runtime)
        }
        if (errors.length > 0) {
          runtime.attachmentError = errors.join('\n')
          if (isCurrentRuntime(runtime)) setAgentAttachmentError(runtime.attachmentError)
        }
      })
    },
    [getCurrentRuntime, isCurrentRuntime, scheduleRuntimeSidecarPersist, setAgentAttachments, setAgentAttachmentError],
  )

  const addAgentImageAttachment = useCallback(
    (image: PlaygroundImage | PlaygroundImageMeta) => {
      const runtime = getCurrentRuntime()
      if (!runtime || runtime.attachments.some((item) => item.id === image.id)) return
      const config = resolveAgentModelConfig(runtime.modelId)
      if (!config.supportsImages) {
        const message = translate('configLib.agent.modelImageUnsupported', { model: config.label })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }
      const remaining = AGENT_MAX_ATTACHMENTS - runtime.attachments.length
      if (remaining <= 0) {
        const message = translate('configLib.agent.maxAttachments', { count: AGENT_MAX_ATTACHMENTS })
        runtime.attachmentError = message
        setAgentAttachmentError(message)
        return
      }

      void (async () => {
        const data = 'data' in image ? image.data : (getBlobFromCache(image.id) ?? (await loadImageBlob(image.id)))
        if (!data) {
          runtime.attachmentError = translate('configLib.agent.readAttachmentFailed')
          if (isCurrentRuntime(runtime)) setAgentAttachmentError(runtime.attachmentError)
          return
        }
        putBlobInCache(image.id, data)
        const fileName = image.source.type === 'upload' ? image.source.fileName : image.id
        const attachment: AgentChatAttachment = {
          id: image.id,
          data,
          mimeType: image.mimeType,
          fileName,
          size: 0,
        }
        runtime.imageRegistry.set(image.id, {
          id: image.id,
          image: { ...image, data },
          source: image.source.type === 'generated' ? 'generated' : 'history',
          status: 'ready',
          createdAt: image.timestamp,
        })
        if (!runtime.attachments.some((item) => item.id === image.id)) {
          runtime.attachments = [...runtime.attachments, attachment]
        }
        runtime.attachmentError = null
        if (isCurrentRuntime(runtime)) {
          setAgentAttachments(runtime.attachments)
          setAgentAttachmentError(null)
        }
        scheduleRuntimeSidecarPersist(runtime)
      })()
    },
    [getCurrentRuntime, isCurrentRuntime, scheduleRuntimeSidecarPersist, setAgentAttachments, setAgentAttachmentError],
  )

  const removeAgentAttachment = useCallback(
    (id: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      runtime.attachments = runtime.attachments.filter((item) => item.id !== id)
      if (isCurrentRuntime(runtime)) setAgentAttachments(runtime.attachments)
      scheduleRuntimeSidecarPersist(runtime)
    },
    [getCurrentRuntime, isCurrentRuntime, scheduleRuntimeSidecarPersist, setAgentAttachments],
  )

  const clearAgentAttachmentError = useCallback(() => {
    const runtime = getCurrentRuntime()
    if (runtime) runtime.attachmentError = null
    setAgentAttachmentError(null)
  }, [getCurrentRuntime, setAgentAttachmentError])

  return {
    addAgentAttachments,
    addAgentImageAttachment,
    removeAgentAttachment,
    clearAgentAttachmentError,
  }
}
