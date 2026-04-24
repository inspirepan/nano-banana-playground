import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Agentation } from 'agentation'
import { usePlayground } from './hooks/usePlayground'
import type { PlaygroundImageMeta } from './lib/types'
import { InputPanel } from './components/InputPanel'
import { OutputPanel } from './components/OutputPanel'
import { ApiKeysDialog } from './components/ApiKeysDialog'
import { Icon, type IconName } from './components/Icon'

type Theme = 'light' | 'dark' | 'system'
type ColorThemeId = 'default' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple' | 'mono'

const BASE_TITLE = 'Nano Banana Playground'
const TITLE_RESET_DELAY_MS = 8000

const COLOR_THEMES: { id: ColorThemeId; name: string; color: string }[] = [
  { id: 'default', name: 'Indigo', color: '#5e6ad2' },
  { id: 'green', name: 'Emerald', color: '#2f9e6a' },
  { id: 'yellow', name: 'Amber', color: '#b87503' },
  { id: 'pink', name: 'Rose', color: '#c4436d' },
  { id: 'orange', name: 'Orange', color: '#c0582a' },
  { id: 'purple', name: 'Violet', color: '#7c56d4' },
  { id: 'mono', name: 'Mono', color: '#1f1d1a' },
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
  if (id !== 'default') document.documentElement.classList.add(`theme-${id}`)
  return id
}

