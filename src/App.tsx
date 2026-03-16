import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Agentation } from 'agentation'
import { usePlayground } from './hooks/usePlayground'
import type { PlaygroundImageMeta } from './lib/types'
import { ControlPanel } from './components/ControlPanel'
import { PromptPanel } from './components/PromptPanel'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (window.innerWidth < 1280) return true
    return localStorage.getItem('nano-banana-sidebar-collapsed') === 'true'
  })
  const mobileRefAreaRef = useRef<HTMLDivElement>(null)
  const mobileOutputAreaRef = useRef<HTMLDivElement>(null)

  const handleAddToRef = useCallback((image: PlaygroundImageMeta) => {
    addToReferences(image)
    // On mobile, scroll to the reference image upload area after adding
    if (window.innerWidth < 768) {
      setTimeout(() => {
        mobileRefAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
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

  // Auto-collapse sidebar when viewport drops below xl (1280px)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const handle = (e: MediaQueryListEvent) => {
      if (!e.matches) setSidebarCollapsed(true)
    }
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [])

  // Cycles light → dark → system → light for the mobile top-bar button
  const cycleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'))

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
      <span className={`material-symbols-rounded text-[18px] transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
        sidebarCollapsed ? 'rotate-180' : ''
      }`}>chevron_left</span>
    ),
    [sidebarCollapsed]
  )

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
            mode={pg.mode}
            schemes={pg.schemes}
            currentSchemeIndex={pg.currentSchemeIndex}
            originalPrompt={pg.originalPrompt}
            referenceImages={pg.referenceImages}
            generationState={pg.generationState}
            apiKey={pg.apiKey}
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
        </div>
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

    {/* Desktop layout */}
    <div className="hidden md:flex h-screen gap-6">
      {/* Left sidebar — collapsible
          Layer 1 (outer): width transition + tooltip positioning context, no overflow clip
          Layer 2 (inner): overflow-hidden clips content during width animation             */}
      <div
        className={`relative shrink-0
                    transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]
                    ${sidebarCollapsed ? 'w-10' : 'w-[240px]'}`}
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
            <AppTitle
              className={`text-xl text-on-surface whitespace-nowrap
                          transition-opacity duration-200
                          ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}
            />
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

        {/* Theme segmented button — MD3 spec: outlined container, dividers, primary-dim selected */}
        <div
          className={`absolute bottom-4 left-4 z-10 transition-opacity duration-200
                      ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          {/* overflow-hidden removed — individual corner rounding lets tooltips escape */}
          <div className="flex items-center h-8 rounded-full border border-outline">
            {([
              { t: 'light' as const, label: '浅色', icon: 'light_mode' },
              { t: 'dark' as const, label: '深色', icon: 'dark_mode' },
              { t: 'system' as const, label: '跟随系统', icon: 'contrast' },
            ]).map(({ t, label, icon }, i, arr) => (
              <div key={t} className="relative group/theme">
                <button
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`w-8 h-8 flex items-center justify-center transition-colors
                    ${i === 0 ? 'rounded-l-full' : i === arr.length - 1 ? 'rounded-r-full' : ''}
                    ${i > 0 ? 'border-l border-outline' : ''}
                    ${theme === t
                      ? 'bg-primary-dim text-primary hover:bg-primary/15 active:bg-primary/20'
                      : 'bg-transparent text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12 hover:text-on-surface'
                    }`}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}>{icon}</span>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                pointer-events-none whitespace-nowrap
                                bg-on-surface text-surface text-xs px-2 py-1 rounded
                                opacity-0 group-hover/theme:opacity-100
                                transition-opacity duration-150 delay-500
                                z-50">
                  {label}
                </div>
              </div>
            ))}
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
                         hover:bg-on-surface/8 active:bg-on-surface/12 transition-colors text-on-surface-variant"
            >
              {collapseIcon}
            </button>
            <div
              className="absolute left-0 bottom-full mb-2
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
        mode={pg.mode}
        schemes={pg.schemes}
        currentSchemeIndex={pg.currentSchemeIndex}
        originalPrompt={pg.originalPrompt}
        referenceImages={pg.referenceImages}
        generationState={pg.generationState}
        apiKey={pg.apiKey}
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
