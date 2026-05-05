import { Component, type ReactNode } from 'react'

import { isLazyChunkLoadError } from '../lib/lazyChunkRecovery'

type Props = {
  children: ReactNode
  title: string
  description: string
  closeLabel: string
  refreshLabel: string
  onClose: () => void
}

class LazyChunkLoadErrorBoundaryInner extends Component<Props, { error: unknown | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    if (!isLazyChunkLoadError(this.state.error)) throw this.state.error

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{
          background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        onClick={this.props.onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={this.props.title}
          className="modal-pop relative flex w-full max-w-sm flex-col gap-4 rounded-[var(--radius-lg)] bg-(--color-surface) p-5 shadow-[0_0_0_1px_var(--ring-edge-elevated),var(--shadow-float)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-1.5">
            <h2 className="font-display text-base font-semibold">{this.props.title}</h2>
            <p className="max-w-[60ch] text-pretty text-sm leading-5 text-(--color-text-2)">{this.props.description}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={this.props.onClose} className="chip ghost">
              {this.props.closeLabel}
            </button>
            <button type="button" onClick={() => window.location.reload()} className="chip">
              {this.props.refreshLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export function LazyChunkLoadErrorBoundary(props: Props) {
  return <LazyChunkLoadErrorBoundaryInner {...props} />
}
