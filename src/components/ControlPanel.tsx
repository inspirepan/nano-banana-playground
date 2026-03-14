import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { ApiKeyInput } from './ApiKeyInput'
import { ChipGroup } from './ChipGroup'
import { AspectRatioSelector } from './AspectRatioSelector'

type Props = {
  model: ModelConfig
  resolution: string
  aspectRatio: string
  batchCount: number
  apiKey: string
  apiKeyStatus: ApiKeyStatus
  onSubmitApiKey: (key: string) => void
  onResetApiKey: () => void
  onSwitchModel: (id: string) => void
  onResolutionChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
  onBatchCountChange: (v: number) => void
}

export function ControlPanel({
  model,
  resolution,
  aspectRatio,
  batchCount,
  apiKey,
  apiKeyStatus,
  onSubmitApiKey,
  onResetApiKey,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
  onBatchCountChange,
}: Props) {
  const batchOptions = Array.from(
    { length: model.maxBatchCount },
    (_, i) => `x${i + 1}`,
  )

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-5">
        {/* API Key */}
        <ApiKeyInput
          apiKey={apiKey}
          status={apiKeyStatus}
          onSubmit={onSubmitApiKey}
          onReset={onResetApiKey}
        />

        {/* Model Selector */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-3">模型</label>
          <div className="flex gap-1.5">
            {MODEL_CONFIGS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSwitchModel(m.id)}
                className={`flex-1 px-3 py-2 text-sm rounded-2xl transition-colors whitespace-nowrap
                  ${
                    model.id === m.id
                      ? 'bg-primary-dim text-primary font-semibold'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <ChipGroup
          label="分辨率"
          options={model.resolutions}
          value={resolution}
          onChange={onResolutionChange}
        />

        {/* Aspect Ratio */}
        <AspectRatioSelector
          options={model.aspectRatios}
          value={aspectRatio}
          resolution={resolution}
          onChange={onAspectRatioChange}
        />

        {/* Batch Count */}
        <ChipGroup
          label="数量"
          options={batchOptions}
          value={`x${batchCount}`}
          onChange={(v) => onBatchCountChange(parseInt(v.slice(1)))}
        />
      </div>
    </div>
  )
}
