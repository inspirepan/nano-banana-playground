import { type AppMessage as AgentMessage } from '@mariozechner/pi-agent'
import { useCallback, type RefObject } from 'react'

import { toolTextResult } from './messageRecovery'
import { type AgentPendingQuestion, type AgentQuestionResolver, type AgentSessionRuntime } from './runtimeTypes'
import { appendAgentSessionMessage } from './sessionStore'
import type { AgentSessionSummary } from './sessionTypes'
import {
  formatAskUserQuestionResult,
  type AgentToolResult,
  type AskUserQuestionAnswer,
  type AskUserQuestionToolArgs,
} from './tools'

export function useAgentQuestions({
  agentRuntimesRef,
  getCurrentRuntime,
  setRuntimePendingQuestions,
  sendAgentSystemEvent,
  setRuntimeError,
  syncRuntimeSnapshot,
  upsertAgentSessionSummary,
}: {
  agentRuntimesRef: RefObject<Map<string, AgentSessionRuntime>>
  getCurrentRuntime: () => AgentSessionRuntime | null
  setRuntimePendingQuestions: (
    runtime: AgentSessionRuntime,
    updater: (prev: AgentPendingQuestion[]) => AgentPendingQuestion[],
  ) => AgentPendingQuestion[]
  sendAgentSystemEvent: (runtime: AgentSessionRuntime, text: string) => Promise<boolean>
  setRuntimeError: (runtime: AgentSessionRuntime, message: string | null) => void
  syncRuntimeSnapshot: (runtime: AgentSessionRuntime) => void
  upsertAgentSessionSummary: (record: AgentSessionSummary) => void
}) {
  const runAskUserQuestionTool = useCallback(
    (
      sessionId: string,
      toolCallId: string,
      args: AskUserQuestionToolArgs,
      signal?: AbortSignal,
    ): Promise<AgentToolResult> => {
      const runtime = agentRuntimesRef.current.get(sessionId)
      if (!runtime) return Promise.reject(new Error('Agent session is no longer available.'))
      const questions = args.questions
      if (questions.length === 0) {
        return Promise.resolve(
          toolTextResult('<tool_use_error>AskUserQuestion requires at least one question.</tool_use_error>', {
            status: 'error',
          }),
        )
      }

      const pending: AgentPendingQuestion = {
        toolCallId,
        agentTurnId: runtime.currentAgentTurnId ?? toolCallId,
        questions,
        createdAt: Date.now(),
      }
      setRuntimePendingQuestions(runtime, (prev) => [...prev.filter((item) => item.toolCallId !== toolCallId), pending])

      return new Promise<AgentToolResult>((resolve, reject) => {
        const cleanup = () => {
          runtime.questionResolvers.delete(toolCallId)
          setRuntimePendingQuestions(runtime, (prev) => prev.filter((item) => item.toolCallId !== toolCallId))
        }

        const resolver: AgentQuestionResolver = {
          questions,
          resolve: (result) => {
            cleanup()
            resolve(result)
          },
          reject: (reason) => {
            cleanup()
            reject(reason instanceof Error ? reason : new Error(String(reason)))
          },
        }
        runtime.questionResolvers.set(toolCallId, resolver)

        if (signal) {
          if (signal.aborted) {
            resolver.reject(new Error('AskUserQuestion was aborted.'))
            return
          }
          signal.addEventListener(
            'abort',
            () => {
              const stillPending = runtime.questionResolvers.get(toolCallId)
              if (!stillPending) return
              stillPending.resolve(
                toolTextResult(formatAskUserQuestionResult(questions, [], { cancelled: true }), {
                  status: 'cancelled',
                  reason: 'aborted',
                }),
              )
            },
            { once: true },
          )
        }
      })
    },
    [agentRuntimesRef, setRuntimePendingQuestions],
  )

  const finishRestoredAgentQuestion = useCallback(
    (
      runtime: AgentSessionRuntime,
      toolCallId: string,
      answers: AskUserQuestionAnswer[],
      options: { cancelled: boolean },
    ) => {
      const pending = runtime.pendingQuestions.find((item) => item.toolCallId === toolCallId)
      if (!pending) return
      const text = formatAskUserQuestionResult(pending.questions, answers, { cancelled: options.cancelled })
      const toolResultMessage = {
        role: 'toolResult',
        toolCallId,
        toolName: 'AskUserQuestion',
        content: [{ type: 'text', text }],
        isError: false,
        timestamp: Date.now(),
      } as unknown as AgentMessage

      setRuntimePendingQuestions(runtime, (prev) => prev.filter((item) => item.toolCallId !== toolCallId))

      runtime.agent.appendMessage(toolResultMessage)
      syncRuntimeSnapshot(runtime)

      runtime.persistQueue = runtime.persistQueue
        .then(async () => {
          const result = await appendAgentSessionMessage({
            sessionId: runtime.sessionId,
            parentId: runtime.leafEntryId,
            message: toolResultMessage,
          })
          runtime.leafEntryId = result.entryId
          upsertAgentSessionSummary(result.record)
        })
        .catch((error: unknown) => {
          setRuntimeError(runtime, error instanceof Error ? error.message : String(error))
        })

      if (options.cancelled) return
      const eventText = `<system>\ntool AskUserQuestion call ${toolCallId} has been answered.\n</system>`
      void sendAgentSystemEvent(runtime, eventText)
    },
    [sendAgentSystemEvent, setRuntimeError, setRuntimePendingQuestions, syncRuntimeSnapshot, upsertAgentSessionSummary],
  )

  const submitAgentQuestionAnswers = useCallback(
    (toolCallId: string, answers: AskUserQuestionAnswer[]) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const resolver = runtime.questionResolvers.get(toolCallId)
      if (resolver) {
        const text = formatAskUserQuestionResult(resolver.questions, answers)
        resolver.resolve(toolTextResult(text, { status: 'submitted', answers }))
        return
      }
      finishRestoredAgentQuestion(runtime, toolCallId, answers, { cancelled: false })
    },
    [finishRestoredAgentQuestion, getCurrentRuntime],
  )

  const cancelAgentQuestion = useCallback(
    (toolCallId: string) => {
      const runtime = getCurrentRuntime()
      if (!runtime) return
      const resolver = runtime.questionResolvers.get(toolCallId)
      if (resolver) {
        resolver.resolve(
          toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
            status: 'cancelled',
            reason: 'user_dismissed',
          }),
        )
        return
      }
      finishRestoredAgentQuestion(runtime, toolCallId, [], { cancelled: true })
    },
    [finishRestoredAgentQuestion, getCurrentRuntime],
  )

  const cancelRuntimeQuestion = useCallback(
    (runtime: AgentSessionRuntime, question: AgentPendingQuestion) => {
      const resolver = runtime.questionResolvers.get(question.toolCallId)
      if (resolver) {
        resolver.resolve(
          toolTextResult(formatAskUserQuestionResult(resolver.questions, [], { cancelled: true }), {
            status: 'cancelled',
            reason: 'user_dismissed',
          }),
        )
        return
      }
      finishRestoredAgentQuestion(runtime, question.toolCallId, [], { cancelled: true })
    },
    [finishRestoredAgentQuestion],
  )

  return {
    runAskUserQuestionTool,
    submitAgentQuestionAnswers,
    cancelAgentQuestion,
    cancelRuntimeQuestion,
  }
}