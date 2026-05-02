import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'

import { AgentModelIcon } from './AgentModelIcon'
import type { AgentChatMenu } from './types'
import type { AgentModelConfig, AgentThinkingLevel } from '../../config/agentModels'
import { MODEL_CONFIGS } from '../../config/models'
import { getProviderConfig } from '../../config/providers'
import { usePreferredImageModel } from '../../hooks/usePreferredImageModel'
import { useI18n } from '../../i18n'
import { BrandIcon, Icon } from '../Icon'

export function ComposerActions({
  fileInputRef,
  openMenu,
  setOpenMenu,
  model,
  effectiveThinkingLevel,
  effectiveThinkingLabel,
  pendingQuestionCount,
  canSend,
  showStop,
  isStreaming,
  onFileChange,
  onSend,
  onStop,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  model: AgentModelConfig
  effectiveThinkingLevel: AgentThinkingLevel
  effectiveThinkingLabel: string
  pendingQuestionCount: number
  canSend: boolean
  showStop: boolean
  isStreaming: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSend: () => void
  onStop: () => void
}) {
  const { t } = useI18n()
  const { preferredImageModelId } = usePreferredImageModel()
  const preferredImageModel = preferredImageModelId
    ? (MODEL_CONFIGS.find((item) => item.id === preferredImageModelId) ?? null)
    : null
  const attachImageTitle = model.supportsImages
    ? t('agentChat.composer.attachImage')
    : t('agentChat.composer.attachImageUnsupported', { model: model.label })

  return (
    <div className="flex items-center gap-1.5 px-2 pt-0.5 pb-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={onFileChange}
        disabled={!model.supportsImages}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!model.supportsImages}
        className="icon-btn"
        title={attachImageTitle}
        aria-label={attachImageTitle}
      >
        <Icon name="plus" size={17} />
      </button>
      <div className="flex-1" />
      {preferredImageModel && (
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'agentOptions' ? null : 'agentOptions'))}
          className="chip ghost max-w-[140px] px-2 text-sm"
          style={{ height: 28 }}
          title={t('agentChat.composer.preferredImageModelTitle', { model: preferredImageModel.name })}
        >
          <BrandIcon name={getProviderConfig(preferredImageModel.provider).brandIcon} size={11} />
          <span className="min-w-0 truncate text-(--color-text-2)">{preferredImageModel.name}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpenMenu((prev) => (prev === 'agentOptions' ? null : 'agentOptions'))}
        className="chip ghost max-w-[170px] justify-between px-2.5 text-sm"
        style={{ height: 28 }}
        title={t('agentChat.composer.optionsTitle')}
      >
        <AgentModelIcon model={model} />
        <span className="min-w-0 truncate text-(--color-text-2)">{model.shortLabel}</span>
        {effectiveThinkingLevel !== 'off' && (
          <span className="shrink-0 text-(--color-text-3)">{effectiveThinkingLabel}</span>
        )}
        <Icon name="chevron_right" size={13} className={openMenu === 'agentOptions' ? '-rotate-90' : 'rotate-90'} />
      </button>
      {showStop ? (
        <button
          type="button"
          onClick={onStop}
          className="chip flex items-center justify-center rounded-full p-0"
          style={{ width: 30, height: 30 }}
          title={t('agentChat.composer.stop')}
          aria-label={t('agentChat.composer.stop')}
        >
          <Icon name="stop_circle" size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="cta flex items-center justify-center rounded-full p-0"
          style={{ width: 30, height: 30 }}
          title={
            isStreaming
              ? pendingQuestionCount > 0
                ? t('agentChat.composer.skipQuestionsAndSend')
                : t('agentChat.composer.sendWhileStreaming')
              : t('agentChat.composer.send')
          }
          aria-label={t('agentChat.composer.send')}
        >
          <Icon name="send" size={14} />
        </button>
      )}
    </div>
  )
}
