type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string
  }
}

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false

  const nav = navigator as NavigatorWithUserAgentData
  const platform = nav.userAgentData?.platform || navigator.platform || ''
  if (/mac|iphone|ipad|ipod/i.test(platform)) return true

  return /macintosh|iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function getPrimaryModifierKeyLabel(): string {
  return isApplePlatform() ? '⌘' : 'Ctrl'
}

export function getPrimaryModifierShortcutLabel(key: string): string {
  return `${getPrimaryModifierKeyLabel()}+${key}`
}

export function hasPrimaryModifier(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>): boolean {
  return isApplePlatform() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}
