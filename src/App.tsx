import { useState, useEffect } from 'react'
import { usePlayground } from './hooks/usePlayground'
import { TopBar } from './components/TopBar'
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

  return (
    <div className="h-screen flex flex-col">
      <TopBar theme={theme} onToggleTheme={toggleTheme} />

      <div className="flex-1 flex gap-6 min-h-0 px-8 pb-4">
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
          onEdit={pg.editImage}
          onAddToRef={pg.addToReferences}
          onRemove={pg.removeFromHistory}
          onClearAll={pg.clearAllHistory}
        />
      </div>
    </div>
  )
}

export default App
