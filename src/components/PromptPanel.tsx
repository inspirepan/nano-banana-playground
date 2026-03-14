import { useState, useRef, useCallback } from 'react'
import type { PlaygroundImage, StructuredPrompt } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { augmentPrompt } from '../lib/api'
import { ReferenceImageUpload } from './ReferenceImageUpload'
import { StructuredPromptForm } from './StructuredPromptForm'

type PromptMode = 'text' | 'augmenting' | 'structured'

const EMPTY_STRUCTURED: StructuredPrompt = {
  subject: '',
  action: '',
  scene: '',
  composition: '',
  style: '',
  lighting: '',
  colorPalette: '',
  textInImage: '',
  constraints: '',
}

function assemblePrompt(fields: StructuredPrompt): string {
  const parts: string[] = []
  if (fields.subject) parts.push(fields.subject)
  if (fields.action) parts.push(fields.action)
  if (fields.scene) parts.push(fields.scene)
  if (fields.composition) parts.push(`构图：${fields.composition}`)
  if (fields.style) parts.push(`风格：${fields.style}`)
  if (fields.lighting) parts.push(`光影：${fields.lighting}`)
  if (fields.colorPalette) parts.push(`色彩：${fields.colorPalette}`)
  if (fields.textInImage) parts.push(`画面中的文字："${fields.textInImage}"`)
  if (fields.constraints) parts.push(`避免：${fields.constraints}`)
  return parts.filter((p) => p.trim()).join('。')
}

type Props = {
  model: ModelConfig
  resolution: string
  batchCount: number
  prompt: string
  referenceImages: PlaygroundImage[]
  generationState: GenerationState
  apiKey: string
  onPromptChange: (v: string) => void
  onAddReferenceImages: (files: File[]) => void
  onAddReferenceImage: (image: PlaygroundImage) => void
  onRemoveReferenceImage: (id: string) => void
  onGenerate: () => void
  onCancel: () => void
}

