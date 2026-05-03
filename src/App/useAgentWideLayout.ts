import { startTransition, useCallback, useMemo, useState } from 'react'

import {
  DESKTOP_AGENT_CHAT_MIN_WIDTH_PX,
  DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX,
  DESKTOP_AGENT_PANEL_WIDE_RATIO,
  DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX,
  DESKTOP_AGENT_SIDE_SPACE_MAX_PX,
  DESKTOP_AGENT_SIDE_SPACE_MIN_PX,
  DESKTOP_INPUT_PANEL_WIDTH,
  DESKTOP_INPUT_PANEL_WIDTH_PX,
  getInitialAgentPanelWide,
  getInitialAgentWideTipDismissed,
} from './initThemePrefs'
import { useWindowEvent } from '../hooks/effects'
import type { InputMode } from '../hooks/usePlayground'
import { writeAgentPanelWidePreference, writeAgentWideTipDismissedPreference } from '../lib/preferenceStore'

type AgentPanelWideLayout = { fits: boolean; panelWidth: number; sideSpace: number }

const DESKTOP_LAYOUT_MIN_WIDTH_PX = 768

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolveAgentPanelWideLayout(viewportWidth: number): AgentPanelWideLayout {
  const maxPanelWidth = viewportWidth - DESKTOP_AGENT_PANEL_OUTPUT_MIN_WIDTH_PX
  const preferredPanelWidth = viewportWidth * DESKTOP_AGENT_PANEL_WIDE_RATIO
  const panelWidth = Math.max(DESKTOP_INPUT_PANEL_WIDTH_PX, Math.min(preferredPanelWidth, maxPanelWidth))
  const availableSideSpace = (panelWidth - DESKTOP_AGENT_SESSION_SIDEBAR_WIDTH_PX - DESKTOP_AGENT_CHAT_MIN_WIDTH_PX) / 2
  const sideSpace = clampNumber(availableSideSpace, DESKTOP_AGENT_SIDE_SPACE_MIN_PX, DESKTOP_AGENT_SIDE_SPACE_MAX_PX)

  return {
    fits: viewportWidth >= DESKTOP_LAYOUT_MIN_WIDTH_PX && availableSideSpace >= DESKTOP_AGENT_SIDE_SPACE_MIN_PX,
    panelWidth,
    sideSpace,
  }
}

// Tracks viewport width and the persisted "wide agent panel" preference,
// deriving the desktop input panel width / side-space CSS values used by
// the desktop layout.
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
    ? `${Math.round(agentWideLayout.panelWidth)}px`
    : DESKTOP_INPUT_PANEL_WIDTH
  const agentPanelSideSpace = `${Math.round(agentWideLayout.sideSpace)}px`

  const dismissAgentWideTip = useCallback(() => {
    setAgentWideTipDismissed(true)
    writeAgentWideTipDismissedPreference()
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
    agentPanelSideSpace,
    showAgentWideTip,
    toggleAgentPanelWide,
    dismissAgentWideTip,
  }
}
