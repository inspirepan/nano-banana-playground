import type { MessageDictionary } from '../types'

export const apiKeysMessages: MessageDictionary = {
  'apiKeys.title': { 'zh-CN': '接口密钥', en: 'API keys' },
  'apiKeys.storageNote': {
    'zh-CN': '密钥与 Base URL 仅保存在当前浏览器的 localStorage，不会上传任何服务器。',
    en: 'Keys and Base URLs are saved only in localStorage in this browser and are never uploaded to any server.',
  },
  'apiKeys.provider.google.label': { 'zh-CN': 'Gemini API Key', en: 'Gemini API key' },
  'apiKeys.provider.google.placeholder': { 'zh-CN': '粘贴你的 Gemini API Key', en: 'Paste your Gemini API key' },
  'apiKeys.provider.google.hint': { 'zh-CN': '用于 Nano Banana 系列', en: 'For the Nano Banana series' },
  'apiKeys.provider.openai.label': { 'zh-CN': 'OpenAI API Key', en: 'OpenAI API key' },
  'apiKeys.provider.openai.placeholder': { 'zh-CN': '粘贴你的 OpenAI API Key', en: 'Paste your OpenAI API key' },
  'apiKeys.provider.openai.hint': { 'zh-CN': '用于 GPT Image 系列', en: 'For the GPT Image series' },
  'apiKeys.apiKey.label': { 'zh-CN': 'API Key', en: 'API key' },
  'apiKeys.apiKey.ariaLabel': { 'zh-CN': '{label} 输入框', en: '{label} field' },
  'apiKeys.apiKey.placeholder.replaceExisting': {
    'zh-CN': '粘贴新密钥；留空则继续使用当前密钥',
    en: 'Paste a new key, or leave blank to keep using the current key',
  },
  'apiKeys.baseUrl.label': { 'zh-CN': 'Base URL', en: 'Base URL' },
  'apiKeys.baseUrl.ariaLabel': { 'zh-CN': '{label} Base URL 输入框', en: '{label} Base URL field' },
  'apiKeys.baseUrl.hint': { 'zh-CN': '可选，留空使用原生 API', en: 'Optional. Leave blank to use the native API' },
  'apiKeys.baseUrl.previewLabel': { 'zh-CN': '实际调用', en: 'Actual endpoint' },
  'apiKeys.baseUrl.defaultSuffix': { 'zh-CN': '（默认）', en: '(default)' },
  'apiKeys.status.validated': { 'zh-CN': '验证成功', en: 'Verified' },
  'apiKeys.status.validating': { 'zh-CN': '验证中…', en: 'Verifying…' },
  'apiKeys.action.edit': { 'zh-CN': '修改', en: 'Edit' },
  'apiKeys.action.editProvider': { 'zh-CN': '修改 {label}', en: 'Edit {label}' },
  'apiKeys.action.removeKey': { 'zh-CN': '移除密钥', en: 'Remove key' },
  'apiKeys.action.removeProviderKey': { 'zh-CN': '移除 {label}', en: 'Remove {label}' },
  'apiKeys.action.cancelEditingProvider': { 'zh-CN': '取消编辑 {label}', en: 'Cancel editing {label}' },
  'apiKeys.action.saveAndValidate': { 'zh-CN': '保存并验证 {label}', en: 'Save and verify {label}' },
  'apiKeys.error.invalidOrExpired': {
    'zh-CN': '密钥无效或已过期，请重新输入。',
    en: 'The key is invalid or expired. Please enter it again.',
  },
}
