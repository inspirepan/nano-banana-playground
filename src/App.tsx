import { Component, lazy, Suspense, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { buildSharedInputPanelProps } from './App/buildInputPanelProps'
import { DesktopLayout } from './App/DesktopLayout'
import { MobileLayout } from './App/MobileLayout'
import { type MobileTab } from './App/Topbar'
import { useAgentWideLayout } from './App/useAgentWideLayout'
import { useDocumentTitle } from './App/useDocumentTitle'
import { useMobileDetailModal } from './App/useMobileDetailModal'
import { useRegenerationToast } from './App/useRegenerationToast'
import { useThemeAndLanguage } from './App/useThemeAndLanguage'
import { usePlayground } from './hooks/usePlayground'
import { createTranslator, I18nProvider } from './i18n'
import type { Translate } from './i18n/types'
import type { PlaygroundImageMeta } from './lib/types'

const LAZY_RELOAD_STORAGE_KEY = 'nano-banana-playground:lazy-reload-attempted'

function isLazyChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|failed to fetch|loading chunk|module script|mime type/i.test(message)
}

function recoverFromLazyChunkLoadError(error: unknown, scope: string): never {
  if (isLazyChunkLoadError(error)) {
    try {
      const token = `${scope}:${import.meta.url}`
      if (window.sessionStorage.getItem(LAZY_RELOAD_STORAGE_KEY) !== token) {
        window.sessionStorage.setItem(LAZY_RELOAD_STORAGE_KEY, token)
        window.location.reload()
      }
    } catch {
      // Keep the original error path if sessionStorage is unavailable.
    }
  }
  throw error
}

const SettingsDialog = lazy(() =>
  import('./components/SettingsDialog')
    .then((module) => ({ default: module.SettingsDialog }))
    .catch((error: unknown) => recoverFromLazyChunkLoadError(error, 'SettingsDialog')),
)

type SettingsTarget = 'apiKeys' | 'generationConcurrency'

function SettingsDialogLoadError({ t, onClose }: { t: Translate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.loadError.title')}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-[var(--radius-lg)] bg-(--color-surface) p-5 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em]">{t('settings.loadError.title')}</h2>
          <p className="max-w-[60ch] text-pretty text-sm leading-5 text-(--color-text-2)">
            {t('settings.loadError.description')}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="chip ghost">
            {t('common.close')}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="chip">
            {t('common.refresh')}
          </button>
        </div>
      </div>
    </div>
  )
}

class SettingsDialogErrorBoundary extends Component<
  { children: ReactNode; t: Translate; onClose: () => void },
  { error: unknown | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (this.state.error) return <SettingsDialogLoadError t={this.props.t} onClose={this.props.onClose} />
    return this.props.children
  }
}

