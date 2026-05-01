import { useState, type ReactNode } from 'react'

import { Icon } from '../Icon'

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-[4px] bg-(--color-surface-2) px-1 py-0.5 mono text-[0.92em]"
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
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function AgentThinking({ thinking }: { thinking: string }) {
  const [thinkingOpen, setThinkingOpen] = useState(true)

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setThinkingOpen((prev) => !prev)}
        aria-expanded={thinkingOpen}
        className="inline-flex cursor-pointer items-center gap-1.5 bg-transparent p-0 py-0.5 text-(--color-text-4) transition-colors duration-150 hover:text-(--color-text-3)"
      >
        <span>Thinking</span>
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
