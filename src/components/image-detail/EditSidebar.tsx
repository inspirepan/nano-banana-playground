import { useCallback, useMemo, type RefObject } from 'react'

import { type BrushPresetId } from './annotationPresets'
import type { DrawableLayerHandle, DrawTool } from './DrawableLayer'
import { EditAnnotationControls } from './editSidebar/EditAnnotationControls'
import { EditBatchCount } from './editSidebar/EditBatchCount'
import { EditFooterCta } from './editSidebar/EditFooterCta'
import { EditParamsCollapse } from './editSidebar/EditParamsCollapse'
import { EditPromptField } from './editSidebar/EditPromptField'
import { useDrawableExportPreview } from './editSidebar/useDrawableExportPreview'
import { useEditJobTracker } from './editSidebar/useEditJobTracker'
import { useEditSidebarForm } from './editSidebar/useEditSidebarForm'
import { useEditSubmit } from './editSidebar/useEditSubmit'
import { defaultOptionsFor, type ModelConfig } from '../../config/models'
import { useWindowEvent } from '../../hooks/effects'
import type { GenerationJob } from '../../hooks/usePlayground'
import { useI18n } from '../../i18n'
import { type ItemCounts } from '../../lib/editStateCache'
import { readFileAsImageData } from '../../lib/fileToImage'
import { getPrimaryModifierShortcutLabel, hasPrimaryModifier } from '../../lib/keyboard'
import { getPricePerImage } from '../../lib/pricing'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../lib/types'
import { ReferenceImageUpload, type LockedReferenceImage } from '../ReferenceImageUpload'

export type EditImageHandler = (params: {
  sourceImage: PlaygroundImageMeta
  model: ModelConfig
  prompt: string
  extraReferences: PlaygroundImage[]
  resolution: string
  aspectRatio: string
  options: Record<string, unknown>
  batchCount: number
  annotatedSource?: PlaygroundImage
  mask?: PlaygroundImage
}) => Promise<string | null>

type EditSidebarProps = {
  sourceImage: PlaygroundImageMeta
  generationJobs: GenerationJob[]
  activeEditBatchId: string | null
  onEditImage: EditImageHandler
  onSetActiveBatchId: (id: string | null, sourceImageId?: string) => void
  annotationActive: boolean
  hasAnnotations: boolean
  annotationToolsFloating: boolean
  drawableCounts: ItemCounts
  drawableRef: RefObject<DrawableLayerHandle | null>
  drawTool: DrawTool
  desktopMoveActive: boolean
  brushPreset: BrushPresetId
  onStartAnnotation: () => void
  onFinishAnnotation: () => void
  onClearAnnotations: () => void
  onChangeDrawTool: (tool: DrawTool) => void
  onChangeDesktopMoveActive: (active: boolean) => void
  onChangeBrushPreset: (preset: BrushPresetId) => void
  autoFocusPrompt?: boolean
  submitFooterClassName?: string
  showSubmitShortcut?: boolean
  onSubmitSuccess?: () => void
}

