import type { StackItem } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

type DetailFooterProps = {
  editing: boolean
  currentImage: PlaygroundImageMeta | null
  selectedItem: StackItem | null
  stackId: string
}

export function DetailFooter({ editing, currentImage, selectedItem, stackId }: DetailFooterProps) {
  return (
    <div
      className="hidden shrink-0 items-center gap-3.5 px-3.5 text-sm text-(--color-text-4) md:flex"
      style={{
        height: 30,
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-sunken)',
      }}
    >
      {!editing && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <kbd>←</kbd>
            <kbd>→</kbd> 切换
          </span>
          <span className="inline-flex items-center gap-1.5">滚轮 缩放</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd>0</kbd> / 双击 重置
          </span>
        </>
      )}
      {editing && (
        <span className="inline-flex items-center gap-1.5">
          <kbd>⌘</kbd>
          <kbd>Z</kbd> 撤销
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <kbd>Esc</kbd> 关闭
      </span>
      <div className="flex-1" />
      <span className="mono">#{(currentImage?.id ?? selectedItem?.id ?? stackId).slice(0, 8)}</span>
    </div>
  )
}
