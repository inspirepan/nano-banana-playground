# Nano Banana Playground

## 架构概览

纯前端 SPA。无后端。用户提供自己的 Gemini API 密钥，存储在 localStorage 中。

```
浏览器
  |
  +-- React SPA (Vite)
  |     |-- ControlPanel (模型/分辨率/比例/数量选择)
  |     |-- InputPanel (参考图 + 提示词 + 生成按钮)
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
| 提示词输入 + 生成按钮 | `InputPanel`            |
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
- **禁止直接使用 `useEffect`**：详见下方「useEffect 禁令」章节。
- **Prop drilling**：不超过 2 层，否则重构。
- **存储**：base64 只存 IndexedDB，localStorage 仅存 API 密钥 / 提示词草稿 / 主题。
- **暗色模式**：基于 `<html>` 的 `.dark` 类名，不用 `prefers-color-scheme`。
- **UI 文字**：全部中文；代码注释保持英文。

## useEffect 禁令

**核心规则：禁止在组件或自定义 Hook 中直接调用 `useEffect`。** 对于必须在挂载时与外部系统同步的场景，使用 `useMountEffect()`：

```typescript
function useMountEffect(effect: () => void | (() => void)) {
  useEffect(effect, []);
}
```

大多数 `useEffect` 的使用场景都有更好的替代方案。以下五条规则覆盖了绝大多数情况：

### 规则 1：派生状态，不要同步状态

从其他 state/props 计算得出的值，直接在渲染时计算或用 `useMemo`，不要用 effect 设 state。

```typescript
// BAD: 多一次渲染，且有循环风险
useEffect(() => {
  setFilteredProducts(products.filter(p => p.inStock));
}, [products]);

// GOOD: 直接计算
const filteredProducts = products.filter(p => p.inStock);
```

**嗅探测试**：你正在写 `useEffect(() => setX(deriveFromY(y)), [y])` —— 停下来，直接算。

### 规则 2：事件处理器，不是 effect

用户操作（点击、提交、切换）触发的逻辑，放在事件处理器中，不要用 state flag + effect 中继。

```typescript
// BAD: state 当 flag，effect 做事
useEffect(() => {
  if (liked) { postLike(); setLiked(false); }
}, [liked]);

// GOOD: 直接在 handler 里做
<button onClick={() => postLike()}>Like</button>
```

**嗅探测试**：你正在构建"设置 flag -> effect 执行 -> 重置 flag"的链路。

### 规则 3：用 key 重置，不要用依赖数组编排

需要"当 ID 变化时重新开始"时，用 React 的 `key` 重挂载语义，不要在 effect 里手动重置状态。

```typescript
// BAD: effect 手动重置
useEffect(() => {
  resetLocalState();
  loadEntity(entityId);
}, [entityId]);

// GOOD: key 驱动重挂载
<EntityView key={entityId} entityId={entityId} />
```

**嗅探测试**：effect 的唯一作用是在某个 ID/prop 变化时重置本地状态。

### 规则 4：useMountEffect 用于一次性外部同步

仅限以下场景使用 `useMountEffect`：
- DOM 集成（focus、scroll、第三方组件生命周期）
- 浏览器 API 订阅（ResizeObserver、IntersectionObserver、事件监听）
- 一次性初始化（加载历史记录、恢复 URL 状态）

条件挂载优于条件 effect：

```typescript
// BAD: effect 里守卫条件
useEffect(() => {
  if (!isLoading) playVideo();
}, [isLoading]);

// GOOD: 条件满足后才挂载
{!isLoading && <VideoPlayer />}
// VideoPlayer 内部 useMountEffect(() => playVideo())
```

### 规则 5：动画用纯 CSS 或专用 Hook

循环动画（shimmer、扫光）优先用 CSS `@keyframes`。命令式动画（打字机、手势缩放）封装到专用 Hook 中，内部可使用 `useEffect` + RAF，但组件层不直接调用 `useEffect`。

### 合法的 useEffect 使用场景

以下场景允许使用 `useEffect`（含带依赖数组的形式），因为它们本质上是与外部系统同步，不是派生状态也不是事件中继：

- **DOM / 浏览器 API 同步**：`document.title`、`<html>` class、`localStorage`、`matchMedia` 监听
- **观察者模式**：`IntersectionObserver`、`ResizeObserver`、`MutationObserver`
- **原生事件监听**：`window.addEventListener('keydown', ...)`、非 passive `wheel` 事件
- **异步数据加载**：从 IndexedDB 加载 blob、初始化时恢复 URL 状态
- **命令式动画**：typewriter RAF、AppTitle 扫光（封装到 hook 或组件内部）
- **挂载/卸载清理**：取消 RAF、清理定时器、重置 `document.title`

新代码中使用上述场景的 `useEffect` 无需额外审批，但应优先考虑是否能用 `useMountEffect`（空依赖）或 `key` 重挂载替代。

## 提交前检查

每次 commit 前必须依次执行：

```bash
npm run build   # TypeScript 类型检查 + Vite 构建
```

构建失败则不得提交。

## 评测

提示词增强（`src/lib/augment-system-prompt.md`）有 LLM-as-Judge 回归测试：`eval/cases.json` 定义用例与断言，`eval/run.py`（`uv run eval/run.py -j 6`）调用增强模型后用 judge 模型逐条判定 + 打分。修改增强提示词后必须跑通。

## 精选知识源

- Gemini 图像生成 API：`docs/refs/nano-banana-api-guide.md`
- 提示词指南：`docs/refs/ultimate-prompting-guide-for-nano-banana.md`
