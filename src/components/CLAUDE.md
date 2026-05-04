# 设计规范

严格对齐现有的 **Linear / Notion 风格**自定义设计系统。

## 整体气质

克制、紧凑、偏工具感，不做 Material、大圆角卡片、重阴影、彩色渐变、发光描边。

## 色彩系统

默认基础盘是 Linear 风格的冷中性灰（`--color-bg: #f7f8f8` / 暗色 `#08090a`），`.warm` 是可选的暖石色主题（`#fbf8f3`），不是默认。强调色默认是 Linear 蓝（`#2558b8`，暗色 `#5e6ad2`），可通过 `.theme-green / orange / mono` 切换。优先复用 `--color-bg`、`--color-surface*`、`--color-border*`、`--color-text*`、`--color-accent*`，不要到处写裸十六进制。

## 排版

正文 `Geist Variable`（`--font-sans`），标题（品牌名 / 弹窗标题 / 面板 header）挂 `.font-display`——它内部已经包含 `letter-spacing: -0.015em` + `text-wrap: balance`，已经覆盖了"标题轻微负 tracking + 短句 balance"两件事，调用方不需要重复。数字、分辨率、费用、时间、计数等常规信息使用 sans；`.mono` 固定为 Roboto Mono，只用于模型 API ID、stack / image 短 ID、API Key 等机器字符串。`.label` eyebrow 用 sans（`text-sm` + 600 + `letter-spacing: 0.07em` + uppercase）。全局基线是 **13px**。

中文字体回退顺序：`PingFang SC -> Hiragino Sans GB -> Microsoft YaHei -> Source Han Sans / Noto Sans CJK`。Geist 相关 `font-feature-settings` 只使用 `kern`、`liga`、`calt`、`tnum`、`zero`，不要加回会切换 CJK 字形的 `ss*` / `cv*` 变体 tag。

文本换行和宽度：非 `.font-display` 的多行说明（dialog body、agent 消息正文、markdown 段落）挂 `text-pretty` 防孤词。对话气泡、说明文段、settings 描述等 prose 容器用字符宽度 `max-w-[60ch]` / `max-w-[72ch]` 控制行长，而非 `max-w-3xl` 这类断点尺寸。

## 边缘定义（Schoger ring，强约束）

1px 边缘一律用 `box-shadow` 的 ring 表达，**禁止 `border: 1px solid` 与 shadow 共存**——border 会让 shadow 在边线处出现 "muddy" 浊边。

- **扁平 surface**（chip / button / card / option / aspect-tile / 输入框）：只写 `shadow-[inset_0_0_0_1px_var(--ring-edge)]`，hover 提到 `--ring-edge-strong`，淡色或带主色调容器降到 `--ring-edge-soft`。**不要再叠 drop shadow**。
- **真正浮起的层级**（弹窗、context menu、tooltip、`.img-card`、悬浮按钮）：外环 + token 阴影一次性写完。**搭配按 drop shadow 强度区分 ring 浓度**：① 走 `var(--shadow-float)` 的弹窗 / dialog / popover / context menu 配 `var(--ring-edge-elevated)`（≈9.5%），因为 18px 大软投会把 7.5% 的边线"halo 模糊掉"，需要稍重边线把轮廓拉回；② 走 `var(--shadow-lift)` 的轻浮起（`.img-card` 静态、悬浮 toolbar、缩略图角标）配 `var(--ring-edge)`（≈7.5%）即可，1-2px 小投影本身不会吃掉边缘。
- **轻浮起卡片**（引导卡 / starter 卡）：套 `.img-card` 配方：静态 `shadow-[0_0_0_1px_var(--ring-edge-soft),var(--shadow-lift)]`，hover 升到 `shadow-[0_0_0_1px_var(--ring-edge-strong),var(--shadow-float)]`，可叠 `hover:-translate-y-px`，过渡写 `transition-[box-shadow,background-color,transform]`。密集 chip / 列表项仍走扁平 inset ring。
- **分隔线**：一律用 `shadow-[inset_0_1px_0_var(--ring-edge-soft)]`（顶）或 `inset_0_-1px_0_…`（底），不写 `border-t/b`。唯一例外是 markdown 表格 `<th>/<td>`（`border-collapse` 必须用 `border-b`）。
- **选中态——主色填充版**：`bg-(--color-accent)` + `shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,#000_10%)]`。适合单一强调动作（提交按钮、单点 CTA）。
- **选中态——淡底内敛版**：`bg-(--color-accent-wash)` + 主色文字 + `shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]`。适合多选并存、密集选项场景。
- **选中态——外环 + 光晕版**：`shadow-[0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-wash)]`。只用于强聚焦单点选择或输入聚焦。
- **禁止清单**：① `rgba(0,0,0,…)` 字面值出现在 `shadow-[...]` 里；② `border-*` 与 `shadow-*` 在同一元素混写；③ 用 `--color-accent-ring*` 当通用 surface 边；④ 密集多选里用 outer accent ring 表达"已选"。

## 圆角 token（强约束）

`index.css` 定义了 `--radius-xs(4) / sm(6) / md(8) / lg(10)` 四档，**所有 `rounded-[...]` 必须引用 token**，不写裸 px：

