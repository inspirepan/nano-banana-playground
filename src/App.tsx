import { Agentation } from 'agentation'
import { useState, useLayoutEffect, useRef, useCallback, useMemo } from 'react'

import type { AgentImageTask } from './agent'
import { Icon } from './components/Icon'
import { InputPanel } from './components/InputPanel'
import { OutputPanel } from './components/OutputPanel'
import { SettingsDialog } from './components/SettingsDialog'
import {
  DEFAULT_SANS_FONT,
  SANS_FONT_IDS,
  SANS_FONTS,
  googleFontPreviewsHref,
  googleFontsHref,
  type SansFontId,
} from './config/fonts'
import {
  isLanguagePreference,
  LANGUAGE_STORAGE_KEY,
  resolveLanguagePreference,
  type LanguagePreference,
} from './config/languages'
import { COLOR_THEME_IDS, type ColorThemeId, type Theme } from './config/theme'
import { useExternalSync, useMediaQuery, useMountEffect } from './hooks/effects'
import { usePlayground } from './hooks/usePlayground'
import { createTranslator, I18nProvider } from './i18n'
import type { PlaygroundImageMeta } from './lib/types'

const BASE_TITLE = 'Imagine Playground'
const TITLE_RESET_DELAY_MS = 8000
const GOOGLE_FONTS_LINK_ID = 'nano-banana-google-fonts'
const GOOGLE_FONT_PREVIEWS_LINK_ID = 'nano-banana-google-font-previews'
const DESKTOP_INPUT_PANEL_WIDTH = '480px'
const DESKTOP_AGENT_PANEL_WIDE_WIDTH = 'clamp(480px, 75vw, calc(100vw - 300px))'
const DESKTOP_AGENT_PANEL_WIDE_PADDING_X = '128px'
const DESKTOP_AGENT_PANEL_SIDEBAR_MEDIA = '(min-width: 1760px)'

type SettingsTarget = 'generationConcurrency'
type MobileTab = 'generate' | 'agent' | 'gallery'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nano-banana-theme')
  const theme = stored === 'light' || stored === 'warm' || stored === 'dark' || stored === 'system' ? stored : 'system'
  if (theme === 'warm') document.documentElement.classList.add('warm')
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
  return theme
}

function getInitialColorTheme(): ColorThemeId {
  const stored = localStorage.getItem('nano-banana-color-theme')
  const id = stored && (COLOR_THEME_IDS as string[]).includes(stored) ? (stored as ColorThemeId) : 'orange'
  if (id !== 'default') document.documentElement.classList.add(`theme-${id}`)
  return id
}

function getInitialSansFont(): SansFontId {
  const stored = localStorage.getItem('nano-banana-sans-font')
  const id = stored && (SANS_FONT_IDS as string[]).includes(stored) ? (stored as SansFontId) : DEFAULT_SANS_FONT
  document.documentElement.classList.add(
    SANS_FONTS.find((font) => font.id === id)?.className ?? SANS_FONTS[0].className,
  )
  return id
}

function getInitialLanguagePreference(): LanguagePreference {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isLanguagePreference(stored) ? stored : 'auto'
}

function getInitialAgentPanelWide(): boolean {
  return localStorage.getItem('nano-banana-agent-panel-wide') === '1'
}

function ensureGoogleFontsPreconnect() {
  let preconnect = document.querySelector<HTMLLinkElement>('link[data-nano-banana-fonts-preconnect="fonts-googleapis"]')
  if (!preconnect) {
    preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = 'https://fonts.googleapis.com'
    preconnect.dataset.nanoBananaFontsPreconnect = 'fonts-googleapis'
    document.head.appendChild(preconnect)
  }

  let gstatic = document.querySelector<HTMLLinkElement>('link[data-nano-banana-fonts-preconnect="fonts-gstatic"]')
  if (!gstatic) {
    gstatic = document.createElement('link')
    gstatic.rel = 'preconnect'
    gstatic.href = 'https://fonts.gstatic.com'
    gstatic.crossOrigin = 'anonymous'
    gstatic.dataset.nanoBananaFontsPreconnect = 'fonts-gstatic'
    document.head.appendChild(gstatic)
  }
}

