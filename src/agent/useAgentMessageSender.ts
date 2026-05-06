import { useCallback, type RefObject } from 'react'

import { compressedAttachmentToAgentAttachment, type AgentChatAttachment } from './agentChat'
import { activateAgentResponseMetadata, getAgentError, queueAgentResponseMetadata } from './messageRecovery'
import { buildCurrentDateDirective, buildLanguageDirective } from './runtimeConfig'
import type {
  AgentPendingQuestion,
  AgentQueuedUserMessage,
  AgentSessionRuntime,
  ProviderCredentials,
} from './runtimeTypes'
import { resolveAgentModelConfig, type AgentModelProvider } from '../config/agentModels'
import { getActiveLanguage, translate } from '../i18n'
import { buildAvailableSkillsSystemMessage } from './skills/listing'
import { getAgentSkillSummaries } from './skills/registry'
import { parseAgentSlashCommands } from './slashCommands'
import { formatLoadedSkillText } from './tools/skill'
import { isKeyError } from '../lib/validateKey'

function textFromLoadedSkill(skillName: string): string | null {
  const result = formatLoadedSkillText(skillName)
  const details = typeof result.details === 'object' && result.details !== null ? result.details : {}
  if ((details as { status?: unknown }).status !== 'loaded') return null
  return result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim()
}

function buildInvokedSkillSystemMessage(skillName: string, skillText: string): string {
  return [
    '<system>',
    `The user explicitly invoked the /${skillName} slash command for this turn.`,
    `The ${skillName} skill has already been loaded below. Follow these instructions directly and do not call the Skill tool for ${skillName} again unless the user asks to inspect or reload it.`,
    '',
    skillText,
    '</system>',
  ].join('\n')
}

function buildAttachmentSystemNote(attachments: AgentChatAttachment[]): string {
  if (attachments.length === 0) return ''
  const lines = attachments.map((attachment) => {
    const details = [
      attachment.resolution ? `resolution=${attachment.resolution}` : null,
      attachment.aspectRatio ? `ratio=${attachment.aspectRatio}` : null,
    ].filter((detail): detail is string => detail !== null)
    return details.length > 0 ? `- ${attachment.id} (${details.join(', ')})` : `- ${attachment.id}`
  })
  return `\n\n<system>Available attachment images:\n${lines.join('\n')}</system>`
}

