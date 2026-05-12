import { useCallback, useRef, useState, type RefObject } from 'react'

import { useExternalSync } from '../../hooks/effects'

type Params = {
  historyHasMore: boolean
  historyLength: number
  onLoadMore: () => void | Promise<void>
  rootRef: RefObject<HTMLDivElement | null>
}

type Result = {
  sentinelRef: RefObject<HTMLDivElement | null>
  isLoadingMore: boolean
  loadMore: () => void
}

const LOAD_AHEAD_PX = 400

function getObserverRoot(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  const overflowY = window.getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay' ? el : null
}

export function useInfiniteScrollSentinel({ historyHasMore, historyLength, onLoadMore, rootRef }: Params): Result {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const isSentinelNearView = useCallback(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !historyHasMore) return false
    if (sentinel.getClientRects().length === 0) return false

    const root = getObserverRoot(rootRef.current)
    const sentinelRect = sentinel.getBoundingClientRect()
    const rootRect = root?.getBoundingClientRect()
    const top = (rootRect?.top ?? 0) - LOAD_AHEAD_PX
    const bottom = (rootRect?.bottom ?? window.innerHeight) + LOAD_AHEAD_PX

    return sentinelRect.bottom >= top && sentinelRect.top <= bottom
  }, [historyHasMore, rootRef])

  const loadMore = useCallback(() => {
    if (!historyHasMore || loadingRef.current) return
    loadingRef.current = true
    setIsLoadingMore(true)
    void (async () => {
      try {
        await onLoadMore()
      } catch {
        // Keep the fallback button available for retry if the background load fails.
      } finally {
        loadingRef.current = false
        setIsLoadingMore(false)
      }
    })()
  }, [historyHasMore, onLoadMore])

  useExternalSync(() => {
    const el = sentinelRef.current
    if (!el || !historyHasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { root: getObserverRoot(rootRef.current), rootMargin: `${LOAD_AHEAD_PX}px 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [historyHasMore, historyLength, loadMore, rootRef])

  useExternalSync(() => {
    if (!historyHasMore) return
    const frame = window.requestAnimationFrame(() => {
      if (isSentinelNearView()) loadMore()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [historyHasMore, historyLength, isSentinelNearView, loadMore])

  return { sentinelRef, isLoadingMore, loadMore }
}
