export const TEXTAREA_MIN_HEIGHT = 120
export const TEXTAREA_MAX_HEIGHT = 360

export function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

export function autoResizeTextarea(el: HTMLTextAreaElement) {
  const scrollContainer = findScrollableAncestor(el)
  const prevScroll = scrollContainer?.scrollTop
  const borderHeight = el.offsetHeight - el.clientHeight
  el.style.height = 'auto'
  const target = Math.max(el.scrollHeight + borderHeight + 1, TEXTAREA_MIN_HEIGHT)
  const capped = Math.min(target, TEXTAREA_MAX_HEIGHT)
  el.style.height = `${capped}px`
  el.style.overflowY = target > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
  if (scrollContainer && prevScroll !== undefined) scrollContainer.scrollTop = prevScroll
}
