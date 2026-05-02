import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import { AgentThinking } from './AgentThinking'
import { MarkdownText } from './MarkdownText'
import { summarizeSystemEvent } from './SystemEvent'
import { TruncatedText } from './TruncatedText'
import {
  agentMessageError,
  agentMessageImages,
  agentMessageRole,
  agentMessageText,
  agentMessageThinking,
  imageDataUrl,
  stripSystemDirectives,
} from '../../agent'
import { useI18n } from '../../i18n'

export function MessageBubble({ message, isStreaming }: { message: AgentMessage; isStreaming: boolean }) {
  const { t } = useI18n()
  const role = agentMessageRole(message)
  const text = agentMessageText(message)
  const thinking = agentMessageThinking(message)
  const images = agentMessageImages(message)
  const error = agentMessageError(message)
  const isUser = role === 'user'
  const trimmedText = text.trim()
  const visibleText = stripSystemDirectives(text)
  const isSystemEvent = isUser && visibleText === '' && trimmedText.startsWith('<system>')

  if (isSystemEvent) {
    return (
      <div className="flex justify-start">
        <div className="mr-3 max-w-[94%] pl-3 text-(--color-text-3)">{summarizeSystemEvent(trimmedText)}</div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? '' : 'justify-start'}`}>
      <div className={isUser ? 'w-full' : 'w-full pl-3'}>
        <div
          className={
            isUser
              ? 'rounded-[12px] bg-(--color-accent-soft) px-3 py-2.5 text-(--color-text) shadow-[inset_0_0_0_1px_var(--color-accent-ring),0_1px_0_var(--color-accent-ring),0_2px_3px_-1px_rgba(0,0,0,0.05)]'
              : ''
          }
        >
          {images.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={imageDataUrl(image)}
                  alt={t('agentChat.imageAlt.message', { index: index + 1 })}
                  className="aspect-square rounded-[var(--radius-sm)] object-cover shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]"
                />
              ))}
            </div>
          )}
          {thinking && !isUser && <AgentThinking thinking={thinking} />}
          {isUser ? (
            <TruncatedText
              text={visibleText}
              className="whitespace-pre-wrap text-base leading-[1.58]"
              fadeColor="var(--color-accent-soft)"
              maxHeight={220}
            />
          ) : (
            <MarkdownText text={error ? `${visibleText}\n\n${error}` : visibleText} isStreaming={isStreaming} />
          )}
        </div>
      </div>
    </div>
  )
}
