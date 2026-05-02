import type { MessageDictionary } from '../types'

export const settingsMessages: MessageDictionary = {
  'settings.title': { 'zh-CN': '设置', en: 'Settings' },
  'settings.description': {
    'zh-CN': '管理服务连接、外观和生成队列行为',
    en: 'Manage service connections, appearance, and generation queue behavior',
  },
  'settings.apiKeys.title': { 'zh-CN': '服务连接', en: 'Service connections' },
  'settings.apiKeys.description': {
    'zh-CN': '配置固定支持服务的访问密钥；模型列表仍由应用内置白名单控制。',
    en: 'Configure access keys for supported services. The model list stays controlled by the built-in allowlist.',
  },
  'settings.appearance.title': { 'zh-CN': '外观', en: 'Appearance' },
  'settings.appearance.description': {
    'zh-CN': '选择语言、界面色调和主色。',
    en: 'Choose the language, interface tone, and accent color.',
  },
  'settings.language.label': { 'zh-CN': '语言', en: 'Language' },
  'settings.theme.label': { 'zh-CN': '模式', en: 'Mode' },
  'settings.theme.light': { 'zh-CN': '浅色', en: 'Light' },
  'settings.theme.warm': { 'zh-CN': '暖调', en: 'Warm' },
  'settings.theme.dark': { 'zh-CN': '深色', en: 'Dark' },
  'settings.theme.system': { 'zh-CN': '自动', en: 'Auto' },
  'settings.colorTheme.label': { 'zh-CN': '主色', en: 'Accent color' },
  'settings.font.label': { 'zh-CN': '正文字体', en: 'Body font' },
  'settings.generationConcurrency.title': { 'zh-CN': '同时生成的最大并发数', en: 'Maximum concurrent generations' },
  'settings.generationConcurrency.description': {
    'zh-CN': '控制一次最多同时生成几张图。数字越大，排队更少，但更容易遇到接口限流。',
    en: 'Controls how many images can generate at the same time. Higher values reduce queueing but may hit API rate limits sooner.',
  },
  'settings.generationConcurrency.imageSuffix': { 'zh-CN': '张', en: 'images' },
  'settings.generationConcurrency.unlimited': { 'zh-CN': '不限', en: 'Unlimited' },
  'settings.agentSkills.title': { 'zh-CN': 'Agent Skills', en: 'Agent Skills' },
  'settings.agentSkills.description': {
    'zh-CN': '管理 Agent 可按需加载的文字指南。内置 Skill 随应用提供，用户 Skill 保存在此浏览器。',
    en: 'Manage text guides the agent can load on demand. Built-in skills ship with the app; user skills are saved in this browser.',
  },
  'settings.agentSkills.enabled': { 'zh-CN': '启用', en: 'Enabled' },
  'settings.agentSkills.disabled': { 'zh-CN': '停用', en: 'Disabled' },
  'settings.agentSkills.source.system': { 'zh-CN': '系统', en: 'System' },
  'settings.agentSkills.source.user': { 'zh-CN': '用户', en: 'User' },
  'settings.agentSkills.fileCount': { 'zh-CN': '{count} 个文件', en: '{count} files' },
  'settings.agentSkills.delete': { 'zh-CN': '删除', en: 'Delete' },
  'settings.agentSkills.deleteUnavailable': { 'zh-CN': '内置 Skill 不能删除', en: 'Built-in skills cannot be deleted' },
  'settings.agentSkills.empty': { 'zh-CN': '还没有 Skill。', en: 'No skills yet.' },
  'settings.agentSkills.builtin.editorialSketchArt.description': {
    'zh-CN': '手绘 editorial 插画、对比图和 Excalidraw 风格图解指南。',
    en: 'Guide for hand-drawn editorial illustrations, comparisons, and Excalidraw-style diagrams.',
  },
  'settings.agentSkills.builtin.baoyuCoverImage.description': {
    'zh-CN': '文章封面图生成指南，覆盖类型、配色、渲染、文字和情绪维度。',
    en: 'Guide for article cover images across type, palette, rendering, text, and mood dimensions.',
  },
  'settings.agentSkills.builtin.skillCreator.description': {
    'zh-CN': '帮助 Agent 把可复用流程沉淀成精简 Skill。',
    en: 'Helps the agent turn reusable workflows into concise skills.',
  },
  'settings.agentSkills.builtin.articleCoverImage.description': {
    'zh-CN': '文章 / 公众号 / 博客封面图，type × palette × rendering × text × mood 五维度自由组合。',
    en: 'Article / blog cover images via the 5-dimension system (type × palette × rendering × text × mood).',
  },
  'settings.agentSkills.builtin.xhsCardSeries.description': {
    'zh-CN': '小红书 / 微信图文系列卡，多张连贯，12 风格 × 8 布局 × 3 配色。',
    en: 'Coherent Xiaohongshu / WeChat image card series across 12 styles, 8 layouts, and 3 palettes.',
  },
  'settings.agentSkills.builtin.editorialPoster.description': {
    'zh-CN': '影评 / 书评 / 演唱会海报，screen-print + duotone 双色调编辑风。',
    en: 'Editorial movie / book / concert posters in screen-print and duotone style.',
  },
  'settings.agentSkills.builtin.knowledgeInfographic.description': {
    'zh-CN': '高密度知识卡 / 信息图，notion 极简、sketch-notes 手绘、chalkboard 黑板三选一。',
    en: 'Dense knowledge cards in notion line, sketch-notes, or chalkboard styles.',
  },
  'settings.agentSkills.builtin.sceneCinematic.description': {
    'zh-CN': '电影感叙事场景图，强氛围、宽幅 2.35:1、大气透视。',
    en: 'Cinematic narrative scene images with strong atmosphere and wide 2.35:1 framing.',
  },
  'settings.agentSkills.builtin.comicStrip.description': {
    'zh-CN': '多格漫画 / 分镜故事，single-sheet 一图多格或 multi-image 多张连贯。',
    en: 'Multi-panel comic strips and storyboards in single-sheet or multi-image mode.',
  },
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
