import { useMemo, useState } from 'react'

import { TITLE_MODEL_CONFIGS, type AgentModelProvider } from '../../config/agentModels'
import type { ApiKeyStatus } from '../../hooks/useApiKey'
import { useI18n } from '../../i18n'
import { readTitleModelPreference } from '../../lib/preferenceStore'
import { AgentModelIcon } from '../agent-chat/AgentModelIcon'
import { Icon } from '../Icon'
import { Segmented, type SegmentedOption } from './Segmented'
import { SettingsSection } from './SettingsSection'
import { parseTitleModelPreference, type TitleModelPreference } from '../../agent/useTitleGenerator'

type TitleModelSettingsTabProps = {
  keyStatuses: Record<AgentModelProvider, ApiKeyStatus>
  onPreferenceChange: (value: TitleModelPreference) => void
  divider?: boolean
  embedded?: boolean
}

type Mode = 'auto' | 'disabled' | 'explicit'

export function TitleModelSettingsTab({
  keyStatuses,
  onPreferenceChange,
  divider,
  embedded,
}: TitleModelSettingsTabProps) {
  const { t } = useI18n()
  const [preference, setPreference] = useState<TitleModelPreference>(() =>
    parseTitleModelPreference(readTitleModelPreference()),
  )

  const mode: Mode = preference.mode

  const autoResolvedModel = useMemo(() => {
    for (const item of TITLE_MODEL_CONFIGS) {
      if (keyStatuses[item.provider] === 'valid') return item
    }
    return null
  }, [keyStatuses])

  const modeOptions: SegmentedOption<Mode>[] = [
    { value: 'auto', label: t('settings.titleModel.mode.auto') },
    { value: 'explicit', label: t('settings.titleModel.modelLabel') },
    { value: 'disabled', label: t('settings.titleModel.mode.disabled') },
  ]

  const apply = (next: TitleModelPreference) => {
    setPreference(next)
    onPreferenceChange(next)
  }

  const handleModeChange = (next: Mode) => {
    if (next === 'auto') apply({ mode: 'auto' })
    else if (next === 'disabled') apply({ mode: 'disabled' })
    else {
      const fallbackId =
        preference.mode === 'explicit' ? preference.modelId : (autoResolvedModel?.id ?? TITLE_MODEL_CONFIGS[0]?.id)
      if (fallbackId) apply({ mode: 'explicit', modelId: fallbackId })
    }
  }

  const handleSelectModel = (modelId: string) => {
    apply({ mode: 'explicit', modelId })
  }

  const content = (
    <SettingsSection
      label={t('settings.titleModel.title')}
      hint={t('settings.titleModel.description')}
      divider={divider}
    >
      <Segmented<Mode>
        options={modeOptions}
        value={mode}
        onChange={handleModeChange}
        ariaLabel={t('settings.titleModel.title')}
      />

      {mode === 'auto' && (
        <p className="text-sm leading-relaxed text-(--color-text-3)">
          {autoResolvedModel
            ? t('settings.titleModel.autoResolved', { model: autoResolvedModel.label })
            : t('settings.titleModel.autoUnavailable')}
        </p>
      )}

      {mode === 'explicit' && (
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          {TITLE_MODEL_CONFIGS.map((item, index) => {
            const missingKey = keyStatuses[item.provider] === 'empty'
            const isActive = preference.mode === 'explicit' && preference.modelId === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModel(item.id)}
                data-active={isActive || undefined}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-(--color-surface-2) ${
                  index === TITLE_MODEL_CONFIGS.length - 1 ? '' : 'shadow-[inset_0_-1px_0_var(--ring-edge-soft)]'
                }`}
              >
                <AgentModelIcon model={item} />
                <span className="min-w-0 flex-1 truncate font-medium text-(--color-text)">{item.label}</span>
                {missingKey ? (
                  <span
                    className="shrink-0 rounded-[var(--radius-xs)] px-1.5 py-0.5 text-xs leading-[1.25]"
                    style={{
                      color: 'var(--color-danger)',
                      background: 'var(--color-danger-soft)',
                      boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-danger) 20%, transparent)',
                    }}
                  >
                    {t('settings.titleModel.missingKey')}
                  </span>
                ) : (
                  isActive && <Icon name="check" size={13} className="text-(--color-accent)" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </SettingsSection>
  )

  if (embedded) return content
  return <div className="px-5 py-4">{content}</div>
}
