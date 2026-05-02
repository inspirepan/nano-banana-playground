import { useCallback, useRef, type RefObject } from 'react'

import {
  buildCompactionSummaryMessage,
  compact,
  DEFAULT_COMPACTION_SETTINGS,
  estimateContextTokens,
  shouldCompact,
} from './compaction'
import type { AgentSessionRuntime, ProviderCredentials } from './runtimeTypes'
import { agentModelWithBaseUrl, resolveAgentModelConfig, type AgentModelProvider } from '../config/agentModels'
import { useExternalSync } from '../hooks/effects'

export function useAgentCompaction({
  agentRuntimesRef,
  agentCredentialsRef,
  maybeDispatchAgentImageCallbacksRef,
  persistRuntimeSidecar,
  setRuntimeError,
  syncRuntimeSnapshot,
}: {
  agentRuntimesRef: RefObject<Map<string, AgentSessionRuntime>>
  agentCredentialsRef: RefObject<Record<AgentModelProvider, ProviderCredentials>>
  maybeDispatchAgentImageCallbacksRef: RefObject<(runtime: AgentSessionRuntime) => void>
  persistRuntimeSidecar: (runtime: AgentSessionRuntime) => Promise<void>
  setRuntimeError: (runtime: AgentSessionRuntime, message: string | null) => void
  syncRuntimeSnapshot: (runtime: AgentSessionRuntime) => void
}) {
  const maybeRunRuntimeCompactionRef = useRef<(runtime: AgentSessionRuntime) => void>(() => {})

  const runRuntimeCompaction = useCallback(
    async (runtime: AgentSessionRuntime) => {
      if (runtime.isCompacting || runtime.agent.state.isStreaming) return
      if (!runtime.ready) return
      if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return

      const config = resolveAgentModelConfig(runtime.modelId)
      const credentials = agentCredentialsRef.current[config.provider]
      if (!credentials.apiKey) return

      const model = agentModelWithBaseUrl(config, credentials.baseUrl)
      const contextWindow = model.contextWindow ?? 0
      if (contextWindow <= 0) return

      // Trust assistant usage only when it is newer than the last compaction.
      const minUsageTimestamp = runtime.lastCompaction?.createdAt ?? 0
      const settings = DEFAULT_COMPACTION_SETTINGS
      const preflightMessages = runtime.agent.state.messages
      if (preflightMessages.length === 0) return
      const preflightTokens = estimateContextTokens(preflightMessages, { minUsageTimestamp }).tokens
      if (!shouldCompact(preflightTokens, contextWindow, settings)) return

      runtime.isCompacting = true
      const abortController = new AbortController()
      runtime.compactionAbort = abortController
      syncRuntimeSnapshot(runtime)

      let compactionErrorMessage: string | null = null
      try {
        await runtime.persistQueue.catch(() => undefined)

        if (!runtime.ready) return
        if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return
        if (runtime.agent.state.isStreaming) return

        const messages = runtime.agent.state.messages.slice()
        if (messages.length === 0) return
        const sameAsPreflight =
          messages.length === preflightMessages.length &&
          messages[messages.length - 1] === preflightMessages[preflightMessages.length - 1]
        const contextTokens = sameAsPreflight
          ? preflightTokens
          : estimateContextTokens(messages, { minUsageTimestamp }).tokens
        if (!shouldCompact(contextTokens, contextWindow, settings)) return

        const previousSummary = runtime.lastCompaction?.summary
        const ignoreLeadingCount = previousSummary && messages.length > 0 ? 1 : 0

        const result = await compact({
          messages,
          settings,
          model,
          apiKey: credentials.apiKey,
          previousSummary,
          ignoreLeadingCount,
          tokensBefore: contextTokens,
          signal: abortController.signal,
        })
        if (!result) return
        if (!runtime.ready) return
        if (agentRuntimesRef.current.get(runtime.sessionId) !== runtime) return

        const liveMessages = runtime.agent.state.messages
        const drift = liveMessages.length - messages.length
        if (drift < 0) return
        const liveFirstKeptIndex = Math.min(result.firstKeptIndex, liveMessages.length)
        if (liveFirstKeptIndex <= 0) return

        const firstKeptMessage = liveMessages[liveFirstKeptIndex]
        if (!firstKeptMessage) return
        let firstKeptEntryId: string | undefined
        for (let i = liveFirstKeptIndex; i < liveMessages.length; i++) {
          const candidate = liveMessages[i]
          const id = runtime.messageEntryIds.get(candidate)
          if (id) {
            firstKeptEntryId = id
            break
          }
        }
        if (!firstKeptEntryId) return

        const summaryMessage = buildCompactionSummaryMessage(result.summary)
        const keptMessages = liveMessages.slice(liveFirstKeptIndex)
        const nextMessages = [summaryMessage, ...keptMessages]

        runtime.agent.replaceMessages(nextMessages)
        runtime.lastCompaction = {
          summary: result.summary,
          firstKeptEntryId,
          tokensBefore: result.tokensBefore,
          createdAt: Date.now(),
        }

        syncRuntimeSnapshot(runtime)
        await persistRuntimeSidecar(runtime)
      } catch (error) {
        if (abortController.signal.aborted) return
        compactionErrorMessage = error instanceof Error ? error.message : String(error)
      } finally {
        runtime.isCompacting = false
        runtime.compactionAbort = null
        syncRuntimeSnapshot(runtime)
        if (compactionErrorMessage !== null) setRuntimeError(runtime, compactionErrorMessage)
        if (runtime.ready && agentRuntimesRef.current.get(runtime.sessionId) === runtime) {
          maybeDispatchAgentImageCallbacksRef.current(runtime)
        }
      }
    },
    [
      agentCredentialsRef,
      agentRuntimesRef,
      maybeDispatchAgentImageCallbacksRef,
      persistRuntimeSidecar,
      setRuntimeError,
      syncRuntimeSnapshot,
    ],
  )

  useExternalSync(() => {
    maybeRunRuntimeCompactionRef.current = (runtime) => {
      void runRuntimeCompaction(runtime)
    }
  }, [runRuntimeCompaction])

  return { maybeRunRuntimeCompactionRef }
}
