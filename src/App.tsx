import { useState, useEffect } from 'react'
import { Agentation } from 'agentation'
import { usePlayground } from './hooks/usePlayground'
import { ControlPanel } from './components/ControlPanel'
import { PromptPanel } from './components/PromptPanel'
import { OutputPanel } from './components/OutputPanel'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nano-banana-theme') as Theme | null
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const pg = usePlayground()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('nano-banana-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const themeIcon =
    theme === 'light' ? (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    ) : (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    )

  return (
    <>
    {/* Mobile layout */}
    <div className="flex flex-col h-[100dvh] md:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-outline/10">
        <h1 className="text-sm font-medium text-on-surface">Nano Banana Playground</h1>
        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     hover:bg-surface-container-high transition-colors text-on-surface-variant"
        >
          {themeIcon}
        </button>
      </div>
      {/* Scrollable content: control → prompt → output stacked */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <ControlPanel
          model={pg.model}
          resolution={pg.resolution}
          aspectRatio={pg.aspectRatio}
          batchCount={pg.batchCount}
          apiKey={pg.apiKey}
          apiKeyStatus={pg.apiKeyStatus}
          onSubmitApiKey={pg.submitApiKey}
          onResetApiKey={pg.resetApiKey}
          onSwitchModel={pg.switchModel}
          onResolutionChange={pg.setResolution}
          onAspectRatioChange={pg.setAspectRatio}
          onBatchCountChange={pg.setBatchCount}
        />
        <div className="border-t border-outline/10">
          <PromptPanel
            model={pg.model}
            prompt={pg.prompt}
            referenceImages={pg.referenceImages}
            generationState={pg.generationState}
            apiKey={pg.apiKey}
            onPromptChange={pg.setPrompt}
            onAddReferenceImages={pg.addReferenceImages}
            onAddReferenceImage={pg.addToReferences}
            onRemoveReferenceImage={pg.removeReferenceImage}
            onGenerate={pg.generate}
            onCancel={pg.cancelGeneration}
          />
        </div>
        <div className="border-t border-outline/10">
          <OutputPanel
            history={pg.history}
            generationState={pg.generationState}
            generationSnapshot={pg.generationSnapshot}
            showDraft={pg.showDraft}
            error={pg.error}
            batchCount={pg.batchCount}
            aspectRatio={pg.aspectRatio}
            resolution={pg.resolution}
            onAddToRef={pg.addToReferences}
            onRemove={pg.removeFromHistory}
            onClearAll={pg.clearAllHistory}
          />
        </div>
      </div>
    </div>

    {/* Desktop layout */}
    <div className="hidden md:flex h-screen gap-6 px-8">
      <div className="w-[320px] shrink-0 flex flex-col py-4">
        <h1 className="text-base font-medium text-on-surface whitespace-nowrap mb-4">
          Nano Banana Playground
        </h1>

        <ControlPanel
          model={pg.model}
          resolution={pg.resolution}
          aspectRatio={pg.aspectRatio}
          batchCount={pg.batchCount}
          apiKey={pg.apiKey}
          apiKeyStatus={pg.apiKeyStatus}
          onSubmitApiKey={pg.submitApiKey}
          onResetApiKey={pg.resetApiKey}
          onSwitchModel={pg.switchModel}
          onResolutionChange={pg.setResolution}
          onAspectRatioChange={pg.setAspectRatio}
          onBatchCountChange={pg.setBatchCount}
        />

        <div className="mt-auto pt-4">
          <div className="relative inline-flex group">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              {theme === 'light' ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
            </button>
            {/* Google-style tooltip */}
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2
                         pointer-events-none whitespace-nowrap
                         bg-on-surface text-surface text-xs px-2 py-1 rounded
                         opacity-0 group-hover:opacity-100
                         transition-opacity duration-150 delay-500 group-hover:delay-500
                         z-50"
            >
              {theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            </div>
          </div>
        </div>
      </div>

      <PromptPanel
        model={pg.model}
        prompt={pg.prompt}
        referenceImages={pg.referenceImages}
        generationState={pg.generationState}
        apiKey={pg.apiKey}
        onPromptChange={pg.setPrompt}
        onAddReferenceImages={pg.addReferenceImages}
        onAddReferenceImage={pg.addToReferences}
        onRemoveReferenceImage={pg.removeReferenceImage}
        onGenerate={pg.generate}
        onCancel={pg.cancelGeneration}
      />

      <OutputPanel
        history={pg.history}
        generationState={pg.generationState}
        generationSnapshot={pg.generationSnapshot}
        showDraft={pg.showDraft}
        error={pg.error}
        batchCount={pg.batchCount}
        aspectRatio={pg.aspectRatio}
        resolution={pg.resolution}
        onAddToRef={pg.addToReferences}
        onRemove={pg.removeFromHistory}
        onClearAll={pg.clearAllHistory}
      />
      {import.meta.env.DEV && <Agentation />}
    </div>
    </>
  )
}

export default App
