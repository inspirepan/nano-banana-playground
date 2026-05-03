import { useCallback, useState } from 'react'

import { downloadImagesZip } from '../../lib/exportImages'
import type { ImageStack } from '../../lib/stacks'
import type { PlaygroundImageMeta } from '../../lib/types'

type Params = {
  history: PlaygroundImageMeta[]
}

type Result = {
  exporting: boolean
  exportingStackId: string | null
  handleExportAll: () => Promise<void>
  handleExportStack: (stack: ImageStack) => Promise<void>
}

export function useStackExporting({ history }: Params): Result {
  const [exporting, setExporting] = useState(false)
  const [exportingStackId, setExportingStackId] = useState<string | null>(null)

  const handleExportAll = useCallback(async () => {
    if (exporting || history.length === 0) return
    setExporting(true)
    try {
      await downloadImagesZip(history, `nano-banana-export-${new Date().toISOString().slice(0, 10)}.zip`)
    } finally {
      setExporting(false)
    }
  }, [exporting, history])

  const handleExportStack = useCallback(
    async (stack: ImageStack) => {
      if (exportingStackId || stack.images.length < 2) return
      setExportingStackId(stack.id)
      try {
        await downloadImagesZip(stack.images, `nano-banana-stack-${stack.id.slice(0, 8)}.zip`)
      } finally {
        setExportingStackId(null)
      }
    },
    [exportingStackId],
  )

  return { exporting, exportingStackId, handleExportAll, handleExportStack }
}
