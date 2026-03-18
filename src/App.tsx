import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Agentation } from 'agentation'
import { usePlayground } from './hooks/usePlayground'
import type { PlaygroundImageMeta } from './lib/types'
import { InputPanel } from './components/InputPanel'
import { OutputPanel } from './components/OutputPanel'
import { AppTitle } from './components/AppTitle'

type Theme = 'light' | 'dark' | 'system'
type ColorThemeId = 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple'

const BASE_TITLE = 'Nano Banana Playground'
const TITLE_RESET_DELAY_MS = 8000

const COLOR_THEMES: { id: ColorThemeId; name: string; color: string }[] = [
  { id: 'default', name: '默认', color: '#9e9e9e' },
  { id: 'blue',    name: '蓝色', color: '#1976d2' },
  { id: 'green',   name: '绿色', color: '#388e3c' },
  { id: 'yellow',  name: '黄色', color: '#fdd835' },
  { id: 'pink',    name: '粉色', color: '#e91e63' },
  { id: 'orange',  name: '橙色', color: '#f57c00' },
  { id: 'purple',  name: '紫色', color: '#7b1fa2' },
]
const COLOR_THEME_IDS = COLOR_THEMES.map((t) => t.id)

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nano-banana-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function getInitialColorTheme(): ColorThemeId {
  const stored = localStorage.getItem('nano-banana-color-theme')
  const id = stored && (COLOR_THEME_IDS as string[]).includes(stored) ? (stored as ColorThemeId) : 'default'
  // Apply immediately to avoid flash
  if (id !== 'default') document.documentElement.classList.add(`theme-${id}`)
  return id
}