export function EditSidebar({
  sourceImage,
  generationJobs,
  activeEditBatchId,
  onEditImage,
  onSetActiveBatchId,
  annotationActive,
  hasAnnotations,
  annotationToolsFloating,
  drawableCounts,
  drawableRef,
  drawTool,
  desktopMoveActive,
  brushPreset,
  onStartAnnotation,
  onFinishAnnotation,
  onClearAnnotations,
  onChangeDrawTool,
  onChangeDesktopMoveActive,
  onChangeBrushPreset,
  autoFocusPrompt = true,
  submitFooterClassName = 'pt-2.5 shadow-[inset_0_1px_0_var(--ring-edge-soft)]',
  showSubmitShortcut = true,
  onSubmitSuccess,
}: EditSidebarProps) {
  const { t } = useI18n()

  const {
    sourceModel,
    resolution,
    setResolution,
    aspectRatio,
    setAspectRatio,
    batchCount,
    setBatchCount,
    prompt,
    setPrompt,
    extraRefs,
    setExtraRefs,
    refsError,
    setRefsError,
    submitError,
    setSubmitError,
    submitting,
    setSubmitting,
    paramsCollapsed,
    setParamsCollapsed,
    placeholder,
    handleModelChange,
    removeExtraRef,
    clearExtraRefs,
  } = useEditSidebarForm(sourceImage)

  const hasAnnotationStrokes = drawableCounts.annotate > 0
  const hasMaskStrokes = drawableCounts.mask > 0
  const isOpenAI = sourceModel.provider === 'openai'
  const hasOpenAIMask = hasMaskStrokes && isOpenAI
  const hasAnnotatedSource = isOpenAI ? hasAnnotationStrokes : hasAnnotationStrokes || hasMaskStrokes
  const maxReferenceImages = sourceModel.maxReferenceImages + sourceModel.maxCharacterImages
  const maxExtraRefs = Math.max(0, maxReferenceImages - 1 - (hasAnnotatedSource ? 1 : 0))
  const referenceLimitExceeded = extraRefs.length > maxExtraRefs
  const effectiveRefsError = referenceLimitExceeded ? t('imageDetail.error.referenceLimitWithAnnotation') : refsError

  const handleAddFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const remaining = maxExtraRefs - extraRefs.length
      if (remaining <= 0) return
      const results = await Promise.allSettled(
        files.slice(0, remaining).map(async (file) => {
          const result = await readFileAsImageData(file)
          if (!result) return null
          const { base64, mimeType, fileName } = result
          return {
            id: crypto.randomUUID(),
            data: base64,
            mimeType,
            source: { type: 'upload' as const, fileName },
            timestamp: Date.now(),
          } as PlaygroundImage
        }),
      )
      const added: PlaygroundImage[] = []
      const errors: string[] = []
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) added.push(r.value)
        else if (r.status === 'rejected') errors.push((r.reason as Error).message)
      }
      if (added.length > 0) setExtraRefs((prev) => [...prev, ...added].slice(0, maxExtraRefs))
      if (errors.length > 0) setRefsError(errors.join('\n'))
    },
    [extraRefs.length, maxExtraRefs, setExtraRefs, setRefsError],
  )

  useEditJobTracker(generationJobs, activeEditBatchId, onSetActiveBatchId)

  // Inherit the source's declared options into the new job. We intentionally
  // don't surface them as editable fields in v1 — they stay silent.
  const inheritedOptions = useMemo(() => {
    const bag = defaultOptionsFor(sourceModel)
    if (sourceImage.source.type === 'generated') {
      const src = sourceImage.source
      if (src.options) Object.assign(bag, src.options)
      if (src.quality !== undefined && bag.quality === undefined) bag.quality = src.quality
      if (src.searchTools?.web && bag.webSearch === undefined) bag.webSearch = true
      if (src.searchTools?.image && bag.imageSearch === undefined) bag.imageSearch = true
    }
    return bag
  }, [sourceImage, sourceModel])

  const pricePerImage = getPricePerImage(sourceModel, resolution, aspectRatio, inheritedOptions)
  const estimatedCost = pricePerImage !== null ? pricePerImage * batchCount : null
  const drawablePreviewKey = `${drawableCounts.annotate}:${drawableCounts.mask}`

  const drawablePreview = useDrawableExportPreview({
    drawableRef,
    drawablePreviewKey,
    hasAnnotatedSource,
    hasOpenAIMask,
    isOpenAI,
    sourceImageId: sourceImage.id,
  })

  // Allow submitting a new edit even while a previous batch is still running.
  // The latest batch stays tracked for auto-navigation; previous jobs keep
  // running in their stack strip.
  const canSubmit = prompt.trim() !== '' && !submitting && !referenceLimitExceeded

  const handleGenerate = useEditSubmit({
    canSubmit,
    onEditImage,
    sourceImage,
    sourceModel,
    prompt,
    extraRefs,
    resolution,
    aspectRatio,
    inheritedOptions,
    batchCount,
    drawableRef,
    hasAnnotatedSource,
    hasOpenAIMask,
    isOpenAI,
    onSetActiveBatchId,
    setPrompt,
    setSubmitError,
    setSubmitting,
    onSubmitSuccess,
  })

  // Primary modifier + Enter to submit. Use capture + stopImmediatePropagation so the
  // background InputPanels (mobile + desktop) don't also fire their own
  // window-level shortcut handlers and trigger duplicate generations.
  useWindowEvent(
    'keydown',
    (e) => {
      if (hasPrimaryModifier(e) && e.key === 'Enter') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (canSubmit) void handleGenerate()
      }
    },
    { capture: true },
  )

  // Count what actually ships to the provider. Visual annotation references
  // take image slots; OpenAI masks travel through the native mask field.
  const visibleDrawablePreview = hasAnnotatedSource || hasOpenAIMask ? drawablePreview : {}
  const lockedReferenceImages: LockedReferenceImage[] = [
    { id: `${sourceImage.id}:source`, image: sourceImage, label: t('imageDetail.lockedReference.source') },
  ]
  if (hasAnnotatedSource)
    lockedReferenceImages.push({
      id: `${sourceImage.id}:annotate`,
      image: sourceImage,
      label: t('imageDetail.lockedReference.annotation'),
      preview: visibleDrawablePreview.annotated,
    })
  if (hasOpenAIMask)
    lockedReferenceImages.push({
      id: `${sourceImage.id}:mask`,
      image: sourceImage,
      label: 'Mask',
      preview: visibleDrawablePreview.mask,
    })

  return (
    <div>
      <EditPromptField prompt={prompt} setPrompt={setPrompt} placeholder={placeholder} autoFocus={autoFocusPrompt} />

      <EditParamsCollapse
        sourceModel={sourceModel}
        resolution={resolution}
        setResolution={setResolution}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        paramsCollapsed={paramsCollapsed}
        setParamsCollapsed={setParamsCollapsed}
        onModelChange={handleModelChange}
      />

      <EditAnnotationControls
        annotationActive={annotationActive}
        hasAnnotations={hasAnnotations}
        annotationToolsFloating={annotationToolsFloating}
        drawTool={drawTool}
        desktopMoveActive={desktopMoveActive}
        brushPreset={brushPreset}
        onStartAnnotation={onStartAnnotation}
        onFinishAnnotation={onFinishAnnotation}
        onClearAnnotations={onClearAnnotations}
        onChangeDrawTool={onChangeDrawTool}
        onChangeDesktopMoveActive={onChangeDesktopMoveActive}
        onChangeBrushPreset={onChangeBrushPreset}
      />

      {/* Extra references */}
      <div className="mb-[18px]">
        <ReferenceImageUpload
          images={extraRefs}
          lockedImages={lockedReferenceImages}
          hint={t('imageDetail.reference.uploadHint', { shortcut: getPrimaryModifierShortcutLabel('V') })}
          maxTotal={maxExtraRefs}
          dragOver={false}
          error={effectiveRefsError}
          onAdd={handleAddFiles}
          onRemove={removeExtraRef}
          onClearAll={clearExtraRefs}
          onClearError={() => setRefsError(null)}
        />
      </div>

      <EditBatchCount batchCount={batchCount} setBatchCount={setBatchCount} maxBatchCount={sourceModel.maxBatchCount} />

      <EditFooterCta
        className={submitFooterClassName}
        estimatedCost={estimatedCost}
        submitError={submitError}
        submitting={submitting}
        canSubmit={canSubmit}
        batchCount={batchCount}
        showSubmitShortcut={showSubmitShortcut}
        onSubmit={handleGenerate}
      />
    </div>
  )
}
