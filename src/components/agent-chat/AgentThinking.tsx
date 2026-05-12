import { useLayoutEffect, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'

import { useExternalSync } from '../../hooks/effects'
import { useI18n } from '../../i18n'
import { Icon } from '../Icon'
import { MARKDOWN_COMPONENTS } from './MarkdownText'

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement ?? null
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') return parent
    parent = parent.parentElement
  }
  return null
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
  onAutoCollapseReserve,
}: {
  thinking: string
  isStreaming: boolean
  hasTrailingContent: boolean
  hasInlineTrailingContent?: boolean
  onAutoCollapseReserve?: (height: number) => boolean
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
  const collapsePanelRef = useRef<HTMLDivElement>(null)

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

    const reserved = onAutoCollapseReserve?.(collapsePanelRef.current?.getBoundingClientRect().height ?? 0) ?? false
    const el = reserved ? null : contentRef.current
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
  }, [isStreaming, hasTrailingContent, onAutoCollapseReserve])

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
            transition: 'transform 200ms var(--ease-out)',
          }}
          className="motion-reduce:!transition-none"
        />
      </button>
      <div
        ref={collapsePanelRef}
        className="grid motion-reduce:!transition-none"
        style={{
          gridTemplateRows: thinkingOpen ? '1fr' : '0fr',
          transition: instantCollapse ? 'none' : 'grid-template-rows 220ms var(--ease-drawer)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            className="space-y-2 pt-3 italic leading-[1.55] text-(--color-text-3) [&_>_*]:my-0"
            style={{ fontSynthesis: 'style' }}
          >
            <Streamdown
              parseIncompleteMarkdown={isStreaming}
              isAnimating={isStreaming}
              animated={{ animation: 'fadeIn', sep: 'word', duration: 220, stagger: 12 }}
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
