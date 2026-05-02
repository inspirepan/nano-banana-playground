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
| 字体 | Geist（正文 / 标题）+ Geist Mono（等宽）                                     |
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
- **排版**：正文 `Geist Variable`（`--font-sans`），标题（品牌名 / 弹窗标题 / 面板 header）挂 `.font-display` 使用 `--font-display`（当前别名到 `--font-sans`，保留入口便于未来单独切换 display 字体）。数字、分辨率、费用、时间、计数等常规信息使用 sans；`.mono` 固定为 Roboto Mono，只用于模型 API ID、stack / image 短 ID、API Key 等机器字符串。全局基线是 **13px**，不是 14/16px 默认网页节奏。
- **中文字体回退**：保持 `PingFang SC -> Hiragino Sans GB -> Microsoft YaHei -> Source Han Sans / Noto Sans CJK` 的顺序。Geist 相关 `font-feature-settings` 只使用 `kern`、`liga`、`calt`、`tnum`、`zero` 等安全特性，不要加回会切换 CJK 字形的 `ss*` / `cv*` 变体 tag。
- **边缘定义（Schoger ring，强约束）**：1px 边缘一律用 `box-shadow` 的 ring 表达，**禁止 `border: 1px solid` 与 shadow 共存**——border 会让 shadow 在边线处出现 "muddy" 浊边。原则与可粘贴模式：
  - **扁平 surface**（chip / button / card / option / aspect-tile / 输入框）：只写 `shadow-[inset_0_0_0_1px_var(--ring-edge)]`，hover 提到 `--ring-edge-strong`，淡色或带主色调容器降到 `--ring-edge-soft`（≈5% 黑/白）。**不要再叠 drop shadow**，扁平就是扁平。
  - **真正浮起的层级**（弹窗、context menu、tooltip、`.img-card`、悬浮按钮）：用 `shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)]` 或 `var(--shadow-float)`——外环 + token 阴影**一次性写完**，不要拼 `0_1px_2px_rgba(0,0,0,0.04)` 这类自造 close shadow。
  - **轻浮起卡片（扁平网格里的层次感）**：用于引导卡 / starter 卡 / promo 卡这种"扁平 surface 太平、弹窗又过重"的中间态，套 `.img-card` 的同款配方：静态 `shadow-[0_0_0_1px_var(--ring-edge-soft),var(--shadow-lift)]`，hover 升到 `shadow-[0_0_0_1px_var(--ring-edge-strong),var(--shadow-float)]`，可叠 `hover:-translate-y-px` 做一像素抬升，过渡写 `transition-[box-shadow,background-color,transform]`。**不要**自造中间档阴影、不要加大位移、不要把密集 chip / 列表项 / 多选选项也升成浮起态——它们仍走扁平 inset ring。典型例子：`AgentChatPanel.tsx` 的 `DrawingSkillStarters` 卡片。
  - **分隔线**：一律用 `shadow-[inset_0_1px_0_var(--ring-edge-soft)]`（顶分隔）或 `inset_0_-1px_0_…`（底分隔），不写 `border-t/b`。**唯一例外**是 markdown 表格 `<th>/<td>`，因为 `border-collapse` 必须用 `border-b`。
  - **选中态——主色填充版**：`bg-(--color-accent)` + `shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,#000_10%)]`（沿用 `.chip.accent-active` 配方），不要再叠主色 drop shadow 或 outer ring。适合中性容器内的单一强调动作（提交按钮、单点 CTA）。
  - **选中态——淡底内敛版**：`bg-(--color-accent-wash)` + 主色文字 + 中性/soft inset ring（如 `shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]`），hover 可升到 `--color-accent-wash-2`。适合选中项可能多个并存、面积较小、或选项排列密集的场景（multi-select / 过滤器组 / agent 问答选项）。多选项优先用内部 checkbox / checkmark 做强确认，不额外加外扩 accent 边框。
  - **选中态——外环 + 光晕版（depth）**：保持原本 `bg-(--color-surface)`，把激活描边写成 `shadow-[0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]`——1px 实心主色外环 + 3px wash 光晕——配合主色文字（标签 `--color-accent`，描述 `--color-text-2`）。这是 `.prompt-wrap:focus-within` 的同源配方。只用于需要强聚焦的单点选择、输入聚焦或少量关键控件；不要作为多选列表的默认选中态。
  - **禁止清单**：① 任意 `rgba(0,0,0,…)` 字面值出现在 `shadow-[...]` 里；② `border-*` 与 `shadow-*` 在同一元素混写；③ 用 `--color-accent-ring*` 当通用 surface 边（accent-ring 仅在强调主色调容器内部使用）；④ 在密集多选/过滤器/问答选项里用 outer accent ring 表达"已选"。
