import { Agentation } from 'agentation'
import { useState, useLayoutEffect, useRef, useCallback, useMemo } from 'react'

import type { AgentImageTask } from './agent'
import {
  BASE_TITLE,
  DESKTOP_AGENT_CHAT_MIN_WIDTH_PX,
  DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX,
  DESKTOP_AGENT_PANEL_WIDE_RATIO,
  DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX,
  DESKTOP_AGENT_SIDE_SPACE_MAX_PX,
  DESKTOP_AGENT_SIDE_SPACE_MIN_PX,
  DESKTOP_INPUT_PANEL_WIDTH,
  DESKTOP_INPUT_PANEL_WIDTH_PX,
  TITLE_RESET_DELAY_MS,
  applyColorThemePreference,
  applyLanguagePreference,
  applySansFontPreference,
  getInitialAgentPanelWide,
  getInitialAgentWideTipDismissed,
  getInitialColorTheme,
  getInitialLanguagePreference,
  getInitialSansFont,
  getInitialTheme,
  syncThemePreference,
  type SansFontId,
  type LanguagePreference,
} from './App/initThemePrefs'
import { Topbar, type MobileTab } from './App/Topbar'
import { Icon } from './components/Icon'
import { ImageDetailModal } from './components/image-detail/ImageDetailModal'
import { InputPanel } from './components/InputPanel'
import { OutputPanel } from './components/OutputPanel'
import { SettingsDialog } from './components/SettingsDialog'
import { resolveLanguagePreference } from './config/languages'
import type { ColorThemeId, Theme } from './config/theme'
import { useExternalSync, useMountEffect, useWindowEvent } from './hooks/effects'
import { usePlayground } from './hooks/usePlayground'
import { createTranslator, I18nProvider } from './i18n'
import { buildImageStacks } from './lib/stacks'
import type { PlaygroundImageMeta } from './lib/types'

type SettingsTarget = 'generationConcurrency'
type AgentPanelWideLayout = { fits: boolean; panelWidth: number; sideSpace: number }
type MobileDetailNavTarget = { stackId: string; itemId: string }
type MobileDetailState = { stackId: string; itemId?: string }

const DESKTOP_LAYOUT_MIN_WIDTH_PX = 768

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolveAgentPanelWideLayout(viewportWidth: number): AgentPanelWideLayout {
  const maxPanelWidth = viewportWidth - DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX
  const preferredPanelWidth = viewportWidth * DESKTOP_AGENT_PANEL_WIDE_RATIO
  const panelWidth = Math.max(DESKTOP_INPUT_PANEL_WIDTH_PX, Math.min(preferredPanelWidth, maxPanelWidth))
  const availableSideSpace = (panelWidth - DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX - DESKTOP_AGENT_CHAT_MIN_WIDTH_PX) / 2
  const sideSpace = clampNumber(availableSideSpace, DESKTOP_AGENT_SIDE_SPACE_MIN_PX, DESKTOP_AGENT_SIDE_SPACE_MAX_PX)

  return {
    fits: viewportWidth >= DESKTOP_LAYOUT_MIN_WIDTH_PX && availableSideSpace >= DESKTOP_AGENT_SIDE_SPACE_MIN_PX,
    panelWidth,
    sideSpace,
  }
}

