import { useCallback, useRef, type RefObject } from 'react'

import { useExternalSync } from '../../hooks/effects'

type Params = {
  historyHasMore: boolean
  onLoadMore: () => void
}

type Result = {
  sentinelRef: RefObject<HTMLDivElement | null>
}

export function useInfiniteScrollSentinel({ historyHasMore, onLoadMore }: Params): Result {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreStable = useCallback(() => {
    onLoadMore()
  }, [onLoadMore])

  useExternalSync(() => {
    const el = sentinelRef.current
    if (!el || !historyHasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMoreStable()
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [historyHasMore, onLoadMoreStable])

  return { sentinelRef }
}
