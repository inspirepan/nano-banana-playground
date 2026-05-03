import { useCallback, type RefObject } from 'react'

import type { ModelConfig } from '../../../config/models'
import { useI18n } from '../../../i18n'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../../lib/types'
import type { DrawableLayerHandle } from '../DrawableLayer'
import type { EditImageHandler } from '../EditSidebar'

type Params = {
  canSubmit: boolean
  onEditImage: EditImageHandler
  sourceImage: PlaygroundImageMeta
  sourceModel: ModelConfig
  prompt: string
  extraRefs: PlaygroundImage[]
  resolution: string
  aspectRatio: string
  inheritedOptions: Record<string, unknown>
  batchCount: number
  drawableRef: RefObject<DrawableLayerHandle | null>
  hasAnnotatedSource: boolean
  hasOpenAIMask: boolean
  isOpenAI: boolean
  onSetActiveBatchId: (id: string | null, sourceImageId?: string) => void
  setPrompt: (value: string) => void
  setSubmitError: (value: string | null) => void
  setSubmitting: (value: boolean) => void
  onSubmitSuccess?: () => void
}

export function useEditSubmit(params: Params) {
  const {
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
  } = params
  const { t } = useI18n()

  return useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Gemini needs visual marks baked into a reference image. OpenAI gets a
      // native alpha mask for brush strokes; numbered annotations still travel
      // as a separate visual reference.
      let annotatedSource: PlaygroundImage | undefined
      let mask: PlaygroundImage | undefined
      const drawable = drawableRef.current
      const needsDrawableExport = hasAnnotatedSource || hasOpenAIMask
      if (needsDrawableExport && (!drawable || !drawable.isReady())) {
        setSubmitError(t('imageDetail.error.imageStillLoading'))
        return
      }
      if (drawable && hasAnnotatedSource) {
        const out = isOpenAI ? await drawable.exportAnnotated() : await drawable.exportMarkedComposite()
        if (!out) {
          setSubmitError(t('imageDetail.error.annotationExportFailed'))
          return
        }
        annotatedSource = {
          id: crypto.randomUUID(),
          data: out.base64,
          mimeType: out.mimeType,
          source: { type: 'upload', fileName: 'annotated.png' },
          timestamp: Date.now(),
        }
      }
      if (drawable && hasOpenAIMask) {
        if (sourceModel.provider === 'openai') {
          const out = await drawable.exportMaskAlpha()
          if (!out) {
            setSubmitError(t('imageDetail.error.maskExportFailed'))
            return
          }
          mask = {
            id: crypto.randomUUID(),
            data: out.base64,
            mimeType: out.mimeType,
            source: { type: 'upload', fileName: 'mask.png' },
            timestamp: Date.now(),
          }
        }
      }

      const batchId = await onEditImage({
        sourceImage,
        model: sourceModel,
        prompt,
        extraReferences: extraRefs,
        resolution,
        aspectRatio,
        options: inheritedOptions,
        batchCount,
        annotatedSource,
        mask,
      })
      if (batchId) {
        onSetActiveBatchId(batchId, sourceImage.id)
        setPrompt('')
        onSubmitSuccess?.()
        // Intentionally do NOT clear strokes here — the user usually iterates
        // on the same annotations across multiple generations.
      }
    } finally {
      setSubmitting(false)
    }
  }, [
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
    onSetActiveBatchId,
    setPrompt,
    onSubmitSuccess,
    drawableRef,
    hasAnnotatedSource,
    hasOpenAIMask,
    isOpenAI,
    setSubmitError,
    setSubmitting,
    t,
  ])
}
