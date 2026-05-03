import { useRef, type MutableRefObject, type RefObject } from 'react'

import { useExternalSync } from '../../hooks/effects'
import type { ImageStack } from '../../lib/stacks'

type Params = {
  stacks: ImageStack[]
  highlightStackId?: string | null
}

type Result = {
  scrollRef: RefObject<HTMLDivElement | null>
  stackRowRefs: MutableRefObject<Map<string, HTMLDivElement>>
}

// Keep two separate syncs: top-stack auto-scroll-to-top vs highlight scrollIntoView.
export function useStackScrollSync({ stacks, highlightStackId }: Params): Result {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stackRowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const topStackIdRef = useRef<string | null>(null)

  useExternalSync(() => {
    const topStackId = stacks[0]?.id ?? null
    if (topStackId && topStackIdRef.current !== topStackId) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    topStackIdRef.current = topStackId
  }, [stacks])

  useExternalSync(() => {
    if (!highlightStackId) return
    const el = stackRowRefs.current.get(highlightStackId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightStackId])

  return { scrollRef, stackRowRefs }
}
