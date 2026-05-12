import { useCallback, useRef, type RefObject } from 'react'
import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import {
  agentMessageRole,
  agentMessageText,
  compressedAttachmentToAgentAttachment,
  stripSystemDirectives,
  type AgentChatAttachment,
} from './agentChat'
import { activateAgentResponseMetadata, getAgentError } from './messageRecovery'
import { buildCurrentDateDirective, buildLanguageDirective } from './runtimeConfig'
import type {
  AgentPendingQuestion,
  AgentQueuedUserMessage,
  AgentSessionRuntime,
  ProviderCredentials,
} from './runtimeTypes'
import { resolveAgentModelConfig, type AgentModelProvider } from '../config/agentModels'
import { getActiveLanguage, translate } from '../i18n'
import { updateAgentSessionTitleOnly } from './sessionStore'
import type { AgentSessionRecord } from './sessionTypes'
import { buildAvailableSkillsSystemMessage } from './skills/listing'
import { getAgentSkillSummaries } from './skills/registry'
import { parseAgentSlashCommands } from './slashCommands'
import { formatLoadedSkillText } from './tools/skill'
import { stackIdForAgentTurn } from '../lib/stackId'
import { stackTitleForPrompt } from '../lib/stackTitle'
import { isKeyError } from '../lib/validateKey'

const PREVIOUS_USER_MESSAGE_LIMIT = 8

function collectPreviousUserMessages(runtime: AgentSessionRuntime): string[] {
  const result: string[] = []
  for (const message of runtime.agent.state.messages) {
    if (agentMessageRole(message) !== 'user') continue
    const cleaned = stripSystemDirectives(agentMessageText(message))
    if (!cleaned) continue
    result.push(cleaned)
  }
  return result.length > PREVIOUS_USER_MESSAGE_LIMIT
    ? result.slice(result.length - PREVIOUS_USER_MESSAGE_LIMIT)
    : result
}

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

function composerHasContent(draft: string, attachments: AgentChatAttachment[]): boolean {
  return draft.trim() !== '' || attachments.length > 0
}

