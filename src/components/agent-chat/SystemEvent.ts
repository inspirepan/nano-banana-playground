function countCommaList(value: string | undefined): number {
  if (!value) return 0
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length
}

export function summarizeSystemEvent(text: string): string {
  const tool = /tool\s+(\w+)/.exec(text)?.[1]
  const status = /status:\s*(\w+)/.exec(text)?.[1]
  const reservedRaw = /reserved_image_ids:\s*(.*)/.exec(text)?.[1]
  const imagesRaw = /image_ids:\s*(.*)/.exec(text)?.[1]
  const reservedCount = countCommaList(reservedRaw)
  const completedCount = countCommaList(imagesRaw)
  const failedCount = Math.max(0, reservedCount - completedCount)

  if (tool !== 'GenImage') return `${tool ?? '工具'} 回调${status ? ` · ${status}` : ''}`

  switch (status) {
    case 'completed':
      return `生成任务完成，生成了 ${completedCount} 张`
    case 'failed': {
      const parts: string[] = []
      if (completedCount > 0) parts.push(`成功 ${completedCount} 张`)
      if (failedCount > 0) parts.push(`失败 ${failedCount} 张`)
      return parts.length > 0 ? `生成任务失败，${parts.join('，')}` : '生成任务失败'
    }
    case 'rejected':
      return '生成任务已拒绝'
    case 'canceled':
      return completedCount > 0 ? `生成任务已取消，已完成 ${completedCount} 张` : '生成任务已取消'
    default:
      return `生成任务 · ${status ?? ''}`.trim()
  }
}
