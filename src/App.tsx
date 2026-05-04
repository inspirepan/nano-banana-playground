import { lazy, Suspense, useCallback, useMemo, useState } from 'react'

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
import type { PlaygroundImageMeta } from './lib/types'

const SettingsDialog = lazy(() =>
  import('./components/SettingsDialog').then((module) => ({ default: module.SettingsDialog })),
)

type SettingsTarget = 'apiKeys' | 'generationConcurrency'

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
        <div className="rounded-md bg-(--color-surface) px-4 py-2 text-base font-medium text-(--color-text) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)] whitespace-nowrap">
          {regenToast}
        </div>
      </div>

      {settingsOpen && (
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
      )}
    </I18nProvider>
  )
}

export default App
