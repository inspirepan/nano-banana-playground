import type { JSX } from 'react'
import { Streamdown } from 'streamdown'

const MARKDOWN_COMPONENTS = {
  p: (props: JSX.IntrinsicElements['p']) => <p {...props} />,
  strong: (props: JSX.IntrinsicElements['strong']) => <strong className="font-semibold" {...props} />,
  em: (props: JSX.IntrinsicElements['em']) => <em className="italic" {...props} />,
  a: (props: JSX.IntrinsicElements['a']) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="text-(--color-accent) underline decoration-(--color-accent-ring) underline-offset-2 hover:decoration-(--color-accent)"
    />
  ),
  ul: (props: JSX.IntrinsicElements['ul']) => <ul className="list-disc space-y-1.5 pl-5" {...props} />,
  ol: (props: JSX.IntrinsicElements['ol']) => <ol className="list-decimal space-y-1.5 pl-5" {...props} />,
  li: (props: JSX.IntrinsicElements['li']) => <li {...props} />,
  blockquote: (props: JSX.IntrinsicElements['blockquote']) => (
    <blockquote
      className="pl-[14px] text-(--color-text-3) italic shadow-[inset_2px_0_0_var(--ring-edge-strong)]"
      {...props}
    />
  ),
  h1: (props: JSX.IntrinsicElements['h1']) => (
    <h1 className="font-display text-lg font-semibold tracking-[-0.01em] text-(--color-text)" {...props} />
  ),
  h2: (props: JSX.IntrinsicElements['h2']) => (
    <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-(--color-text)" {...props} />
  ),
  h3: (props: JSX.IntrinsicElements['h3']) => (
    <h3 className="font-display text-sm font-semibold text-(--color-text)" {...props} />
  ),
  hr: (props: JSX.IntrinsicElements['hr']) => <hr className="h-px border-0 bg-(--ring-edge-soft)" {...props} />,
  inlineCode: (props: JSX.IntrinsicElements['code']) => (
    <code className="rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1 py-0.5 mono text-[0.92em]" {...props} />
  ),
  pre: ({ children, ...props }: JSX.IntrinsicElements['pre']) => (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <pre {...props} className="overflow-x-auto px-3 py-2.5 mono text-sm leading-[1.55] text-(--color-text)">
        {children}
      </pre>
    </div>
  ),
  table: (props: JSX.IntrinsicElements['table']) => (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: JSX.IntrinsicElements['th']) => (
    <th
      className="border-b border-(--ring-edge-soft) bg-(--color-surface-2) px-2.5 py-1.5 text-left font-medium text-(--color-text)"
      {...props}
    />
  ),
  td: (props: JSX.IntrinsicElements['td']) => (
    <td className="border-b border-(--ring-edge-soft) px-2.5 py-1.5 text-(--color-text-2)" {...props} />
  ),
}

export function MarkdownText({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text.trim()) return null

  return (
    <div className="space-y-2.5 text-base leading-[1.62] text-(--color-text-2) [&_>_*]:my-0">
      <Streamdown
        parseIncompleteMarkdown={isStreaming ?? false}
        isAnimating={isStreaming ?? false}
        animated={{ animation: 'fadeIn', sep: 'word', duration: 220, stagger: 12 }}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </Streamdown>
    </div>
  )
}
