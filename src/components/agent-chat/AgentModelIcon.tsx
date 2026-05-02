import type { AgentModelConfig } from '../../config/agentModels'
import { getProviderConfig } from '../../config/providers'
import { BrandIcon } from '../Icon'

export function AgentModelIcon({ model, size = 13 }: { model: AgentModelConfig; size?: number }) {
  return (
    <BrandIcon
      name={getProviderConfig(model.provider).brandIcon}
      size={size}
      className="shrink-0 text-(--color-text-3)"
    />
  )
}
