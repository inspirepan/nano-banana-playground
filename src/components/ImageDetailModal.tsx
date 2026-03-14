import type { PlaygroundImage } from '../lib/types'
import { MODEL_CONFIGS } from '../config/models'

type Props = {
  image: PlaygroundImage
  onClose: () => void
  onEdit: (image: PlaygroundImage) => void
  onAddToRef: (image: PlaygroundImage) => void
  onRemove: (id: string) => void
}

export function ImageDetailModal({ image, onClose, onEdit, onAddToRef, onRemove }: Props) {
  const src = `data:${image.mimeType};base64,${image.data}`
  const meta = image.source.type === 'generated' ? image.source : null

  const modelName = meta
    ? MODEL_CONFIGS.find((m) => m.id === meta.modelId)?.name ?? meta.modelId
    : null

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = `nano-banana-${image.id.slice(0, 8)}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-surface rounded-2xl shadow-xl max-w-[900px] w-full max-h-[90vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image side */}
        <div className="flex-1 min-w-0 bg-surface-dim flex items-center justify-center p-4">
          <img
            src={src}
            alt={meta?.prompt ?? ''}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>

        {/* Metadata side */}
        <div className="w-[280px] shrink-0 border-l border-outline-variant p-5 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-on-surface">详情</span>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full
                         hover:bg-surface-container text-on-surface-variant text-sm"
            >
              x
            </button>
          </div>

          <div className="space-y-4 flex-1">
            {meta && (
              <>
                <MetaRow label="模型" value={modelName!} />
                <MetaRow label="分辨率" value={meta.resolution} />
                <MetaRow label="宽高比" value={meta.aspectRatio} />
                <div>
                  <div className="text-[11px] font-medium text-on-surface-variant mb-1">提示词</div>
                  <div className="text-xs text-on-surface leading-relaxed bg-surface-container rounded-lg p-2.5 max-h-[120px] overflow-y-auto">
                    {meta.prompt}
                  </div>
                </div>
                {meta.referenceImageIds.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-on-surface-variant mb-1">参考图片</div>
                    <div className="text-xs text-on-surface-variant font-mono">
                      {meta.referenceImageIds.length} 张图片
                    </div>
                  </div>
                )}
              </>
            )}

            {image.source.type === 'upload' && (
              <MetaRow label="来源" value={`上传: ${image.source.fileName}`} />
            )}

            <MetaRow label="创建时间" value={new Date(image.timestamp).toLocaleString()} />
          </div>

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-outline-variant space-y-2">
            <div className="flex gap-2">
              <ModalAction label="编辑" onClick={() => { onEdit(image); onClose() }} />
              <ModalAction label="+参考" onClick={() => { onAddToRef(image); onClose() }} />
              <ModalAction label="保存" onClick={handleDownload} />
            </div>
            <button
              type="button"
              onClick={() => { onRemove(image.id); onClose() }}
              className="w-full py-1.5 text-xs text-error hover:bg-error-dim rounded-lg transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-on-surface-variant mb-0.5">{label}</div>
      <div className="text-xs text-on-surface">{value}</div>
    </div>
  )
}

function ModalAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-1.5 text-xs font-medium bg-surface-container hover:bg-surface-container-high
                 rounded-lg transition-colors text-on-surface"
    >
      {label}
    </button>
  )
}
