import { lazy, Suspense, useLayoutEffect, useRef, type ComponentProps } from 'react'

import type { SharedInputPanelProps } from './buildInputPanelProps'
import { Topbar, type MobileTab } from './Topbar'
import type { MobileDetailNavTarget } from './useMobileDetailModal'
import { InputPanel } from '../components/InputPanel'
import { OutputPanel } from '../components/OutputPanel'
import type { ImageStack } from '../lib/stacks'

const ImageDetailModal = lazy(() =>
  import('../components/image-detail/ImageDetailModal').then((module) => ({ default: module.ImageDetailModal })),
)

type OutputPanelProps = ComponentProps<typeof OutputPanel>
type ImageDetailModalProps = ComponentProps<typeof ImageDetailModal>

type Props = {
  mobileTab: MobileTab
  onMobileTabChange: (tab: MobileTab) => void
  onOpenSettings: () => void
  inputPanelProps: SharedInputPanelProps
  history: OutputPanelProps['history']
  historyHasMore: OutputPanelProps['historyHasMore']
  generationJobs: OutputPanelProps['generationJobs']
  highlightStackId: OutputPanelProps['highlightStackId']
  mobileDetailStack: ImageStack | null
  mobileDetailItemId: string | undefined
  mobilePrevStackTarget: MobileDetailNavTarget | null
  mobileNextStackTarget: MobileDetailNavTarget | null
  onAddToRef: OutputPanelProps['onAddToRef']
  onRegenerate: OutputPanelProps['onRegenerate']
  onReroll: OutputPanelProps['onReroll']
  onEditImage: OutputPanelProps['onEditImage']
  onCancelGenerationJob: OutputPanelProps['onCancelGenerationJob']
  onDismissGenerationJob: OutputPanelProps['onDismissGenerationJob']
  onCancelGenerationSlot: ImageDetailModalProps['onCancelGenerationSlot']
  onRetryGenerationSlot: OutputPanelProps['onRetryGenerationSlot']
  onRemove: OutputPanelProps['onRemove']
  onLoadMore: OutputPanelProps['onLoadMore']
  onOpenGenerationSettings: OutputPanelProps['onOpenGenerationSettings']
  onNavigateToStackItem: (target: MobileDetailNavTarget) => void
  onCloseDetail: () => void
}

export function MobileLayout({
  mobileTab,
  onMobileTabChange,
  onOpenSettings,
  inputPanelProps,
  history,
  historyHasMore,
  generationJobs,
  highlightStackId,
  mobileDetailStack,
  mobileDetailItemId,
  mobilePrevStackTarget,
  mobileNextStackTarget,
  onAddToRef,
  onRegenerate,
  onReroll,
  onEditImage,
  onCancelGenerationJob,
  onDismissGenerationJob,
  onCancelGenerationSlot,
  onRetryGenerationSlot,
  onRemove,
  onLoadMore,
  onOpenGenerationSettings,
  onNavigateToStackItem,
  onCloseDetail,
}: Props) {
  const mobilePanelScrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    mobilePanelScrollRef.current?.scrollTo({ top: 0 })
  }, [mobileTab])

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-(--color-bg) md:hidden">
      <Topbar mobileTab={mobileTab} onMobileTabChange={onMobileTabChange} onOpenSettings={onOpenSettings} />

      <div ref={mobilePanelScrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {mobileTab !== 'gallery' ? (
          <div
            className={`h-full ${mobileTab === 'agent' ? 'px-0' : 'px-3'}`}
            style={{ ['--agent-panel-padding-x' as string]: mobileTab === 'agent' ? '10px' : undefined }}
          >
            <InputPanel
              {...inputPanelProps}
              inputMode={mobileTab === 'agent' ? 'agent' : 'generate'}
              showHeader={false}
            />
          </div>
        ) : (
          <div className="px-3 py-[18px]">
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
              highlightStackId={highlightStackId}
              onOpenGenerationSettings={onOpenGenerationSettings}
            />
          </div>
        )}
      </div>

      {mobileDetailStack && (
        <Suspense fallback={null}>
          <ImageDetailModal
            stack={mobileDetailStack}
            initialItemId={mobileDetailItemId}
            history={history}
            generationJobs={generationJobs}
            previousStackTarget={mobilePrevStackTarget}
            nextStackTarget={mobileNextStackTarget}
            onNavigateToStackItem={onNavigateToStackItem}
            onClose={onCloseDetail}
            onAddToRef={onAddToRef}
            onRegenerate={onRegenerate}
            onReroll={onReroll}
            onEditImage={onEditImage}
            onCancelGenerationJob={onCancelGenerationJob}
            onDismissGenerationJob={onDismissGenerationJob}
            onCancelGenerationSlot={onCancelGenerationSlot}
            onRetryGenerationSlot={onRetryGenerationSlot}
            onRemove={onRemove}
          />
        </Suspense>
      )}
    </div>
  )
}
