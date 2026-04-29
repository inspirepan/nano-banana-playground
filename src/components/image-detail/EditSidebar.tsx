import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { BrushPresetDot } from './annotationControls'
import { BRUSH_PRESETS, type BrushPresetId } from './annotationPresets'
import type { DrawableLayerHandle, DrawTool } from './DrawableLayer'
import { MODEL_CONFIGS, DEFAULT_MODEL, defaultOptionsFor, type ModelConfig } from '../../config/models'
import { useExternalSync, useWindowEvent } from '../../hooks/effects'
import type { GenerationJob } from '../../hooks/usePlayground'
import { getEditState, setEditPrompt, type ItemCounts } from '../../lib/editStateCache'
import { readFileAsImageData } from '../../lib/fileToImage'
import { openAISize } from '../../lib/openai'
import { getPricePerImage } from '../../lib/pricing'
import type { PlaygroundImage, PlaygroundImageMeta } from '../../lib/types'
import { AspectRatioSelector } from '../AspectRatioSelector'
import { ChipGroup } from '../ChipGroup'
import { Icon } from '../Icon'
import { ReferenceImageUpload, type LockedReferenceImage } from '../ReferenceImageUpload'

function OpenAILogo({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M22.28 9.82a5.95 5.95 0 0 0-.51-4.91 6.04 6.04 0 0 0-6.5-2.9A6.06 6.06 0 0 0 4.98 4.18a5.99 5.99 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.9 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.2 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.08Zm-9.02 12.63a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .39-.68v-6.74L17.7 12.3a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.48 4.51Zm-9.64-4.12a4.48 4.48 0 0 1-.54-3.03l.14.09 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.78 20a4.51 4.51 0 0 1-6.16-1.65Zm-1.19-9.9a4.5 4.5 0 0 1 2.35-1.98v5.68a.78.78 0 0 0 .39.67l5.8 3.35-2.2 1.27a.08.08 0 0 1-.08 0l-4.83-2.79a4.51 4.51 0 0 1-1.43-6.2Zm16.6 3.86L13.24 9 15.43 7.73a.07.07 0 0 1 .08 0l4.83 2.79a4.5 4.5 0 0 1-.68 8.12v-5.69a.78.78 0 0 0-.4-.67Zm2.18-3.27-.14-.09-4.77-2.77a.79.79 0 0 0-.79 0L9.57 9.54V7.2a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.67Zm-12.64 4.5-2.19-1.26a.07.07 0 0 1-.04-.06V6.63a4.5 4.5 0 0 1 7.38-3.47l-.14.08L8.8 6a.78.78 0 0 0-.39.68ZM9.76 11l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5Z" />
    </svg>
  )
}

function getModelShortLabel(model: ModelConfig) {
  if (model.provider === 'openai') return model.name
  return model.name.replace(/^Nano\s+/, '')
}

function InlineParamDivider() {
  return <span aria-hidden className="meta-dot text-(--color-text-4)" />
}

