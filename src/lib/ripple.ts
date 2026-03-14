const DURATION = 600
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

export function initRipple() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  document.addEventListener('pointerdown', (event) => {
    const button = (event.target as Element).closest('button')
    if (!button || button.disabled) return

    const rect = button.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    // size must cover the farthest corner from the click point
    const dx = Math.max(x, rect.width - x)
    const dy = Math.max(y, rect.height - y)
    const size = Math.hypot(dx, dy) * 2

    // snapshot color at click time so state transitions don't affect the ripple mid-animation
    const color = window.getComputedStyle(button).color

    const ripple = document.createElement('span')
    Object.assign(ripple.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: color,
      pointerEvents: 'none',
      // keep z-index below button content
      zIndex: '0',
    })

    button.appendChild(ripple)

    const anim = ripple.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0)', opacity: 0.12 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      ],
      { duration: DURATION, easing: EASING, fill: 'forwards' },
    )

    anim.addEventListener('finish', () => ripple.remove())
  })
}
