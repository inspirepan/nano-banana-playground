import { useRef, useState, type ReactNode } from 'react'

import { useExternalSync } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match = pattern.exec(text)

  while (match) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1 py-0.5 mono text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    }
    lastIndex = match.index + token.length
    match = pattern.exec(text)
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

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
}: {
  thinking: string
  isStreaming: boolean
  hasTrailingContent: boolean
}) {
  const { t } = useI18n()
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const startedAtRef = useRef<number | null>(null)

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

  const label = isStreaming ? t('agentChat.thinking.label') : thoughtLabel(t, durationMs)

  return (
    <div className={hasTrailingContent ? 'mb-3' : ''}>
      <button
        type="button"
        onClick={() => setThinkingOpen((prev) => !prev)}
        aria-expanded={thinkingOpen}
        className="inline-flex cursor-pointer items-center gap-1.5 bg-transparent p-0 py-0.5 text-(--color-text-4) transition-colors duration-150 hover:text-(--color-text-3)"
      >
        <span>{label}</span>
        <Icon
          name="chevron_right"
          size={13}
          style={{
            transform: thinkingOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          className="motion-reduce:!transition-none"
        />
      </button>
      <div
        className="grid motion-reduce:!transition-none"
        style={{
          gridTemplateRows: thinkingOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 220ms cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="pt-3 whitespace-pre-wrap italic leading-[1.55] text-(--color-text-3)"
            style={{ fontSynthesis: 'style' }}
          >
            {renderInline(thinking.replace(/\n{3,}/g, '\n\n'))}
          </div>
        </div>
      </div>
    </div>
  )
}
