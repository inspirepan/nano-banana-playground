# Nano Banana Playground

## 架构概览

纯前端 SPA + Cloudflare Pages Functions 代理层。浏览器直接调用图像接口；所有 LLM 调用、Web 搜索/抓取均可选择通过站点代理（Pages Functions）转发，规避浏览器 CORS 限制。用户自己的 API Key 分 provider 保存在 localStorage。生成历史和图片数据保存在 IndexedDB，本地 blob/object URL 缓存由 `useImageSrc` 管理。

```
浏览器
  |
  +-- React SPA (Vite)
  |     |-- App.tsx
  |     |    |-- 内联 Topbar + SettingsDialog
  |     |    |-- InputPanel (mobile)
  |     |    |-- OutputPanel (mobile)
  |     |    |-- InputPanel (desktop)
  |     |    +-- OutputPanel (desktop)
  |     |
  |     +-- usePlayground (中央状态)
  |           |-- model / resolution / aspectRatio / quality / batchCount
  |           |-- prompt / referenceImages / generationPreview / history / error
  |           +-- URL sync + IndexedDB history + blob cache
  |
  +-- Cloudflare Pages Functions (functions/)
  |     |-- /api/exa/[[path]]     → https://api.exa.ai
  |     |-- /api/tavily/[[path]]  → https://api.tavily.com
  |     |-- /api/brave/[[path]]   → https://api.search.brave.com
  |     |-- /api/parallel/[[path]] → https://api.parallel.ai
  |     |-- /api/fetch            → 通用 URL 抓取代理（POST {url}）
  |     +-- /api/llm/[[path]]     → LLM provider 透明代理
  |           首段为 provider 名（google/openai/anthropic/moonshot-*）
  |           或 base64url 编码的自定义 Base URL
  |
  +-- Gemini REST API
  |     POST /v1beta/models/{model}:generateContent
  |
  +-- OpenAI Images API
  |     POST /v1/images/generations
  |
  +-- IndexedDB ("nano-banana-playground")
  |     图片元数据 + base64/blob
  |
  +-- localStorage
        API Key（各 provider）+ 代理开关 + theme + color theme
```

核心设计决策：

- **配置驱动的模型能力**：新模型、分辨率、比例、quality、价格、上限统一在 `src/config/models.ts` 配置。
- **共享编辑器状态**：`App.tsx` 同时渲染移动端和桌面端两套 `InputPanel`，共享状态必须放在 `usePlayground`，不要做面板内持久化分叉。
- **统一图片模型**：上传图、历史图、生成图都走 `PlaygroundImage` / `PlaygroundImageMeta`，通过 `source.type` 区分来源。
- **URL 可恢复编辑态**：模型参数与提示词通过 `src/lib/urlState.ts` 以裸 query 参数写回 URL。
- **本地优先历史**：图片和历史只存本地浏览器，不依赖账号体系或服务端。

## 技术栈

| 层级 | 选择                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| 框架 | React 19 + TypeScript 5.9 + Vite 8                                           |
| 样式 | Tailwind CSS 4 + `src/index.css` 自定义 token / utility layer                |
| 存储 | IndexedDB（图片/历史）+ localStorage（API Key / 外观）+ URL params（编辑态） |
| 字体 | Geist（正文 / 标题）+ Geist Mono（等宽）                                     |
| 图标 | `lucide-react`，统一经由 `src/components/Icon.tsx`                           |

禁止引入：CSS-in-JS、zustand/redux 等状态库、MUI/shadcn 等 UI 组件库。

## 项目结构

```
functions/
  api/
    exa/[[path]].ts       # 透明代理 → https://api.exa.ai
    tavily/[[path]].ts    # 透明代理 → https://api.tavily.com
    brave/[[path]].ts     # 透明代理 → https://api.search.brave.com
    parallel/[[path]].ts  # 透明代理 → https://api.parallel.ai
    fetch.ts              # 通用 URL 抓取代理（POST {url}）
    llm/[[path]].ts       # LLM provider 代理（named provider 或 base64url 自定义 URL）
src/
  config/
    models.ts                  # 图片模型/分辨率/比例/quality/价格/上限
    agentModels.ts             # Agent LLM 模型列表（Gemini / OpenAI / Anthropic / Moonshot 等）
    providers.ts               # API provider 定义（鉴权 key、标签、提示等）
    webProviders.ts            # Web 工具后端（Exa / Tavily / Brave / Parallel）配置
    agentPreferences.ts        # Agent 偏好（默认图片模型等）
    fonts.ts / theme.ts / languages.ts  # 外观和语言选项
  hooks/
    usePlayground.ts           # 中央状态、URL 同步、生成流程、历史分页
    useApiKey.ts               # provider 维度的 API Key 校验与存储
    useImageSrc.ts             # blob cache / object URL
  lib/
    api.ts                     # Gemini/OpenAI 图像请求层
    history.ts / stacks.ts     # IndexedDB 历史持久化、stack 管理
    urlState.ts                # URL 参数读写
    pricing.ts                 # 预估价格 / 实际费用计算
    types.ts                   # PlaygroundImage / token usage
    exportImages.ts / downloadFileName.ts  # 图片导出与文件名生成
    credentialStore.ts / preferenceStore.ts / webProviderStore.ts  # localStorage domain stores（含 useProxy 开关）
    db.ts                      # IndexedDB 抽象层
  i18n/
    useI18n.ts                 # useI18n hook，组件调用入口
    messages/                  # 双语（zh-CN / en）MessageDictionary，按页面区域分文件
  components/                  # UI 组件（设计规范见 src/components/CLAUDE.md）
    InputPanel.tsx             # 编辑器、模型切换、参考图、生成 CTA
    OutputPanel.tsx            # 草稿预览、历史批次、导出 ZIP
    image-detail/ImageDetailModal.tsx  # 全屏查看、缩放平移、元数据、参考图对比
    agent-chat/                # Agent 对话子组件（消息气泡、工具卡片、skill starters 等）
    AgentChatPanel.tsx         # Agent 对话面板（消息流、工具卡片、输入区）
    SettingsDialog.tsx         # 全局设置（API Key、Web 工具后端、外观、语言等）
    AspectRatioSelector.tsx / ChipGroup.tsx / ReferenceImageUpload.tsx
    ImageGrid.tsx / ImageCard.tsx / StackItemThumb.tsx / Icon.tsx
  agent/                       # Agent 领域逻辑（规范见 src/agent/CLAUDE.md）
    useAgentPlayground.ts      # Agent orchestration hook
    tools/                     # GenImage / ReadAgentFile / ReadImage / AskUserQuestion / WebSearch / WebFetch / CreateSkill / ReadSkillFile / Skill
    skills/                    # skill 类型、registry、frontmatter 解析、内置 skill 定义
  App/
    Topbar.tsx                 # 顶栏组件
    index.tsx                  # 主题、移动/桌面双布局
  index.css                    # 设计 token、组件 utility、动画
```