function ThemeSettings({
  theme,
  colorTheme,
  onThemeChange,
  onColorThemeChange,
}: {
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
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
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

  const BRIGHTNESS: { value: Theme; icon: IconName; label: string }[] = [
    { value: 'light', icon: 'light_mode', label: '浅色' },
    { value: 'dark', icon: 'dark_mode', label: '深色' },
    { value: 'system', icon: 'contrast', label: '系统' },
  ]

  const currentIcon = BRIGHTNESS.find((b) => b.value === theme)?.icon ?? 'contrast'

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button ref={buttonRef} type="button" onClick={handleToggle} title="外观" className="icon-btn">
        <Icon name={currentIcon} size={14} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 w-56 rounded-lg bg-(--color-surface) shadow-[0_0_0_1px_var(--ring-edge),0_10px_28px_-12px_rgba(30,27,20,0.18),0_2px_6px_rgba(30,27,20,0.06)] p-2"
          >
            <div className="label px-1.5 pb-1.5">外观</div>
            <div className="flex gap-1 mb-2">
              {BRIGHTNESS.map(({ value, icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onThemeChange(value)}
                  className="chip flex-1 justify-center"
                  data-active={theme === value}
                >
                  <Icon name={icon} size={12} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="label px-1.5 pb-1.5">主色</div>
            <div className="grid grid-cols-7 gap-1.5">
              {COLOR_THEMES.map((ct) => {
                const isDark =
                  theme === 'dark' ||
                  (theme === 'system' &&
                    typeof window !== 'undefined' &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches)
                const swatch = ct.id === 'mono' ? (isDark ? '#f2f1ef' : '#1f1d1a') : ct.color
                return (
                  <button
                    key={ct.id}
                    type="button"
                    title={ct.name}
                    onClick={() => onColorThemeChange(ct.id)}
                    className="aspect-square rounded-[6px] transition-all"
                    style={{
                      background: swatch,
                      boxShadow:
                        colorTheme === ct.id
                          ? `inset 0 0 0 2px var(--color-surface), 0 0 0 2px ${swatch}`
                          : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                    }}
                  />
                )
              })}
            </div>
          </div>,
          document.body,
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
    switchModel,
    setResolution,
    setAspectRatio,
  } = pg
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [colorTheme, setColorTheme] = useState<ColorThemeId>(getInitialColorTheme)
  const [regenToast, setRegenToast] = useState<string | null>(null)
  const [apiKeysOpen, setApiKeysOpen] = useState(false)
  const regenToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleResetTimerRef = useRef<number | null>(null)
  const prevActiveQueueRef = useRef(0)
  const queueSummary = pg.generationQueueSummary
  const queueActive = queueSummary.queued + queueSummary.running + queueSummary.retrying
  const queueDone = queueSummary.succeeded + queueSummary.failed + queueSummary.canceled

  const mobileOutputAreaRef = useRef<HTMLDivElement>(null)

  const handleAddToRef = useCallback(
    (image: PlaygroundImageMeta) => {
      addToReferences(image)
    },
    [addToReferences],
  )

  const handleRegenerate = useCallback(
    async (image: PlaygroundImageMeta) => {
      if (image.source.type !== 'generated') return
      const meta = image.source
      switchModel(meta.modelId)
      setResolution(meta.resolution)
      setAspectRatio(meta.aspectRatio)
      const refMetas = pgHistory.filter((h) => meta.referenceImageIds.includes(h.id))
      const refs = await resolveFullImages(refMetas)
      restoreSession(meta.prompt, refs)
      const message = refs.length > 0 ? `已还原提示词和 ${refs.length} 张参考图` : '已还原提示词'
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
    },
    [pgHistory, resolveFullImages, restoreSession, setAspectRatio, setResolution, switchModel],
  )

  useLayoutEffect(() => {
    const root = document.documentElement
    COLOR_THEME_IDS.forEach((id) => root.classList.remove(`theme-${id}`))
    if (colorTheme !== 'default') root.classList.add(`theme-${colorTheme}`)
    localStorage.setItem('nano-banana-color-theme', colorTheme)
  }, [colorTheme])

  useEffect(() => {
    const root = document.documentElement
    const applyDark = (isDark: boolean) => {
      root.classList.toggle('dark', isDark)
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => applyDark(mq.matches)
      apply()
      mq.addEventListener('change', apply)
      localStorage.setItem('nano-banana-theme', 'system')
      return () => mq.removeEventListener('change', apply)
    }
    applyDark(theme === 'dark')
    localStorage.setItem('nano-banana-theme', theme)
  }, [theme])

  useEffect(() => {
    const clearTitleResetTimer = () => {
      if (!titleResetTimerRef.current) return
      window.clearTimeout(titleResetTimerRef.current)
      titleResetTimerRef.current = null
    }

    if (queueActive > 0) {
      clearTitleResetTimer()
      document.title =
        queueSummary.total > 0
          ? `〔${queueDone}/${queueSummary.total}〕生成中 · ${BASE_TITLE}`
          : `生成中 · ${BASE_TITLE}`
    } else if (prevActiveQueueRef.current > 0) {
      clearTitleResetTimer()
      if (queueSummary.failed > 0 && queueSummary.succeeded === 0) {
        document.title = `生成失败 · ${BASE_TITLE}`
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else if (queueSummary.total > 0 && queueDone === queueSummary.total) {
        document.title = `已完成 · ${BASE_TITLE}`
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else {
        document.title = BASE_TITLE
      }
    } else {
      clearTitleResetTimer()
      document.title = BASE_TITLE
    }

    prevActiveQueueRef.current = queueActive
  }, [queueActive, queueDone, queueSummary.failed, queueSummary.succeeded, queueSummary.total])

  useEffect(() => {
    return () => {
      if (titleResetTimerRef.current) window.clearTimeout(titleResetTimerRef.current)
      document.title = BASE_TITLE
    }
  }, [])

  const handleGenerate = () => {
    pg.generate()
    if (window.innerWidth < 768) {
      setTimeout(() => {
        mobileOutputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  const topbar = (
    <div className="topbar flex items-center gap-2.5 px-4 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        <div className="font-display font-semibold text-[13.5px] tracking-[-0.01em]">Image Generation</div>
        <span className="text-(--color-text-4) text-[12px] ml-0.5">/</span>
        <span className="text-(--color-text-3) text-[12.5px] font-medium">Playground</span>
      </div>

      <div className="flex-1" />

      <button type="button" onClick={() => setApiKeysOpen(true)} className="icon-btn" title="API Keys">
        <Icon name="key" size={14} />
      </button>

      <ThemeSettings
        theme={theme}
        colorTheme={colorTheme}
        onThemeChange={setTheme}
        onColorThemeChange={setColorTheme}
      />
    </div>
  )

  return (
    <>
      {/* Mobile layout */}
      <div className="flex flex-col h-[100dvh] md:hidden overflow-y-auto bg-(--color-bg)">
        {topbar}
        <div className="px-3">
          <InputPanel
            model={pg.model}
            resolution={pg.resolution}
            aspectRatio={pg.aspectRatio}
            batchCount={pg.batchCount}
            options={pg.options}
            prompt={pg.prompt}
            referenceImages={pg.referenceImages}
            referenceImageError={pg.referenceImageError}
            generationQueueSummary={pg.generationQueueSummary}
            apiKey={pg.apiKey}
            apiKeyStatus={pg.apiKeyStatus}
            googleKeyStatus={pg.googleKey.status}
            openaiKeyStatus={pg.openaiKey.status}
            onOpenApiKeys={() => setApiKeysOpen(true)}
            onSwitchModel={pg.switchModel}
            onResolutionChange={pg.setResolution}
            onAspectRatioChange={pg.setAspectRatio}
            onPromptChange={pg.setPrompt}
            onBatchCountChange={pg.setBatchCount}
            onOptionChange={pg.setOption}
            onAddReferenceImages={pg.addReferenceImages}
            onAddReferenceImage={pg.addToReferences}
            onRemoveReferenceImage={pg.removeReferenceImage}
            onClearAllReferences={pg.clearAllReferences}
            onClearReferenceImageError={pg.clearReferenceImageError}
            onGenerate={handleGenerate}
          />
          <div ref={mobileOutputAreaRef} className="border-t border-(--color-border) pt-5">
            <OutputPanel
              history={pg.history}
              historyHasMore={pg.historyHasMore}
              generationJobs={pg.generationJobs}
              generationQueueSummary={pg.generationQueueSummary}
              generationConcurrency={pg.generationConcurrency}
              onGenerationConcurrencyChange={pg.setGenerationConcurrency}
              onCancelGenerationJob={pg.cancelGenerationJob}
              onDismissGenerationJob={pg.dismissGenerationJob}
              onCancelGenerationSlot={pg.cancelGenerationSlot}
              onAddToRef={handleAddToRef}
              onRegenerate={handleRegenerate}
              onEditImage={pg.editImage}
              onRemove={pg.removeFromHistory}
              onClearAll={pg.clearAllHistory}
              onLoadMore={pg.loadMoreHistory}
            />
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-(--color-bg)">
        {topbar}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left input panel */}
          <div className="w-[380px] shrink-0 flex flex-col border-r border-(--color-border) overflow-y-auto [scrollbar-gutter:stable] bg-(--color-bg)">
            <InputPanel
              model={pg.model}
              resolution={pg.resolution}
              aspectRatio={pg.aspectRatio}
              batchCount={pg.batchCount}
              options={pg.options}
              prompt={pg.prompt}
              referenceImages={pg.referenceImages}
              referenceImageError={pg.referenceImageError}
              generationQueueSummary={pg.generationQueueSummary}
              apiKey={pg.apiKey}
              apiKeyStatus={pg.apiKeyStatus}
              googleKeyStatus={pg.googleKey.status}
              openaiKeyStatus={pg.openaiKey.status}
              onOpenApiKeys={() => setApiKeysOpen(true)}
              onSwitchModel={pg.switchModel}
              onResolutionChange={pg.setResolution}
              onAspectRatioChange={pg.setAspectRatio}
              onPromptChange={pg.setPrompt}
              onBatchCountChange={pg.setBatchCount}
              onOptionChange={pg.setOption}
              onAddReferenceImages={pg.addReferenceImages}
              onAddReferenceImage={pg.addToReferences}
              onRemoveReferenceImage={pg.removeReferenceImage}
              onClearAllReferences={pg.clearAllReferences}
              onClearReferenceImageError={pg.clearReferenceImageError}
              onGenerate={handleGenerate}
            />
          </div>

          {/* Right output panel */}
          <OutputPanel
            history={pg.history}
            historyHasMore={pg.historyHasMore}
            generationJobs={pg.generationJobs}
            generationQueueSummary={pg.generationQueueSummary}
            generationConcurrency={pg.generationConcurrency}
            onGenerationConcurrencyChange={pg.setGenerationConcurrency}
            onCancelGenerationJob={pg.cancelGenerationJob}
            onDismissGenerationJob={pg.dismissGenerationJob}
            onCancelGenerationSlot={pg.cancelGenerationSlot}
            onAddToRef={handleAddToRef}
            onRegenerate={handleRegenerate}
            onEditImage={pg.editImage}
            onRemove={pg.removeFromHistory}
            onClearAll={pg.clearAllHistory}
            onLoadMore={pg.loadMoreHistory}
          />
          {import.meta.env.DEV && <Agentation />}
        </div>
      </div>

      {/* Regen toast — bottom center */}
      <div
        className={`pointer-events-none fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300
        ${regenToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        <div className="rounded-md bg-(--color-surface) px-4 py-2 text-[12.5px] font-medium text-(--color-text) shadow-[0_0_0_1px_var(--ring-edge),0_10px_28px_-12px_rgba(30,27,20,0.18),0_2px_6px_rgba(30,27,20,0.06)] whitespace-nowrap">
          {regenToast}
        </div>
      </div>

      <ApiKeysDialog
        open={apiKeysOpen}
        googleKey={pg.googleKey}
        openaiKey={pg.openaiKey}
        onClose={() => setApiKeysOpen(false)}
      />
    </>
  )
}

export default App
