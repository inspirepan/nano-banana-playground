# Nano Banana Playground

## 架构概览

纯前端 SPA。无后端。用户提供自己的 Gemini API 密钥，存储在 localStorage 中。

```
浏览器
  |
  +-- React SPA (Vite)
  |     |-- ControlPanel (模型/分辨率/比例/数量选择)
  |     |-- PromptPanel (参考图 + 提示词 + 生成按钮)
  |     +-- OutputPanel (统一时间线：草稿骨架图 + 历史记录网格)
  |
  +-- Gemini REST API (直接从浏览器调用)
  |     POST /v1beta/models/{model}:generateContent
  |
  +-- IndexedDB ("nano-banana-playground")
        将生成的图片存储为 PlaygroundImage 对象
```

核心设计决策：
- **配置驱动的控件**：添加新模型 = 在 `src/config/models.ts` 中添加一个条目，UI 自动适配。
- **统一的图片类型**：上传图与生成图共用 `PlaygroundImage`，通过 `source` 字段区分来源。
- **响应式布局**：桌面端 3 栏并排，移动端垂直堆叠（`md:hidden` / `hidden md:flex`）。

## 技术栈

| 层级   | 选择                                        |
|--------|---------------------------------------------|
| 框架   | React 19 + TypeScript 5.9，Vite 8           |
| 样式   | Tailwind CSS 4，无 CSS-in-JS                |
| 存储   | IndexedDB（图片）+ localStorage（轻量配置） |
| 字体   | Google Sans Flex + Google Sans Code（本地） |

禁止引入：CSS-in-JS 库、状态管理库（zustand/redux 等）、UI 组件库（MUI/shadcn 等）。

## 项目结构

```
src/
  config/models.ts          # 模型配置（分辨率、比例、上限）
  lib/                      # 工具层：types / api / history / validateKey
  hooks/                    # useApiKey + usePlayground（中央状态）
  components/               # UI 组件（见下方映射）
  App.tsx                   # 根布局
  index.css                 # 主题色令牌 + 暗色模式 + 全局样式
public/fonts/               # 本地字体文件
docs/refs/                  # API 和提示词参考文档
```

## 页面元素 → 组件映射

| 页面区域           | 组件                      |
|--------------------|---------------------------|
| API 密钥输入框     | `ApiKeyInput`             |
| 模型 / 分辨率 / 批次选择 | `ControlPanel` → `ChipGroup` |
| 比例选择器         | `AspectRatioSelector`     |
| 参考图上传区       | `ReferenceImageUpload`    |
| 提示词输入 + 生成按钮 | `PromptPanel`           |
| 历史图片网格       | `OutputPanel` → `ImageGrid` → `ImageCard` |
| 全屏查看 / 缩放 / 对比 | `ImageDetailModal`    |
| 主题切换           | `App.tsx`（内联，非独立组件） |

> `TopBar.tsx` 和 `HistoryDrawer.tsx` 存在于代码库中但未挂载，勿重复引入。

## 设计规范

严格遵循 **Google Material Design 3（MD3）**规范：

- **色彩系统**：使用 MD3 动态色彩角色（`primary`、`on-primary`、`surface`、`surface-variant`、`outline` 等），通过 CSS 变量映射到 `index.css` 主题令牌，亮/暗色方案各自定义完整角色。
- **排版**：遵循 MD3 字阶（Display / Headline / Title / Body / Label），对应 `size`、`line-height`、`weight` 三元组，不随意自定义字号。
- **组件形态**：按钮、输入框、卡片、芯片等控件的圆角、高程、状态层（hover 8%、pressed 12%、focus 12% `on-surface`）均照 MD3 规格实现。
- **间距**：使用 MD3 4pt 基础网格（`4 / 8 / 12 / 16 / 24 / 32 / 48px`）。
- **图标**：使用 Material Symbols（Rounded 风格）。
- **禁止**：不引入 Material Web 或 MUI 等组件库，所有 MD3 控件手写实现。

## 开发规范

- **类型**：禁止 `any`，用正确类型或带类型缩小的 `unknown`。
- **内联样式**：禁止用于布局，仅允许 JS 计算的动态网格值（`ImageGrid` 行高）。
- **派生状态**：不用 `useEffect`，直接渲染时计算或用 `useMemo`。
- **Prop drilling**：不超过 2 层，否则重构。
- **存储**：base64 只存 IndexedDB，localStorage 仅存 API 密钥 / 提示词草稿 / 主题。
- **暗色模式**：基于 `<html>` 的 `.dark` 类名，不用 `prefers-color-scheme`。
- **UI 文字**：全部中文；代码注释保持英文。

## 精选知识源

- Gemini 图像生成 API：`docs/refs/nano-banana-api-guide.md`
- 提示词指南：`docs/refs/ultimate-prompting-guide-for-nano-banana.md`
