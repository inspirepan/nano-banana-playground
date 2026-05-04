import type { Dispatch, SetStateAction } from 'react'

import { AgentModelIcon } from './AgentModelIcon'
import type { AgentChatMenu } from './types'
import { AGENT_THINKING_OPTIONS, type AgentModelConfig, type AgentThinkingLevel } from '../../config/agentModels'
import { MODEL_CONFIGS, getModelShortLabel, type Provider } from '../../config/models'
import { getProviderConfig } from '../../config/providers'
import type { ApiKeyStatus } from '../../hooks/useApiKey'
import { usePreferredImageModel } from '../../hooks/usePreferredImageModel'
import { useI18n } from '../../i18n'
import { BrandIcon, Icon } from '../Icon'

export function AgentOptionsMenu({
  openMenu,
  setOpenMenu,
  autoApproveImageTasks,
  model,
  models,
  effectiveThinkingLevel,
  keyStatuses,
  onToggleAutoApproveImageTasks,
  onModelChange,
  onThinkingLevelChange,
  onOpenApiKeys,
}: {
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  autoApproveImageTasks: boolean
  model: AgentModelConfig
  models: AgentModelConfig[]
  effectiveThinkingLevel: AgentThinkingLevel
  keyStatuses: Record<Provider, ApiKeyStatus>
  onToggleAutoApproveImageTasks: (value: boolean) => void
  onModelChange: (id: string) => void
  onThinkingLevelChange: (level: AgentThinkingLevel) => void
  onOpenApiKeys: () => void
}) {
  const { t } = useI18n()
  const { preferredImageModelId, setPreferredImageModelId } = usePreferredImageModel()

  if (openMenu !== 'agentOptions') return null

  return (
    <div
      data-agent-menu
      className="popover-pop absolute right-2 bottom-[46px] z-50 w-[320px] max-w-[calc(100vw-32px)] origin-bottom-right rounded-[var(--radius-lg)] bg-(--color-surface) p-1 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
    >
      <button
        type="button"
        onClick={() => onToggleAutoApproveImageTasks(!autoApproveImageTasks)}
        role="switch"
        aria-checked={autoApproveImageTasks}
        className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
      >
        <span className="min-w-0 flex-1 truncate">{t('agentChat.options.autoApproveImageTasks')}</span>
        <ToggleSwitch checked={autoApproveImageTasks} />
      </button>
      <div className="my-1 h-px bg-(--ring-edge-soft)" />
      <div className="flex items-baseline gap-2 px-2 py-1">
        <span className="text-xs font-medium text-(--color-text-3)">{t('agentChat.options.preferredImageModel')}</span>
        <span className="text-xs text-(--color-text-3) opacity-65">
          {t('agentChat.options.preferredImageModel.hint')}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setPreferredImageModelId(null)}
        className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
      >
        <Icon name="circle_dashed" size={12} className="text-(--color-text-3)" />
        <span className="min-w-0 flex-1 truncate">{t('agentChat.options.preferredImageModel.none')}</span>
        {preferredImageModelId === null && <Icon name="check" size={13} />}
      </button>
      {MODEL_CONFIGS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setPreferredImageModelId(item.id)}
          className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
        >
          <BrandIcon name={getProviderConfig(item.provider).brandIcon} size={12} />
          <span className="min-w-0 flex-1 truncate">{getModelShortLabel(item)}</span>
          {preferredImageModelId === item.id && <Icon name="check" size={13} />}
        </button>
      ))}
      <div className="my-1 h-px bg-(--ring-edge-soft)" />
      <ThinkingSlider
        value={effectiveThinkingLevel}
        disabled={!model.supportsThinking}
        onChange={onThinkingLevelChange}
      />
      <div className="my-1 h-px bg-(--ring-edge-soft)" />
      <div className="px-2 py-1 text-xs font-medium text-(--color-text-3)">{t('agentChat.options.agentModel')}</div>
      {models.map((item) => {
        const needsKey = keyStatuses[item.provider] === 'empty'
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onModelChange(item.id)
              if (needsKey) {
                setOpenMenu(null)
                onOpenApiKeys()
              }
            }}
            className="flex h-7 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-(--color-text-2) transition-colors hover:bg-(--color-surface-2)"
            data-active={model.id === item.id}
          >
            <AgentModelIcon model={item} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {needsKey ? (
              <span
                className="shrink-0 rounded-[var(--radius-xs)] px-1.5 py-0.5 text-xs leading-[1.25]"
                style={{
                  color: 'var(--color-danger)',
                  background: 'var(--color-danger-soft)',
                  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 20%, transparent)',
                }}
              >
                {t('agentChat.apiKeyMissing.action')}
              </span>
            ) : (
              model.id === item.id && <Icon name="check" size={13} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function ToggleSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-[14px] w-[24px] shrink-0 rounded-full transition-colors"
      style={{
        background: checked ? 'var(--color-accent)' : 'var(--color-surface-3)',
        boxShadow: checked
          ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 55%, #000 10%)'
          : 'inset 0 0 0 1px var(--ring-edge)',
      }}
    >
      <span
        className="absolute top-[1px] left-[1px] h-[12px] w-[12px] rounded-full bg-(--color-surface) transition-transform"
        style={{
          transform: checked ? 'translateX(10px)' : 'translateX(0)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.18), inset 0 0 0 0.5px var(--ring-edge-soft)',
        }}
      />
    </span>
  )
}

function ThinkingSlider({
  value,
  disabled,
  onChange,
}: {
  value: AgentThinkingLevel
  disabled: boolean
  onChange: (level: AgentThinkingLevel) => void
}) {
  const { t } = useI18n()
  const levels = AGENT_THINKING_OPTIONS.map((item) => item.value)
  const activeIndex = Math.max(0, levels.indexOf(value))

  return (
    <div className="px-2 py-1.5" style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <div className="mb-1.5 px-1 text-xs font-medium text-(--color-text-3)">{t('agentChat.options.thinking')}</div>
      <div
        className="segmented"
        style={{
          ['--seg-count' as string]: levels.length,
          ['--seg-index' as string]: activeIndex,
        }}
      >
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            data-active={value === level}
            title={t(`agentChat.thinking.${level}`)}
          >
            <span className="text-xs">{t(`agentChat.thinking.${level}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
