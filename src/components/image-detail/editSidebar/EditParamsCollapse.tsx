import { MODEL_CONFIGS, getModelShortLabel, type ModelConfig } from '../../../config/models'
import { getProviderConfig } from '../../../config/providers'
import { useI18n } from '../../../i18n'
import { openAISize } from '../../../lib/openai'
import { AspectRatioSelector } from '../../AspectRatioSelector'
import { ChipGroup } from '../../ChipGroup'
import { BrandIcon, Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'

function InlineParamDivider() {
  return <span aria-hidden className="meta-dot text-(--color-text-4)" />
}

type Props = {
  sourceModel: ModelConfig
  resolution: string
  setResolution: (value: string) => void
  aspectRatio: string
  setAspectRatio: (value: string) => void
  paramsCollapsed: boolean
  setParamsCollapsed: (updater: (prev: boolean) => boolean) => void
  onModelChange: (id: string) => void
}

export function EditParamsCollapse({
  sourceModel,
  resolution,
  setResolution,
  aspectRatio,
  setAspectRatio,
  paramsCollapsed,
  setParamsCollapsed,
  onModelChange,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="mb-[18px]">
      <button
        type="button"
        onClick={() => setParamsCollapsed((v) => !v)}
        aria-expanded={!paramsCollapsed}
        className="flex items-center w-full bg-transparent border-0 p-0 cursor-pointer min-h-[20px]"
      >
        <span className="flex items-center gap-1.5">
          <span className="label">{t('imageDetail.parameters')}</span>
        </span>
        <span className="flex-1" />
        <span className="mr-1.5 flex items-center gap-1.5 text-sm text-(--color-text-3)">
          <span>{getModelShortLabel(sourceModel)}</span>
          <InlineParamDivider />
          <span className="tabular-nums">{resolution}</span>
          <InlineParamDivider />
          <span className="tabular-nums">{aspectRatio}</span>
        </span>
        <Icon name={paramsCollapsed ? 'chevron_right' : 'chevron_down'} size={12} className="text-(--color-text-4)" />
      </button>
      <div
        className="grid motion-reduce:transition-none"
        style={{
          gridTemplateRows: paramsCollapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 260ms var(--ease-drawer)',
        }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="pt-2.5">
            <div className="mb-[14px]">
              <div className="grid grid-cols-2 gap-1.5">
                {MODEL_CONFIGS.map((model) => (
                  <Tooltip key={model.id} text={model.name} placement="top" className="min-w-0">
                    <button
                      type="button"
                      data-active={sourceModel.id === model.id}
                      onClick={() => onModelChange(model.id)}
                      className="chip w-full min-w-0 justify-center px-2"
                    >
                      <BrandIcon name={getProviderConfig(model.provider).brandIcon} size={12} />
                      <span className="min-w-0 truncate">{model.name}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
            <div className="mb-[14px] tabular-nums">
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
                sourceModel.provider === 'openai' ? (ratio, res) => openAISize(res, ratio).replace('x', '×') : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
