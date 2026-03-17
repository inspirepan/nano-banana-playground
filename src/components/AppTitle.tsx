import { useRef, useCallback, useEffect } from 'react'

const TEXT = 'Nano Banana Playground'
const MAX_DIST = 100
const WAVE_WIDTH = 3.5  // chars on each side of wave peak
const SWEEP_DURATION = 600 // ms

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function readTitleColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-title').trim() || '#1f1f1f'
}

type Props = { className?: string; sweepKey?: string }

export function AppTitle({ className = '', sweepKey }: Props) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const cachedRects = useRef<DOMRect[]>([])
  const animRef = useRef<number | null>(null)
  const prevColorRef = useRef('')

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

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

  const startSweep = useCallback((oldColor: string, newColor: string) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)

    const charCount = refs.current.length
    const startTime = performance.now()

    // Lock all chars to old color before wave starts
    refs.current.forEach((span) => {
      if (!span) return
      span.style.transition = 'none'
      span.style.color = oldColor
      span.style.fontVariationSettings = ''
    })

    const tick = (now: number) => {
      const elapsed = now - startTime
      const rawPos = ((elapsed / SWEEP_DURATION) * (charCount + WAVE_WIDTH * 2)) - WAVE_WIDTH

      refs.current.forEach((span, i) => {
        if (!span) return
        const dist = Math.abs(i - rawPos)
        const t = Math.max(0, 1 - dist / WAVE_WIDTH) // 1 at peak, 0 far

        if (t > 0.01) {
          // Wave touching — expand font, light up in new color
          span.style.transition = 'none'
          span.style.fontVariationSettings = [
            `'wdth' ${lerp(65, 151, t).toFixed(1)}`,
            `'wght' ${lerp(650, 280, t).toFixed(1)}`,
            `'opsz' 24`,
            `'GRAD' 0`,
          ].join(', ')
          span.style.color = newColor
        } else if (rawPos > i + WAVE_WIDTH) {
          // Wave passed — spring back, keep new color
          span.style.transition = ''
          span.style.fontVariationSettings = ''
          span.style.color = newColor
        }
        // else: wave hasn't reached yet — stays in oldColor set above
      })

      if (rawPos < charCount + WAVE_WIDTH) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        // Done — remove inline colors, h1's text-primary CSS takes over
        refs.current.forEach((span) => {
          if (!span) return
          span.style.transition = ''
          span.style.fontVariationSettings = ''
          span.style.color = ''
        })
        animRef.current = null
      }
    }

    animRef.current = requestAnimationFrame(tick)
  }, [])

  // Trigger sweep only when title color actually changes; skip on mount and StrictMode re-invoke
  useEffect(() => {
    const newColor = readTitleColor()
    const oldColor = prevColorRef.current
    prevColorRef.current = newColor
    if (!oldColor || oldColor === newColor) return
    startSweep(oldColor, newColor)
  }, [sweepKey, startSweep])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLHeadingElement>) => {
    if (animRef.current) return // don't fight the sweep

    const isDark = document.documentElement.classList.contains('dark')
    const grad = isDark ? 60 : 0
    const { clientX: mx, clientY: my } = e

    refs.current.forEach((span, i) => {
      if (!span) return
      const rect = cachedRects.current[i]
      if (!rect) return

      span.style.transition = 'none'

      const dist = Math.hypot(
        mx - (rect.left + rect.width / 2),
        my - (rect.top + rect.height / 2),
      )
      const t = Math.min(1, dist / MAX_DIST)

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
    if (animRef.current) return
    refs.current.forEach((span) => {
      if (!span) return
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