export function PromptPanel({
  model,
  resolution,
  batchCount,
  prompt,
  referenceImages,
  generationState,
  apiKey,
  onPromptChange,
  onAddReferenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onGenerate,
  onCancel,
}: Props) {
  const isGenerating = generationState === 'generating'
  const canGenerate = apiKey.trim() !== '' && prompt.trim() !== '' && !isGenerating
  const maxRef = model.maxReferenceImages + model.maxCharacterImages

  const pricePerImage = model.imagePriceByResolution[resolution]
  const estimatedCost = pricePerImage !== undefined ? pricePerImage * batchCount : null

  const [mode, setMode] = useState<PromptMode>('text')
  const [structuredFields, setStructuredFields] = useState<StructuredPrompt>(EMPTY_STRUCTURED)
  const [augmentError, setAugmentError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Snapshot of the assembled prompt when last in structured mode
  const assembledRef = useRef<string | null>(null)

  const canAugment = apiKey.trim() !== '' && prompt.trim() !== ''
  // Cache is valid if fields exist and user hasn't edited the textarea since leaving structured mode
  const hasCachedFields = assembledRef.current !== null && prompt === assembledRef.current

  const handleAugment = useCallback(async () => {
    if (!canAugment) return
    setMode('augmenting')
    setAugmentError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await augmentPrompt(apiKey, prompt, controller.signal)
      setStructuredFields(result)
      const assembled = assemblePrompt(result)
      assembledRef.current = assembled
      onPromptChange(assembled)
      setMode('structured')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setAugmentError((e as Error).message)
        setMode('text')
      }
    }
  }, [apiKey, prompt, canAugment, onPromptChange])

  const handleCancelAugment = useCallback(() => {
    abortRef.current?.abort()
    setMode('text')
  }, [])

  const handleFieldChange = useCallback(
    (fields: StructuredPrompt) => {
      setStructuredFields(fields)
      const assembled = assemblePrompt(fields)
      assembledRef.current = assembled
      onPromptChange(assembled)
    },
    [onPromptChange],
  )

  const handleRestoreStructured = useCallback(() => {
    setMode('structured')
  }, [])

  const handleBackToText = useCallback(() => {
    // Keep structuredFields cached so user can switch back without re-calling API
    setMode('text')
  }, [])

  return (
    <div className="w-full md:w-[360px] md:shrink-0 flex flex-col gap-4 overflow-y-auto py-4 pr-4">
      {/* Reference Images */}
      <ReferenceImageUpload
        images={referenceImages}
        maxTotal={maxRef}
        onAdd={onAddReferenceImages}
        onAddImage={onAddReferenceImage}
        onRemove={onRemoveReferenceImage}
      />

      {/* Prompt area -- mode-dependent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-on-surface-variant">
            提示词
          </label>
          {mode === 'structured' && (
            <button
              type="button"
              onClick={handleBackToText}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              返回文本编辑
            </button>
          )}
        </div>

        {mode === 'text' && (
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="描述你想生成的图片..."
              rows={8}
              className="w-full px-3 py-2.5 text-sm bg-surface-container rounded-xl
                         border-b-2 border-b-outline-variant
                         hover:bg-surface-container-high hover:border-b-outline
                         focus:bg-surface-container-high focus:border-b-primary focus:outline-none
                         placeholder:text-on-surface-variant/50 resize-y transition-colors"
            />
            {/* Bottom-right action: restore cached structured fields, or augment via API */}
            {hasCachedFields ? (
              <button
                type="button"
                onClick={handleRestoreStructured}
                className="absolute right-2 bottom-3 flex items-center gap-1
                           px-2.5 py-1 text-xs rounded-full transition-colors
                           bg-primary-dim text-primary hover:bg-primary hover:text-on-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.001 1.001 0 0 0 0-1.41l-2.34-2.34a1.001 1.001 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
                结构化编辑
              </button>
            ) : canAugment ? (
              <button
                type="button"
                onClick={handleAugment}
                className="absolute right-2 bottom-3 flex items-center gap-1
                           px-2.5 py-1 text-xs rounded-full transition-colors
                           bg-primary-dim text-primary hover:bg-primary hover:text-on-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.46 8l.79-1.75L22 5.46c.39-.18.39-.73 0-.91l-1.75-.79L19.46 2c-.18-.39-.73-.39-.91 0l-.79 1.75-1.76.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.74.39.92 0zM11.5 9.5L9.91 6c-.35-.78-1.47-.78-1.82 0L6.5 9.5 3 11.09c-.78.36-.78 1.47 0 1.82l3.5 1.59L8.09 18c.36.78 1.47.78 1.82 0l1.59-3.5 3.5-1.59c.78-.36.78-1.47 0-1.82L11.5 9.5zm7.04 6.5l-.79 1.75-1.75.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.73.39.91 0l.79-1.75 1.76-.79c.39-.18.39-.73 0-.91l-1.75-.79-.79-1.76c-.18-.39-.74-.39-.92 0z" />
                </svg>
                增强
              </button>
            ) : null}
          </div>
        )}

        {mode === 'augmenting' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8
                          bg-surface-container rounded-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-on-surface-variant">正在分析提示词...</p>
            <button
              type="button"
              onClick={handleCancelAugment}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              取消
            </button>
          </div>
        )}

        {mode === 'structured' && (
          <StructuredPromptForm
            fields={structuredFields}
            onChange={handleFieldChange}
          />
        )}

        {augmentError && (
          <p className="mt-2 text-xs text-error">{augmentError}</p>
        )}
      </div>

      {/* Generate Button */}
      <div className="relative group/btn shrink-0">
        <button
          type="button"
          onClick={isGenerating ? onCancel : onGenerate}
          disabled={!isGenerating && !canGenerate}
          className={`w-full py-2.5 text-sm font-medium rounded-full transition-colors
            ${
              isGenerating
                ? 'bg-error text-on-primary hover:bg-error/90'
                : canGenerate
                  ? 'bg-primary text-on-primary hover:bg-primary-hover'
                  : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'
            }`}
        >
          {isGenerating ? '取消' : '生成'}
        </button>
        {/* Tooltip: only shown when disabled due to missing API key */}
        {!isGenerating && !apiKey.trim() && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5
                          bg-on-surface text-surface text-xs rounded-lg
                          whitespace-nowrap pointer-events-none
                          opacity-0 group-hover/btn:opacity-100 transition-opacity">
            请先配置 API 密钥
          </div>
        )}
      </div>

      {/* Cost estimate */}
      {estimatedCost !== null && (
        <p className="text-center text-xs text-on-surface-variant/60 -mt-2">
          预估费用约 ${estimatedCost.toFixed(3)}
          <span className="ml-1 opacity-70">({batchCount} 张 × ${pricePerImage!.toFixed(3)})</span>
        </p>
      )}
    </div>
  )
}
