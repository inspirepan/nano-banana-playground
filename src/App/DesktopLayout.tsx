import {
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type CSSProperties,
} from 'react'

import type { SharedInputPanelProps } from './buildInputPanelProps'
import type { AgentSessionStatus } from '../agent'
import { AgentSessionSidebar } from '../components/agent-chat/AgentSessionSidebar'
import { AgentChatPanel } from '../components/AgentChatPanel'
import { Icon } from '../components/Icon'
import { InputPanel } from '../components/InputPanel'
import { InputPanelHeader } from '../components/InputPanel/InputPanelHeader'
import { OutputPanel } from '../components/OutputPanel'
import type { InputMode } from '../hooks/usePlayground'
import type { Translate } from '../i18n'

type OutputPanelProps = ComponentProps<typeof OutputPanel>

// Dev-only inspector — kept out of production import graph via dynamic import.
const Agentation = import.meta.env.DEV
  ? lazy(() => import('agentation').then((module) => ({ default: module.Agentation })))
  : null

type Props = {
  inputMode: InputMode
  inputPanelProps: SharedInputPanelProps
  desktopInputPanelWidth: string
  useWideAgentPanel: boolean
  agentPanelSidebarFits: boolean
  agentPanelWide: boolean
  showAgentWideTip: boolean
  toggleAgentPanelWide: () => void
  dismissAgentWideTip: () => void
  highlightStackId: OutputPanelProps['highlightStackId']
  externalDetailTarget: OutputPanelProps['externalDetailTarget']
  onExternalDetailTargetConsumed: OutputPanelProps['onExternalDetailTargetConsumed']
  history: OutputPanelProps['history']
  historyHasMore: OutputPanelProps['historyHasMore']
  generationJobs: OutputPanelProps['generationJobs']
  onCancelGenerationJob: OutputPanelProps['onCancelGenerationJob']
  onDismissGenerationJob: OutputPanelProps['onDismissGenerationJob']
  onCancelGenerationSlot: OutputPanelProps['onCancelGenerationSlot']
  onRetryGenerationSlot: OutputPanelProps['onRetryGenerationSlot']
  onRetryFailedGenerationImage: OutputPanelProps['onRetryFailedGenerationImage']
  onAddToRef: OutputPanelProps['onAddToRef']
  onRegenerate: OutputPanelProps['onRegenerate']
  onReroll: OutputPanelProps['onReroll']
  onEditImage: OutputPanelProps['onEditImage']
  onRemove: OutputPanelProps['onRemove']
  onLoadMore: OutputPanelProps['onLoadMore']
  onOpenGenerationSettings: OutputPanelProps['onOpenGenerationSettings']
  t: Translate
}

