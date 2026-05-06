import { useSyncExternalStore } from 'react'

import {
  getStripDownloadMetadata,
  setStripDownloadMetadata,
  subscribeStripDownloadMetadata,
} from '../config/downloadMetadata'

export function useStripDownloadMetadata(): {
  stripDownloadMetadata: boolean
  setStripDownloadMetadata: (strip: boolean) => void
} {
  const stripDownloadMetadata = useSyncExternalStore(
    subscribeStripDownloadMetadata,
    getStripDownloadMetadata,
    getStripDownloadMetadata,
  )
  return { stripDownloadMetadata, setStripDownloadMetadata }
}
