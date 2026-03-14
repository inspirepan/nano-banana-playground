import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  const addToReferences = pg.addToReferences
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [draftBatchOverride, setDraftBatchOverride] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('nano-banana-sidebar-collapsed') === 'true'
  })
  const mobileRefAreaRef = useRef<HTMLDivElement>(null)

  const handleAddToRef = useCallback((image: PlaygroundImage) => {
    addToReferences(image)
    // On mobile, scroll to the reference image upload area after adding
    if (window.innerWidth < 768) {
      setTimeout(() => {
        mobileRefAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [addToReferences])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('nano-banana-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c
      localStorage.setItem('nano-banana-sidebar-collapsed', String(next))
      return next
    })
  }, [])

  // Chevron icon rotates when sidebar collapses
  const collapseIcon = useMemo(
    () => (
      <svg
        className={`w-[18px] h-[18px] transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
          sidebarCollapsed ? 'rotate-180' : ''
        }`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        {/* chevron_left */}
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
      </svg>
    ),
    [sidebarCollapsed]
  )

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
          apiKey={pg.apiKey}
          apiKeyStatus={pg.apiKeyStatus}
          onSubmitApiKey={pg.submitApiKey}
          onResetApiKey={pg.resetApiKey}
          onSwitchModel={pg.switchModel}
          onResolutionChange={pg.setResolution}
          onAspectRatioChange={pg.setAspectRatio}
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
            onBatchCountChange={pg.setBatchCount}
            onAddReferenceImages={pg.addReferenceImages}
            onAddReferenceImage={pg.addToReferences}
            onRemoveReferenceImage={pg.removeReferenceImage}
            onGenerate={pg.generate}
            onCancel={pg.cancelGeneration}
            onDraftBatchOverride={setDraftBatchOverride}
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
            draftBatchOverride={draftBatchOverride}
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
    <div className="hidden md:flex h-screen gap-6">
      {/* Left sidebar — collapsible
          Layer 1 (outer): width transition + tooltip positioning context, no overflow clip
          Layer 2 (inner): overflow-hidden clips content during width animation             */}
      <div
        className={`relative shrink-0
                    transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]
                    ${sidebarCollapsed ? 'w-10' : 'w-[200px]'}`}
      >
        {/* 🍌 — visible when collapsed, positioned in Layer 1 (no overflow clip) */}
        <div
          className={`absolute top-4 left-0 w-10 flex justify-center pointer-events-none
                      transition-opacity duration-200
                      ${sidebarCollapsed ? 'opacity-100' : 'opacity-0'}`}
        >
          <span className="text-base leading-none select-none">🍌</span>
        </div>

        {/* Layer 2: content clip + border */}
        <div className="h-full overflow-hidden bg-surface-container border-r border-outline/10 flex flex-col py-4 pb-14 pl-4">
          {/* Title — fades out when collapsed */}
          <div className="mb-4 shrink-0">
            <h1
              className={`text-sm font-medium text-on-surface whitespace-nowrap
                          transition-opacity duration-200
                          ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}
            >
              Nano Banana Playground
            </h1>
          </div>

          {/* ControlPanel — fades out when collapsed */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto transition-opacity duration-200
                        ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <ControlPanel
              model={pg.model}
              resolution={pg.resolution}
              aspectRatio={pg.aspectRatio}
              apiKey={pg.apiKey}
              apiKeyStatus={pg.apiKeyStatus}
              onSubmitApiKey={pg.submitApiKey}
              onResetApiKey={pg.resetApiKey}
              onSwitchModel={pg.switchModel}
              onResolutionChange={pg.setResolution}
              onAspectRatioChange={pg.setAspectRatio}
            />
          </div>
        </div>

        {/* Theme toggle — absolute bottom-left, outside overflow clip, tooltip unclipped */}
        <div
          className={`absolute bottom-4 left-4 z-10 transition-opacity duration-200
                      ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <div className="relative group">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              {themeIcon}
            </button>
            <div
              className="absolute left-0 bottom-full mb-2
                         pointer-events-none whitespace-nowrap
                         bg-on-surface text-surface text-xs px-2 py-1 rounded
                         opacity-0 group-hover:opacity-100
                         transition-opacity duration-150 delay-500
                         z-50"
            >
              {theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            </div>
          </div>
        </div>

        {/* Collapse toggle — absolute bottom-right, always visible, tooltip unclipped */}
        <div className="absolute bottom-4 right-1 z-10">
          <div className="relative group">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              {collapseIcon}
            </button>
            <div
              className="absolute right-0 bottom-full mb-2
                         pointer-events-none whitespace-nowrap
                         bg-on-surface text-surface text-xs px-2 py-1 rounded
                         opacity-0 group-hover:opacity-100
                         transition-opacity duration-150 delay-500
                         z-50"
            >
              {sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
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
        onBatchCountChange={pg.setBatchCount}
        onAddReferenceImages={pg.addReferenceImages}
        onAddReferenceImage={pg.addToReferences}
        onRemoveReferenceImage={pg.removeReferenceImage}
        onGenerate={pg.generate}
        onCancel={pg.cancelGeneration}
        onDraftBatchOverride={setDraftBatchOverride}
      />

      <OutputPanel
        history={pg.history}
        generationState={pg.generationState}
        generationSnapshot={pg.generationSnapshot}
        showDraft={pg.showDraft}
        error={pg.error}
        batchCount={pg.batchCount}
        draftBatchOverride={draftBatchOverride}
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
