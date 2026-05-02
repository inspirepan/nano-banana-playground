import { useEffect, useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react'

type Cleanup = void | (() => void)

export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

export function useMountEffect(effect: () => Cleanup): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate mount/unmount boundary
  useEffect(effect, [])
}

export function useExternalSync(effect: () => Cleanup, deps: DependencyList): void {
  // Thin adapter for explicit external-system synchronization. Callers should
  // prefer narrower hooks such as useWindowEvent/useResizeObserver when possible.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dependency list is owned by the caller
  useEffect(effect, deps)
}

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
  enabled = true,
): void {
  const listenerRef = useLatestRef(listener)
  const capture = options?.capture
  const passive = options?.passive

  useEffect(() => {
    if (!enabled) return
    const handler = (event: WindowEventMap[K]) => listenerRef.current(event)
    window.addEventListener(type, handler as EventListener, options)
    return () => window.removeEventListener(type, handler as EventListener, options)
  }, [capture, enabled, listenerRef, passive, type])
}

export function useWindowResize(listener: () => void, enabled = true): void {
  useWindowEvent('resize', listener, undefined, enabled)
}

export function useMediaQuery(query: string): boolean {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return { query, matches: false }
    return { query, matches: window.matchMedia(query).matches }
  })
  if (state && state.query !== query) {
    setState({ query, matches: typeof window !== 'undefined' && window.matchMedia(query).matches })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const handler = (event: MediaQueryListEvent) => setState({ query, matches: event.matches })
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return state.matches
}

export function useVisualViewport(enabled = true): { height: number; offsetTop: number } {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return { height: 0, offsetTop: 0 }
    const vv = window.visualViewport
    return {
      height: vv?.height ?? window.innerHeight,
      offsetTop: vv?.offsetTop ?? 0,
    }
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setState({ height: vv.height, offsetTop: vv.offsetTop })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return state
}

export function useResizeObserver<T extends Element>(
  targetRef: RefObject<T | null>,
  onResize: ResizeObserverCallback,
  enabled = true,
): void {
  const onResizeRef = useLatestRef(onResize)

  useEffect(() => {
    const target = targetRef.current
    if (!enabled || !target) return
    const observer = new ResizeObserver((entries, observerInstance) => {
      onResizeRef.current(entries, observerInstance)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled, onResizeRef, targetRef])
}
