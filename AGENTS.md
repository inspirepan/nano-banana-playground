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
- **配置驱动的控件**：添加新模型 = 在 `src/config/models.ts` 中添加一个条目。UI 根据所选模型的配置动态渲染控件。
- **统一的图片类型**：所有图片（上传或生成的）都使用带有 `source` 判别联合类型的 `PlaygroundImage`。参见 `src/lib/types.ts`。
- **网格布局**：右侧面板使用固定的 4 列网格，基于 `ResizeObserver` 计算行高以自适应长宽比。参见 `src/components/ImageGrid.tsx`。

## 技术栈与版本

| 层级       | 选择                | 版本    |
|------------|---------------------|---------|
| 运行时     | Vite                | 8.x     |
| 框架       | React               | 19.x    |
| 语言       | TypeScript          | 5.9     |
| 样式       | Tailwind CSS        | 4.x     |
| 存储       | IndexedDB (原生 API) | -       |
| 字体       | Google Sans Flex + Google Sans Code | 通过 Google Fonts CDN |

禁止使用：
- 任何 CSS-in-JS 库 (styled-components, emotion 等)
- 任何状态管理库 (zustand, redux 等) —— React 状态 + 自定义 Hooks 已足够
- 任何 UI 组件库 (MUI, shadcn 等) —— 组件使用 Tailwind 手写
- 脚本中使用 `npm` 进行包管理 —— 本项目仅使用 `npm` (不用 yarn/pnpm/bun)

## 精选知识源

- Gemini 图像生成 API：`docs/refs/nano-banana-api-guide.md`
- 提示词指南：`docs/refs/ultimate-prompting-guide-for-nano-banana.md`
- Tailwind CSS v4 文档：https://tailwindcss.com/docs
- Gemini REST API 参考：https://ai.google.dev/gemini-api/docs

## 项目结构

```
src/
  config/
    models.ts          # 模型配置 (每个模型的分辨率、比例、限制)
  lib/
    types.ts           # PlaygroundImage, ImageSource 联合类型
    api.ts             # Gemini REST API 调用 (generateImage)
    history.ts         # 图片历史记录的 IndexedDB CRUD
    validateKey.ts     # API 密钥验证 + 错误检测
  hooks/
    usePlayground.ts   # 中央状态 Hook (所有应用状态 + 动作)
  components/
    TopBar.tsx         # 标题 + 主题切换
    ApiKeyInput.tsx    # API 密钥输入/验证/状态 + useApiKey Hook
    ControlPanel.tsx   # 左栏：模型、分辨率、比例、数量
    PromptPanel.tsx    # 中栏：参考图、提示词、生成
    OutputPanel.tsx    # 右栏：统一时间线 (草稿 + 历史)
    ImageGrid.tsx      # 4 列网格，基于 ResizeObserver 计算行高
    ImageCard.tsx      # 单张图片卡片，带悬浮操作
    ImageDetailModal.tsx # 全屏详情视图，带元数据
    AspectRatioSelector.tsx # 比例选择器，带形状预览 + 像素尺寸
    ChipGroup.tsx      # 通用 Chip/Pill 选择器
    ReferenceImageUpload.tsx # 拖拽图片上传区域
  App.tsx              # 根布局 (3 栏)
  index.css            # Tailwind 导入 + Google M3 颜色令牌 + 暗色模式
  main.tsx             # 入口点
docs/refs/             # API 和提示词参考文档
```

## 命名规范

- **文件**：组件使用 PascalCase (`ImageCard.tsx`)，非组件使用 camelCase (`models.ts`, `usePlayground.ts`)
- **类型**：PascalCase，从定义处导出。接口不使用 `I` 前缀。
- **组件**：每个文件一个组件，具名导出需与文件名匹配。除 `App.tsx` 外不使用默认导出。
- **Hooks**：`use` 前缀，`hooks/` 目录下每个文件一个。
- **CSS**：仅使用 Tailwind 工具类。自定义 CSS 仅限于 `index.css` (主题令牌、关键帧)。不使用 CSS Modules。

## 代码示例

### 模型配置 (配置驱动模式)

```ts
// src/config/models.ts
export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    apiModel: 'gemini-3.1-flash-image-preview',
    resolutions: ['512', '1K', '2K', '4K'],
    defaultResolution: '1K',
    aspectRatios: ['1:1', '2:3', '3:2', ...],
    defaultAspectRatio: '1:1',
    maxReferenceImages: 10,
    maxCharacterImages: 4,
    maxBatchCount: 4,
  },
  // 添加新模型 = 在此处添加新条目。无需修改 UI。
]
```

### 统一图片类型 (判别联合类型)

```ts
// src/lib/types.ts
export type PlaygroundImage = {
  id: string
  data: string      // base64
  mimeType: string
  source: ImageSource
  timestamp: number
}

export type ImageSource =
  | { type: 'upload'; fileName: string }
  | { type: 'generated'; modelId: string; prompt: string;
      resolution: string; aspectRatio: string;
      referenceImageIds: string[]; batchId: string }
```

### 网格跨度映射

```ts
// src/components/ImageGrid.tsx
export function getGridSpan(ratio: number): { cols: number; rows: number } {
  if (ratio >= 6) return { cols: 3, rows: 1 }    // 8:1
  if (ratio >= 3) return { cols: 2, rows: 1 }    // 4:1
  if (ratio > 1.6) return { cols: 2, rows: 1 }   // 16:9, 21:9
  if (ratio >= 0.55) return { cols: 1, rows: 1 } // 1:1, 接近正方形
  if (ratio >= 0.2) return { cols: 1, rows: 2 }  // 9:16, 1:4
  return { cols: 1, rows: 3 }                     // 1:8
}
```

## 避坑指南 (Anti-patterns)

- **禁止使用 `any` 类型**。使用正确的类型或配合类型缩小的 `unknown`。
- **禁止在布局中使用内联样式**。例外：由 JS 计算的动态网格值 (ImageGrid 行高)。
- **禁止使用 `useEffect` 处理派生状态**。直接在渲染时计算或使用 `useMemo`。
- **Props 透传 (prop drilling) 不得超过 2 层**。如果一个 prop 连续穿过 3 个及以上组件且未被修改，请重构。
- **禁止在 localStorage 中存储 base64**。图片存入 IndexedDB。localStorage 仅用于存储小体积数据 (API 密钥、提示词草稿、主题)。
- **暗色模式不使用 `prefers-color-scheme` 媒体查询**。暗色模式基于类名 (`<html>` 上的 `.dark`)，由用户手动切换。
- **UI 文本禁止使用英文**。所有面向用户的字符串均使用中文。代码注释保持英文。
