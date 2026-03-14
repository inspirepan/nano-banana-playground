import { MODEL_CONFIGS, type ModelConfig } from '../config/models'
import type { ApiKeyStatus } from '../hooks/useApiKey'
import { ApiKeyInput } from './ApiKeyInput'
import { ChipGroup } from './ChipGroup'  // still used for resolution
import { AspectRatioSelector } from './AspectRatioSelector'

type Props = {
  model: ModelConfig
  resolution: string
  aspectRatio: string
  apiKey: string
  apiKeyStatus: ApiKeyStatus
  onSubmitApiKey: (key: string) => void
  onResetApiKey: () => void
  onSwitchModel: (id: string) => void
  onResolutionChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
}

export function ControlPanel({
  model,
  resolution,
  aspectRatio,
  apiKey,
  apiKeyStatus,
  onSubmitApiKey,
  onResetApiKey,
  onSwitchModel,
  onResolutionChange,
  onAspectRatioChange,
}: Props) {
  return (
    <div className="flex-1 min-h-0 overflow-visible md:overflow-y-auto md:pr-2">
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
          <div className="flex flex-col gap-1.5">
            {MODEL_CONFIGS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSwitchModel(m.id)}
                className={`block w-full px-4 py-2 text-xs rounded-2xl transition-colors text-center leading-snug
                  ${
                    model.id === m.id
                      ? 'bg-primary-dim text-primary font-medium hover:bg-primary/15'
                      : 'bg-surface-container-high text-on-surface font-medium hover:bg-on-surface/10'
                  }`}
              >
                🍌 {m.name}
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
      </div>
    </div>
  )
}
