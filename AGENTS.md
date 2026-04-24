# Nano Banana Playground

## 架构概览

纯前端 SPA。无后端。浏览器直接调用 Gemini 和 OpenAI 图像接口；用户自己的 API Key 分 provider 保存在 localStorage。生成历史和图片数据保存在 IndexedDB，本地 blob/object URL 缓存由 `useImageSrc` 管理。

```
浏览器
  |
  +-- React SPA (Vite)
  |     |-- App.tsx
  |     |    |-- 内联 Topbar + ThemeSettings + ApiKeysDialog
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
        Google/OpenAI API Key + theme + color theme
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
| 字体 | Roboto（正文 / 标题）+ Roboto Mono（等宽）                                   |
| 图标 | `lucide-react`，统一经由 `src/components/Icon.tsx`                           |

禁止引入：CSS-in-JS、zustand/redux 等状态库、MUI/shadcn 等 UI 组件库。

## 项目结构

```
src/
  config/models.ts             # 模型/provider/分辨率/比例/quality/价格/上限
  hooks/
    usePlayground.ts           # 中央状态、URL 同步、生成流程、历史分页
    useApiKey.ts               # provider 维度的 API Key 校验与存储
    useImageSrc.ts             # blob cache / object URL
  lib/
    api.ts                     # Gemini/OpenAI 请求层
    history.ts                 # IndexedDB 持久化
    urlState.ts                # URL 参数读写
    openai.ts                  # GPT Image 2 尺寸映射
    pricing.ts                 # 预估价格 / 实际费用计算
    types.ts                   # PlaygroundImage / token usage
    validateKey.ts             # API Key 校验
  components/
    InputPanel.tsx             # 编辑器、模型切换、参考图、生成 CTA
    OutputPanel.tsx            # 草稿预览、历史批次、导出 ZIP
    ImageDetailModal.tsx       # 全屏查看、缩放平移、元数据、参考图对比
    ApiKeysDialog.tsx          # Google/OpenAI Key 管理弹窗
    AspectRatioSelector.tsx    # 比例 glyph tile + 像素 tooltip
    ChipGroup.tsx              # 扁平 chip 选择器
    ReferenceImageUpload.tsx   # 参考图上传/拖拽/粘贴入口
    ImageGrid.tsx / ImageCard.tsx / Icon.tsx
  App.tsx                      # 顶栏、主题、移动/桌面双布局
  index.css                    # 设计 token、组件 utility、动画
```

## 页面元素 → 组件映射

| 页面区域                        | 组件                                      |
| ------------------------------- | ----------------------------------------- |
| 顶栏 / 外观 / 主色              | `App.tsx` 内联 topbar + `ThemeSettings`   |
| API Key 管理                    | `ApiKeysDialog`                           |
| 模型切换                        | `InputPanel` 内 segmented control         |
| 分辨率 / Quality / 批次数量     | `InputPanel` + `ChipGroup`                |
| 宽高比选择                      | `AspectRatioSelector`                     |
| 参考图上传区                    | `ReferenceImageUpload`                    |
| 文本提示词                      | `InputPanel`                              |
| 草稿骨架 / 生成进度 / 历史批次  | `OutputPanel` + `ImageGrid` + `ImageCard` |
| 全屏查看 / 缩放 / 对比 / 元数据 | `ImageDetailModal`                        |

> `AppTitle.tsx`、`HistoryDrawer.tsx`、`TopBar.tsx`、`src/lib/ripple.ts` 已删除。不要按旧文档把它们重新引回。

## 设计规范

当前不是 MD3。严格对齐现有的 **Linear / Notion 风格** 自定义设计系统。

- **整体气质**：克制、紧凑、偏工具感，不做 Material、大圆角卡片、重阴影、彩色渐变、发光描边。
- **色彩系统**：基础盘是 warm-stone 中性色，强调色默认 indigo，可通过 `.theme-*` 类切到 blue / green / yellow / pink / orange / purple。优先复用 `--color-bg`、`--color-surface*`、`--color-border*`、`--color-text*`、`--color-accent*`，不要到处写裸十六进制。
- **排版**：正文 `Roboto Variable`（`--font-sans`），标题（品牌名 / 弹窗标题 / 面板 header）挂 `.font-display` 使用 `--font-display`（当前别名到 `--font-sans`，保留入口便于未来单独切换 display 字体），数字/分辨率/元数据/快捷键用 `.mono`（Roboto Mono，`--font-mono`）。全局基线是 **13px**，不是 14/16px 默认网页节奏。
- **中文字体回退**：保持 `PingFang SC -> Hiragino Sans GB -> Microsoft YaHei -> Source Han Sans / Noto Sans CJK` 的顺序，`font-feature-settings` 只保留 `tnum`，不要加回会切换 CJK 字形的 Latin 变体 tag。
- **边框与圆角**：以 **1px hairline border** 为主，常用圆角为 `6 / 8 / 10px`，大多数控件是 flat surface，不靠阴影塑形。
- **滚动条**：沿用 `src/index.css` 里的近乎不可见 Linear 风格滚动条，不要改成系统粗滚动条。
- **图标**：只用 Lucide，经 `Icon.tsx` 映射；不要再使用 Material Symbols。
- **暗色模式**：由 `<html>` 上的 `.dark` 控制；主色主题由 `<html>` 上的 `.theme-*` 控制。
- **复用现成 utility class**：优先使用 `.chip`、`.segmented`、`.aspect-tile`、`.card`、`.cta`、`.dropzone`、`.img-card`、`.icon-btn`、`.label`、`.mono`，不要在组件里重复造一套视觉规则。
- **动效**：过渡保持短促（约 120ms 到 260ms），优先 CSS `transition` / `@keyframes`，避免夸张弹簧、长位移、悬浮漂移动画。

## 开发规范

- **类型**：禁止 `any`，优先正确建模或用可缩小的 `unknown`。
- **状态归属**：会影响 URL 恢复、移动/桌面同步、生成参数或历史的状态，一律放在 `usePlayground`。`InputPanel` 只保留局部瞬时 UI 状态，比如局部 undo/redo、drag over、textarea 测量态。
- **响应式布局**：`App.tsx` 会同时渲染两套 `InputPanel`。任何编辑器功能改动，都要确认移动端和桌面端共用同一份 state/handler。
- **持久化边界**：API Key 和外观设置走 localStorage；提示词编辑态走 URL；图片二进制只存 IndexedDB/blob cache。不要把大对象或 base64 塞进 localStorage。
- **样式写法**：优先 Tailwind utility + `index.css` 里的复用类。仅在动态几何值、portal 定位、色块预览、计算型 grid size 等少数场景使用 inline style。
- **`useEffect` 使用原则**：允许用于外部系统同步（localStorage、URL、matchMedia、事件监听、observer、IndexedDB/blob 加载、命令式 DOM）。不要用 effect 镜像派生状态，也不要写“设 flag -> effect 执行 -> 再清 flag”的链路。
- **文本域自动高度**：`InputPanel` 的 textarea 自适应高度必须保留最近的可滚动祖先滚动位置，不能假设滚动容器就是面板根节点。
- **文案**：界面文字全部中文；代码注释保持英文且简短。

## 提交前检查

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
- 提示词指南：`docs/refs/ultimate-prompting-guide-for-nano-banana.md`