function ThemeSettings({ theme, colorTheme, onThemeChange, onColorThemeChange }: {
  theme: Theme
  colorTheme: ColorThemeId
  onThemeChange: (t: Theme) => void
  onColorThemeChange: (id: ColorThemeId) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const BRIGHTNESS: { value: Theme; icon: string; label: string }[] = [
    { value: 'light',  icon: 'light_mode', label: '浅色' },
    { value: 'dark',   icon: 'dark_mode',  label: '深色' },
    { value: 'system', icon: 'contrast',   label: '跟随系统' },
  ]

  const currentIcon = BRIGHTNESS.find((b) => b.value === theme)?.icon ?? 'contrast'

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors
          ${open ? 'bg-on-surface/12 text-on-surface' : 'hover:bg-on-surface/8 active:bg-on-surface/12 text-on-surface-variant'}`}
      >
        <span className="material-symbols-rounded text-[18px]">{currentIcon}</span>
      </button>

      {/* Popover — portaled to body to escape backdrop-filter containing block */}
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 w-44 rounded-2xl bg-surface/40 backdrop-blur-xl shadow-lg border border-outline/10 py-2">
          {/* Brightness */}
          <p className="px-4 pt-1 pb-2 text-xs font-medium text-on-surface-variant">外观</p>
          <div className="flex gap-1 px-3 pb-3">
            {BRIGHTNESS.map(({ value, icon, label }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => onThemeChange(value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition-colors
                  ${theme === value
                    ? 'bg-primary-dim text-primary'
                    : 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12'}`}
              >
                <span className="material-symbols-rounded text-[12px]">{icon}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-outline/10 mx-2 mb-1" />

          {/* Color */}
          <p className="px-4 pt-2 pb-1 text-xs font-medium text-on-surface-variant">颜色</p>
          {COLOR_THEMES.map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => { onColorThemeChange(ct.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                ${colorTheme === ct.id
                  ? 'bg-primary-dim text-primary font-medium'
                  : 'text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12'}`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />
              {ct.name}
              {colorTheme === ct.id && (
                <span className="material-symbols-rounded text-sm ml-auto">check</span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function App() {
  const pg = usePlayground()
  const {
    addToReferences,
    history: pgHistory,
    restoreSession,
    resolveFullImages,
    setMode,
    switchModel,
    setResolution,
    setAspectRatio,
  } = pg
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [colorTheme, setColorTheme] = useState<ColorThemeId>(getInitialColorTheme)
  const [draftBatchOverride, setDraftBatchOverride] = useState<number | null>(null)
  const [draftLabels, setDraftLabels] = useState<string[] | null>(null)
  const [draftPreviewHover, setDraftPreviewHover] = useState(false)
  const [regenToast, setRegenToast] = useState<string | null>(null)
  const regenToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleResetTimerRef = useRef<number | null>(null)
  const prevGenerationStateRef = useRef(pg.generationState)
  const lastGenerationProgressRef = useRef({ done: 0, total: 0 })

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
    switchModel(meta.modelId)
    setResolution(meta.resolution)
    setAspectRatio(meta.aspectRatio)
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
  }, [pgHistory, resolveFullImages, restoreSession, setAspectRatio, setMode, setResolution, switchModel])
  // Apply color theme class to <html> — useLayoutEffect so CSS vars update
  // before AppTitle's useEffect reads --color-primary for the sweep
  useLayoutEffect(() => {
    const root = document.documentElement
    COLOR_THEME_IDS.forEach((id) => root.classList.remove(`theme-${id}`))
    if (colorTheme !== 'default') root.classList.add(`theme-${colorTheme}`)
    localStorage.setItem('nano-banana-color-theme', colorTheme)
  }, [colorTheme])

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

  useEffect(() => {
    const clearTitleResetTimer = () => {
      if (!titleResetTimerRef.current) return
      window.clearTimeout(titleResetTimerRef.current)
      titleResetTimerRef.current = null
    }

    const prevGenerationState = prevGenerationStateRef.current

    if (pg.generationState === 'generating') {
      clearTitleResetTimer()
      const total = pg.generationPreview.length
      const done = pg.generationPreview.filter((slot) => slot.status !== 'pending').length
      lastGenerationProgressRef.current = { done, total }
      document.title = total > 0
        ? `〔${done}/${total}〕◐ 生成中 · ${BASE_TITLE}`
        : `◐ 生成中 · ${BASE_TITLE}`
    } else if (prevGenerationState === 'generating' && pg.generationState === 'idle') {
      clearTitleResetTimer()
      const { done, total } = lastGenerationProgressRef.current
      if (total > 0 && done === total) {
        document.title = `✓ 已完成 · ${BASE_TITLE}`
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else {
        document.title = BASE_TITLE
      }
    } else if (pg.generationState === 'error') {
      clearTitleResetTimer()
      document.title = `✕ 生成失败 · ${BASE_TITLE}`
      titleResetTimerRef.current = window.setTimeout(() => {
        document.title = BASE_TITLE
        titleResetTimerRef.current = null
      }, TITLE_RESET_DELAY_MS)
    } else {
      clearTitleResetTimer()
      document.title = BASE_TITLE
    }

    prevGenerationStateRef.current = pg.generationState
  }, [pg.generationState, pg.generationPreview])

  useEffect(() => {
    return () => {
      if (titleResetTimerRef.current) window.clearTimeout(titleResetTimerRef.current)
      document.title = BASE_TITLE
    }
  }, [])

  // Wrap generate to scroll output into view on mobile
  const handleGenerate = (prompts?: string[]) => {
    pg.generate(prompts)
    if (window.innerWidth < 768) {
      setTimeout(() => {
        mobileOutputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  return (
    <>
    {/* Mobile layout */}
    <div className="flex flex-col h-[100dvh] md:hidden overflow-y-auto">
      {/* Top bar — sticky so content scrolls behind it */}
      <div className="sticky top-0 z-10 flex items-center px-4 pt-3 pb-2 bg-surface/20 backdrop-blur-md header-fade">
        <AppTitle className="text-xl text-title" sweepKey={colorTheme} />
        <div className="flex-1" />
        <ThemeSettings theme={theme} colorTheme={colorTheme} onThemeChange={setTheme} onColorThemeChange={setColorTheme} />
      </div>
      {/* Content — no longer its own scroll container */}
      <div className="px-4">
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
          onGenerate={handleGenerate}
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
      {/* Left input panel — scroll container, header floats above content */}
      <div className="w-1/3 min-w-[400px] shrink-0 flex flex-col h-screen border-r border-outline/10 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Header: app title + color swatches + theme toggle — sticky so content scrolls behind it */}
        <div className="sticky top-0 z-10 flex items-center px-4 pt-3 pb-2 bg-surface/20 backdrop-blur-md header-fade">
          <AppTitle className="text-xl text-title" sweepKey={colorTheme} />
          <div className="flex-1" />
          <ThemeSettings theme={theme} colorTheme={colorTheme} onThemeChange={setTheme} onColorThemeChange={setColorTheme} />
        </div>
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
          onGenerate={handleGenerate}
          onCancel={pg.cancelGeneration}
          onDraftBatchOverride={handleDraftBatchOverride}
          onDraftPreviewHover={setDraftPreviewHover}
          onDraftLabelsOverride={setDraftLabels}
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
