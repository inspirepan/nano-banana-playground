import { useCallback, useState } from 'react'

import { downloadImagesZip } from '../../lib/exportImages'
import type { PlaygroundImageMeta } from '../../lib/types'

type Params = {
  history: PlaygroundImageMeta[]
}

type Result = {
  exporting: boolean
  handleExportAll: () => Promise<void>
}

export function useStackExporting({ history }: Params): Result {
  const [exporting, setExporting] = useState(false)

  const handleExportAll = useCallback(async () => {
    if (exporting || history.length === 0) return
    setExporting(true)
    try {
      await downloadImagesZip(history, `images-export-${new Date().toISOString().slice(0, 10)}.zip`)
    } finally {
      setExporting(false)
    }
  }, [exporting, history])

  return { exporting, handleExportAll }
}