## 页面元素 → 组件映射

| 页面区域                        | 组件                                      |
| ------------------------------- | ----------------------------------------- |
| 顶栏                            | `App/Topbar.tsx`                          |
| 全局设置 / 外观 / 主色          | `SettingsDialog`                          |
| API Key 管理                    | `ApiKeysDialog`                           |
| 模型切换                        | `InputPanel` 内 segmented control         |
| 分辨率 / Quality / 批次数量     | `InputPanel` + `ChipGroup`                |
| 宽高比选择                      | `AspectRatioSelector`                     |
| 参考图上传区                    | `ReferenceImageUpload`                    |
| 文本提示词                      | `InputPanel`                              |
| 草稿骨架 / 生成进度 / 历史批次  | `OutputPanel` + `ImageGrid` + `ImageCard` |
| 全屏查看 / 缩放 / 对比 / 元数据 | `ImageDetailModal`                        |
| Agent 对话 / 工具卡片           | `AgentChatPanel`                          |

> `AppTitle.tsx`、`HistoryDrawer.tsx`、`TopBar.tsx`、`src/lib/ripple.ts` 已删除。不要按旧文档把它们重新引回。

## 开发规范

- **类型**：禁止 `any`，优先正确建模或用可缩小的 `unknown`。
- **状态归属**：会影响 URL 恢复、移动/桌面同步、生成参数或历史的状态，一律放在 `usePlayground`。`InputPanel` 只保留局部瞬时 UI 状态，比如局部 undo/redo、drag over、textarea 测量态。
- **响应式布局**：`App.tsx` 会同时渲染两套 `InputPanel`。任何编辑器功能改动，都要确认移动端和桌面端共用同一份 state/handler。
- **持久化边界**：API Key 和外观设置走 localStorage；提示词编辑态走 URL；图片二进制只存 IndexedDB/blob cache。不要把大对象或 base64 塞进 localStorage。
- **样式写法**：优先 Tailwind utility + `index.css` 里的复用类。仅在动态几何值、portal 定位、色块预览、计算型 grid size 等少数场景使用 inline style。
- **`useEffect` 使用原则**：默认不要直接写 `useEffect`。先尝试 5 个替代模式：渲染期派生值、事件处理器内完成状态迁移、`key` 触发干净重挂载、把异步资源收敛进专用 hook、用 reducer 表达状态机。允许 effect 只用于外部系统同步（localStorage、URL、matchMedia、事件监听、observer、IndexedDB/blob 加载、命令式 DOM），且必须保持入口清晰、可取消、无状态镜像。
- **禁止 effect 链**：不要用 effect 做 props -> state 同步、A state 改 B state、设 flag 后由 effect 执行再清 flag。组件切换上下文时优先在父级加 `key`，或把状态建模为按 id 分桶的 reducer/cache；写缓存优先在事件处理器里 write-through。
- **图片切换防闪烁**：详情弹窗、全屏预览、图库等图片 viewer 左右切换时，不能用随图片 id 变化的 `key` 强制 unmount 当前 viewer，也不要在下一张未加载/解码完成前清空当前图。应保留上一张已解码图片作为占位，下一张 blob 加载并尽量 `decode()` 后再替换。
- **文本域自动高度**：`InputPanel` 的 textarea 自适应高度必须保留最近的可滚动祖先滚动位置，不能假设滚动容器就是面板根节点。
- **文案**：UI 文字通过 `src/i18n/` 的 `useI18n` hook + 双语 `MessageDictionary`（zh-CN / en）管理。新增界面文字时加到 `src/i18n/messages/` 对应文件，不要在组件里写裸字符串。代码注释保持英文且简短。

## 提交前检查

每次提交前必须对本次改动涉及的文件运行 lint 和 format 检查，并修复所有相关问题。可按需使用：

```bash
npm run lint
npm run format:check
```

需要自动修复时使用：

```bash
npm run lint:fix
npm run format
```

每次提交前至少执行：

```bash
npm run build
```

如果改了 `src/lib/urlState.ts` 或 URL 恢复逻辑，再执行：

```bash
npm test
```

构建失败不得提交。

## 精选知识源

- Gemini 图像生成 API：`docs/refs/nano-banana-api-guide.md`
- Agent Gemini Base URL 调试备忘：`docs/agent-gemini-base-url.md`
- 提示词指南：`docs/refs/ultimate-prompting-guide-for-nano-banana.md`
