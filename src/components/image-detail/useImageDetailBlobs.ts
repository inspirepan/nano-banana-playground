import { useMemo, useState, type RefObject } from 'react'

import { useExternalSync } from '../../hooks/effects'
import { ensureBlobLoaded, useImageSrc } from '../../hooks/useImageSrc'
import { loadImageMetas } from '../../lib/history'
import type { ImageStack } from '../../lib/stacks'
import type { GeneratedSource, PlaygroundImageMeta } from '../../lib/types'

type DisplayImage = { id: string; src: string; alt: string }

export function useImageDetailBlobs({
  currentImage,
  currentMeta,
  stack,
  history,
  canNavigate,
  currentIdx,
  refDetailId,
}: {
  currentImage: PlaygroundImageMeta | null
  currentMeta: GeneratedSource | null
  stack: ImageStack
  history: PlaygroundImageMeta[]
  canNavigate: boolean
  currentIdx: number
  refDetailId: string | null
}) {
  const currentInlineData =
    currentImage && 'data' in currentImage && typeof currentImage.data === 'string' ? currentImage.data : undefined
  const { ref: imgRef, src: currentSrc } = useImageSrc(
    currentImage?.id ?? '',
    currentImage?.mimeType ?? 'image/png',
    currentInlineData,
  )

  const [displayImage, setDisplayImage] = useState<DisplayImage | null>(null)

  // Resolve missing refs from IndexedDB
  const [dbRefMetas, setDbRefMetas] = useState<Map<string, PlaygroundImageMeta>>(() => new Map())
  const historyMetaById = useMemo(() => new Map(history.map((image) => [image.id, image])), [history])
  const missingRefIds = useMemo(() => {
    if (!currentMeta) return []
    return currentMeta.referenceImageIds.filter((id) => !historyMetaById.has(id))
  }, [currentMeta, historyMetaById])

  useExternalSync(() => {
    if (missingRefIds.length === 0) return
    void loadImageMetas(missingRefIds)
      .then(setDbRefMetas)
      .catch(() => setDbRefMetas(new Map()))
  }, [missingRefIds])

  const findRefImage = useMemo(() => {
    return (id: string): PlaygroundImageMeta | undefined => historyMetaById.get(id) ?? dbRefMetas.get(id)
  }, [historyMetaById, dbRefMetas])

  const [refSrcMap, setRefSrcMap] = useState<Map<string, string>>(() => new Map())
  const refDetailSrc = refDetailId ? (refSrcMap.get(refDetailId) ?? null) : null

  useExternalSync(() => {
    if (!refDetailId) return
    if (refSrcMap.has(refDetailId)) return
    const refImg = findRefImage(refDetailId)
    if (!refImg) return
    void ensureBlobLoaded(refImg.id, refImg.mimeType)
      .then((src) => {
        if (!src) return
        setRefSrcMap((prev) => {
          if (prev.has(refDetailId)) return prev
          const next = new Map(prev)
          next.set(refDetailId, src)
          return next
        })
      })
      .catch(() => {})
  }, [refDetailId, refSrcMap, findRefImage])

  // Eager-load the current image bytes.
  useExternalSync(() => {
    if (!currentImage) return
    void ensureBlobLoaded(currentImage.id, currentImage.mimeType).catch(() => {})
  }, [currentImage])

  // Decode the next frame off-screen before promoting it to displayImage so the
  // pager swap is flicker-free.
  useExternalSync(() => {
    if (!currentImage || !currentSrc) return
    let cancelled = false
    const next: DisplayImage = { id: currentImage.id, src: currentSrc, alt: currentMeta?.prompt ?? '' }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      void img
        .decode()
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setDisplayImage(next)
        })
    }
    img.onerror = () => {
      if (!cancelled) setDisplayImage(next)
    }
    img.src = currentSrc
    return () => {
      cancelled = true
    }
  }, [currentImage, currentMeta?.prompt, currentSrc])

  // Prefetch neighbor blobs and prime the browser image decode cache so left/
  // right pager switches swap frames without a blank flash.
  useExternalSync(() => {
    if (!canNavigate) return
    const neighbors: PlaygroundImageMeta[] = []
    const prev = stack.items[currentIdx - 1]
    const next = stack.items[currentIdx + 1]
    if (prev?.type === 'image') neighbors.push(prev.image)
    if (next?.type === 'image') neighbors.push(next.image)
    let cancelled = false
    for (const n of neighbors) {
      void ensureBlobLoaded(n.id, n.mimeType)
        .then((dataUrl) => {
          if (cancelled || !dataUrl) return
          const pre = new Image()
          pre.decoding = 'async'
          pre.src = dataUrl
          void pre.decode().catch(() => {})
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [canNavigate, currentIdx, stack.items])

  return {
    imgRef,
    currentSrc,
    displayImage,
    findRefImage,
    refDetailSrc,
  }
}

export type UseImageDetailBlobsReturn = {
  imgRef: RefObject<HTMLDivElement | null>
  currentSrc: string | null
  displayImage: DisplayImage | null
  findRefImage: (id: string) => PlaygroundImageMeta | undefined
  refDetailSrc: string | null
}