function App() {
  const pg = usePlayground()
  const { addToReferences, restoreGeneratedImageParams, rerollGeneratedImage, retryGenerationSlot } = pg
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [colorTheme, setColorTheme] = useState<ColorThemeId>(getInitialColorTheme)
  const [sansFont, setSansFont] = useState<SansFontId>(getInitialSansFont)
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(getInitialLanguagePreference)
  const [browserLanguages, setBrowserLanguages] = useState<readonly string[]>(() => navigator.languages)
  const [regenToast, setRegenToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => (pg.inputMode === 'agent' ? 'agent' : 'generate'))
  const [agentPanelWide, setAgentPanelWide] = useState(getInitialAgentPanelWide)
  const [agentWideTipDismissed, setAgentWideTipDismissed] = useState(getInitialAgentWideTipDismissed)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))
  const [highlightStackId, setHighlightStackId] = useState<string | null>(null)
  const [mobileDetailState, setMobileDetailState] = useState<MobileDetailState | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const regenToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleResetTimerRef = useRef<number | null>(null)
  const prevActiveQueueRef = useRef(0)
  const mobilePanelScrollRef = useRef<HTMLDivElement>(null)
  const queueSummary = pg.generationQueueSummary
  const queueActive = queueSummary.queued + queueSummary.running + queueSummary.retrying
  const queueDone = queueSummary.succeeded + queueSummary.failed + queueSummary.canceled
  const language = resolveLanguagePreference(languagePreference, browserLanguages)
  const t = useMemo(() => createTranslator(language), [language])
  const agentWideLayout = useMemo(() => resolveAgentPanelWideLayout(viewportWidth), [viewportWidth])
  const agentPanelSidebarFits = agentWideLayout.fits
  const useWideAgentPanel = pg.inputMode === 'agent' && agentPanelWide && agentPanelSidebarFits
  const desktopInputPanelWidth = useWideAgentPanel
    ? `${Math.round(agentWideLayout.panelWidth)}px`
    : DESKTOP_INPUT_PANEL_WIDTH
  const agentPanelSideSpace = `${Math.round(agentWideLayout.sideSpace)}px`

  const allStacks = useMemo(() => buildImageStacks(pg.history, pg.generationJobs), [pg.history, pg.generationJobs])
  const mobileDetailStack = mobileDetailState
    ? (allStacks.find((stack) => stack.id === mobileDetailState.stackId) ?? null)
    : null
  const mobileStackIndex = mobileDetailStack ? allStacks.findIndex((stack) => stack.id === mobileDetailStack.id) : -1
  const mobilePrevStackTarget: MobileDetailNavTarget | null =
    mobileStackIndex > 0
      ? (() => {
          const prev = allStacks[mobileStackIndex - 1]
          const item = prev?.items[prev.items.length - 1]
          return item ? { stackId: prev.id, itemId: item.id } : null
        })()
      : null
  const mobileNextStackTarget: MobileDetailNavTarget | null =
    mobileStackIndex >= 0 && mobileStackIndex < allStacks.length - 1
      ? (() => {
          const next = allStacks[mobileStackIndex + 1]
          const item = next?.items[0]
          return item ? { stackId: next.id, itemId: item.id } : null
        })()
      : null

  const handleMobileNavigateToStackItem = useCallback(
    (target: MobileDetailNavTarget) => {
      if (!allStacks.some((stack) => stack.id === target.stackId)) return
      setMobileDetailState({ stackId: target.stackId, itemId: target.itemId })
    },
    [allStacks],
  )

  useWindowEvent('resize', () => setViewportWidth(window.innerWidth))

  const dismissAgentWideTip = useCallback(() => {
    setAgentWideTipDismissed(true)
    try {
      localStorage.setItem('nano-banana-agent-panel-wide-tip', '1')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleAgentPanelWide = useCallback(() => {
    setAgentPanelWide((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nano-banana-agent-panel-wide', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
    dismissAgentWideTip()
  }, [dismissAgentWideTip])

  const showAgentWideTip =
    pg.inputMode === 'agent' && agentPanelSidebarFits && !agentPanelWide && !agentWideTipDismissed

  const handleAddToRef = useCallback(
    (image: PlaygroundImageMeta) => {
      void addToReferences(image)
    },
    [addToReferences],
  )

  const handleRegenerate = useCallback(
    async (image: PlaygroundImageMeta) => {
      const result = await restoreGeneratedImageParams(image)
      if (result === null) return
      const message = result.restoredModel
        ? result.refCount > 0
          ? t('app.toast.restoredPromptParamsRefs', { count: result.refCount })
          : t('app.toast.restoredPromptParams')
        : result.refCount > 0
          ? t('app.toast.restoredUnavailableModelPromptRefs', { count: result.refCount })
          : t('app.toast.restoredUnavailableModelPrompt')
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
    },
    [restoreGeneratedImageParams, t],
  )

  const handleReroll = useCallback(
    async (image: PlaygroundImageMeta) => {
      const result = await rerollGeneratedImage(image).catch(() => ({ status: 'unavailable' as const }))
      const message =
        result.status === 'queued'
          ? t('app.toast.rerollQueued')
          : result.status === 'unsupported-mask'
            ? t('app.toast.rerollUnsupportedMask')
            : t('app.toast.rerollFailed')
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
      return { ok: result.status === 'queued', message }
    },
    [rerollGeneratedImage, t],
  )

  const handleRetryGenerationSlot = useCallback(
    (jobId: string, slotId: string) => {
      const result = retryGenerationSlot(jobId, slotId)
      const message = result.status === 'queued' ? t('app.toast.retryQueued') : t('app.toast.retryFailed')
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
      return { ok: result.status === 'queued', message }
    },
    [retryGenerationSlot, t],
  )

  const openSettings = useCallback((target: SettingsTarget | null = null) => {
    setSettingsTarget(target)
    setSettingsOpen(true)
  }, [])

  const switchInputMode = useCallback(
    (mode: 'generate' | 'agent') => {
      pg.setInputMode(mode)
      setMobileTab(mode)
    },
    [pg],
  )

  const switchMobileTab = useCallback(
    (tab: MobileTab) => {
      setMobileTab(tab)
      if (tab === 'generate' || tab === 'agent') pg.setInputMode(tab)
    },
    [pg],
  )

  const handleFocusAgentImageTask = useCallback(
    (task: AgentImageTask) => {
      let stackId = task.request.stackId
      if (!stackId && task.generationJobId) {
        const job = pg.generationJobs.find((item) => item.id === task.generationJobId)
        stackId = job?.stackId ?? undefined
      }
      if (!stackId) return
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        const stack = allStacks.find((s) => s.id === stackId)
        if (!stack) return
        const newestImage = [...stack.images].sort((a, b) => b.timestamp - a.timestamp)[0]
        const fallbackItem = stack.items[stack.items.length - 1]
        setMobileDetailState({
          stackId: stack.id,
          itemId: newestImage?.id ?? fallbackItem?.id,
        })
      } else {
        setHighlightStackId(stackId)
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightStackId((prev) => (prev === stackId ? null : prev))
          highlightTimerRef.current = null
        }, 1800)
      }
    },
    [allStacks, pg.generationJobs],
  )

  const handleCloseMobileDetail = useCallback(() => {
    setMobileDetailState(null)
  }, [])

  useLayoutEffect(() => {
    applyColorThemePreference(colorTheme)
  }, [colorTheme])

  useLayoutEffect(() => {
    applySansFontPreference(sansFont, settingsOpen)
  }, [sansFont, settingsOpen])

  useLayoutEffect(() => {
    applyLanguagePreference(languagePreference, language)
  }, [language, languagePreference])

  useExternalSync(() => {
    const updateBrowserLanguages = () => setBrowserLanguages(navigator.languages)
    window.addEventListener('languagechange', updateBrowserLanguages)
    return () => window.removeEventListener('languagechange', updateBrowserLanguages)
  }, [])

  useLayoutEffect(() => {
    mobilePanelScrollRef.current?.scrollTo({ top: 0 })
  }, [mobileTab])

  useExternalSync(() => {
    return syncThemePreference(theme)
  }, [theme])

  useExternalSync(() => {
    const clearTitleResetTimer = () => {
      if (!titleResetTimerRef.current) return
      window.clearTimeout(titleResetTimerRef.current)
      titleResetTimerRef.current = null
    }

    if (queueActive > 0) {
      clearTitleResetTimer()
      document.title =
        queueSummary.total > 0
          ? t('app.title.generatingProgress', { done: queueDone, total: queueSummary.total, app: BASE_TITLE })
          : t('app.title.generating', { app: BASE_TITLE })
    } else if (prevActiveQueueRef.current > 0) {
      clearTitleResetTimer()
      if (queueSummary.failed > 0 && queueSummary.succeeded === 0) {
        document.title = t('app.title.failed', { app: BASE_TITLE })
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else if (queueSummary.total > 0 && queueDone === queueSummary.total) {
        document.title = t('app.title.completed', { app: BASE_TITLE })
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else {
        document.title = BASE_TITLE
      }
    } else {
      clearTitleResetTimer()
      document.title = BASE_TITLE
    }

    prevActiveQueueRef.current = queueActive
  }, [queueActive, queueDone, queueSummary.failed, queueSummary.succeeded, queueSummary.total, t])

  useMountEffect(() => {
    return () => {
      if (titleResetTimerRef.current) window.clearTimeout(titleResetTimerRef.current)
      document.title = BASE_TITLE
    }
  })

  const handleGenerate = () => {
    pg.generate()
    if (window.innerWidth < 768) {
      setMobileTab('gallery')
    }
  }

  return (
    <I18nProvider preference={languagePreference} browserLanguages={browserLanguages}>
      {/* Mobile layout */}
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-(--color-bg) md:hidden">
        <Topbar mobileTab={mobileTab} onMobileTabChange={switchMobileTab} onOpenSettings={() => openSettings()} />

        <div ref={mobilePanelScrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {mobileTab !== 'gallery' ? (
            <div
              className={`h-full ${mobileTab === 'agent' ? 'px-0' : 'px-3'}`}
              style={{ ['--agent-panel-padding-x' as string]: mobileTab === 'agent' ? '10px' : undefined }}
            >
              <InputPanel
                inputMode={mobileTab === 'agent' ? 'agent' : 'generate'}
                model={pg.model}
                resolution={pg.resolution}
                aspectRatio={pg.aspectRatio}
                batchCount={pg.batchCount}
                options={pg.options}
                prompt={pg.prompt}
                agentModels={pg.agentModels}
                agentModel={pg.agentModel}
                agentThinkingLevel={pg.agentThinkingLevel}
                agentMessages={pg.agentMessages}
                agentMessageMetadata={pg.agentMessageMetadata}
                agentStreamingMessage={pg.agentStreamingMessage}
                agentQueuedMessages={pg.agentQueuedMessages}
                agentIsStreaming={pg.agentIsStreaming}
                agentError={pg.agentError}
                agentDraft={pg.agentDraft}
                agentAttachments={pg.agentAttachments}
                agentAttachmentError={pg.agentAttachmentError}
                agentSessions={pg.agentSessions}
                currentAgentSessionId={pg.currentAgentSessionId}
                agentSessionsLoading={pg.agentSessionsLoading}
                autoApproveAgentImageTasks={pg.autoApproveAgentImageTasks}
                agentImageTasks={pg.agentImageTasks}
                agentPendingQuestions={pg.agentPendingQuestions}
                agentSkills={pg.agentSkills}
                history={pg.history}
                generationJobs={pg.generationJobs}
                referenceImages={pg.referenceImages}
                referenceImageError={pg.referenceImageError}
                apiKey={pg.apiKey}
                apiKeyStatus={pg.apiKeyStatus}
                keyStatuses={pg.keyStatuses}
                showHeader={false}
                onOpenApiKeys={() => openSettings()}
                onInputModeChange={switchInputMode}
                onSwitchModel={pg.switchModel}
                onResolutionChange={pg.setResolution}
                onAspectRatioChange={pg.setAspectRatio}
                onPromptChange={pg.setPrompt}
                onAgentModelChange={pg.setAgentModelId}
                onAgentThinkingLevelChange={pg.setAgentThinkingLevel}
                onAgentDraftChange={pg.setAgentDraft}
                onAddAgentAttachments={pg.addAgentAttachments}
                onAddAgentImageAttachment={pg.addAgentImageAttachment}
                onRemoveAgentAttachment={pg.removeAgentAttachment}
                onClearAgentAttachmentError={pg.clearAgentAttachmentError}
                onCreateAgentSession={pg.createAgentSession}
                onSwitchAgentSession={pg.switchAgentSession}
                onDeleteAgentSession={pg.deleteAgentSession}
                onToggleAutoApproveAgentImageTasks={pg.setAutoApproveAgentImageTasks}
                onApproveAgentImageTask={pg.approveAgentImageTask}
                onCancelAgentImageTask={pg.cancelAgentImageTask}
                onSubmitAgentQuestionAnswers={pg.submitAgentQuestionAnswers}
                onCancelAgentQuestion={pg.cancelAgentQuestion}
                onFocusAgentImageTask={handleFocusAgentImageTask}
                onSendAgentMessage={pg.sendAgentMessage}
                onStopAgentMessage={pg.stopAgentMessage}
                onBatchCountChange={pg.setBatchCount}
                onOptionChange={pg.setOption}
                onAddReferenceImages={pg.addReferenceImages}
                onAddReferenceImage={pg.addToReferences}
                onRemoveReferenceImage={pg.removeReferenceImage}
                onClearAllReferences={pg.clearAllReferences}
                onClearReferenceImageError={pg.clearReferenceImageError}
                onGenerate={handleGenerate}
              />
            </div>
          ) : (
            <div className="px-3 py-[18px]">
              <OutputPanel
                history={pg.history}
                historyHasMore={pg.historyHasMore}
                generationJobs={pg.generationJobs}
                onCancelGenerationJob={pg.cancelGenerationJob}
                onDismissGenerationJob={pg.dismissGenerationJob}
                onCancelGenerationSlot={pg.cancelGenerationSlot}
                onRetryGenerationSlot={handleRetryGenerationSlot}
                onAddToRef={handleAddToRef}
                onRegenerate={handleRegenerate}
                onReroll={handleReroll}
                onEditImage={pg.editImage}
                onRemove={pg.removeFromHistory}
                onLoadMore={pg.loadMoreHistory}
                highlightStackId={highlightStackId}
                onOpenGenerationSettings={() => openSettings('generationConcurrency')}
              />
            </div>
          )}
        </div>

        {mobileDetailState && mobileDetailStack && (
          <ImageDetailModal
            stack={mobileDetailStack}
            initialItemId={mobileDetailState.itemId}
            history={pg.history}
            generationJobs={pg.generationJobs}
            previousStackTarget={mobilePrevStackTarget}
            nextStackTarget={mobileNextStackTarget}
            onNavigateToStackItem={handleMobileNavigateToStackItem}
            onClose={handleCloseMobileDetail}
            onAddToRef={handleAddToRef}
            onRegenerate={handleRegenerate}
            onReroll={handleReroll}
            onEditImage={pg.editImage}
            onCancelGenerationJob={pg.cancelGenerationJob}
            onDismissGenerationJob={pg.dismissGenerationJob}
            onCancelGenerationSlot={pg.cancelGenerationSlot}
            onRetryGenerationSlot={handleRetryGenerationSlot}
            onRemove={pg.removeFromHistory}
          />
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-(--color-bg)">
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          {/* Left input panel */}
          <div
            className="shrink-0 flex flex-col overflow-y-auto [scrollbar-gutter:stable] bg-(--color-bg) shadow-[inset_-1px_0_0_var(--ring-edge-soft)] transition-[width] duration-[280ms] ease-[cubic-bezier(0.22,0.8,0.4,1)] motion-reduce:transition-none"
            style={{
              width: desktopInputPanelWidth,
              ['--agent-panel-wide-side-space' as string]: useWideAgentPanel ? agentPanelSideSpace : undefined,
            }}
          >
            <InputPanel
              inputMode={pg.inputMode}
              model={pg.model}
              resolution={pg.resolution}
              aspectRatio={pg.aspectRatio}
              batchCount={pg.batchCount}
              options={pg.options}
              prompt={pg.prompt}
              agentModels={pg.agentModels}
              agentModel={pg.agentModel}
              agentThinkingLevel={pg.agentThinkingLevel}
              agentMessages={pg.agentMessages}
              agentMessageMetadata={pg.agentMessageMetadata}
              agentStreamingMessage={pg.agentStreamingMessage}
              agentQueuedMessages={pg.agentQueuedMessages}
              agentIsStreaming={pg.agentIsStreaming}
              agentError={pg.agentError}
              agentDraft={pg.agentDraft}
              agentAttachments={pg.agentAttachments}
              agentAttachmentError={pg.agentAttachmentError}
              agentSessions={pg.agentSessions}
              currentAgentSessionId={pg.currentAgentSessionId}
              agentSessionsLoading={pg.agentSessionsLoading}
              autoApproveAgentImageTasks={pg.autoApproveAgentImageTasks}
              agentImageTasks={pg.agentImageTasks}
              agentPendingQuestions={pg.agentPendingQuestions}
              agentSkills={pg.agentSkills}
              history={pg.history}
              generationJobs={pg.generationJobs}
              referenceImages={pg.referenceImages}
              referenceImageError={pg.referenceImageError}
              apiKey={pg.apiKey}
              apiKeyStatus={pg.apiKeyStatus}
              keyStatuses={pg.keyStatuses}
              showAgentSessionSidebar={useWideAgentPanel}
              onOpenApiKeys={() => openSettings()}
              onInputModeChange={switchInputMode}
              onSwitchModel={pg.switchModel}
              onResolutionChange={pg.setResolution}
              onAspectRatioChange={pg.setAspectRatio}
              onPromptChange={pg.setPrompt}
              onAgentModelChange={pg.setAgentModelId}
              onAgentThinkingLevelChange={pg.setAgentThinkingLevel}
              onAgentDraftChange={pg.setAgentDraft}
              onAddAgentAttachments={pg.addAgentAttachments}
              onAddAgentImageAttachment={pg.addAgentImageAttachment}
              onRemoveAgentAttachment={pg.removeAgentAttachment}
              onClearAgentAttachmentError={pg.clearAgentAttachmentError}
              onCreateAgentSession={pg.createAgentSession}
              onSwitchAgentSession={pg.switchAgentSession}
              onDeleteAgentSession={pg.deleteAgentSession}
              onToggleAutoApproveAgentImageTasks={pg.setAutoApproveAgentImageTasks}
              onApproveAgentImageTask={pg.approveAgentImageTask}
              onCancelAgentImageTask={pg.cancelAgentImageTask}
              onSubmitAgentQuestionAnswers={pg.submitAgentQuestionAnswers}
              onCancelAgentQuestion={pg.cancelAgentQuestion}
              onFocusAgentImageTask={handleFocusAgentImageTask}
              onSendAgentMessage={pg.sendAgentMessage}
              onStopAgentMessage={pg.stopAgentMessage}
              onBatchCountChange={pg.setBatchCount}
              onOptionChange={pg.setOption}
              onAddReferenceImages={pg.addReferenceImages}
              onAddReferenceImage={pg.addToReferences}
              onRemoveReferenceImage={pg.removeReferenceImage}
              onClearAllReferences={pg.clearAllReferences}
              onClearReferenceImageError={pg.clearReferenceImageError}
              onGenerate={handleGenerate}
            />
          </div>

          {pg.inputMode === 'agent' && agentPanelSidebarFits && (
            <button
              type="button"
              onClick={toggleAgentPanelWide}
              title={agentPanelWide ? t('app.action.collapseAgentPanel') : t('app.action.expandAgentPanel')}
              aria-label={agentPanelWide ? t('app.action.collapseAgentPanel') : t('app.action.expandAgentPanel')}
              aria-pressed={agentPanelWide}
              className="agent-panel-width-toggle"
              style={{ left: desktopInputPanelWidth }}
            >
              <Icon name={agentPanelWide ? 'chevron_left' : 'chevron_right'} size={14} strokeWidth={1.8} />
            </button>
          )}

          {showAgentWideTip && (
            <div
              role="status"
              aria-live="polite"
              className="agent-panel-width-tip"
              style={{ left: desktopInputPanelWidth }}
            >
              <span aria-hidden className="agent-panel-width-tip__caret" />
              <div className="agent-panel-width-tip__body">
                <span className="agent-panel-width-tip__title">{t('app.tip.wideAgentPanel.title')}</span>
                <span className="agent-panel-width-tip__desc">{t('app.tip.wideAgentPanel.description')}</span>
              </div>
              <button
                type="button"
                onClick={dismissAgentWideTip}
                className="agent-panel-width-tip__close"
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <Icon name="close" size={11} strokeWidth={1.8} />
              </button>
            </div>
          )}

          {/* Right output panel */}
          <OutputPanel
            history={pg.history}
            historyHasMore={pg.historyHasMore}
            generationJobs={pg.generationJobs}
            onCancelGenerationJob={pg.cancelGenerationJob}
            onDismissGenerationJob={pg.dismissGenerationJob}
            onCancelGenerationSlot={pg.cancelGenerationSlot}
            onRetryGenerationSlot={handleRetryGenerationSlot}
            onAddToRef={handleAddToRef}
            onRegenerate={handleRegenerate}
            onReroll={handleReroll}
            onEditImage={pg.editImage}
            onRemove={pg.removeFromHistory}
            onLoadMore={pg.loadMoreHistory}
            onOpenGenerationSettings={() => openSettings('generationConcurrency')}
            highlightStackId={highlightStackId}
          />
          {import.meta.env.DEV && <Agentation />}
        </div>
      </div>

      {/* Regen toast — bottom center */}
      <div
        className={`pointer-events-none fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300
        ${regenToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        <div className="rounded-md bg-(--color-surface) px-4 py-2 text-base font-medium text-(--color-text) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)] whitespace-nowrap">
          {regenToast}
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        keyHooks={pg.keyHooks}
        theme={theme}
        colorTheme={colorTheme}
        sansFont={sansFont}
        language={languagePreference}
        generationConcurrency={pg.generationConcurrency}
        agentSkills={pg.agentSkills}
        focusSection={settingsTarget}
        onThemeChange={setTheme}
        onColorThemeChange={setColorTheme}
        onSansFontChange={setSansFont}
        onLanguageChange={setLanguagePreference}
        onGenerationConcurrencyChange={pg.setGenerationConcurrency}
        onAgentSkillEnabledChange={pg.setAgentSkillEnabled}
        onDeleteAgentSkill={pg.deleteAgentSkill}
        onGetAgentSkillPackage={pg.getAgentSkillPackage}
        onCreateAgentSkill={pg.createUserAgentSkill}
        onClose={() => setSettingsOpen(false)}
      />
    </I18nProvider>
  )
}

export default App
