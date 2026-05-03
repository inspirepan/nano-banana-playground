import { useState, type RefObject } from 'react'

import { useExternalSync } from '../../../hooks/effects'
import type { PlaygroundImage } from '../../../lib/types'
import type { DrawableLayerHandle } from '../DrawableLayer'

export type DrawablePreview = { annotated?: PlaygroundImage; mask?: PlaygroundImage }

export function useDrawableExportPreview(params: {
  drawableRef: RefObject<DrawableLayerHandle | null>
  drawablePreviewKey: string
  hasAnnotatedSource: boolean
  hasOpenAIMask: boolean
  isOpenAI: boolean
  sourceImageId: string
}): DrawablePreview {
  const { drawableRef, drawablePreviewKey, hasAnnotatedSource, hasOpenAIMask, isOpenAI, sourceImageId } = params
  const [drawablePreview, setDrawablePreview] = useState<DrawablePreview>({})

  useExternalSync(() => {
    if (drawablePreviewKey === '0:0' || (!hasAnnotatedSource && !hasOpenAIMask)) return

    let cancelled = false
    void (async () => {
      let drawable = drawableRef.current
      for (let i = 0; i < 20 && !cancelled && !drawable?.isReady(); i++) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 80)
        })
        drawable = drawableRef.current
      }
      if (cancelled) return
      if (!drawable?.isReady()) {
        setDrawablePreview({})
        return
      }

      try {
        const next: DrawablePreview = {}
        if (hasAnnotatedSource) {
          const out = isOpenAI ? await drawable.exportAnnotated() : await drawable.exportMarkedComposite()
          if (out) {
            next.annotated = {
              id: `${sourceImageId}:annotated-preview`,
              data: out.base64,
              mimeType: out.mimeType,
              source: { type: 'upload', fileName: 'annotated-preview.png' },
              timestamp: Date.now(),
            }
          }
        }
        if (hasOpenAIMask) {
          const out = await drawable.exportMaskRedOverlay()
          if (out) {
            next.mask = {
              id: `${sourceImageId}:mask-preview`,
              data: out.base64,
              mimeType: out.mimeType,
              source: { type: 'upload', fileName: 'mask-preview.png' },
              timestamp: Date.now(),
            }
          }
        }
        if (!cancelled) setDrawablePreview(next)
      } catch {
        if (!cancelled) setDrawablePreview({})
      }
    })()

    return () => {
      cancelled = true
    }
  }, [drawablePreviewKey, drawableRef, hasAnnotatedSource, hasOpenAIMask, isOpenAI, sourceImageId])

  return drawablePreview
}
