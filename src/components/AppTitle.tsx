import { useRef, useCallback, useEffect } from 'react'

const TEXT = 'Nano Banana Playground'
const MAX_DIST = 100

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

type Props = { className?: string }

export function AppTitle({ className = '' }: Props) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  // Cache rects to avoid layout thrashing on every mousemove
  const cachedRects = useRef<DOMRect[]>([])

  const updateRects = useCallback(() => {
    cachedRects.current = refs.current.map(
      (span) => span?.getBoundingClientRect() ?? new DOMRect(),
    )
  }, [])

  useEffect(() => {
    updateRects()
    const ro = new ResizeObserver(updateRects)
    ro.observe(document.documentElement)
    window.addEventListener('scroll', updateRects, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', updateRects)
    }
  }, [updateRects])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLHeadingElement>) => {
    const isDark = document.documentElement.classList.contains('dark')
    const grad = isDark ? 60 : 0
    const { clientX: mx, clientY: my } = e

    // Disable transition while cursor is moving — instant response
    refs.current.forEach((span, i) => {
      if (!span) return
      const rect = cachedRects.current[i]
      if (!rect) return

      span.style.transition = 'none'

      const dist = Math.hypot(
        mx - (rect.left + rect.width / 2),
        my - (rect.top + rect.height / 2),
      )
      // t=0: near cursor, t=1: far
      const t = Math.min(1, dist / MAX_DIST)

      // wdth: near→151 (expand), midpoint 65 (default), far→45 (compress)
      const wdth = t < 0.5
        ? lerp(151, 65, t * 2)
        : lerp(65, 45, (t - 0.5) * 2)

      span.style.fontVariationSettings = [
        `'wdth' ${wdth.toFixed(1)}`,
        `'wght' ${lerp(280, 650, t).toFixed(1)}`,
        `'opsz' 24`,
        `'GRAD' ${grad}`,
      ].join(', ')
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    refs.current.forEach((span) => {
      if (!span) return
      // Re-enable transition for smooth spring-back on leave
      span.style.transition = ''
      span.style.fontVariationSettings = ''
    })
  }, [])

  return (
    <h1
      className={`app-title ${className}`.trim()}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {[...TEXT].map((char, i) => (
        <span key={i} ref={(el) => { refs.current[i] = el }}>
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </h1>
  )
}
