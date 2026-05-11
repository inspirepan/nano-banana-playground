import { useCallback, useRef, useState } from 'react'

import type { usePlayground } from '../hooks/usePlayground'
import type { Translate } from '../i18n'
import type { PlaygroundImageMeta } from '../lib/types'

type Pg = ReturnType<typeof usePlayground>

type Params = {
  restoreGeneratedImageParams: Pg['restoreGeneratedImageParams']
  rerollGeneratedImage: Pg['rerollGeneratedImage']
  retryGenerationSlot: Pg['retryGenerationSlot']
  retryFailedGenerationImage: Pg['retryFailedGenerationImage']
  t: Translate
}

type RegenerationActionResult = { ok: boolean; message: string; batchId?: string; slotId?: string; slotIndex?: number }

const TOAST_DURATION_MS = 2500

// Shared toast surface for restore-prompt / reroll / retry-slot actions.
// Each call clears the previous timer before scheduling a new one so the
// most recent message stays visible for the full TOAST_DURATION_MS.
export function useRegenerationToast({
  restoreGeneratedImageParams,
  rerollGeneratedImage,
  retryGenerationSlot,
  retryFailedGenerationImage,
  t,
}: Params) {
  const [regenToast, setRegenToast] = useState<string | null>(null)
  const regenToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    if (regenToastTimer.current) clearTimeout(regenToastTimer.current)
    setRegenToast(message)
    regenToastTimer.current = setTimeout(() => setRegenToast(null), TOAST_DURATION_MS)
  }, [])

  const handleRegenerate = useCallback(
    async (image: PlaygroundImageMeta) => {
      const result = await restoreGeneratedImageParams(image)
      if (result === null) return
      const message = result.restoredModel
        ? result.refCount > 0
          ? t('app.toast.restoredPromptParamsRefs', { count: result.refCount })
          : t('app.toast.restoredPromptParams')
        : result.refCount > 0
          ? t('app.toast.restoredUnavailableModelPromptRefs', { count: result.refCount })
          : t('app.toast.restoredUnavailableModelPrompt')
      showToast(message)
    },
    [restoreGeneratedImageParams, showToast, t],
  )

  const handleReroll = useCallback(
    async (image: PlaygroundImageMeta): Promise<RegenerationActionResult> => {
      const result = await rerollGeneratedImage(image).catch(() => ({ status: 'unavailable' as const }))
      const message =
        result.status === 'queued'
          ? t('app.toast.rerollQueued')
          : result.status === 'unsupported-mask'
            ? t('app.toast.rerollUnsupportedMask')
            : t('app.toast.rerollFailed')
      showToast(message)
      return result.status === 'queued'
        ? { ok: true, message, batchId: result.batchId, slotId: result.slotId, slotIndex: result.slotIndex }
        : { ok: false, message }
    },
    [rerollGeneratedImage, showToast, t],
  )

  const handleRetryGenerationSlot = useCallback(
    (jobId: string, slotId: string): RegenerationActionResult => {
      const result = retryGenerationSlot(jobId, slotId)
      const message = result.status === 'queued' ? t('app.toast.retryQueued') : t('app.toast.retryFailed')
      showToast(message)
      return result.status === 'queued'
        ? { ok: true, message, batchId: result.batchId, slotId: result.slotId, slotIndex: result.slotIndex }
        : { ok: false, message }
    },
    [retryGenerationSlot, showToast, t],
  )

  const handleRetryFailedGenerationImage = useCallback(
    async (image: PlaygroundImageMeta): Promise<RegenerationActionResult> => {
      const result = await retryFailedGenerationImage(image).catch(() => ({ status: 'unavailable' as const }))
      const message = result.status === 'queued' ? t('app.toast.retryQueued') : t('app.toast.retryFailed')
      showToast(message)
      return result.status === 'queued'
        ? { ok: true, message, batchId: result.batchId, slotId: result.slotId, slotIndex: result.slotIndex }
        : { ok: false, message }
    },
    [retryFailedGenerationImage, showToast, t],
  )

  return { regenToast, handleRegenerate, handleReroll, handleRetryGenerationSlot, handleRetryFailedGenerationImage }
}
