import { useRef, useCallback } from 'react'

const TEXT = 'Nano Banana Playground'
const MAX_DIST = 100

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

type Props = { className?: string }

export function AppTitle({ className = '' }: Props) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLHeadingElement>) => {
    const isDark = document.documentElement.classList.contains('dark')
    const grad = isDark ? 60 : 0
    const { clientX: mx, clientY: my } = e

    refs.current.forEach((span) => {
      if (!span) return
      const rect = span.getBoundingClientRect()
      const dist = Math.hypot(
        mx - (rect.left + rect.width / 2),
        my - (rect.top + rect.height / 2),
      )
      // t=0: near cursor, t=1: far
      const t = Math.min(1, dist / MAX_DIST)

      // wdth: near→151 (expand), midpoint 65 (default), far→45 (compress)
      // compensates total width so text stays within container
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
