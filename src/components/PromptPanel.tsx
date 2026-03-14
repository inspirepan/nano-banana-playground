import type { PlaygroundImage } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { ReferenceImageUpload } from './ReferenceImageUpload'

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

  return (
    <div className="w-full md:w-[300px] md:shrink-0 flex flex-col gap-4 overflow-y-auto py-4">
      {/* Reference Images */}
      <ReferenceImageUpload
        images={referenceImages}
        maxTotal={maxRef}
        onAdd={onAddReferenceImages}
        onAddImage={onAddReferenceImage}
        onRemove={onRemoveReferenceImage}
      />

      {/* Prompt */}
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-3">提示词</label>
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
