import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'

import { AgentModelIcon } from './AgentModelIcon'
import type { AgentChatMenu } from './types'
import type { AgentModelConfig, AgentThinkingLevel } from '../../config/agentModels'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

export function ComposerActions({
  fileInputRef,
  openMenu,
  setOpenMenu,
  model,
  effectiveThinkingLevel,
  effectiveThinkingLabel,
  autoApproveImageTasks,
  pendingQuestionCount,
  canSend,
  showStop,
  isStreaming,
  hasGalleryImages,
  onFileChange,
  onOpenGalleryPicker,
  onSend,
  onStop,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  openMenu: AgentChatMenu
  setOpenMenu: Dispatch<SetStateAction<AgentChatMenu>>
  model: AgentModelConfig
  effectiveThinkingLevel: AgentThinkingLevel
  effectiveThinkingLabel: string
  autoApproveImageTasks: boolean
  pendingQuestionCount: number
  canSend: boolean
  showStop: boolean
  isStreaming: boolean
  hasGalleryImages: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenGalleryPicker: () => void
  onSend: () => void
  onStop: () => void
}) {
  const { t } = useI18n()
  const attachImageTitle = model.supportsImages
    ? t('agentChat.composer.attachImage')
    : t('agentChat.composer.attachImageUnsupported', { model: model.label })
  const galleryPickerTitle = !model.supportsImages
    ? t('agentChat.composer.attachImageUnsupported', { model: model.label })
    : !hasGalleryImages
      ? t('agentChat.composer.attachFromGalleryEmpty')
      : t('agentChat.composer.attachFromGallery')
  const galleryDisabled = !model.supportsImages || !hasGalleryImages
  const showThinkingLabel = model.thinkingOptions.length > 1 && effectiveThinkingLevel !== 'off'
  const sendTitle = isStreaming
    ? pendingQuestionCount > 0
      ? t('agentChat.composer.skipQuestionsAndSend')
      : t('agentChat.composer.sendWhileStreaming')
    : t('agentChat.composer.send')

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
      <Tooltip text={attachImageTitle} placement="top" className="inline-flex">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!model.supportsImages}
          className="icon-btn"
          aria-label={attachImageTitle}
        >
          <Icon name="plus" size={17} />
        </button>
      </Tooltip>
      <Tooltip text={galleryPickerTitle} placement="top" className="inline-flex">
        <button
          type="button"
          onClick={onOpenGalleryPicker}
          disabled={galleryDisabled}
          className="icon-btn"
          aria-label={galleryPickerTitle}
        >
          <Icon name="images" size={15} />
        </button>
      </Tooltip>
      <div className="flex-1" />
      <Tooltip text={t('agentChat.composer.optionsTitle')} placement="top" className="min-w-0 max-w-[300px]">
        <button
          type="button"
          data-agent-menu-trigger
          onClick={() => setOpenMenu((prev) => (prev === 'agentOptions' ? null : 'agentOptions'))}
          className="chip ghost w-full min-w-0 gap-1 px-2 text-sm"
          style={{ height: 28 }}
        >
          {autoApproveImageTasks && (
            <>
              <span
                className="flex shrink-0 items-center gap-1 text-(--color-accent)"
                aria-label={t('agentChat.composer.autoApproveActive')}
              >
                <Icon name="circle_play" size={12} />
                <span className="hidden md:inline">{t('agentChat.composer.autoApproveLabel')}</span>
              </span>
              <span aria-hidden="true" className="h-4 w-px shrink-0 bg-(--ring-edge-soft)" />
            </>
          )}
          <span className="flex min-w-0 items-center gap-1.5">
            <AgentModelIcon model={model} />
            <span className="min-w-0 truncate text-(--color-text-2)">{model.shortLabel}</span>
            {showThinkingLabel && <span className="shrink-0 text-(--color-text-3)">{effectiveThinkingLabel}</span>}
          </span>
          <Icon name="chevron_right" size={13} className={openMenu === 'agentOptions' ? '-rotate-90' : 'rotate-90'} />
        </button>
      </Tooltip>
      {showStop ? (
        <Tooltip text={t('agentChat.composer.stop')} placement="top" className="inline-flex">
          <button
            type="button"
            onClick={onStop}
            className="cta flex items-center justify-center rounded-full p-0"
            style={{ width: 30, height: 30 }}
            aria-label={t('agentChat.composer.stop')}
          >
            <Icon name="square" size={12} fill="currentColor" />
          </button>
        </Tooltip>
      ) : (
        <Tooltip text={sendTitle} placement="top" className="inline-flex">
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="cta flex items-center justify-center rounded-full p-0"
            style={{ width: 30, height: 30 }}
            aria-label={t('agentChat.composer.send')}
          >
            <Icon name="send" size={16} strokeWidth={2.2} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
