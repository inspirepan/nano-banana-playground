import { startTransition, useCallback, useMemo, useState } from 'react'

import {
  DESKTOP_AGENT_CHAT_MIN_WIDTH_PX,
  DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX,
  DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX,
  DESKTOP_INPUT_PANEL_WIDTH,
  getInitialAgentPanelWide,
  getInitialAgentWideTipDismissed,
} from './initThemePrefs'
import { useWindowEvent } from '../hooks/effects'
import type { InputMode } from '../hooks/usePlayground'
import { writeAgentPanelWidePreference, writeAgentWideTipDismissedPreference } from '../lib/preferenceStore'

type AgentPanelWideLayout = { fits: boolean }

const DESKTOP_LAYOUT_MIN_WIDTH_PX = 768

function resolveAgentPanelWideLayout(viewportWidth: number): AgentPanelWideLayout {
  // Wide-agent fits when the viewport can hold sidebar + chat min + output min.
  const required =
    DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX + DESKTOP_AGENT_CHAT_MIN_WIDTH_PX + DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX
  return {
    fits: viewportWidth >= DESKTOP_LAYOUT_MIN_WIDTH_PX && viewportWidth >= required,
  }
}

// Tracks viewport width and the persisted "wide agent panel" preference,
// deriving the desktop input panel width used by the desktop layout.
export function useAgentWideLayout(inputMode: InputMode) {
  const [agentPanelWide, setAgentPanelWide] = useState(getInitialAgentPanelWide)
  const [agentWideTipDismissed, setAgentWideTipDismissed] = useState(getInitialAgentWideTipDismissed)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))

  useWindowEvent('resize', () => {
    startTransition(() => setViewportWidth(window.innerWidth))
  })

  const agentWideLayout = useMemo(() => resolveAgentPanelWideLayout(viewportWidth), [viewportWidth])
  const agentPanelSidebarFits = agentWideLayout.fits
  const useWideAgentPanel = inputMode === 'agent' && agentPanelWide && agentPanelSidebarFits
  const desktopInputPanelWidth = useWideAgentPanel
    ? `${DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX}px`
    : DESKTOP_INPUT_PANEL_WIDTH

  const dismissAgentWideTip = useCallback(() => {
    setAgentWideTipDismissed(true)
    writeAgentWideTipDismissedPreference()
  }, [])

  const setAgentPanelWidePreference = useCallback((wide: boolean) => {
    setAgentPanelWide(wide)
    writeAgentPanelWidePreference(wide)
  }, [])

  const setAgentWideTipDismissedPreference = useCallback((dismissed: boolean) => {
    setAgentWideTipDismissed(dismissed)
    writeAgentWideTipDismissedPreference(dismissed)
  }, [])

  const toggleAgentPanelWide = useCallback(() => {
    setAgentPanelWide((prev) => {
      const next = !prev
      writeAgentPanelWidePreference(next)
      return next
    })
    dismissAgentWideTip()
  }, [dismissAgentWideTip])

  const showAgentWideTip = inputMode === 'agent' && agentPanelSidebarFits && !agentPanelWide && !agentWideTipDismissed

  return {
    agentPanelWide,
    agentPanelSidebarFits,
    useWideAgentPanel,
    desktopInputPanelWidth,
    showAgentWideTip,
    toggleAgentPanelWide,
    dismissAgentWideTip,
    setAgentPanelWidePreference,
    setAgentWideTipDismissedPreference,
  }
}
