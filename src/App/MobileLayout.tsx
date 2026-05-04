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
  onRetryFailedGenerationImage: OutputPanelProps['onRetryFailedGenerationImage']
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
  onRetryFailedGenerationImage,
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

      <div
        ref={mobilePanelScrollRef}
        // Gallery is image-dense so it needs a wider fade band; InputPanel
        // (generate / agent) is text-dense, 1.25rem is enough.
        className={`scroll-fade-y min-h-0 flex-1 overflow-y-auto ${
          mobileTab === 'gallery'
            ? '[--scroll-fade-start-size:3rem] [--scroll-fade-end-size:3rem]'
            : '[--scroll-fade-start-size:1.25rem] [--scroll-fade-end-size:1.25rem]'
        }`}
      >
        {mobileTab !== 'gallery' ? (
          <div
            className="h-full px-3 pt-[var(--panel-pad-top)]"
            style={{
              // Mobile panel layout tokens. See `--panel-*` in src/index.css.
              ['--panel-pad-x' as string]: '12px',
              ['--panel-pad-top' as string]: '18px',
              ['--panel-pad-bottom' as string]: mobileTab === 'agent' ? '18px' : '120px',
            }}
          >
            <InputPanel {...inputPanelProps} inputMode={mobileTab === 'agent' ? 'agent' : 'generate'} />
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
              onRetryFailedGenerationImage={onRetryFailedGenerationImage}
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
            onRetryFailedGenerationImage={onRetryFailedGenerationImage}
            onRemove={onRemove}
          />
        </Suspense>
      )}
    </div>
  )
}
