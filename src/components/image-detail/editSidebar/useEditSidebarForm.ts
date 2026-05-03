import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { MODEL_CONFIGS, DEFAULT_MODEL, type ModelConfig } from '../../../config/models'
import { useI18n } from '../../../i18n'
import { getEditState, setEditPrompt } from '../../../lib/editStateCache'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../../lib/types'

// Rotating example prompts for the edit textarea.
const EDIT_PROMPT_EXAMPLE_KEYS = [
  'imageDetail.editPrompt.example.background',
  'imageDetail.editPrompt.example.coat',
  'imageDetail.editPrompt.example.cup',
  'imageDetail.editPrompt.example.film',
  'imageDetail.editPrompt.example.sideView',
]

export type EditSidebarForm = {
  sourceModel: ModelConfig
  modelId: string
  resolution: string
  setResolution: Dispatch<SetStateAction<string>>
  aspectRatio: string
  setAspectRatio: Dispatch<SetStateAction<string>>
  batchCount: number
  setBatchCount: Dispatch<SetStateAction<number>>
  prompt: string
  setPrompt: (value: string) => void
  extraRefs: PlaygroundImage[]
  setExtraRefs: Dispatch<SetStateAction<PlaygroundImage[]>>
  refsError: string | null
  setRefsError: Dispatch<SetStateAction<string | null>>
  submitError: string | null
  setSubmitError: Dispatch<SetStateAction<string | null>>
  submitting: boolean
  setSubmitting: Dispatch<SetStateAction<boolean>>
  paramsCollapsed: boolean
  setParamsCollapsed: Dispatch<SetStateAction<boolean>>
  placeholder: string
  handleModelChange: (id: string) => void
  removeExtraRef: (id: string) => void
  clearExtraRefs: () => void
}

export function useEditSidebarForm(sourceImage: PlaygroundImageMeta): EditSidebarForm {
  const { t } = useI18n()

  // Resolve the model / resolution / aspect ratio / options that generated the
  // source. For uploads, fall back to the default model's defaults.
  const sourceDefaultModel = useMemo(() => {
    const src = sourceImage.source
    if (src.type !== 'generated') return DEFAULT_MODEL
    return MODEL_CONFIGS.find((m) => m.id === src.modelId) ?? DEFAULT_MODEL
  }, [sourceImage])

  const sourceRes =
    sourceImage.source.type === 'generated' ? sourceImage.source.resolution : sourceDefaultModel.defaultResolution
  const sourceAspect =
    sourceImage.source.type === 'generated' ? sourceImage.source.aspectRatio : sourceDefaultModel.defaultAspectRatio

  const [modelId, setModelId] = useState(sourceDefaultModel.id)
  const sourceModel = useMemo(
    () => MODEL_CONFIGS.find((model) => model.id === modelId) ?? sourceDefaultModel,
    [modelId, sourceDefaultModel],
  )

  const [resolution, setResolution] = useState(() =>
    sourceDefaultModel.resolutions.includes(sourceRes) ? sourceRes : sourceDefaultModel.defaultResolution,
  )
  const [aspectRatio, setAspectRatio] = useState(() =>
    sourceDefaultModel.aspectRatios.includes(sourceAspect) ? sourceAspect : sourceDefaultModel.defaultAspectRatio,
  )
  const [batchCount, setBatchCount] = useState(1)
  // Prompt text is cached per source image so users who close the modal
  // mid-edit (or switch between images via the pager) don't lose what they
  // were writing.
  const [prompt, setPromptState] = useState(() => getEditState(sourceImage.id).prompt)
  const setPrompt = useCallback(
    (next: string) => {
      setPromptState(next)
      setEditPrompt(sourceImage.id, next)
    },
    [sourceImage.id],
  )
  const [extraRefs, setExtraRefs] = useState<PlaygroundImage[]>([])
  const [refsError, setRefsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Editing rarely needs resolution / aspect changes, so collapse by default.
  const [paramsCollapsed, setParamsCollapsed] = useState(true)

  const handleModelChange = useCallback((id: string) => {
    const nextModel = MODEL_CONFIGS.find((model) => model.id === id)
    if (!nextModel) return
    setModelId(id)
    setResolution((prev) => (nextModel.resolutions.includes(prev) ? prev : nextModel.defaultResolution))
    setAspectRatio((prev) => (nextModel.aspectRatios.includes(prev) ? prev : nextModel.defaultAspectRatio))
    setBatchCount((prev) => Math.min(prev, nextModel.maxBatchCount))
  }, [])

  // Pick a stable placeholder example per source image.
  const placeholder = useMemo(() => {
    const hash = Array.from(sourceImage.id).reduce((a, c) => (a + c.charCodeAt(0)) | 0, 0)
    const exampleKey = EDIT_PROMPT_EXAMPLE_KEYS[Math.abs(hash) % EDIT_PROMPT_EXAMPLE_KEYS.length]
    return t('imageDetail.editPrompt.placeholder', { example: t(exampleKey) })
  }, [sourceImage.id, t])

  const removeExtraRef = useCallback((id: string) => {
    setExtraRefs((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearExtraRefs = useCallback(() => {
    setExtraRefs([])
    setRefsError(null)
  }, [])

  return {
    sourceModel,
    modelId,
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
  }
}
