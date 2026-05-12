import { useRef, useState } from 'react'
import { Streamdown } from 'streamdown'

import { useExternalSync } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'
import { MARKDOWN_COMPONENTS } from './MarkdownText'

function thoughtLabel(t: ReturnType<typeof useI18n>['t'], durationMs: number | null): string {
  if (durationMs === null) return t('agentChat.thinking.thought')
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  if (seconds === 1) return t('agentChat.thinking.thoughtForOneSecond')
  return t('agentChat.thinking.thoughtForSeconds', { seconds })
}

export function AgentThinking({
  thinking,
  isStreaming,
  hasTrailingContent,
  hasInlineTrailingContent = hasTrailingContent,
}: {
  thinking: string
  isStreaming: boolean
  hasTrailingContent: boolean
  hasInlineTrailingContent?: boolean
}) {
  const { t } = useI18n()
  const initialOpen = isStreaming && !hasTrailingContent
  const [thinkingOpen, setThinkingOpen] = useState(initialOpen)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const thinkingOpenRef = useRef(thinkingOpen)
  thinkingOpenRef.current = thinkingOpen

  useExternalSync(() => {
    if (isStreaming) {
      startedAtRef.current = Date.now()
      return
    }
    const startedAt = startedAtRef.current
    if (startedAt === null) return
    const timer = window.setTimeout(() => {
      setDurationMs(Date.now() - startedAt)
      startedAtRef.current = null
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isStreaming])

  useExternalSync(() => {
    // Auto-collapse when follow-up content (assistant text / error / tool call)
    // appears, or when streaming ends without any follow-up. Otherwise keep open.
    const shouldCollapse = hasTrailingContent || !isStreaming
    if (!shouldCollapse) {
      setThinkingOpen(true)
      return
    }
    if (!thinkingOpenRef.current) return

    setThinkingOpen(false)
  }, [isStreaming, hasTrailingContent])

  const handleToggle = () => {
    setThinkingOpen((prev) => !prev)
  }

  const label = isStreaming ? t('agentChat.thinking.label') : thoughtLabel(t, durationMs)

  return (
    <div className={hasInlineTrailingContent ? 'mb-3' : ''}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={thinkingOpen}
        className="inline-flex cursor-pointer items-center gap-1.5 bg-transparent p-0 py-0.5 text-(--color-text-4) transition-colors duration-150 hover:text-(--color-text-3)"
      >
        <span>{label}</span>
        <Icon
          name="chevron_right"
          size={13}
          style={{
            transform: thinkingOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms var(--ease-out)',
          }}
          className="motion-reduce:!transition-none"
        />
      </button>
      <div
        className="grid motion-reduce:!transition-none"
        style={{
          gridTemplateRows: thinkingOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 220ms var(--ease-drawer)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="space-y-2 pt-3 italic leading-[1.55] text-(--color-text-3) [&_>_*]:my-0"
            style={{ fontSynthesis: 'style' }}
          >
            <Streamdown
              parseIncompleteMarkdown={isStreaming}
              components={MARKDOWN_COMPONENTS}
            >
              {thinking.replace(/\n{3,}/g, '\n\n')}
            </Streamdown>
          </div>
        </div>
      </div>
    </div>
  )
}