function ensureGoogleFontsLink(id: string, href: string) {
  ensureGoogleFontsPreconnect()
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  link.href = href
}

function App() {
  const pg = usePlayground()
  const { addToReferences, restoreGeneratedImageParams, rerollGeneratedImage, retryGenerationSlot } = pg
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [colorTheme, setColorTheme] = useState<ColorThemeId>(getInitialColorTheme)
  const [sansFont, setSansFont] = useState<SansFontId>(getInitialSansFont)
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(getInitialLanguagePreference)
  const [browserLanguages, setBrowserLanguages] = useState<readonly string[]>(() => navigator.languages)
  const [regenToast, setRegenToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => (pg.inputMode === 'agent' ? 'agent' : 'generate'))
  const [agentPanelWide, setAgentPanelWide] = useState(getInitialAgentPanelWide)
  const agentPanelSidebarFits = useMediaQuery(DESKTOP_AGENT_PANEL_SIDEBAR_MEDIA)
  const [highlightStackId, setHighlightStackId] = useState<string | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const regenToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleResetTimerRef = useRef<number | null>(null)
  const prevActiveQueueRef = useRef(0)
  const mobilePanelScrollRef = useRef<HTMLDivElement>(null)
  const queueSummary = pg.generationQueueSummary
  const queueActive = queueSummary.queued + queueSummary.running + queueSummary.retrying
  const queueDone = queueSummary.succeeded + queueSummary.failed + queueSummary.canceled
  const language = resolveLanguagePreference(languagePreference, browserLanguages)
  const t = useMemo(() => createTranslator(language), [language])
  const useWideAgentPanel = pg.inputMode === 'agent' && agentPanelWide && agentPanelSidebarFits
  const desktopInputPanelWidth = useWideAgentPanel ? DESKTOP_AGENT_PANEL_WIDE_WIDTH : DESKTOP_INPUT_PANEL_WIDTH

  const toggleAgentPanelWide = useCallback(() => {
    setAgentPanelWide((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nano-banana-agent-panel-wide', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const handleAddToRef = useCallback(
    (image: PlaygroundImageMeta) => {
      void addToReferences(image)
    },
    [addToReferences],
  )

  const handleRegenerate = useCallback(
    async (image: PlaygroundImageMeta) => {
      const result = await restoreGeneratedImageParams(image)
      if (result === null) return
      const message = result.restoredModel
        ? result.refCount > 0
          ? t('app.toast.restoredPromptParamsRefs', { count: result.refCount })
          : t('app.toast.restoredPromptParams')
        : result.refCount > 0
          ? t('app.toast.restoredUnavailableModelPromptRefs', { count: result.refCount })
          : t('app.toast.restoredUnavailableModelPrompt')
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
    },
    [restoreGeneratedImageParams, t],
  )

  const handleReroll = useCallback(
    async (image: PlaygroundImageMeta) => {
      const result = await rerollGeneratedImage(image).catch(() => ({ status: 'unavailable' as const }))
      const message =
        result.status === 'queued'
          ? t('app.toast.rerollQueued')
          : result.status === 'unsupported-mask'
            ? t('app.toast.rerollUnsupportedMask')
            : t('app.toast.rerollFailed')
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
      return { ok: result.status === 'queued', message }
    },
    [rerollGeneratedImage, t],
  )

  const handleRetryGenerationSlot = useCallback(
    (jobId: string, slotId: string) => {
      const result = retryGenerationSlot(jobId, slotId)
      const message = result.status === 'queued' ? t('app.toast.retryQueued') : t('app.toast.retryFailed')
      if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
      setRegenToast(message)
      regenToastTimer.current = setTimeout(() => setRegenToast(null), 2500)
      return { ok: result.status === 'queued', message }
    },
    [retryGenerationSlot, t],
  )

  const openSettings = useCallback((target: SettingsTarget | null = null) => {
    setSettingsTarget(target)
    setSettingsOpen(true)
  }, [])

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

  const handleFocusAgentImageTask = useCallback(
    (task: AgentImageTask) => {
      let stackId = task.request.stackId
      if (!stackId && task.generationJobId) {
        const job = pg.generationJobs.find((item) => item.id === task.generationJobId)
        stackId = job?.stackId ?? undefined
      }
      if (!stackId) return
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        setMobileTab('gallery')
      }
      setHighlightStackId(stackId)
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightStackId((prev) => (prev === stackId ? null : prev))
        highlightTimerRef.current = null
      }, 1800)
    },
    [pg.generationJobs],
  )

  useLayoutEffect(() => {
    const root = document.documentElement
    COLOR_THEME_IDS.forEach((id) => root.classList.remove(`theme-${id}`))
    if (colorTheme !== 'default') root.classList.add(`theme-${colorTheme}`)
    localStorage.setItem('nano-banana-color-theme', colorTheme)
  }, [colorTheme])

  useLayoutEffect(() => {
    const root = document.documentElement
    SANS_FONTS.forEach((font) => root.classList.remove(font.className))
    root.classList.add(SANS_FONTS.find((font) => font.id === sansFont)?.className ?? SANS_FONTS[0].className)
    ensureGoogleFontsLink(GOOGLE_FONTS_LINK_ID, googleFontsHref(sansFont))
    if (settingsOpen) {
      ensureGoogleFontsLink(GOOGLE_FONT_PREVIEWS_LINK_ID, googleFontPreviewsHref())
    } else {
      document.getElementById(GOOGLE_FONT_PREVIEWS_LINK_ID)?.remove()
    }
    localStorage.setItem('nano-banana-sans-font', sansFont)
  }, [sansFont, settingsOpen])

  useLayoutEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languagePreference)
    document.documentElement.lang = language
  }, [language, languagePreference])

  useExternalSync(() => {
    const updateBrowserLanguages = () => setBrowserLanguages(navigator.languages)
    window.addEventListener('languagechange', updateBrowserLanguages)
    return () => window.removeEventListener('languagechange', updateBrowserLanguages)
  }, [])

  useLayoutEffect(() => {
    mobilePanelScrollRef.current?.scrollTo({ top: 0 })
  }, [mobileTab])

  useExternalSync(() => {
    const root = document.documentElement
    const applyDark = (isDark: boolean) => {
      root.classList.remove('warm')
      root.classList.toggle('dark', isDark)
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }
    const applyWarm = () => {
      root.classList.remove('dark')
      root.classList.add('warm')
      root.style.colorScheme = 'light'
    }
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => applyDark(mq.matches)
      apply()
      mq.addEventListener('change', apply)
      localStorage.setItem('nano-banana-theme', 'system')
      return () => mq.removeEventListener('change', apply)
    }
    if (theme === 'warm') {
      applyWarm()
      localStorage.setItem('nano-banana-theme', theme)
      return
    }
    applyDark(theme === 'dark')
    localStorage.setItem('nano-banana-theme', theme)
  }, [theme])

  useExternalSync(() => {
    const clearTitleResetTimer = () => {
      if (!titleResetTimerRef.current) return
      window.clearTimeout(titleResetTimerRef.current)
      titleResetTimerRef.current = null
    }

    if (queueActive > 0) {
      clearTitleResetTimer()
      document.title =
        queueSummary.total > 0
          ? t('app.title.generatingProgress', { done: queueDone, total: queueSummary.total, app: BASE_TITLE })
          : t('app.title.generating', { app: BASE_TITLE })
    } else if (prevActiveQueueRef.current > 0) {
      clearTitleResetTimer()
      if (queueSummary.failed > 0 && queueSummary.succeeded === 0) {
        document.title = t('app.title.failed', { app: BASE_TITLE })
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else if (queueSummary.total > 0 && queueDone === queueSummary.total) {
        document.title = t('app.title.completed', { app: BASE_TITLE })
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
  }, [queueActive, queueDone, queueSummary.failed, queueSummary.succeeded, queueSummary.total, t])

  useMountEffect(() => {
    return () => {
      if (titleResetTimerRef.current) window.clearTimeout(titleResetTimerRef.current)
      document.title = BASE_TITLE
    }
  })

  const handleGenerate = () => {
    pg.generate()
    if (window.innerWidth < 768) {
      setMobileTab('gallery')
    }
  }

  return (
    <I18nProvider preference={languagePreference} browserLanguages={browserLanguages}>
      {/* Mobile layout */}
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-(--color-bg) md:hidden">
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="mb-2 flex min-h-[30px] items-center gap-2.5">
            <div className="min-w-0 font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)">
              {t('app.name')}
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => openSettings()}
              className="icon-btn"
              title={t('common.settings')}
              aria-label={t('common.settings')}
            >
              <Icon name="settings" size={14} />
            </button>
          </div>
          <div
            className="segmented"
            style={{
              ['--seg-count' as string]: 3,
              ['--seg-index' as string]: mobileTab === 'generate' ? 0 : mobileTab === 'agent' ? 1 : 2,
            }}
            aria-label={t('app.mobilePanel')}
          >
            <button type="button" data-active={mobileTab === 'generate'} onClick={() => switchMobileTab('generate')}>
              {t('common.generate')}
            </button>
            <button type="button" data-active={mobileTab === 'agent'} onClick={() => switchMobileTab('agent')}>
              {t('common.agent')}
            </button>
            <button type="button" data-active={mobileTab === 'gallery'} onClick={() => switchMobileTab('gallery')}>
              {t('common.gallery')}
            </button>
          </div>
        </div>

        <div ref={mobilePanelScrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {mobileTab !== 'gallery' ? (
            <div className="px-3">
              <InputPanel
                inputMode={mobileTab === 'agent' ? 'agent' : 'generate'}
                model={pg.model}
                resolution={pg.resolution}
                aspectRatio={pg.aspectRatio}
                batchCount={pg.batchCount}
                options={pg.options}
                prompt={pg.prompt}
                agentModels={pg.agentModels}
                agentModel={pg.agentModel}
                agentThinkingLevel={pg.agentThinkingLevel}
                agentMessages={pg.agentMessages}
                agentMessageMetadata={pg.agentMessageMetadata}
                agentStreamingMessage={pg.agentStreamingMessage}
                agentIsStreaming={pg.agentIsStreaming}
                agentError={pg.agentError}
                agentDraft={pg.agentDraft}
                agentAttachments={pg.agentAttachments}
                agentAttachmentError={pg.agentAttachmentError}
                agentSessions={pg.agentSessions}
                currentAgentSessionId={pg.currentAgentSessionId}
                agentSessionsLoading={pg.agentSessionsLoading}
                autoApproveAgentImageTasks={pg.autoApproveAgentImageTasks}
                agentImageTasks={pg.agentImageTasks}
                agentPendingQuestions={pg.agentPendingQuestions}
                agentSkills={pg.agentSkills}
                history={pg.history}
                generationJobs={pg.generationJobs}
                referenceImages={pg.referenceImages}
                referenceImageError={pg.referenceImageError}
                apiKey={pg.apiKey}
                apiKeyStatus={pg.apiKeyStatus}
                keyStatuses={pg.keyStatuses}
                showHeader={false}
                onOpenApiKeys={() => openSettings()}
                onInputModeChange={switchInputMode}
                onSwitchModel={pg.switchModel}
                onResolutionChange={pg.setResolution}
                onAspectRatioChange={pg.setAspectRatio}
                onPromptChange={pg.setPrompt}
                onAgentModelChange={pg.setAgentModelId}
                onAgentThinkingLevelChange={pg.setAgentThinkingLevel}
                onAgentDraftChange={pg.setAgentDraft}
                onAddAgentAttachments={pg.addAgentAttachments}
                onAddAgentImageAttachment={pg.addAgentImageAttachment}
                onRemoveAgentAttachment={pg.removeAgentAttachment}
                onClearAgentAttachmentError={pg.clearAgentAttachmentError}
                onCreateAgentSession={pg.createAgentSession}
                onSwitchAgentSession={pg.switchAgentSession}
                onDeleteAgentSession={pg.deleteAgentSession}
                onToggleAutoApproveAgentImageTasks={pg.setAutoApproveAgentImageTasks}
                onApproveAgentImageTask={pg.approveAgentImageTask}
                onCancelAgentImageTask={pg.cancelAgentImageTask}
                onSubmitAgentQuestionAnswers={pg.submitAgentQuestionAnswers}
                onCancelAgentQuestion={pg.cancelAgentQuestion}
                onFocusAgentImageTask={handleFocusAgentImageTask}
                onSendAgentMessage={pg.sendAgentMessage}
                onStopAgentMessage={pg.stopAgentMessage}
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
          ) : (
            <div className="px-3 py-[18px]">
              <OutputPanel
                history={pg.history}
                historyHasMore={pg.historyHasMore}
                generationJobs={pg.generationJobs}
                onCancelGenerationJob={pg.cancelGenerationJob}
                onDismissGenerationJob={pg.dismissGenerationJob}
                onCancelGenerationSlot={pg.cancelGenerationSlot}
                onRetryGenerationSlot={handleRetryGenerationSlot}
                onAddToRef={handleAddToRef}
                onRegenerate={handleRegenerate}
                onReroll={handleReroll}
                onEditImage={pg.editImage}
                onRemove={pg.removeFromHistory}
                onLoadMore={pg.loadMoreHistory}
                highlightStackId={highlightStackId}
                onOpenGenerationSettings={() => openSettings('generationConcurrency')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-(--color-bg)">
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          {/* Left input panel */}
          <div
            className="shrink-0 flex flex-col overflow-y-auto [scrollbar-gutter:stable] bg-(--color-bg) shadow-[inset_-1px_0_0_var(--ring-edge-soft)] transition-[width] duration-[280ms] ease-[cubic-bezier(0.22,0.8,0.4,1)] motion-reduce:transition-none"
            style={{
              width: desktopInputPanelWidth,
              ['--agent-panel-padding-x' as string]: useWideAgentPanel ? DESKTOP_AGENT_PANEL_WIDE_PADDING_X : undefined,
            }}
          >
            <InputPanel
              inputMode={pg.inputMode}
              model={pg.model}
              resolution={pg.resolution}
              aspectRatio={pg.aspectRatio}
              batchCount={pg.batchCount}
              options={pg.options}
              prompt={pg.prompt}
              agentModels={pg.agentModels}
              agentModel={pg.agentModel}
              agentThinkingLevel={pg.agentThinkingLevel}
              agentMessages={pg.agentMessages}
              agentMessageMetadata={pg.agentMessageMetadata}
              agentStreamingMessage={pg.agentStreamingMessage}
              agentIsStreaming={pg.agentIsStreaming}
              agentError={pg.agentError}
              agentDraft={pg.agentDraft}
              agentAttachments={pg.agentAttachments}
              agentAttachmentError={pg.agentAttachmentError}
              agentSessions={pg.agentSessions}
              currentAgentSessionId={pg.currentAgentSessionId}
              agentSessionsLoading={pg.agentSessionsLoading}
              autoApproveAgentImageTasks={pg.autoApproveAgentImageTasks}
              agentImageTasks={pg.agentImageTasks}
              agentPendingQuestions={pg.agentPendingQuestions}
              agentSkills={pg.agentSkills}
              history={pg.history}
              generationJobs={pg.generationJobs}
              referenceImages={pg.referenceImages}
              referenceImageError={pg.referenceImageError}
              apiKey={pg.apiKey}
              apiKeyStatus={pg.apiKeyStatus}
              keyStatuses={pg.keyStatuses}
              showAgentSessionSidebar={useWideAgentPanel}
              onOpenApiKeys={() => openSettings()}
              onInputModeChange={switchInputMode}
              onSwitchModel={pg.switchModel}
              onResolutionChange={pg.setResolution}
              onAspectRatioChange={pg.setAspectRatio}
              onPromptChange={pg.setPrompt}
              onAgentModelChange={pg.setAgentModelId}
              onAgentThinkingLevelChange={pg.setAgentThinkingLevel}
              onAgentDraftChange={pg.setAgentDraft}
              onAddAgentAttachments={pg.addAgentAttachments}
              onAddAgentImageAttachment={pg.addAgentImageAttachment}
              onRemoveAgentAttachment={pg.removeAgentAttachment}
              onClearAgentAttachmentError={pg.clearAgentAttachmentError}
              onCreateAgentSession={pg.createAgentSession}
              onSwitchAgentSession={pg.switchAgentSession}
              onDeleteAgentSession={pg.deleteAgentSession}
              onToggleAutoApproveAgentImageTasks={pg.setAutoApproveAgentImageTasks}
              onApproveAgentImageTask={pg.approveAgentImageTask}
              onCancelAgentImageTask={pg.cancelAgentImageTask}
              onSubmitAgentQuestionAnswers={pg.submitAgentQuestionAnswers}
              onCancelAgentQuestion={pg.cancelAgentQuestion}
              onFocusAgentImageTask={handleFocusAgentImageTask}
              onSendAgentMessage={pg.sendAgentMessage}
              onStopAgentMessage={pg.stopAgentMessage}
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

          {pg.inputMode === 'agent' && (
            <button
              type="button"
              onClick={toggleAgentPanelWide}
              title={agentPanelWide ? t('app.action.collapseAgentPanel') : t('app.action.expandAgentPanel')}
              aria-label={agentPanelWide ? t('app.action.collapseAgentPanel') : t('app.action.expandAgentPanel')}
              aria-pressed={agentPanelWide}
              className="agent-panel-width-toggle"
              style={{ left: desktopInputPanelWidth }}
            >
              <Icon name={agentPanelWide ? 'chevron_left' : 'chevron_right'} size={14} strokeWidth={1.8} />
            </button>
          )}

          {/* Right output panel */}
          <OutputPanel
            history={pg.history}
            historyHasMore={pg.historyHasMore}
            generationJobs={pg.generationJobs}
            onCancelGenerationJob={pg.cancelGenerationJob}
            onDismissGenerationJob={pg.dismissGenerationJob}
            onCancelGenerationSlot={pg.cancelGenerationSlot}
            onRetryGenerationSlot={handleRetryGenerationSlot}
            onAddToRef={handleAddToRef}
            onRegenerate={handleRegenerate}
            onReroll={handleReroll}
            onEditImage={pg.editImage}
            onRemove={pg.removeFromHistory}
            onLoadMore={pg.loadMoreHistory}
            onOpenGenerationSettings={() => openSettings('generationConcurrency')}
            highlightStackId={highlightStackId}
          />
          {import.meta.env.DEV && <Agentation />}
        </div>
      </div>

      {/* Regen toast — bottom center */}
      <div
        className={`pointer-events-none fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300
        ${regenToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        <div className="rounded-md bg-(--color-surface) px-4 py-2 text-base font-medium text-(--color-text) shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)] whitespace-nowrap">
          {regenToast}
        </div>
      </div>

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
        onAgentSkillEnabledChange={pg.setAgentSkillEnabled}
        onDeleteAgentSkill={pg.deleteAgentSkill}
        onClose={() => setSettingsOpen(false)}
      />
    </I18nProvider>
  )
}

export default App
