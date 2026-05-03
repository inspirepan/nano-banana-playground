import { Agentation } from 'agentation'
import type { ComponentProps } from 'react'

import type { SharedInputPanelProps } from './buildInputPanelProps'
import { Icon } from '../components/Icon'
import { InputPanel } from '../components/InputPanel'
import { OutputPanel } from '../components/OutputPanel'
import type { InputMode } from '../hooks/usePlayground'
import type { Translate } from '../i18n'

type OutputPanelProps = ComponentProps<typeof OutputPanel>

type Props = {
  inputMode: InputMode
  inputPanelProps: SharedInputPanelProps
  desktopInputPanelWidth: string
  agentPanelSideSpace: string
  useWideAgentPanel: boolean
  agentPanelSidebarFits: boolean
  agentPanelWide: boolean
  showAgentWideTip: boolean
  toggleAgentPanelWide: () => void
  dismissAgentWideTip: () => void
  highlightStackId: OutputPanelProps['highlightStackId']
  history: OutputPanelProps['history']
  historyHasMore: OutputPanelProps['historyHasMore']
  generationJobs: OutputPanelProps['generationJobs']
  onCancelGenerationJob: OutputPanelProps['onCancelGenerationJob']
  onDismissGenerationJob: OutputPanelProps['onDismissGenerationJob']
  onCancelGenerationSlot: OutputPanelProps['onCancelGenerationSlot']
  onRetryGenerationSlot: OutputPanelProps['onRetryGenerationSlot']
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
  agentPanelSideSpace,
  useWideAgentPanel,
  agentPanelSidebarFits,
  agentPanelWide,
  showAgentWideTip,
  toggleAgentPanelWide,
  dismissAgentWideTip,
  highlightStackId,
  history,
  historyHasMore,
  generationJobs,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onRemove,
  onLoadMore,
  onOpenGenerationSettings,
  t,
}: Props) {
  return (
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
          <InputPanel {...inputPanelProps} inputMode={inputMode} showAgentSessionSidebar={useWideAgentPanel} />
        </div>

        {inputMode === 'agent' && agentPanelSidebarFits && (
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
          history={history}
          historyHasMore={historyHasMore}
          generationJobs={generationJobs}
          onCancelGenerationJob={onCancelGenerationJob}
          onDismissGenerationJob={onDismissGenerationJob}
          onCancelGenerationSlot={onCancelGenerationSlot}
          onRetryGenerationSlot={onRetryGenerationSlot}
          onAddToRef={onAddToRef}
          onRegenerate={onRegenerate}
          onReroll={onReroll}
          onEditImage={onEditImage}
          onRemove={onRemove}
          onLoadMore={onLoadMore}
          onOpenGenerationSettings={onOpenGenerationSettings}
          highlightStackId={highlightStackId}
        />
        {import.meta.env.DEV && <Agentation />}
      </div>
    </div>
  )
}
