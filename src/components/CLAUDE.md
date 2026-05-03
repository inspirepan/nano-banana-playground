# 设计规范

严格对齐现有的 **Linear / Notion 风格**自定义设计系统。

## 整体气质

克制、紧凑、偏工具感，不做 Material、大圆角卡片、重阴影、彩色渐变、发光描边。

## 色彩系统

基础盘是 warm-stone 中性色，强调色默认 indigo，可通过 `.theme-*` 类切到 blue / green / yellow / pink / orange / purple。优先复用 `--color-bg`、`--color-surface*`、`--color-border*`、`--color-text*`、`--color-accent*`，不要到处写裸十六进制。

## 排版

正文 `Geist Variable`（`--font-sans`），标题（品牌名 / 弹窗标题 / 面板 header）挂 `.font-display`。数字、分辨率、费用、时间、计数等常规信息使用 sans；`.mono` 固定为 Roboto Mono，只用于模型 API ID、stack / image 短 ID、API Key 等机器字符串。全局基线是 **13px**。

中文字体回退顺序：`PingFang SC -> Hiragino Sans GB -> Microsoft YaHei -> Source Han Sans / Noto Sans CJK`。Geist 相关 `font-feature-settings` 只使用 `kern`、`liga`、`calt`、`tnum`、`zero`，不要加回会切换 CJK 字形的 `ss*` / `cv*` 变体 tag。

## 边缘定义（Schoger ring，强约束）

1px 边缘一律用 `box-shadow` 的 ring 表达，**禁止 `border: 1px solid` 与 shadow 共存**——border 会让 shadow 在边线处出现 "muddy" 浊边。

- **扁平 surface**（chip / button / card / option / aspect-tile / 输入框）：只写 `shadow-[inset_0_0_0_1px_var(--ring-edge)]`，hover 提到 `--ring-edge-strong`，淡色或带主色调容器降到 `--ring-edge-soft`。**不要再叠 drop shadow**。
- **真正浮起的层级**（弹窗、context menu、tooltip、`.img-card`、悬浮按钮）：用 `shadow-[0_0_0_1px_var(--ring-edge),var(--shadow-lift)]` 或 `var(--shadow-float)`——外环 + token 阴影一次性写完。
- **轻浮起卡片**（引导卡 / starter 卡）：套 `.img-card` 配方：静态 `shadow-[0_0_0_1px_var(--ring-edge-soft),var(--shadow-lift)]`，hover 升到 `shadow-[0_0_0_1px_var(--ring-edge-strong),var(--shadow-float)]`，可叠 `hover:-translate-y-px`，过渡写 `transition-[box-shadow,background-color,transform]`。密集 chip / 列表项仍走扁平 inset ring。
- **分隔线**：一律用 `shadow-[inset_0_1px_0_var(--ring-edge-soft)]`（顶）或 `inset_0_-1px_0_…`（底），不写 `border-t/b`。唯一例外是 markdown 表格 `<th>/<td>`（`border-collapse` 必须用 `border-b`）。
- **选中态——主色填充版**：`bg-(--color-accent)` + `shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,#000_10%)]`。适合单一强调动作（提交按钮、单点 CTA）。
- **选中态——淡底内敛版**：`bg-(--color-accent-wash)` + 主色文字 + `shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]`。适合多选并存、密集选项场景。
- **选中态——外环 + 光晕版**：`shadow-[0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]`。只用于强聚焦单点选择或输入聚焦。
- **禁止清单**：① `rgba(0,0,0,…)` 字面值出现在 `shadow-[...]` 里；② `border-*` 与 `shadow-*` 在同一元素混写；③ 用 `--color-accent-ring*` 当通用 surface 边；④ 密集多选里用 outer accent ring 表达"已选"。

## 圆角 token（强约束）

`index.css` 定义了 `--radius-xs(4) / sm(6) / md(8) / lg(10) / xl(14)` 五档，**所有 `rounded-[...]` 必须引用 token**，不写裸 px：

- ✅ `rounded-[var(--radius-md)]` / ❌ `rounded-[8px]` / ❌ 任何偏离 token 的字面值。
- **同心圆角**：外层 radius - padding = 内层 radius。常见组合：外层 `lg(10)` / 内层 `sm(6)` / badge `xs(4)`。
- **已知例外**（改前先确认）：`MessageBubble.tsx` 用户气泡 + `AgentChatComposer.tsx` 输入区用 `rounded-[12px]`，是聊天序列精调过的视觉例外；`AskUserQuestionCards.tsx` 内部 14×14 多选指示器保留 `rounded-[3px]`。

## 其他规范

- **按钮形态**：主 CTA 维持 `36px` 高度和 pill 形态；普通 chip / segmented / icon button 维持紧凑工具型尺寸。
- **容器层级**：大多数控件保持 flat surface；只有图库图片、弹窗、toast、上下文菜单才使用轻量阴影。
- **排版细节**：`.label` 是 eyebrow 语义但使用 sans；标题使用 `.font-display` 并保持轻微负 tracking。
- **布局取舍**：工具型 SPA，不套用 hero、testimonial、canvas grid、大面积居中空态等 landing page 技巧。
- **滚动条**：沿用 `src/index.css` 里的近乎不可见 Linear 风格滚动条。`[scrollbar-gutter:stable]` 只在右侧保留 gutter，会造成左右视觉不对称（macOS「始终显示滚动条」/ Windows 可见）。规则：① 容器有水平对称要求时改用 `[scrollbar-gutter:stable_both-edges]`；② 内容为 `h-full` 实际不会溢出时直接去掉，不需要 stable gutter。
- **滚动边缘遮罩**：滚动容器的淡出边缘统一走 `src/index.css` 里的 `.scroll-fade-y` / `.scroll-fade-x` utility，band 尺寸用 `[--scroll-fade-start-size:…]` / `[--scroll-fade-end-size:…]` 按调用点覆盖。**禁止在组件里手写 `maskImage: 'linear-gradient(...)'`**。两条硬约束：① 渐变必须是单段 `transparent → #000`，不得塞任何中间 alpha stop——在高对比度图片上每个 stop 都会暴露成肉眼可见的斜率折点，「多段模拟 ease」是反模式，要更柔和就加长 band 而不是加 stop；② 只有**无 ring 的开放容器**（面板主内容区、侧栏、无边 rail）才加 fade，**带 `ring-edge` shadow / border 的卡片或浮层内部不加**——fade 会落在 ring 之内变成「卡片在吃自己的内容」。图片密集的 rail band 建议 ≥3rem，纯文本场景 1–2rem 即可；支持 `animation-timeline: scroll()` 的浏览器会随滚动位置动态收起 fade，无须另行处理。
- **图标**：只用 Lucide，经 `Icon.tsx` 映射。
- **暗色模式**：由 `<html>` 上的 `.dark` 控制；主色主题由 `.theme-*` 控制。
- **复用 utility class**：优先使用 `.chip`、`.segmented`、`.aspect-tile`、`.card`、`.cta`、`.dropzone`、`.img-card`、`.icon-btn`、`.label`、`.mono`。
- **动效**：过渡保持短促（约 120ms 到 260ms），优先 CSS `transition` / `@keyframes`，避免夸张弹簧、长位移动画。
