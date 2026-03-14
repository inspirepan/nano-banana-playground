import type { PlaygroundImage } from '../lib/types'
import type { ModelConfig } from '../config/models'
import type { GenerationState } from '../hooks/usePlayground'
import { ReferenceImageUpload } from './ReferenceImageUpload'

type Props = {
  model: ModelConfig
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

  return (
    <div className="w-[300px] shrink-0 flex flex-col gap-4 overflow-y-auto">
      {/* Reference Images */}
      <ReferenceImageUpload
        images={referenceImages}
        maxTotal={maxRef}
        onAdd={onAddReferenceImages}
        onAddImage={onAddReferenceImage}
        onRemove={onRemoveReferenceImage}
      />

      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-on-surface-variant">提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="描述你想生成的图片..."
          rows={8}
          className="w-full px-3 py-2.5 text-sm bg-surface-container rounded-xl border border-outline-variant
                     focus:border-primary focus:outline-none
                     placeholder:text-on-surface-variant/50 resize-y"
        />
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={isGenerating ? onCancel : onGenerate}
        disabled={!isGenerating && !canGenerate}
        className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors shrink-0
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
    </div>
  )
}