function buildQueuedPreviewMessage(
  draft: string,
  attachments: AgentChatAttachment[],
  timestamp = Date.now(),
): AgentMessage {
  const promptBody = draft.trim() || translate('agentChat.slash.imageOnlyPrompt')
  return {
    role: 'user',
    content: [
      { type: 'text', text: promptBody },
      ...attachments.map((attachment) => ({
        type: 'image' as const,
        data: attachment.data,
        mimeType: attachment.mimeType,
      })),
    ],
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      type: 'image' as const,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      content: attachment.data,
    })),
    timestamp,
  }
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
  requestSessionTitle,
  patchGenerationJobsForStackTitle,
  upsertAgentSessionSummary,
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
  requestSessionTitle: (params: {
    sessionId: string
    currentUserMessage: string
    previousUserMessages: string[]
    previousTitle?: string
  }) => Promise<string | null>
  patchGenerationJobsForStackTitle: (stackId: string, stackTitle: string) => void
  upsertAgentSessionSummary: (record: AgentSessionRecord) => void
}) {
  const drainQueuedMessagesRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})

  const startAgentTurn = useCallback(
    (
      runtime: AgentSessionRuntime,
      input: {
        draft: string
        attachments: AgentChatAttachment[]
        agentTurnId: string
        stackId: string
        stackTitle: string
        clearComposer: boolean
        onPromptStarted?: () => void
      },
    ): boolean => {
      const trimmed = input.draft.trim()
      if (!trimmed && input.attachments.length === 0) return false

      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) {
        setRuntimeError(
          runtime,
          translate('configLib.agent.modelMissingKey', { model: config.label, provider: config.providerLabel }),
        )
        return false
      }
      if (!config.supportsImages && input.attachments.length > 0) {
        setRuntimeError(runtime, translate('configLib.agent.modelImageUnsupported', { model: config.label }))
        return false
      }

      applyAgentRuntimeConfig(runtime)
      const attachmentsToSend = input.attachments.slice()
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
      const retryDraft = trimmed
      const retryAttachments = attachmentsToSend.slice()
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
      runtime.currentAgentTurnId = input.agentTurnId
      runtime.currentAgentTurnStackId = input.stackId
      runtime.currentAgentTurnStackTitle = input.stackTitle
      runtime.promptPreparing = true
      runtime.isStreaming = true
      activateAgentResponseMetadata(runtime, config.id)
      if (input.clearComposer) {
        runtime.draft = ''
        runtime.attachments = []
        runtime.attachmentError = null
      }
      if (isCurrentRuntime(runtime)) {
        if (input.clearComposer) {
          setAgentDraft('')
          setAgentAttachments([])
          setAgentAttachmentError(null)
        }
        setAgentIsStreaming(true)
      }
      syncRuntimeSnapshot(runtime)
      scheduleRuntimeSidecarPersist(runtime)

      const previousUserMessages = collectPreviousUserMessages(runtime)
      const previousSessionTitle = runtime.lastSessionTitle ?? undefined
      void requestSessionTitle({
        sessionId: runtime.sessionId,
        currentUserMessage: promptBody,
        previousUserMessages,
        previousTitle: previousSessionTitle,
      }).then((title) => {
        if (!title) return
        if (runtime.currentAgentTurnId === input.agentTurnId) runtime.currentAgentTurnStackTitle = title
        patchGenerationJobsForStackTitle(input.stackId, title)
        runtime.lastSessionTitle = title
        scheduleRuntimeSidecarPersist(runtime)
        void updateAgentSessionTitleOnly(runtime.sessionId, title).then((record) => {
          if (record) upsertAgentSessionSummary(record)
        })
      })

      const restoreComposerForRetry = () => {
        if (!composerHasContent(retryDraft, retryAttachments)) return
        if (composerHasContent(runtime.draft, runtime.attachments)) return

        runtime.draft = retryDraft
        runtime.attachments = retryAttachments
        runtime.attachmentError = null
        if (isCurrentRuntime(runtime)) {
          setAgentDraft(retryDraft)
          setAgentAttachments(retryAttachments)
          setAgentAttachmentError(null)
        }
        scheduleRuntimeSidecarPersist(runtime)
      }

      void (async () => {
        try {
          const images = await Promise.all(attachmentsToSend.map(compressedAttachmentToAgentAttachment))
          for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(runtime, question)
          const promptPromise = runtime.agent.prompt(promptText, images)
          input.onPromptStarted?.()
          runtime.promptPreparing = false
          promptPromise
            .then(() => {
              const errorMessage = getAgentError(runtime.agent)
              if (!errorMessage) return
              restoreComposerForRetry()
              if (isKeyError(errorMessage)) invalidateGenerationKey(config.provider)
            })
            .catch((error: unknown) => {
              restoreComposerForRetry()
              setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
            })
            .finally(() => {
              syncRuntimeSnapshot(runtime)
              if (runtime.queuedUserMessages.length > 0) {
                window.setTimeout(() => drainQueuedMessagesRef.current(runtime), 0)
              } else {
                maybeDispatchAgentImageCallbacks(runtime)
              }
            })
        } catch (error) {
          restoreComposerForRetry()
          setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
        } finally {
          runtime.promptPreparing = false
          syncRuntimeSnapshot(runtime)
          if (runtime.queuedUserMessages.length > 0) {
            window.setTimeout(() => drainQueuedMessagesRef.current(runtime), 0)
          } else {
            maybeDispatchAgentImageCallbacks(runtime)
          }
        }
      })()
      return true
    },
    [
      agentCredentialsRef,
      applyAgentRuntimeConfig,
      cancelRuntimeQuestion,
      invalidateGenerationKey,
      isCurrentRuntime,
      maybeDispatchAgentImageCallbacks,
      patchGenerationJobsForStackTitle,
      requestSessionTitle,
      scheduleRuntimeSidecarPersist,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentDraft,
      setAgentIsStreaming,
      setRuntimeError,
      syncRuntimeSnapshot,
      upsertAgentSessionSummary,
    ],
  )

  const drainQueuedMessages = useCallback(
    (runtime: AgentSessionRuntime) => {
      const queued = runtime.queuedUserMessages[0]
      if (!queued) return
      if (!runtime.ready || runtime.isCompacting) return
      if (runtime.promptPreparing) {
        window.setTimeout(() => drainQueuedMessagesRef.current(runtime), 16)
        return
      }
      if (runtime.agent.state.isStreaming) {
        void runtime.agent.waitForIdle().then(() => drainQueuedMessagesRef.current(runtime))
        return
      }
      startAgentTurn(runtime, {
        ...queued,
        clearComposer: false,
        onPromptStarted: () => {
          setRuntimeQueuedUserMessages(runtime, (prev) => prev.filter((item) => item.id !== queued.id))
        },
      })
    },
    [setRuntimeQueuedUserMessages, startAgentTurn],
  )
  drainQueuedMessagesRef.current = drainQueuedMessages

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

    const pendingQuestionsToCancel = runtime.pendingQuestions.slice()
    const hasInFlightResolver = pendingQuestionsToCancel.some((question) =>
      runtime.questionResolvers.has(question.toolCallId),
    )
    const promptBody = trimmed || translate('agentChat.slash.imageOnlyPrompt')
    const agentTurnId = crypto.randomUUID()
    const stackId = stackIdForAgentTurn(runtime.sessionId, agentTurnId)
    const stackTitle = stackTitleForPrompt(promptBody)
    const draft = runtime.draft
    const attachments = runtime.attachments.slice()
    const inFlight = runtime.isStreaming || hasInFlightResolver

    if (inFlight) {
      const queuedMessage: AgentQueuedUserMessage = {
        id: crypto.randomUUID(),
        draft,
        attachments,
        agentTurnId,
        stackId,
        stackTitle,
        message: buildQueuedPreviewMessage(draft, attachments),
      }
      runtime.draft = ''
      runtime.attachments = []
      runtime.attachmentError = null
      setRuntimeQueuedUserMessages(runtime, (prev) => [...prev, queuedMessage])
      for (const question of pendingQuestionsToCancel) cancelRuntimeQuestion(runtime, question)
      if (isCurrentRuntime(runtime)) {
        setAgentDraft('')
        setAgentAttachments([])
        setAgentAttachmentError(null)
      }
      scheduleRuntimeSidecarPersist(runtime)
      syncRuntimeSnapshot(runtime)
      window.setTimeout(() => drainQueuedMessagesRef.current(runtime), 0)
      return true
    }

    return startAgentTurn(runtime, { draft, attachments, agentTurnId, stackId, stackTitle, clearComposer: true })
  }, [
    agentCredentialsRef,
    cancelRuntimeQuestion,
    getCurrentRuntime,
    isCurrentRuntime,
    scheduleRuntimeSidecarPersist,
    setAgentAttachmentError,
    setAgentAttachments,
    setAgentDraft,
    setRuntimeQueuedUserMessages,
    setRuntimeError,
    startAgentTurn,
    syncRuntimeSnapshot,
  ])

  const updateQueuedUserMessage = useCallback(
    (id: string, draft: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      setRuntimeQueuedUserMessages(runtime, (prev) =>
        prev.map((queued) => {
          if (queued.id !== id) return queued
          if (!draft.trim() && queued.attachments.length === 0) return queued
          const promptBody = draft.trim() || translate('agentChat.slash.imageOnlyPrompt')
          return {
            ...queued,
            draft,
            stackTitle: stackTitleForPrompt(promptBody),
            message: buildQueuedPreviewMessage(draft, queued.attachments),
          }
        }),
      )
      scheduleRuntimeSidecarPersist(runtime)
    },
    [getCurrentRuntime, scheduleRuntimeSidecarPersist, setRuntimeQueuedUserMessages],
  )

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

  return { sendAgentMessage, stopAgentMessage, setCurrentAgentDraft, updateQueuedUserMessage }
}
