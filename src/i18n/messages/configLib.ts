import type { MessageDictionary } from '../types'

export const configLibMessages: MessageDictionary = {
  'configLib.models.searchTools.groupLabel': { 'zh-CN': '搜索增强', en: 'Search tools' },
  'configLib.models.webSearch.label': { 'zh-CN': 'Web 搜索', en: 'Web search' },
  'configLib.models.webSearch.tooltip': {
    'zh-CN': '启用 Google 搜索接地，让模型基于实时网页信息生成图片，如当前天气、股市、近期事件等。响应会附带来源链接。',
    en: 'Enable Google Search grounding so the model can generate images from live web information, such as current weather, stock markets, and recent events. Responses include source links.',
  },
  'configLib.models.imageSearch.label': { 'zh-CN': '图片搜索', en: 'Image search' },
  'configLib.models.imageSearch.tooltip': {
    'zh-CN':
      '启用 Google 图片搜索接地，模型会使用检索到的网络图片作为视觉上下文。可单独使用或与 Web 搜索叠加，生成结果需展示来源网页链接（仅 Nano Banana 2 支持）。',
    en: 'Enable Google Image Search grounding so the model can use retrieved web images as visual context. It can be used alone or together with Web search, and generated results must show source page links (Nano Banana 2 only).',
  },
  'configLib.models.thinking.label': { 'zh-CN': '思考等级', en: 'Thinking level' },
  'configLib.models.thinking.hint': { 'zh-CN': '平衡生成质量与延迟', en: 'Balance generation quality and latency' },
  'configLib.models.thinking.minimal.label': { 'zh-CN': 'Minimal', en: 'Minimal' },
  'configLib.models.thinking.minimal.tooltip': {
    'zh-CN': '默认等级。模型仍会进行推理，但大幅精简思考步骤以换取更低的响应延迟。',
    en: 'Default level. The model still reasons, but uses much shorter thinking steps for lower response latency.',
  },
  'configLib.models.thinking.high.label': { 'zh-CN': 'High', en: 'High' },
  'configLib.models.thinking.high.tooltip': {
    'zh-CN': '启用完整推理流程，适合复杂提示和高保真输出。延迟显著增加，思考 token 会被计费（无论是否返回思考内容）。',
    en: 'Enable full reasoning for complex prompts and high-fidelity output. Latency increases significantly, and thinking tokens are billed whether or not thinking content is returned.',
  },
  'configLib.models.quality.label': { 'zh-CN': '质量', en: 'Quality' },
  'configLib.models.quality.auto.label': { 'zh-CN': 'Auto', en: 'Auto' },
  'configLib.models.quality.auto.tooltip': {
    'zh-CN': '由模型根据提示自动选择质量等级。',
    en: 'Let the model choose the quality level automatically from the prompt.',
  },
  'configLib.models.quality.low.label': { 'zh-CN': 'Low', en: 'Low' },
  'configLib.models.quality.low.tooltip': {
    'zh-CN': '最低渲染质量。成本最低，延迟最短。',
    en: 'Lowest rendering quality. Lowest cost and shortest latency.',
  },
  'configLib.models.quality.medium.label': { 'zh-CN': 'Medium', en: 'Medium' },
  'configLib.models.quality.medium.tooltip': {
    'zh-CN': '中等渲染质量。成本与细节的折中点。',
    en: 'Medium rendering quality. A compromise between cost and detail.',
  },
  'configLib.models.quality.high.label': { 'zh-CN': 'High', en: 'High' },
  'configLib.models.quality.high.tooltip': {
    'zh-CN': '最高渲染质量。细节最丰富，单张成本也最高。',
    en: 'Highest rendering quality. The richest detail and highest per-image cost.',
  },

  'configLib.agentModels.thinking.off': { 'zh-CN': '关闭', en: 'Off' },
  'configLib.agentModels.thinking.minimal': { 'zh-CN': '低', en: 'Minimal' },
  'configLib.agentModels.thinking.low': { 'zh-CN': '中', en: 'Low' },
  'configLib.agentModels.thinking.medium': { 'zh-CN': '高', en: 'Medium' },
  'configLib.agentModels.thinking.high': { 'zh-CN': '超高', en: 'High' },

  'configLib.useApiKey.validationFailed': { 'zh-CN': '校验失败', en: 'Validation failed' },
  'configLib.generationQueue.timeout': {
    'zh-CN': '请求超时（5min），请检查网络连接或代理配置后重试',
    en: 'Request timed out (5 min). Check your network connection or proxy settings, then try again.',
  },
  'configLib.generationQueue.requestAborted': {
    'zh-CN': '请求被浏览器或网络中断，请检查网络连接或代理配置后重试',
    en: 'The request was interrupted by the browser or network. Check your connection or proxy settings, then try again.',
  },
  'configLib.generationQueue.networkCorsError': {
    'zh-CN': '网络或 CORS 错误：请求没有收到有效响应。请检查网络、代理/网关跨域设置或浏览器拦截。原始错误：{message}',
    en: 'Network or CORS error: the request did not receive a valid response. Check your network, proxy/gateway CORS settings, or browser blocking. Original error: {message}',
  },

  'configLib.exportImages.shareTitle': { 'zh-CN': 'Nano Banana 图片', en: 'Nano Banana images' },

  'configLib.fileToImage.canvasToBlobFailed': {
    'zh-CN': '无法转换 {fileName}：canvas toBlob 失败',
    en: 'Could not convert {fileName}: canvas toBlob failed',
  },
  'configLib.fileToImage.canvasContextFailed': {
    'zh-CN': '无法创建图片转换画布',
    en: 'Could not create the image conversion canvas',
  },
  'configLib.fileToImage.convertFailed': {
    'zh-CN': '无法转换 {fileName}',
    en: 'Could not convert {fileName}',
  },
  'configLib.fileToImage.heifConvertFailed': {
    'zh-CN': '{fileName}：无法转换 HEIC/HEIF 图片，请改用 JPEG 或 PNG 后重试。',
    en: '{fileName}: Could not convert the HEIC/HEIF image. Try again with JPEG or PNG.',
  },

  'configLib.siteData.indexedDB.label': { 'zh-CN': 'IndexedDB', en: 'IndexedDB' },
  'configLib.siteData.localStorage.label': { 'zh-CN': 'localStorage', en: 'localStorage' },
  'configLib.siteData.sessionStorage.label': { 'zh-CN': 'sessionStorage', en: 'sessionStorage' },
  'configLib.siteData.cacheStorage.label': { 'zh-CN': 'Cache Storage', en: 'Cache Storage' },
  'configLib.siteData.cookies.label': { 'zh-CN': 'Cookie', en: 'Cookie' },
  'configLib.siteData.databaseCount': { 'zh-CN': '{count} 个数据库', en: '{count} databases' },
  'configLib.siteData.itemCount': { 'zh-CN': '{count} 项', en: '{count} items' },
  'configLib.siteData.indexedDbDeleteFailed': {
    'zh-CN': '无法删除 IndexedDB: {name}',
    en: 'Could not delete IndexedDB: {name}',
  },

  'configLib.validateKey.networkCorsError': {
    'zh-CN': '网络或 CORS 错误：{message}。若 curl 能通但浏览器失败，通常是网关未允许跨域。',
    en: 'Network or CORS error: {message}. If curl works but the browser fails, the gateway usually has not allowed cross-origin requests.',
  },

  'configLib.queue.runningProgress': { 'zh-CN': '运行 {done}/{total}', en: 'Running {done}/{total}' },
  'configLib.queue.generatingCount': { 'zh-CN': '生成 {count}', en: 'Generating {count}' },
  'configLib.queue.retryingCount': { 'zh-CN': '重试 {count}', en: 'Retrying {count}' },
  'configLib.queue.queuedCount': { 'zh-CN': '排队 {count}', en: 'Queued {count}' },
  'configLib.queue.completedProgress': { 'zh-CN': '完成 {done}/{total}', en: 'Completed {done}/{total}' },
  'configLib.queue.failedCount': { 'zh-CN': '失败 {count}', en: 'Failed {count}' },
  'configLib.queue.canceledCount': { 'zh-CN': '中断 {count}', en: 'Interrupted {count}' },
  'configLib.queue.failedProgress': { 'zh-CN': '失败 {failed}/{total}', en: 'Failed {failed}/{total}' },
  'configLib.queue.canceledProgress': { 'zh-CN': '已中断 {canceled}/{total}', en: 'Interrupted {canceled}/{total}' },
  'configLib.queue.justNow': { 'zh-CN': '刚刚', en: 'Just now' },
  'configLib.queue.minutesAgo': { 'zh-CN': '{count} 分钟前', en: '{count} min ago' },
  'configLib.queue.hoursAgo': { 'zh-CN': '{count} 小时前', en: '{count} hr ago' },

  'configLib.agent.taskInterrupted': {
    'zh-CN': '页面刷新或切换会话中断了这次生成任务。',
    en: 'A page refresh or session switch interrupted this generation task.',
  },
  'configLib.agent.maxAttachments': { 'zh-CN': '最多附加 {count} 张图片', en: 'Attach up to {count} images' },
  'configLib.agent.readAttachmentFailed': {
    'zh-CN': '无法读取这张图片，请先打开图片或稍后重试。',
    en: 'Could not read this image. Open it first or try again later.',
  },
  'configLib.agent.modelImageUnsupported': {
    'zh-CN': '{model} 不支持图片附件，请移除图片或切换到支持图片的模型。',
    en: '{model} does not support image attachments. Remove images or switch to a model with image input.',
  },
  'configLib.agent.callbackMissingKey': {
    'zh-CN': 'Agent 需要 {provider} API Key 才能接收任务完成回调。',
    en: 'The agent needs a {provider} API key to receive task completion callbacks.',
  },
  'configLib.agent.modelMissingKey': {
    'zh-CN': '使用 {model} 需要先配置 {provider} API Key。',
    en: '{model} requires a {provider} API key before use.',
  },
  'configLib.agent.referenceMissing': {
    'zh-CN': '参考图不存在：{id}',
    en: 'Reference image does not exist: {id}',
  },
  'configLib.agent.referenceNotReady': {
    'zh-CN': '参考图尚未准备好：{id}',
    en: 'Reference image is not ready: {id}',
  },
  'configLib.agent.unknownGenImageModel': {
    'zh-CN': '未知 GenImage 模型：{model}。',
    en: 'Unknown GenImage model: {model}.',
  },
  'configLib.agent.sessionDeleted': { 'zh-CN': '任务所属对话已经删除。', en: 'The task session has been deleted.' },
  'configLib.agent.taskCanceled': { 'zh-CN': '任务已经结束，无法启动。', en: 'The task has already ended.' },
  'configLib.agent.taskStarted': {
    'zh-CN': '任务已经提交并开始生成。',
    en: 'The task has been submitted and generation has started.',
  },
  'configLib.agent.defaultSessionTitle': { 'zh-CN': '新对话', en: 'New conversation' },
  'configLib.agent.imageCompressionCanvasFailed': {
    'zh-CN': '无法创建图片压缩画布',
    en: 'Could not create the image compression canvas',
  },
  'configLib.agent.tool.genImage': { 'zh-CN': '生成图片', en: 'Generate image' },
  'configLib.agent.tool.askUserQuestion': { 'zh-CN': '提问用户', en: 'Ask user' },
  'configLib.agent.tool.readAgentFile': { 'zh-CN': '读取 Agent 文件', en: 'Read Agent file' },
  'configLib.agent.tool.readImage': { 'zh-CN': '读取图片', en: 'Read image' },
  'configLib.agent.tool.skill': { 'zh-CN': '加载 Skill', en: 'Load skill' },
  'configLib.agent.tool.readSkillFile': { 'zh-CN': '读取 Skill 文件', en: 'Read skill file' },
  'configLib.agent.tool.createSkill': { 'zh-CN': '创建 Skill', en: 'Create skill' },
  'configLib.agent.tool.webSearch': { 'zh-CN': '搜索网页', en: 'Search web' },
  'configLib.agent.tool.webFetch': { 'zh-CN': '抓取网页', en: 'Fetch web page' },
}