- ✅ `rounded-[var(--radius-md)]` / ❌ `rounded-[8px]` / ❌ 任何偏离 token 的字面值。
- **同心圆角**：外层 radius - padding = 内层 radius。常见组合：外层 `lg(10)` / 内层 `sm(6)` / badge `xs(4)`。
- **已知例外**（改前先确认）：`MessageBubble.tsx` 用户气泡 + `AgentChatComposer.tsx` 输入区用 `rounded-[12px]`，是聊天序列精调过的视觉例外；`AskUserQuestionCards.tsx` 内部 14×14 多选指示器保留 `rounded-[3px]`。这两个数值不是 token 缺漏，新增组件不要把它当作"第五档"复用。

## 其他规范

- **按钮形态**：主 CTA 维持 `36px` 高度和 pill 形态；普通 chip / segmented / icon button 维持紧凑工具型尺寸。
- **容器层级**：大多数控件保持 flat surface；只有图库图片、弹窗、toast、上下文菜单才使用轻量阴影。
- **布局取舍**：工具型 SPA，不套用 hero、testimonial、canvas grid、大面积居中空态等 landing page 技巧。
- **滚动条**：沿用 `src/index.css` 里的近乎不可见 Linear 风格滚动条。`[scrollbar-gutter:stable]` 只在右侧保留 gutter，会造成左右视觉不对称（macOS「始终显示滚动条」/ Windows 可见）。规则：① 容器有水平对称要求时改用 `[scrollbar-gutter:stable_both-edges]`；② 内容为 `h-full` 实际不会溢出时直接去掉，不需要 stable gutter。
- **滚动边缘遮罩**：滚动容器的淡出边缘统一走 `src/index.css` 里的 `.scroll-fade-y` / `.scroll-fade-x` utility，band 尺寸用 `[--scroll-fade-start-size:…]` / `[--scroll-fade-end-size:…]` 按调用点覆盖。**禁止在组件里手写 `maskImage: 'linear-gradient(...)'`**。两条硬约束：① 渐变必须是单段 `transparent → #000`，不得塞任何中间 alpha stop——在高对比度图片上每个 stop 都会暴露成肉眼可见的斜率折点，「多段模拟 ease」是反模式，要更柔和就加长 band 而不是加 stop；② 只有**无 ring 的开放容器**（面板主内容区、侧栏、无边 rail）才加 fade，**带 `ring-edge` shadow / border 的卡片或浮层内部不加**——fade 会落在 ring 之内变成「卡片在吃自己的内容」。图片密集的 rail band 建议 ≥3rem，纯文本场景 1–2rem 即可；支持 `animation-timeline: scroll()` 的浏览器会随滚动位置动态收起 fade，无须另行处理。
- **图标**：只用 Lucide，经 `Icon.tsx` 映射。
- **暗色模式**：由 `<html>` 上的 `.dark` 控制；主色主题由 `.theme-*` 控制。
- **复用 utility class**：优先使用 `.chip`、`.segmented`、`.aspect-tile`、`.card`、`.cta`、`.dropzone`、`.img-card`、`.icon-btn`、`.label`、`.mono`；浮层入场用 `.popover-pop` / `.modal-pop` / `.modal-backdrop-pop`。
- **动效**：过渡保持短促（约 120ms 到 260ms），优先 CSS `transition` / `@keyframes`，避免夸张弹簧、长位移动画。具体硬约束：
  - **easing token**：所有过渡的曲线一律引用 `var(--ease-out)`（默认，入场 / 出场 / hover）/ `var(--ease-in-out)`（屏内移动）/ `var(--ease-drawer)`（抽屉、grid-row 展开）。**禁止再写裸 `cubic-bezier(...)`**；`ease-in` 在 UI 里禁止使用——它把延迟摆在用户最专注的那一刻，体感反而更慢。
  - **按下反馈**：可点击控件的 `:active` 用 `transform: scale(0.92~0.98)` 表达，不用 `translateY(0.5px)` 这类亚像素位移（hi-DPI 屏看不见）。`.chip / .aspect-tile / .cta / .media-action` 用 0.97~0.98，`.icon-btn` 这种 24px 小图标按钮用 0.92。
  - **弹窗 / 浮层入场**：dialog 走 `.modal-pop` + `.modal-backdrop-pop`（`scale 0.96 → 1` + opacity，200ms，origin 默认 center 即可）；下拉菜单 / context menu / popover 走 `.popover-pop`（160ms）+ 必须显式声明 `origin-*`（`origin-top-right` / `origin-bottom-left` 等），让浮层从触发器位置长出来，**不要保留默认的 `transform-origin: center`**。两个 utility 都基于 `@starting-style`，组件挂上 class 即可，不用写 `useEffect` 设 `mounted`。
  - **进入态起点**：禁止从 `scale(0)` 进入；`scale(0.95~0.97)` + `opacity: 0` 才符合"现实里没有凭空冒出来的物体"。toast / overlay 同理。
  - **频繁动作不加动画**：键盘快捷键触发的状态切换（command palette toggle 等）每天会被触发上百次，加动画只会拖慢手感，直接零过渡。
  - **`prefers-reduced-motion`**：自定义 keyframes / scale 入场必须带 `@media (prefers-reduced-motion: reduce)` 兜底（参见 `index.css` 里 `.popover-pop / .modal-pop` 的范式）；hover 上的 transform 还要加 `@media (hover: hover) and (pointer: fine)` 守卫，否则触屏点击会触发假 hover。