export function DesktopLayout({
  inputMode,
  inputPanelProps,
  desktopInputPanelWidth,
  useWideAgentPanel,
  agentPanelSidebarFits,
  agentPanelWide,
  showAgentWideTip,
  toggleAgentPanelWide,
  dismissAgentWideTip,
  highlightStackId,
  externalDetailTarget,
  onExternalDetailTargetConsumed,
  history,
  historyHasMore,
  generationJobs,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  onRetryFailedGenerationImage,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onRemove,
  onLoadMore,
  onOpenGenerationSettings,
  t,
}: Props) {
  // The shared header (mode switcher + settings) lives at
  // the layout level so it stays put across mode switches. On inputMode flips,
  // the panel width snaps to its final size before the body fades in.
  const panelRef = useRef<HTMLDivElement>(null)
  const inputBodyRef = useRef<HTMLDivElement>(null)
  const skipNextAnimationRef = useRef(true)
  const onInputModeChange = inputPanelProps.onInputModeChange
  const showWideAgentStructure = inputMode === 'agent' && useWideAgentPanel

  const handleAgentPanelWideToggle = useCallback(() => {
    toggleAgentPanelWide()
  }, [toggleAgentPanelWide])

  const handleInputModeChange = useCallback(
    (mode: InputMode) => {
      onInputModeChange(mode)
    },
    [onInputModeChange],
  )

  useLayoutEffect(() => {
    if (skipNextAnimationRef.current) {
      skipNextAnimationRef.current = false
      return
    }
    const panelEl = panelRef.current
    if (panelEl) {
      // Cancel any in-flight width transition for this commit so the panel
      // snaps to the new mode's width instead of animating wide->narrow.
      panelEl.style.transitionProperty = 'none'
      void panelEl.offsetWidth
      requestAnimationFrame(() => {
        panelEl.style.transitionProperty = ''
      })
    }
    inputBodyRef.current?.animate(
      [
        { opacity: 0, filter: 'blur(8px)' },
        { opacity: 1, filter: 'blur(0)' },
      ],
      {
        duration: 240,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
        fill: 'backwards',
      },
    )
  }, [inputMode])

  const isWaitingForQuestionAnswer = inputPanelProps.agentPendingQuestions.length > 0
  const isAgentActivelyRunning = inputPanelProps.agentIsStreaming && !isWaitingForQuestionAnswer
  const hasGeneratingImageTask = inputPanelProps.agentImageTasks.some(
    (task) => task.status === 'queued' || task.status === 'running',
  )
  const currentSessionSidebarStatus: AgentSessionStatus | null = isWaitingForQuestionAnswer
    ? 'waiting_for_question'
    : isAgentActivelyRunning
      ? 'running'
      : hasGeneratingImageTask
        ? 'generating_images'
        : null
  const visibleAgentSessionStatuses = useMemo(() => {
    const next = { ...inputPanelProps.agentSessionStatuses }
    const currentSessionId = inputPanelProps.currentAgentSessionId
    if (!currentSessionId) return next
    if (currentSessionSidebarStatus) {
      next[currentSessionId] = currentSessionSidebarStatus
    } else {
      delete next[currentSessionId]
    }
    return next
  }, [currentSessionSidebarStatus, inputPanelProps.agentSessionStatuses, inputPanelProps.currentAgentSessionId])

  // Per-layout panel tokens — see `--panel-*` in src/index.css.
  const panelLayoutVars: CSSProperties = {
    width: desktopInputPanelWidth,
    ['--panel-pad-x' as string]: '18px',
    ['--panel-pad-top' as string]: '18px',
    ['--panel-pad-bottom' as string]: showWideAgentStructure || inputMode === 'agent' ? '18px' : '120px',
    ['--panel-header-mb' as string]: '18px',
  }

  const agentChatPanelVars: CSSProperties = {
    ['--panel-pad-x' as string]: '26px',
    flexGrow: useWideAgentPanel ? 4 : 0,
  }

  const outputPanel = (
    <OutputPanel
      history={history}
      historyHasMore={historyHasMore}
      generationJobs={generationJobs}
      onCancelGenerationJob={onCancelGenerationJob}
      onDismissGenerationJob={onDismissGenerationJob}
      onCancelGenerationSlot={onCancelGenerationSlot}
      onRetryGenerationSlot={onRetryGenerationSlot}
      onRetryFailedGenerationImage={onRetryFailedGenerationImage}
      onAddToRef={onAddToRef}
      onRegenerate={onRegenerate}
      onReroll={onReroll}
      onEditImage={onEditImage}
      onRemove={onRemove}
      onLoadMore={onLoadMore}
      onOpenGenerationSettings={onOpenGenerationSettings}
      highlightStackId={highlightStackId}
      externalDetailTarget={externalDetailTarget}
      onExternalDetailTargetConsumed={onExternalDetailTargetConsumed}
    />
  )

  return (
    <div className="hidden md:flex flex-col h-screen overflow-hidden bg-(--color-bg)">
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Left input panel */}
        <div
          ref={panelRef}
          className="shrink-0 flex flex-col bg-(--color-bg) shadow-[inset_-1px_0_0_var(--ring-edge-soft)]"
          style={panelLayoutVars}
        >
          <div className="shrink-0 pt-[21px]">
            <InputPanelHeader
              inputMode={inputMode}
              showInputModeSwitcher
              stacked={showWideAgentStructure}
              onInputModeChange={handleInputModeChange}
              onOpenApiKeys={inputPanelProps.onOpenApiKeys}
            />
          </div>
          <div
            ref={inputBodyRef}
            className={`flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] ${
              inputMode === 'agent' && !showWideAgentStructure
                ? ''
                : 'scroll-fade-y [--scroll-fade-start-size:1.25rem] [--scroll-fade-end-size:1.25rem]'
            }`}
          >
            {showWideAgentStructure ? (
              <AgentSessionSidebar
                sessions={inputPanelProps.agentSessions}
                sessionStatuses={visibleAgentSessionStatuses}
                currentSessionId={inputPanelProps.currentAgentSessionId}
                sessionsLoading={inputPanelProps.agentSessionsLoading}
                onNewSession={inputPanelProps.onCreateAgentSession}
                onSwitchSession={inputPanelProps.onSwitchAgentSession}
                onDeleteSession={inputPanelProps.onDeleteAgentSession}
              />
            ) : (
              <InputPanel {...inputPanelProps} inputMode={inputMode} />
            )}
          </div>
        </div>

        {showWideAgentStructure && (
          <div
            className="flex min-w-0 basis-0 shrink flex-col overflow-hidden bg-(--color-bg)"
            style={agentChatPanelVars}
          >
            <AgentChatPanel
              messages={inputPanelProps.agentMessages}
              messageMetadata={inputPanelProps.agentMessageMetadata}
              streamingMessage={inputPanelProps.agentStreamingMessage}
              queuedMessages={inputPanelProps.agentQueuedMessages}
              isStreaming={inputPanelProps.agentIsStreaming}
              error={inputPanelProps.agentError}
              draft={inputPanelProps.agentDraft}
              attachments={inputPanelProps.agentAttachments}
              attachmentError={inputPanelProps.agentAttachmentError}
              sessions={inputPanelProps.agentSessions}
              sessionStatuses={inputPanelProps.agentSessionStatuses}
              currentSessionId={inputPanelProps.currentAgentSessionId}
              sessionsLoading={inputPanelProps.agentSessionsLoading}
              autoApproveImageTasks={inputPanelProps.autoApproveAgentImageTasks}
              imageTasks={inputPanelProps.agentImageTasks}
              pendingQuestions={inputPanelProps.agentPendingQuestions}
              skills={inputPanelProps.agentSkills}
              history={inputPanelProps.history}
              generationJobs={inputPanelProps.generationJobs}
              model={inputPanelProps.agentModel}
              models={inputPanelProps.agentModels}
              thinkingLevel={inputPanelProps.agentThinkingLevel}
              keyStatuses={inputPanelProps.keyStatuses}
              onOpenApiKeys={inputPanelProps.onOpenApiKeys}
              onDraftChange={inputPanelProps.onAgentDraftChange}
              onAddAttachments={inputPanelProps.onAddAgentAttachments}
              onAddImageAttachment={inputPanelProps.onAddAgentImageAttachment}
              onRemoveAttachment={inputPanelProps.onRemoveAgentAttachment}
              onClearAttachmentError={inputPanelProps.onClearAgentAttachmentError}
              onNewSession={inputPanelProps.onCreateAgentSession}
              onSwitchSession={inputPanelProps.onSwitchAgentSession}
              onDeleteSession={inputPanelProps.onDeleteAgentSession}
              onToggleAutoApproveImageTasks={inputPanelProps.onToggleAutoApproveAgentImageTasks}
              onApproveImageTask={inputPanelProps.onApproveAgentImageTask}
              onCancelImageTask={inputPanelProps.onCancelAgentImageTask}
              onSubmitQuestionAnswers={inputPanelProps.onSubmitAgentQuestionAnswers}
              onCancelQuestion={inputPanelProps.onCancelAgentQuestion}
              onFocusImageTask={inputPanelProps.onFocusAgentImageTask}
              onModelChange={inputPanelProps.onAgentModelChange}
              onThinkingLevelChange={inputPanelProps.onAgentThinkingLevelChange}
              onSend={inputPanelProps.onSendAgentMessage}
              onStop={inputPanelProps.onStopAgentMessage}
              wideLayout
            />
          </div>
        )}

        {inputMode === 'agent' && agentPanelSidebarFits && !showWideAgentStructure && (
          <button
            type="button"
            onClick={handleAgentPanelWideToggle}
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
        {showWideAgentStructure ? (
          <div className="relative flex min-w-0 flex-[2_1_0%] shadow-[inset_1px_0_0_var(--ring-edge-soft)]">
            <button
              type="button"
              onClick={handleAgentPanelWideToggle}
              title={agentPanelWide ? t('app.action.collapseAgentPanel') : t('app.action.expandAgentPanel')}
              aria-label={agentPanelWide ? t('app.action.collapseAgentPanel') : t('app.action.expandAgentPanel')}
              aria-pressed={agentPanelWide}
              className="agent-panel-width-toggle"
              style={{ left: 0 }}
            >
              <Icon name={agentPanelWide ? 'chevron_left' : 'chevron_right'} size={14} strokeWidth={1.8} />
            </button>
            {outputPanel}
          </div>
        ) : (
          outputPanel
        )}
        {Agentation && (
          <Suspense fallback={null}>
            <Agentation />
          </Suspense>
        )}
      </div>
    </div>
  )
}
