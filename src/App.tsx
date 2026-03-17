import { useState, useEffect, useRef, useCallback } from 'react'
import { Agentation } from 'agentation'
import { usePlayground } from './hooks/usePlayground'
import type { PlaygroundImageMeta } from './lib/types'
import { InputPanel } from './components/InputPanel'
import { OutputPanel } from './components/OutputPanel'
import { AppTitle } from './components/AppTitle'

type Theme = 'light' | 'dark' | 'system'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nano-banana-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function App() {
  const pg = usePlayground()
  const { addToReferences, history: pgHistory, restoreSession, resolveFullImages, setMode } = pg
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [draftBatchOverride, setDraftBatchOverride] = useState<number | null>(null)
  const [draftLabels, setDraftLabels] = useState<string[] | null>(null)
  const [draftPreviewHover, setDraftPreviewHover] = useState(false)
  const [regenToast, setRegenToast] = useState<string | null>(null)
  const regenToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDraftBatchOverride = useCallback((count: number | null, labels?: string[]) => {
    setDraftBatchOverride(count)
    setDraftLabels(count !== null && labels ? labels : null)
  }, [])
  const mobileOutputAreaRef = useRef<HTMLDivElement>(null)

  const handleAddToRef = useCallback((image: PlaygroundImageMeta) => {
    addToReferences(image)
  }, [addToReferences])

  const handleRegenerate = useCallback(async (image: PlaygroundImageMeta) => {
    if (image.source.type !== 'generated') return
    const meta = image.source
    const refMetas = pgHistory.filter((h) => meta.referenceImageIds.includes(h.id))
    const refs = await resolveFullImages(refMetas)
    restoreSession(meta.prompt, refs)
    setMode('text')
    const message = refs.length > 0
      ? `已还原提示词和 ${refs.length} 张参考图`
      : '已还原提示词'
    if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
    setRegenToast(message)
    regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
  }, [pgHistory, restoreSession, resolveFullImages, setMode])
  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => document.documentElement.classList.toggle('dark', mq.matches)
      apply()
      mq.addEventListener('change', apply)
      localStorage.setItem('nano-banana-theme', 'system')
      return () => mq.removeEventListener('change', apply)
    }
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('nano-banana-theme', theme)
  }, [theme])

  // Scroll to output area on mobile when generation starts
  useEffect(() => {
    if (pg.generationState === 'generating' && window.innerWidth < 768) {
      setTimeout(() => {
        mobileOutputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [pg.generationState])

  // Cycles light → dark → system → light for the mobile top-bar button
  const cycleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'))

  const themeIcon =
    theme === 'light' ? (
      <span className="material-symbols-rounded text-[18px]">dark_mode</span>
    ) : theme === 'dark' ? (
      <span className="material-symbols-rounded text-[18px]">light_mode</span>
    ) : (
      <span className="material-symbols-rounded text-[18px]">contrast</span>
    )

  return (
    <>
    {/* Mobile layout */}
    <div className="flex flex-col h-[100dvh] md:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-outline/10">
        <AppTitle className="text-xl text-on-surface" />
        <button
          type="button"
          onClick={cycleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     hover:bg-on-surface/8 active:bg-on-surface/12 transition-colors text-on-surface-variant"
        >
          {themeIcon}
        </button>
      </div>
      {/* Scrollable content: prompt panel + output stacked */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <InputPanel
          model={pg.model}
          resolution={pg.resolution}
          aspectRatio={pg.aspectRatio}
          batchCount={pg.batchCount}
          prompt={pg.prompt}
          mode={pg.mode}
          schemes={pg.schemes}
          currentSchemeIndex={pg.currentSchemeIndex}
          originalPrompt={pg.originalPrompt}
          referenceImages={pg.referenceImages}
          generationState={pg.generationState}
          apiKey={pg.apiKey}
          apiKeyStatus={pg.apiKeyStatus}
          onSubmitApiKey={pg.submitApiKey}
          onResetApiKey={pg.resetApiKey}
          onSwitchModel={pg.switchModel}
          onResolutionChange={pg.setResolution}
          onAspectRatioChange={pg.setAspectRatio}
          onPromptChange={pg.setPrompt}
          onBatchCountChange={pg.setBatchCount}
          onModeChange={pg.setMode}
          onSchemesChange={pg.setSchemes}
          onCurrentSchemeIndexChange={pg.setCurrentSchemeIndex}
          onOriginalPromptChange={pg.setOriginalPrompt}
          onAddReferenceImages={pg.addReferenceImages}
          onAddReferenceImage={pg.addToReferences}
          onRemoveReferenceImage={pg.removeReferenceImage}
          onGenerate={pg.generate}
          onCancel={pg.cancelGeneration}
          onDraftBatchOverride={handleDraftBatchOverride}
          onDraftPreviewHover={setDraftPreviewHover}
          onDraftLabelsOverride={setDraftLabels}
        />
        <div ref={mobileOutputAreaRef} className="border-t border-outline/10">
          <OutputPanel
            history={pg.history}
            historyHasMore={pg.historyHasMore}
            generationState={pg.generationState}
            generationSnapshot={pg.generationSnapshot}
            generationPreview={pg.generationPreview}
            showDraft={draftPreviewHover}
            error={pg.error}
            batchCount={pg.batchCount}
            draftBatchOverride={draftBatchOverride}
            draftLabels={draftLabels}
            aspectRatio={pg.aspectRatio}
            resolution={pg.resolution}
            onAddToRef={handleAddToRef}
            onRegenerate={handleRegenerate}
            onRemove={pg.removeFromHistory}
            onClearAll={pg.clearAllHistory}
            onLoadMore={pg.loadMoreHistory}
          />
        </div>
      </div>
    </div>

    {/* Desktop layout — 2 columns: input panel + output panel */}
    <div className="hidden md:flex h-screen">
      {/* Left input panel */}
      <div className="w-1/3 min-w-[400px] shrink-0 flex flex-col h-screen border-r border-outline/10">
        {/* Header: app title */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <AppTitle className="text-xl text-on-surface" />
        </div>
        {/* Scrollable input area */}
        <InputPanel
          model={pg.model}
          resolution={pg.resolution}
          aspectRatio={pg.aspectRatio}
          batchCount={pg.batchCount}
          prompt={pg.prompt}
          mode={pg.mode}
          schemes={pg.schemes}
          currentSchemeIndex={pg.currentSchemeIndex}
          originalPrompt={pg.originalPrompt}
          referenceImages={pg.referenceImages}
          generationState={pg.generationState}
          apiKey={pg.apiKey}
          apiKeyStatus={pg.apiKeyStatus}
          onSubmitApiKey={pg.submitApiKey}
          onResetApiKey={pg.resetApiKey}
          onSwitchModel={pg.switchModel}
          onResolutionChange={pg.setResolution}
          onAspectRatioChange={pg.setAspectRatio}
          onPromptChange={pg.setPrompt}
          onBatchCountChange={pg.setBatchCount}
          onModeChange={pg.setMode}
          onSchemesChange={pg.setSchemes}
          onCurrentSchemeIndexChange={pg.setCurrentSchemeIndex}
          onOriginalPromptChange={pg.setOriginalPrompt}
          onAddReferenceImages={pg.addReferenceImages}
          onAddReferenceImage={pg.addToReferences}
          onRemoveReferenceImage={pg.removeReferenceImage}
          onGenerate={pg.generate}
          onCancel={pg.cancelGeneration}
          onDraftBatchOverride={handleDraftBatchOverride}
          onDraftPreviewHover={setDraftPreviewHover}
          onDraftLabelsOverride={setDraftLabels}
          theme={theme}
          onThemeChange={setTheme}
        />
      </div>

      {/* Right output panel */}
      <OutputPanel
        history={pg.history}
        historyHasMore={pg.historyHasMore}
        generationState={pg.generationState}
        generationSnapshot={pg.generationSnapshot}
        generationPreview={pg.generationPreview}
        showDraft={draftPreviewHover}
        error={pg.error}
        batchCount={pg.batchCount}
        draftBatchOverride={draftBatchOverride}
        draftLabels={draftLabels}
        aspectRatio={pg.aspectRatio}
        resolution={pg.resolution}
        onAddToRef={handleAddToRef}
        onRegenerate={handleRegenerate}
        onRemove={pg.removeFromHistory}
        onClearAll={pg.clearAllHistory}
        onLoadMore={pg.loadMoreHistory}
      />
      {import.meta.env.DEV && <Agentation />}
    </div>

    {/* Regen toast — global, bottom-center */}
    <div
      className={`pointer-events-none fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300
        ${regenToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className="rounded-full bg-on-surface/85 px-5 py-2.5 text-sm font-medium text-surface shadow-lg backdrop-blur-sm whitespace-nowrap">
        {regenToast}
      </div>
    </div>
    </>
  )
}

export default App
