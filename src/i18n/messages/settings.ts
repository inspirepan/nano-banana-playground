import type { MessageDictionary } from '../types'

export const settingsMessages: MessageDictionary = {
  'settings.title': { 'zh-CN': '设置', en: 'Settings' },
  'settings.description': {
    'zh-CN': '管理密钥、外观和生成队列行为',
    en: 'Manage keys, appearance, and generation queue behavior',
  },
  'settings.apiKeys.title': { 'zh-CN': '接口密钥', en: 'API keys' },
  'settings.apiKeys.description': {
    'zh-CN': '配置浏览器本地保存的 Gemini 和 OpenAI 访问密钥。',
    en: 'Configure the Gemini and OpenAI access keys saved locally in this browser.',
  },
  'settings.appearance.title': { 'zh-CN': '外观', en: 'Appearance' },
  'settings.appearance.description': {
    'zh-CN': '选择语言、明暗模式和界面主色。',
    en: 'Choose the language, brightness mode, and interface accent color.',
  },
  'settings.language.label': { 'zh-CN': '语言', en: 'Language' },
  'settings.theme.label': { 'zh-CN': '模式', en: 'Mode' },
  'settings.theme.light': { 'zh-CN': '浅色', en: 'Light' },
  'settings.theme.dark': { 'zh-CN': '深色', en: 'Dark' },
  'settings.theme.system': { 'zh-CN': '系统', en: 'System' },
  'settings.colorTheme.label': { 'zh-CN': '主色', en: 'Accent color' },
  'settings.font.label': { 'zh-CN': '正文字体', en: 'Body font' },
  'settings.generationConcurrency.title': { 'zh-CN': '同时生成的最大并发数', en: 'Maximum concurrent generations' },
  'settings.generationConcurrency.description': {
    'zh-CN': '控制一次最多同时生成几张图。数字越大，排队更少，但更容易遇到接口限流。',
    en: 'Controls how many images can generate at the same time. Higher values reduce queueing but may hit API rate limits sooner.',
  },
  'settings.generationConcurrency.imageSuffix': { 'zh-CN': '张', en: 'images' },
  'settings.generationConcurrency.unlimited': { 'zh-CN': '不限', en: 'Unlimited' },
  'settings.data.title': { 'zh-CN': '数据', en: 'Data' },
  'settings.data.description': {
    'zh-CN': '清空当前站点保存在此浏览器里的所有数据。',
    en: 'Clear all data saved by this site in the current browser.',
  },
  'settings.data.currentUsage': { 'zh-CN': '当前占用', en: 'Current usage' },
  'settings.data.calculating': { 'zh-CN': '计算中…', en: 'Calculating…' },
  'settings.data.calculatingShort': { 'zh-CN': '计算中', en: 'Calculating' },
  'settings.data.browserEstimate': { 'zh-CN': '浏览器估算 {size}', en: 'Browser estimate {size}' },
  'settings.data.quota': { 'zh-CN': ' / 可用 {size}', en: ' / quota {size}' },
  'settings.data.clearDescription': {
    'zh-CN':
      '会删除 API Key、外观设置、生成历史、参考图、缓存、当前 URL 编辑态，以及旧版 IndexedDB 数据。清空后页面会重新加载。',
    en: 'This deletes API keys, appearance settings, generation history, reference images, caches, the current URL edit state, and legacy IndexedDB data. The page will reload after clearing.',
  },
  'settings.data.clear': { 'zh-CN': '清空数据', en: 'Clear data' },
  'settings.data.clearing': { 'zh-CN': '清空中…', en: 'Clearing…' },
  'settings.data.confirmClear': { 'zh-CN': '确认清空', en: 'Confirm clear' },
  'settings.error.readSiteDataUsage': { 'zh-CN': '无法读取当前数据大小。', en: 'Unable to read current data usage.' },
  'settings.error.clearSiteData': {
    'zh-CN': '清空失败，请刷新后重试。',
    en: 'Clearing failed. Refresh and try again.',
  },
}
