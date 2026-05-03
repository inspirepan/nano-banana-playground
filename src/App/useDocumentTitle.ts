import { useRef } from 'react'

import { useExternalSync, useMountEffect } from '../hooks/effects'
import type { Translate } from '../i18n'
import { BASE_TITLE, TITLE_RESET_DELAY_MS } from './initThemePrefs'

type Params = {
  queueActive: number
  queueDone: number
  queueTotal: number
  queueFailed: number
  queueSucceeded: number
  t: Translate
}

// Mirrors generation queue state into document.title, with a delayed
// reset back to BASE_TITLE after success/failure.
export function useDocumentTitle({ queueActive, queueDone, queueTotal, queueFailed, queueSucceeded, t }: Params) {
  const titleResetTimerRef = useRef<number | null>(null)
  const prevActiveQueueRef = useRef(0)

  useExternalSync(() => {
    const clearTitleResetTimer = () => {
      if (!titleResetTimerRef.current) return
      window.clearTimeout(titleResetTimerRef.current)
      titleResetTimerRef.current = null
    }

    if (queueActive > 0) {
      clearTitleResetTimer()
      document.title =
        queueTotal > 0
          ? t('app.title.generatingProgress', { done: queueDone, total: queueTotal, app: BASE_TITLE })
          : t('app.title.generating', { app: BASE_TITLE })
    } else if (prevActiveQueueRef.current > 0) {
      clearTitleResetTimer()
      if (queueFailed > 0 && queueSucceeded === 0) {
        document.title = t('app.title.failed', { app: BASE_TITLE })
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else if (queueTotal > 0 && queueDone === queueTotal) {
        document.title = t('app.title.completed', { app: BASE_TITLE })
        titleResetTimerRef.current = window.setTimeout(() => {
          document.title = BASE_TITLE
          titleResetTimerRef.current = null
        }, TITLE_RESET_DELAY_MS)
      } else {
        document.title = BASE_TITLE
      }
    } else {
      clearTitleResetTimer()
      document.title = BASE_TITLE
    }

    prevActiveQueueRef.current = queueActive
  }, [queueActive, queueDone, queueFailed, queueSucceeded, queueTotal, t])

  useMountEffect(() => {
    return () => {
      if (titleResetTimerRef.current) window.clearTimeout(titleResetTimerRef.current)
      document.title = BASE_TITLE
    }
  })
}
