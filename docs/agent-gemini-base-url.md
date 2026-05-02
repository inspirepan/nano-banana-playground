# Agent Gemini Base URL 备忘

## 现象

设置页里 Google 的 Base URL 校验能正常走自定义地址，但 Agent 聊天选择 Gemini 模型时，请求仍然打到官方端点：

```txt
https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse
```

直接生成图片不受影响，因为图片生成路径走项目自己的 REST 请求层：`src/lib/imageApi/google.ts` 会用 `resolveBaseUrl('google', baseUrl)` 拼出完整 `generateContent` endpoint。

## 根因

Agent 聊天的请求链不是直接使用项目顶层的 `@mariozechner/pi-ai`：

```txt
@mariozechner/pi-agent@0.9.0
  -> @mariozechner/pi-ai@0.9.4
  -> @google/genai
```

项目顶层当前也依赖一份更新的 `@mariozechner/pi-ai`，它的 Google provider 会读取 `model.baseUrl`。但 `pi-agent` 内部解析到的旧 `pi-ai@0.9.4` 在 Google provider 的 `createClient()` 里只把 headers 传给 `GoogleGenAI`，没有把 `model.baseUrl` 传入 `httpOptions.baseUrl`，所以 SDK 回退到官方 `generativelanguage.googleapis.com`。

其他 provider 的 Base URL 可用，不代表 Gemini Agent 路径可用；OpenAI / Anthropic 等 provider 在旧 `pi-ai` 中各自读取 `model.baseUrl`，问题集中在 Google provider 这一支。

## 当前修复方式

`src/agent/useAgentPlayground.ts` 在应用 Agent runtime 配置时调用 `@google/genai` 的 `setDefaultBaseUrls()`：

```ts
setDefaultBaseUrls({ geminiUrl: sdkBaseUrl })
```

这里传给 SDK 的 `geminiUrl` 必须是去掉 API version 的根地址。SDK 会根据 `apiVersion` 自己追加 `/v1beta`，否则容易得到重复版本路径。项目使用 `resolveBaseUrl('google', baseUrl)` 规范化用户输入，再移除末尾 `/v1beta` / `/v1alpha` / `/v1` 等版本段。

未配置自定义 Base URL 时，调用：

```ts
setDefaultBaseUrls({ geminiUrl: undefined })
```

让 SDK 恢复官方默认地址。

## 以后排查时先看这里

1. `jj diff --git` 或浏览器 Network 里确认 Agent 请求是否仍打到官方域名。
2. 检查 `node_modules/.pnpm/@mariozechner+pi-agent.../node_modules/@mariozechner/pi-ai` 实际解析到的版本，不要只看项目顶层 `@mariozechner/pi-ai`。
3. 如果未来 `pi-agent` 升级到会使用新版 `pi-ai`，且 Google provider 已经正确传递 `model.baseUrl`，可以重新评估是否还需要 `setDefaultBaseUrls()` 这层兼容。
4. 直接生图和 Agent 聊天是两条请求路径：前者看 `src/lib/imageApi/google.ts`，后者看 `src/agent/useAgentPlayground.ts` 与 `pi-agent` 内部依赖。