export function useAgentMessageSender({
  agentCredentialsRef,
  getCurrentRuntime,
  isCurrentRuntime,
  applyAgentRuntimeConfig,
  cancelRuntimeQuestion,
  maybeDispatchAgentImageCallbacks,
  scheduleRuntimeSidecarPersist,
  setRuntimeQueuedUserMessages,
  setRuntimeError,
  syncRuntimeSnapshot,
  invalidateGenerationKey,
  setAgentDraft,
  setAgentAttachments,
  setAgentAttachmentError,
  setAgentIsStreaming,
}: {
  agentCredentialsRef: RefObject<Record<AgentModelProvider, ProviderCredentials>>
  getCurrentRuntime: () => AgentSessionRuntime | null
  isCurrentRuntime: (runtime: AgentSessionRuntime) => boolean
  applyAgentRuntimeConfig: (runtime: AgentSessionRuntime) => void
  cancelRuntimeQuestion: (runtime: AgentSessionRuntime, question: AgentPendingQuestion) => void
  maybeDispatchAgentImageCallbacks: (runtime: AgentSessionRuntime) => void
  scheduleRuntimeSidecarPersist: (runtime: AgentSessionRuntime) => void
  setRuntimeQueuedUserMessages: (
    runtime: AgentSessionRuntime,
    updater: (prev: AgentQueuedUserMessage[]) => AgentQueuedUserMessage[],
  ) => AgentQueuedUserMessage[]
  setRuntimeError: (runtime: AgentSessionRuntime, message: string | null) => void
  syncRuntimeSnapshot: (runtime: AgentSessionRuntime) => void
  invalidateGenerationKey: (provider: AgentModelProvider) => void
  setAgentDraft: (draft: string) => void
  setAgentAttachments: (attachments: AgentChatAttachment[]) => void
  setAgentAttachmentError: (message: string | null) => void
  setAgentIsStreaming: (isStreaming: boolean) => void
}) {
  const sendAgentMessage = useCallback(() => {
    const runtime = getCurrentRuntime()
    const trimmed = runtime?.draft.trim() ?? ''
    if (!runtime || runtime.promptPreparing || runtime.isCompacting) return false
    if (!trimmed && runtime.attachments.length === 0) return false

    const config = resolveAgentModelConfig(runtime.modelId)
    const credentials = agentCredentialsRef.current[config.provider]
    if (!credentials.apiKey) {
      setRuntimeError(
        runtime,
        translate('configLib.agent.modelMissingKey', { model: config.label, provider: config.providerLabel }),
      )
      return false
    }
    if (!config.supportsImages && runtime.attachments.length > 0) {
      setRuntimeError(runtime, translate('configLib.agent.modelImageUnsupported', { model: config.label }))
      return false
    }

    applyAgentRuntimeConfig(runtime)
    const attachmentsToSend = runtime.attachments
    const attachmentNote = buildAttachmentSystemNote(attachmentsToSend)
    const isFirstUserMessage = runtime.agent.state.messages.length === 0
    const skillSummaries = getAgentSkillSummaries()
    const enabledSkillNames = new Set(skillSummaries.filter((skill) => skill.enabled).map((skill) => skill.name))
    const slashCommands = parseAgentSlashCommands(trimmed, enabledSkillNames, { includeNewCommand: false })
    let systemPrefix = ''
    if (isFirstUserMessage) {
      const activeLanguage = getActiveLanguage()
      systemPrefix += `${buildLanguageDirective(activeLanguage)}\n\n`
      const imageIdLanguageInstruction =
        activeLanguage === 'en'
          ? 'When calling GenImage, write image_id values in English so they match the user language.'
          : 'When calling GenImage, write image_id values in 简体中文 so they read naturally to the user.'
      systemPrefix += `<system>${imageIdLanguageInstruction}</system>\n\n`
      systemPrefix += `${buildCurrentDateDirective()}\n\n`
    }
    if (isFirstUserMessage) {
      const skillListing = buildAvailableSkillsSystemMessage(skillSummaries)
      if (skillListing) systemPrefix += `${skillListing}\n\n`
    }
    for (const skillName of slashCommands.skillNames) {
      const skillText = textFromLoadedSkill(skillName)
      if (skillText) systemPrefix += `${buildInvokedSkillSystemMessage(skillName, skillText)}\n\n`
    }
    const promptBody = trimmed || translate('agentChat.slash.imageOnlyPrompt')
    const promptText = `${systemPrefix}${promptBody}${attachmentNote}`
    for (const attachment of attachmentsToSend) {
      if (runtime.imageRegistry.get(attachment.id)?.status === 'ready') continue
      runtime.imageRegistry.set(attachment.id, {
        id: attachment.id,
        image: attachment,
        source: 'agent_attachment',
        status: 'ready',
        createdAt: Date.now(),
      })
    }

    const pendingQuestionsToCancel = runtime.pendingQuestions.slice()
    const hasInFlightResolver = pendingQuestionsToCancel.some((question) =>
      runtime.questionResolvers.has(question.toolCallId),
    )
    const inFlight = runtime.isStreaming || hasInFlightResolver

    runtime.draft = ''
    runtime.attachments = []
    runtime.attachmentError = null
    runtime.promptPreparing = true
    if (!inFlight) {
      runtime.currentAgentTurnId = crypto.randomUUID()
      activateAgentResponseMetadata(runtime, config.id)
      runtime.isStreaming = true
    }
    if (isCurrentRuntime(runtime)) {
      setAgentDraft('')
      setAgentAttachments([])
      setAgentAttachmentError(null)
      setAgentIsStreaming(runtime.isStreaming)
    }
    syncRuntimeSnapshot(runtime)
    scheduleRuntimeSidecarPersist(runtime)

    const queuedMessageId = inFlight ? crypto.randomUUID() : null
    const queuedMessage =
      inFlight && queuedMessageId
        ? {
            id: queuedMessageId,
            message: {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: promptText },
                ...attachmentsToSend.map((attachment) => ({
                  type: 'image' as const,
                  data: attachment.data,
                  mimeType: attachment.mimeType,
                })),
              ],
              attachments: attachmentsToSend.map((attachment) => ({
                id: attachment.id,
                type: 'image' as const,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                size: attachment.size,
                content: attachment.data,
              })),
              timestamp: Date.now(),
            },
          }
        : null
    if (queuedMessage) setRuntimeQueuedUserMessages(runtime, (prev) => [...prev, queuedMessage])

    void (async () => {
      try {
        const images = await Promise.all(attachmentsToSend.map(compressedAttachmentToAgentAttachment))
        if (inFlight) {
          const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [
            { type: 'text', text: promptText },
          ]
          for (const image of images) {
            if (image.type === 'image') content.push({ type: 'image', data: image.content, mimeType: image.mimeType })
          }
          queueAgentResponseMetadata(runtime, config.id)
          await runtime.agent.queueMessage({
            role: 'user',
            content,
            attachments: images.length > 0 ? images : undefined,
            timestamp: queuedMessage ? queuedMessage.message.timestamp : Date.now(),
          })
          for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(runtime, question)
          return
        }

        for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(runtime, question)
        activateAgentResponseMetadata(runtime, config.id)
        const promptPromise = runtime.agent.prompt(promptText, images)
        runtime.promptPreparing = false
        promptPromise
          .then(() => {
            const errorMessage = getAgentError(runtime.agent)
            if (errorMessage && isKeyError(errorMessage)) invalidateGenerationKey(config.provider)
          })
          .catch((error: unknown) => {
            setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
          })
          .finally(() => {
            syncRuntimeSnapshot(runtime)
            maybeDispatchAgentImageCallbacks(runtime)
          })
      } catch (error) {
        if (queuedMessageId) {
          setRuntimeQueuedUserMessages(runtime, (prev) => prev.filter((queued) => queued.id !== queuedMessageId))
        }
        setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
      } finally {
        runtime.promptPreparing = false
        syncRuntimeSnapshot(runtime)
        maybeDispatchAgentImageCallbacks(runtime)
      }
    })()
    return true
  }, [
    agentCredentialsRef,
    applyAgentRuntimeConfig,
    cancelRuntimeQuestion,
    getCurrentRuntime,
    invalidateGenerationKey,
    isCurrentRuntime,
    maybeDispatchAgentImageCallbacks,
    scheduleRuntimeSidecarPersist,
    setAgentAttachmentError,
    setAgentAttachments,
    setAgentDraft,
    setAgentIsStreaming,
    setRuntimeQueuedUserMessages,
    setRuntimeError,
    syncRuntimeSnapshot,
  ])

  const stopAgentMessage = useCallback(() => {
    getCurrentRuntime()?.agent.abort()
  }, [getCurrentRuntime])

  const setCurrentAgentDraft = useCallback(
    (value: string) => {
      const runtime = getCurrentRuntime()
      if (runtime) {
        runtime.draft = value
        scheduleRuntimeSidecarPersist(runtime)
      }
      setAgentDraft(value)
    },
    [getCurrentRuntime, scheduleRuntimeSidecarPersist, setAgentDraft],
  )

  return { sendAgentMessage, stopAgentMessage, setCurrentAgentDraft }
}
