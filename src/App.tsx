import { useState, useEffect, useRef } from 'react'
import { Agentation } from 'agentation'
import { usePlayground } from './hooks/usePlayground'
import type { PlaygroundImage } from './lib/types'
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
  const mobileRefAreaRef = useRef<HTMLDivElement>(null)

  const handleAddToRef = (image: PlaygroundImage) => {
    pg.addToReferences(image)
    // On mobile, scroll to the reference image upload area after adding
    if (window.innerWidth < 768) {
      setTimeout(() => {
        mobileRefAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('nano-banana-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const themeIcon =
    theme === 'light' ? (
      // dark_mode - Material Symbols filled
      <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
      </svg>
    ) : (
      // light_mode - Material Symbols filled
      <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
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
        <div ref={mobileRefAreaRef} className="border-t border-outline/10">
          <PromptPanel
            model={pg.model}
            resolution={pg.resolution}
            batchCount={pg.batchCount}
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
            onAddToRef={handleAddToRef}
            onRemove={pg.removeFromHistory}
            onClearAll={pg.clearAllHistory}
          />
        </div>
      </div>
    </div>

    {/* Desktop layout */}
    <div className="hidden md:flex h-screen gap-6 pl-8">
      <div className="w-[280px] shrink-0 flex flex-col py-4">
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
              {themeIcon}
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
        resolution={pg.resolution}
        batchCount={pg.batchCount}
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
        onAddToRef={handleAddToRef}
        onRemove={pg.removeFromHistory}
        onClearAll={pg.clearAllHistory}
      />
      {import.meta.env.DEV && <Agentation />}
    </div>
    </>
  )
}

export default App
