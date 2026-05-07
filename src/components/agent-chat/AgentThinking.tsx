import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { useExternalSync } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement ?? null
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') return parent
    parent = parent.parentElement
  }
  return null
}

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
  const [instantCollapse, setInstantCollapse] = useState(false)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const thinkingOpenRef = useRef(thinkingOpen)
  thinkingOpenRef.current = thinkingOpen
  const pendingScrollAdjustRef = useRef<{ scrollEl: HTMLElement; delta: number } | null>(null)

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
      setInstantCollapse(false)
      return
    }
    if (!thinkingOpenRef.current) return

    const el = contentRef.current
    if (el) {
      const scrollEl = findScrollParent(el)
      if (scrollEl) {
        const scrollRect = scrollEl.getBoundingClientRect()
        const blockRect = el.getBoundingClientRect()
        // Pixels of the thinking block scrolled above the scroll container's
        // viewport top — we'll subtract this from scrollTop so the visible
        // content stays anchored after the block collapses.
        const lostAbove = Math.max(0, scrollRect.top - blockRect.top)
        if (lostAbove > 0) {
          pendingScrollAdjustRef.current = { scrollEl, delta: lostAbove }
        }
      }
    }
    setInstantCollapse(true)
    setThinkingOpen(false)
  }, [isStreaming, hasTrailingContent])

  useLayoutEffect(() => {
    if (thinkingOpen || !instantCollapse) return
    const pending = pendingScrollAdjustRef.current
    pendingScrollAdjustRef.current = null
    if (pending) {
      pending.scrollEl.scrollTop = Math.max(0, pending.scrollEl.scrollTop - pending.delta)
    }
    setInstantCollapse(false)
  }, [thinkingOpen, instantCollapse])

  const handleToggle = () => {
    setInstantCollapse(false)
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
            transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          className="motion-reduce:!transition-none"
        />
      </button>
      <div
        className="grid motion-reduce:!transition-none"
        style={{
          gridTemplateRows: thinkingOpen ? '1fr' : '0fr',
          transition: instantCollapse ? 'none' : 'grid-template-rows 220ms cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={contentRef}
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