// Rotating example prompts for the edit textarea.
const EDIT_PROMPT_EXAMPLES = [
  '把背景换成日落海边',
  '将外套改成米色风衣',
  '去掉桌上的杯子',
  '整体色调调成复古胶片感',
  '人物改成侧面视角',
]

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
}: EditSidebarProps) {
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
  const [drawablePreview, setDrawablePreview] = useState<{ annotated?: PlaygroundImage; mask?: PlaygroundImage }>({})
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
    return `例：${EDIT_PROMPT_EXAMPLES[Math.abs(hash) % EDIT_PROMPT_EXAMPLES.length]}`
  }, [sourceImage.id])

  const hasAnnotationStrokes = drawableCounts.annotate > 0
  const hasMaskStrokes = drawableCounts.mask > 0
  const isOpenAI = sourceModel.provider === 'openai'
  const hasOpenAIMask = hasMaskStrokes && isOpenAI
  const hasAnnotatedSource = isOpenAI ? hasAnnotationStrokes : hasAnnotationStrokes || hasMaskStrokes
  const maxReferenceImages = sourceModel.maxReferenceImages + sourceModel.maxCharacterImages
  const maxExtraRefs = Math.max(0, maxReferenceImages - 1 - (hasAnnotatedSource ? 1 : 0))
  const referenceLimitExceeded = extraRefs.length > maxExtraRefs
  const effectiveRefsError = referenceLimitExceeded
    ? '当前标注会占用一个参考图名额，请移除一张参考图后再提交'
    : refsError

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
    [extraRefs.length, maxExtraRefs],
  )

  const removeExtraRef = useCallback((id: string) => {
    setExtraRefs((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearExtraRefs = useCallback(() => {
    setExtraRefs([])
    setRefsError(null)
  }, [])

  const activeJob = useMemo(() => {
    if (!activeEditBatchId) return null
    return generationJobs.find((j) => j.id === activeEditBatchId) ?? null
  }, [activeEditBatchId, generationJobs])

  // Clear activeEditBatchId when the job it points to is fully terminal, or
  // when it has dropped off the active jobs list (e.g. pruned after completion).
  useExternalSync(() => {
    if (!activeEditBatchId) return
    if (!activeJob) {
      onSetActiveBatchId(null)
      return
    }
    const anyActive = activeJob.slots.some(
      (s) => s.status === 'queued' || s.status === 'running' || s.status === 'retrying',
    )
    if (!anyActive) onSetActiveBatchId(null)
  }, [activeJob, activeEditBatchId, onSetActiveBatchId])

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

  useExternalSync(() => {
    if (drawablePreviewKey === '0:0' || (!hasAnnotatedSource && !hasOpenAIMask)) return

    let cancelled = false
    void (async () => {
      let drawable = drawableRef.current
      for (let i = 0; i < 20 && !cancelled && !drawable?.isReady(); i++) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 80)
        })
        drawable = drawableRef.current
      }
      if (cancelled) return
      if (!drawable?.isReady()) {
        setDrawablePreview({})
        return
      }

      try {
        const next: { annotated?: PlaygroundImage; mask?: PlaygroundImage } = {}
        if (hasAnnotatedSource) {
          const out = isOpenAI ? await drawable.exportAnnotated() : await drawable.exportMarkedComposite()
          if (out) {
            next.annotated = {
              id: `${sourceImage.id}:annotated-preview`,
              data: out.base64,
              mimeType: out.mimeType,
              source: { type: 'upload', fileName: 'annotated-preview.png' },
              timestamp: Date.now(),
            }
          }
        }
        if (hasOpenAIMask) {
          const out = await drawable.exportMaskRedOverlay()
          if (out) {
            next.mask = {
              id: `${sourceImage.id}:mask-preview`,
              data: out.base64,
              mimeType: out.mimeType,
              source: { type: 'upload', fileName: 'mask-preview.png' },
              timestamp: Date.now(),
            }
          }
        }
        if (!cancelled) setDrawablePreview(next)
      } catch {
        if (!cancelled) setDrawablePreview({})
      }
    })()

    return () => {
      cancelled = true
    }
  }, [drawablePreviewKey, drawableRef, hasAnnotatedSource, hasOpenAIMask, isOpenAI, sourceImage.id])

  // Allow submitting a new edit even while a previous batch is still running.
  // The latest batch stays tracked for auto-navigation; previous jobs keep
  // running in their stack strip.
  const canSubmit = prompt.trim() !== '' && !submitting && !referenceLimitExceeded

  const handleGenerate = useCallback(async () => {
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
        setSubmitError('图片仍在加载，请稍后再提交')
        return
      }
      if (drawable && hasAnnotatedSource) {
        const out = isOpenAI ? await drawable.exportAnnotated() : await drawable.exportMarkedComposite()
        if (!out) {
          setSubmitError('标注导出失败，请稍后再试')
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
            setSubmitError('Mask 导出失败，请稍后再试')
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
    drawableRef,
    hasAnnotatedSource,
    hasOpenAIMask,
    isOpenAI,
  ])

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight + 2, 96)}px`
  }, [prompt])

  // Cmd+Enter to submit when focused inside the edit panel.
  useWindowEvent('keydown', (e) => {
    if (e.metaKey && e.key === 'Enter') {
      e.preventDefault()
      if (canSubmit) void handleGenerate()
    }
  })

  // Count what actually ships to the provider. Visual annotation references
  // take image slots; OpenAI masks travel through the native mask field.
  const visibleDrawablePreview = hasAnnotatedSource || hasOpenAIMask ? drawablePreview : {}
  const lockedReferenceImages: LockedReferenceImage[] = [
    { id: `${sourceImage.id}:source`, image: sourceImage, label: '原图' },
  ]
  if (hasAnnotatedSource)
    lockedReferenceImages.push({
      id: `${sourceImage.id}:annotate`,
      image: sourceImage,
      label: '标注',
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
      {/* Prompt */}
      <div className="mb-[18px]">
        <div className="label mb-1.5">编辑指令</div>
        <div className="prompt-wrap">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={1}
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-[16px] leading-[1.55] focus:outline-none md:text-base"
            autoFocus
          />
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-(--color-text-3) shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
            <span className="text-sm text-(--color-text-4)">{prompt.length} 字</span>
            <div className="flex-1" />
            {prompt.length > 0 && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-sm text-(--color-text-4) transition-colors hover:text-(--color-text-2)"
              >
                <Icon name="close" size={11} /> 清空
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Model + size params (collapsed by default — rarely adjusted while editing). */}
      <div className="mb-[18px]">
        <button
          type="button"
          onClick={() => setParamsCollapsed((v) => !v)}
          aria-expanded={!paramsCollapsed}
          className="flex items-center w-full bg-transparent border-0 p-0 cursor-pointer min-h-[20px]"
        >
          <span className="flex items-center gap-1.5">
            <span className="label">模型</span>
            <InlineParamDivider />
            <span className="label">分辨率</span>
            <InlineParamDivider />
            <span className="label">宽高比</span>
          </span>
          <span className="flex-1" />
          <span className="mr-1.5 flex items-center gap-1.5 text-sm text-(--color-text-3)">
            <span>{getModelShortLabel(sourceModel)}</span>
            <InlineParamDivider />
            <span>{resolution}</span>
            <InlineParamDivider />
            <span>{aspectRatio}</span>
          </span>
          <Icon name={paramsCollapsed ? 'chevron_right' : 'chevron_down'} size={12} className="text-(--color-text-4)" />
        </button>
        <div
          className="grid"
          style={{
            gridTemplateRows: paramsCollapsed ? '0fr' : '1fr',
            transition: 'grid-template-rows 260ms cubic-bezier(0.22, 0.8, 0.4, 1)',
          }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="pt-2.5">
              <div className="mb-[14px]">
                <div
                  className="segmented"
                  style={{
                    ['--seg-count' as string]: MODEL_CONFIGS.length,
                    ['--seg-index' as string]: Math.max(
                      0,
                      MODEL_CONFIGS.findIndex((model) => model.id === sourceModel.id),
                    ),
                  }}
                >
                  {MODEL_CONFIGS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      data-active={sourceModel.id === model.id}
                      onClick={() => handleModelChange(model.id)}
                      title={model.name}
                    >
                      {model.provider === 'google' ? <span className="text-base">🍌</span> : <OpenAILogo />}
                      <span>{getModelShortLabel(model)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-[14px]">
                <ChipGroup
                  options={sourceModel.resolutions}
                  value={resolution}
                  onChange={setResolution}
                  mono={false}
                  columns={sourceModel.resolutions.length}
                />
              </div>
              <AspectRatioSelector
                options={sourceModel.aspectRatios}
                value={aspectRatio}
                resolution={resolution}
                onChange={setAspectRatio}
                showLabel={false}
                pixelLabel={
                  sourceModel.provider === 'openai'
                    ? (ratio, res) => openAISize(res, ratio).replace('x', '×')
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-[18px]">
        <div className="label mb-1.5">标注</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="chip flex-1 justify-center"
            onClick={annotationActive ? onFinishAnnotation : onStartAnnotation}
          >
            <Icon name={annotationActive ? 'check' : 'brush'} size={13} strokeWidth={1.8} />
            {annotationActive ? '完成标注' : '标注'}
          </button>
          {hasAnnotations && (
            <button type="button" className="chip ghost shrink-0" onClick={onClearAnnotations}>
              清空标注
            </button>
          )}
        </div>
        {annotationActive && !annotationToolsFloating && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[
                { id: 'move' as const, label: '拖动', icon: 'mouse_pointer' as const },
                { id: 'brush' as const, label: '涂抹', icon: 'brush' as const },
                { id: 'step' as const, label: '编号', icon: 'map_pin' as const },
                { id: 'eraser' as const, label: '橡皮', icon: 'eraser' as const },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip shrink-0"
                  data-active={item.id === 'move' ? desktopMoveActive : !desktopMoveActive && drawTool === item.id}
                  onClick={() => {
                    if (item.id === 'move') {
                      onChangeDesktopMoveActive(true)
                    } else {
                      onChangeDrawTool(item.id)
                    }
                  }}
                >
                  <Icon name={item.icon} size={13} strokeWidth={1.8} />
                  {item.label}
                </button>
              ))}
            </div>
            {!desktopMoveActive && drawTool !== 'eraser' && (
              <div className="grid grid-cols-3 gap-1.5">
                {BRUSH_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chip justify-center"
                    data-active={brushPreset === item.id}
                    onClick={() => onChangeBrushPreset(item.id)}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <BrushPresetDot preset={item} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extra references */}
      <div className="mb-[18px]">
        <ReferenceImageUpload
          images={extraRefs}
          lockedImages={lockedReferenceImages}
          hint="可拖入本地图片，或按 ⌘/Ctrl+V 粘贴"
          maxTotal={maxExtraRefs}
          dragOver={false}
          error={effectiveRefsError}
          onAdd={handleAddFiles}
          onRemove={removeExtraRef}
          onClearAll={clearExtraRefs}
          onClearError={() => setRefsError(null)}
        />
      </div>

      {/* Batch count */}
      <div className="mb-[18px]">
        <div className="label mb-1.5">数量</div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sourceModel.maxBatchCount}, 1fr)` }}>
          {Array.from({ length: sourceModel.maxBatchCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="chip justify-center"
              data-active={batchCount === n}
              onClick={() => setBatchCount(n)}
            >
              <span>×{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary + CTA */}
      <div className="pt-2.5 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
        {estimatedCost !== null && (
          <div className="mb-2 text-right text-sm text-(--color-text-2)">≈ ${estimatedCost.toFixed(3)}</div>
        )}
        {submitError && <div className="mb-2 text-sm text-(--color-danger)">{submitError}</div>}
        <button type="button" onClick={handleGenerate} disabled={!canSubmit} className="cta w-full">
          <Icon name="wand" size={13} strokeWidth={1.8} />
          <span>{submitting ? '提交中…' : `生成编辑 ×${batchCount}`}</span>
          <span className="flex-1" />
          <span className="flex gap-0.5">
            <kbd>⌘</kbd>
            <kbd>⏎</kbd>
          </span>
        </button>
      </div>
    </div>
  )
}
