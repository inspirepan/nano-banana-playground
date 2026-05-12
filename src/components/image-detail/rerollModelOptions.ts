import { normalizeAspectRatio, normalizeResolution } from '../../agent/modelLookup'
import { MODEL_CONFIGS, type ModelConfig } from '../../config/models'
import type { GeneratedSource } from '../../lib/types'

export type RerollModelOption = {
  modelId: string
  modelName: string
  resolution: string
  aspectRatio: string
  isCurrent: boolean
  disabled: boolean
}

export function buildRerollModelOptions(
  source: GeneratedSource,
  currentModel: ModelConfig | null,
): RerollModelOption[] {
  const currentId = currentModel?.id ?? source.modelId
  const models = [...(currentModel ? [currentModel] : []), ...MODEL_CONFIGS.filter((model) => model.id !== currentId)]
  const options: RerollModelOption[] = []

  for (const model of models) {
    const maxTotalRefs = model.maxReferenceImages + model.maxCharacterImages
    options.push({
      modelId: model.id,
      modelName: model.name,
      resolution: normalizeResolution(model, source.resolution),
      aspectRatio: normalizeAspectRatio(model, source.aspectRatio),
      isCurrent: model.id === currentId,
      disabled: source.referenceImageIds.length > maxTotalRefs,
    })
  }

  return options
}
