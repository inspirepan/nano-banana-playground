import { DynamicIcon } from 'lucide-react/dynamic'

import { Icon } from './Icon'
import { normalizeSkillIcon, type AgentSkillIconName } from '../agent/skills/icons'

type Props = {
  name: AgentSkillIconName | string
  size?: number
  className?: string
  strokeWidth?: number
}

export function SkillIcon({ name, size = 14, className, strokeWidth = 1.8 }: Props) {
  const Fallback = () => <Icon name="sparkles" size={size} strokeWidth={strokeWidth} className={className} />
  return (
    <DynamicIcon
      name={normalizeSkillIcon(name)}
      fallback={Fallback}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
    />
  )
}
