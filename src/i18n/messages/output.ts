import type { MessageDictionary } from '../types'

export const outputMessages: MessageDictionary = {
  'output.adjustParenthetical': { 'zh-CN': '（调整）', en: '(Adjust)' },
  'output.cancelGeneration': { 'zh-CN': '取消生成', en: 'Cancel generation' },
  'output.clearFailed': { 'zh-CN': '清空失败', en: 'Clear failed' },
  'output.downloadZip': { 'zh-CN': '下载 ZIP', en: 'Download ZIP' },
  'output.emptyDescription': {
    'zh-CN': '配置左侧参数并点击「生成」开始。',
    en: 'Configure the settings on the left and click Generate to start.',
  },
  'output.emptyHistory': { 'zh-CN': '空历史', en: 'Empty history' },
  'output.emptyTitle': { 'zh-CN': '生成结果会出现在这里', en: 'Generated results will appear here' },
  'output.exporting': { 'zh-CN': '导出中…', en: 'Exporting…' },
  'output.exportZip': { 'zh-CN': '导出 ZIP', en: 'Export ZIP' },
  'output.failedCount': { 'zh-CN': '失败 {count}', en: '{count} failed' },
  'output.gallerySummary': {
    'zh-CN': '{groups} 组，{count} 张生成图，存储于本地浏览器',
    en: '{groups} groups, {count} generated images, stored in this browser',
  },
  'output.imageCount': { 'zh-CN': '{count} 张', en: '{count} images' },
  'output.noImages': { 'zh-CN': '暂无图片', en: 'No images yet' },
  'output.packaging': { 'zh-CN': '打包中…', en: 'Packaging…' },
  'output.retryFailed': { 'zh-CN': '重试失败项', en: 'Retry failed' },
  'output.stripMetadataInfo': { 'zh-CN': '下载元数据说明', en: 'Download metadata info' },
  'output.stripMetadataShort': { 'zh-CN': '去 AI 标记', en: 'Strip metadata' },
  'output.stripMetadataToggle': { 'zh-CN': '下载时去除元数据', en: 'Strip metadata on download' },
  'output.stripMetadataTooltip': {
    'zh-CN':
      '开启后，下载和 ZIP 导出会重新编码图片，去除 C2PA / Content Credentials、EXIF、XMP 等容器元数据，有助于避免部分平台基于这些元数据显示“图片由 AI 生成”。历史里的原始图片不会改变；JPEG 会重新压缩。',
    en: 'When enabled, downloads and ZIP exports re-encode images to remove container metadata such as C2PA / Content Credentials, EXIF, and XMP. This can help avoid some platforms showing an “AI-generated image” label based on that metadata. Original history images stay unchanged; JPEG files are recompressed.',
  },
  'output.status.generatingCount': { 'zh-CN': '{count} 项生成中', en: '{count} generating' },
  'output.status.queuedCount': { 'zh-CN': '{count} 项排队中', en: '{count} queued' },
  'output.status.retryingCount': { 'zh-CN': '{count} 项重试中', en: '{count} retrying' },
  'output.viewAll': { 'zh-CN': '查看全部', en: 'View all' },
}