function App() {
  const pg = usePlayground()
  const {
    addToReferences,
    restoreGeneratedImageParams,
    rerollGeneratedImage,
    retryGenerationSlot,
    retryFailedGenerationImage,
  } = pg

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => (pg.inputMode === 'agent' ? 'agent' : 'generate'))

  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    sansFont,
    setSansFont,
    languagePreference,
    setLanguagePreference,
    language,
    browserLanguages,
  } = useThemeAndLanguage(settingsOpen)

  const t = useMemo(() => createTranslator(language), [language])

  const queueSummary = pg.generationQueueSummary
  const queueActive = queueSummary.queued + queueSummary.running + queueSummary.retrying
  const queueDone = queueSummary.succeeded + queueSummary.failed + queueSummary.canceled

  useDocumentTitle({
    queueActive,
    queueDone,
    queueTotal: queueSummary.total,
    queueFailed: queueSummary.failed,
    queueSucceeded: queueSummary.succeeded,
    t,
  })

  const {
    agentPanelWide,
    agentPanelSidebarFits,
    useWideAgentPanel,
    desktopInputPanelWidth,
    showAgentWideTip,
    toggleAgentPanelWide,
    dismissAgentWideTip,
    setAgentPanelWidePreference,
    setAgentWideTipDismissedPreference,
  } = useAgentWideLayout(pg.inputMode)

  const { regenToast, handleRegenerate, handleReroll, handleRetryGenerationSlot, handleRetryFailedGenerationImage } =
    useRegenerationToast({
      restoreGeneratedImageParams,
      rerollGeneratedImage,
      retryGenerationSlot,
      retryFailedGenerationImage,
      t,
    })

  const {
    highlightStackId,
    desktopDetailTarget,
    mobileDetailState,
    mobileDetailStack,
    mobilePrevStackTarget,
    mobileNextStackTarget,
    handleMobileNavigateToStackItem,
    handleCloseMobileDetail,
    handleDesktopDetailTargetConsumed,
    handleFocusAgentImageTask,
  } = useMobileDetailModal({ history: pg.history, generationJobs: pg.generationJobs })

  const handleAddToRef = useCallback(
    (image: PlaygroundImageMeta) => {
      void addToReferences(image)
    },
    [addToReferences],
  )

  const openSettings = useCallback((target: SettingsTarget | null = null) => {
    setSettingsTarget(target)
    setSettingsOpen(true)
  }, [])

  const handleOpenApiKeys = useCallback(() => openSettings('apiKeys'), [openSettings])
  const handleOpenGenerationSettings = useCallback(() => openSettings('generationConcurrency'), [openSettings])

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

  const handleGenerate = () => {
    pg.generate()
    if (window.innerWidth < 768) {
      setMobileTab('gallery')
    }
  }

  const sharedInputPanelProps = buildSharedInputPanelProps({
    pg,
    onOpenApiKeys: handleOpenApiKeys,
    onInputModeChange: switchInputMode,
    onFocusAgentImageTask: handleFocusAgentImageTask,
    onGenerate: handleGenerate,
  })

  return (
    <I18nProvider preference={languagePreference} browserLanguages={browserLanguages}>
      {/* Mobile layout */}
      <MobileLayout
        mobileTab={mobileTab}
        onMobileTabChange={switchMobileTab}
        onOpenSettings={() => openSettings()}
        inputPanelProps={sharedInputPanelProps}
        history={pg.history}
        historyHasMore={pg.historyHasMore}
        generationJobs={pg.generationJobs}
        highlightStackId={highlightStackId}
        mobileDetailStack={mobileDetailState ? mobileDetailStack : null}
        mobileDetailItemId={mobileDetailState?.itemId}
        mobilePrevStackTarget={mobilePrevStackTarget}
        mobileNextStackTarget={mobileNextStackTarget}
        onAddToRef={handleAddToRef}
        onRegenerate={handleRegenerate}
        onReroll={handleReroll}
        onEditImage={pg.editImage}
        onCancelGenerationJob={pg.cancelGenerationJob}
        onDismissGenerationJob={pg.dismissGenerationJob}
        onCancelGenerationSlot={pg.cancelGenerationSlot}
        onRetryGenerationSlot={handleRetryGenerationSlot}
        onRetryFailedGenerationImage={handleRetryFailedGenerationImage}
        onRemove={pg.removeFromHistory}
        onLoadMore={pg.loadMoreHistory}
        onOpenGenerationSettings={handleOpenGenerationSettings}
        onNavigateToStackItem={handleMobileNavigateToStackItem}
        onCloseDetail={handleCloseMobileDetail}
      />

      {/* Desktop layout */}
      <DesktopLayout
        inputMode={pg.inputMode}
        inputPanelProps={sharedInputPanelProps}
        desktopInputPanelWidth={desktopInputPanelWidth}
        useWideAgentPanel={useWideAgentPanel}
        agentPanelSidebarFits={agentPanelSidebarFits}
        agentPanelWide={agentPanelWide}
        showAgentWideTip={showAgentWideTip}
        toggleAgentPanelWide={toggleAgentPanelWide}
        dismissAgentWideTip={dismissAgentWideTip}
        highlightStackId={highlightStackId}
        externalDetailTarget={desktopDetailTarget}
        onExternalDetailTargetConsumed={handleDesktopDetailTargetConsumed}
        history={pg.history}
        historyHasMore={pg.historyHasMore}
        generationJobs={pg.generationJobs}
        onCancelGenerationJob={pg.cancelGenerationJob}
        onDismissGenerationJob={pg.dismissGenerationJob}
        onCancelGenerationSlot={pg.cancelGenerationSlot}
        onRetryGenerationSlot={handleRetryGenerationSlot}
        onRetryFailedGenerationImage={handleRetryFailedGenerationImage}
        onAddToRef={handleAddToRef}
        onRegenerate={handleRegenerate}
        onReroll={handleReroll}
        onEditImage={pg.editImage}
        onRemove={pg.removeFromHistory}
        onLoadMore={pg.loadMoreHistory}
        onOpenGenerationSettings={handleOpenGenerationSettings}
        t={t}
      />

      {/* Regen toast — bottom center */}
      <div
        className={`pointer-events-none fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300
        ${regenToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        <div className="rounded-md bg-(--color-surface) px-4 py-2 text-base font-medium text-(--color-text) shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)] whitespace-nowrap">
          {regenToast}
        </div>
      </div>

      {settingsOpen && (
        <SettingsDialogErrorBoundary t={t} onClose={() => setSettingsOpen(false)}>
          <Suspense fallback={null}>
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
              onAgentPanelWidePreferenceChange={setAgentPanelWidePreference}
              onAgentWideTipDismissedPreferenceChange={setAgentWideTipDismissedPreference}
              onAgentSkillEnabledChange={pg.setAgentSkillEnabled}
              onDeleteAgentSkill={pg.deleteAgentSkill}
              onGetAgentSkillPackage={pg.getAgentSkillPackage}
              onCreateAgentSkill={pg.createUserAgentSkill}
              onClose={() => setSettingsOpen(false)}
            />
          </Suspense>
        </SettingsDialogErrorBoundary>
      )}
    </I18nProvider>
  )
}

export default App
