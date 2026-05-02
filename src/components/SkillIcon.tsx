import { DynamicIcon } from 'lucide-react/dynamic'

import { normalizeSkillIcon, type AgentSkillIconName } from '../agent/skills/icons'

type Props = {
  name: AgentSkillIconName | string
  size?: number
  className?: string
  strokeWidth?: number
}

export function SkillIcon({ name, size = 14, className, strokeWidth = 1.8 }: Props) {
  return <DynamicIcon name={normalizeSkillIcon(name)} size={size} strokeWidth={strokeWidth} className={className} />
}
