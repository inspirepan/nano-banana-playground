import type { Dispatch, SetStateAction } from 'react'

import { AgentModelIcon } from './AgentModelIcon'
import type { AgentChatMenu } from './types'
import { AGENT_THINKING_OPTIONS, type AgentModelConfig, type AgentThinkingLevel } from '../../config/agentModels'
import { Icon } from '../Icon'

export function AgentOptionsMenu({
  openMenu,
  setOpenMenu,
  autoApproveImageTasks,
  model,
  models,
  effectiveThinkingLevel,
  onToggleAutoApproveImageTasks,
  onModelChange,
  onThinkingLevelChange,
}: {
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  autoApproveImageTasks: boolean
  model: AgentModelConfig
  models: AgentModelConfig[]
  effectiveThinkingLevel: AgentThinkingLevel
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
}) {
  if (openMenu !== 'agentOptions') return null

  return (
    <div className="absolute right-2 bottom-[46px] z-50 w-[208px] rounded-[var(--radius-lg)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-float)]">
      <button
        type="button"
        onClick={() => onToggleAutoApproveImageTasks(!autoApproveImageTasks)}
        className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
      >
        <span className="min-w-0 flex-1 truncate">自动通过生图任务</span>
        {autoApproveImageTasks && <Icon name="check" size={13} />}
      </button>
      <div className="my-1 h-px bg-(--ring-edge-soft)" />
      <div className="px-2 py-1 text-sm font-medium text-(--color-text-4)">深度思考</div>
      {AGENT_THINKING_OPTIONS.map((item) => {
        const disabled = !model.supportsThinking && item.value !== 'off'
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              if (disabled) return
              onThinkingLevelChange(item.value)
              setOpenMenu(null)
            }}
            disabled={disabled}
            className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2) disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {effectiveThinkingLevel === item.value && <Icon name="check" size={13} />}
          </button>
        )
      })}
      <div className="my-1 h-px bg-(--ring-edge-soft)" />
      {models.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            onModelChange(item.id)
            setOpenMenu(null)
          }}
          className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
          data-active={model.id === item.id}
        >
          <AgentModelIcon model={item} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {model.id === item.id && <Icon name="check" size={13} />}
        </button>
      ))}
    </div>
  )
}
