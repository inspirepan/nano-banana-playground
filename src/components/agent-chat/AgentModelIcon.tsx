import type { AgentModelConfig } from '../../config/agentModels'
import { BrandIcon } from '../Icon'

export function AgentModelIcon({ model, size = 13 }: { model: AgentModelConfig; size?: number }) {
  return (
    <BrandIcon
      name={model.provider === 'google' ? 'gemini' : 'openai'}
      size={size}
      className="shrink-0 text-(--color-text-3)"
    />
  )
}