- **圆角 token（强约束）**：`index.css` 定义了 `--radius-xs(4) / sm(6) / md(8) / lg(10) / xl(14)` 五档，**所有 `rounded-[...]` 必须引用 token**，不写裸 px：
  - ✅ `rounded-[var(--radius-md)]` / ❌ `rounded-[8px]` / ❌ `rounded-[5px]`、`rounded-[7px]`、`rounded-[12px]` 等偏离 token 的字面值。
  - **同心圆角**按"外层 radius - padding = 内层 radius"，常见组合：外层 `lg(10)` / 内层 `sm(6)` / badge `xs(4)` / 强调小标签 `xs(4)`，不要让内外层使用同一个 radius 造成视觉别扭。
  - **已知例外**（改前先确认）：`MessageBubble.tsx` 用户气泡 + `AgentChatComposer.tsx` 输入区都是 `rounded-[12px]` 并配带底层次自调阴影，是聊天序列精调过的视觉例外；`AskUserQuestionCards.tsx` 内部 14×14 多选指示器保留 `rounded-[3px]`。
- **按钮形态**：主 CTA 维持 `36px` 左右高度和 pill 形态；普通 chip / segmented / icon button 维持紧凑工具型尺寸。不要把所有按钮都改成大胶囊，也不要随手给按钮塞装饰图标。
- **容器层级**：大多数控件保持 flat surface；只有图库图片、弹窗、toast、上下文菜单等真正需要浮起的层级才使用轻量阴影。淡色容器边缘用低透明度 inset ring 定义，不用重边框抢内容焦点。
- **排版细节**：`.label` 是 eyebrow 语义但使用 sans；只有模型 API ID、stack / image 短 ID、API Key 等机器字符串用 `.mono`。标题使用 `.font-display` 并保持轻微负 tracking；长说明优先控制行高和宽度，不做大段居中文案。
- **布局取舍**：这是工具型 SPA，不是营销页。不要套用 hero、testimonial、logo cloud、canvas grid、大面积居中空态、厚重展示卡片等 landing page 技巧；空态和面板标题默认左对齐、紧凑、可扫描。
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
- **`useEffect` 使用原则**：默认不要直接写 `useEffect`。先尝试 5 个替代模式：渲染期派生值、事件处理器内完成状态迁移、`key` 触发干净重挂载、把异步资源收敛进专用 hook、用 reducer 表达状态机。允许 effect 只用于外部系统同步（localStorage、URL、matchMedia、事件监听、observer、IndexedDB/blob 加载、命令式 DOM），且必须保持入口清晰、可取消、无状态镜像。
- **禁止 effect 链**：不要用 effect 做 props -> state 同步、A state 改 B state、设 flag 后由 effect 执行再清 flag。组件切换上下文时优先在父级加 `key`，或把状态建模为按 id 分桶的 reducer/cache；写缓存优先在事件处理器里 write-through。
- **图片切换防闪烁**：详情弹窗、全屏预览、图库等图片 viewer 左右切换时，不能用随图片 id 变化的 `key` 强制 unmount 当前 viewer，也不要在下一张未加载/解码完成前清空当前图。应保留上一张已解码图片作为占位，下一张 blob 加载并尽量 `decode()` 后再替换，避免露出空画布或网格背景闪一下。
- **文本域自动高度**：`InputPanel` 的 textarea 自适应高度必须保留最近的可滚动祖先滚动位置，不能假设滚动容器就是面板根节点。
- **文案**：界面文字全部中文；代码注释保持英文且简短。

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
