---
name: comparison-visual
description: Generate side-by-side comparison visuals, before/after images, versus thumbnails, transformation comparisons, product comparison boards, and split-screen explanatory graphics. Use when the user asks for 对比图, 前后对比, before-after, VS, battle thumbnail, comparison poster, product comparison, style comparison, or transformation visual. Do NOT use for dense standalone knowledge infographics, article covers, comic strips, UI mockups, or product ads where comparison is not the main structure.
icon: columns-2
preview_image: /skill-previews/comparison-visual.jpg
display_name:
  zh-CN: 对比视觉图
  en: Comparison Visual
display_description:
  zh-CN: 前后对比 / VS / 产品对比 / 风格对照，用清晰分屏结构表达差异。
  en: Before-after, versus, product, and style comparison visuals with clear split-screen structure.
---

# Comparison Visual

生成以“差异”为核心的单张对比视觉图：before / after、A vs B、产品对比、风格对照、视角转换、效果前后。重点是**结构清楚、两侧可比、差异一眼看懂**。

## 适用场景

- 前后对比：改造前后、修图前后、方案前后、视角变化
- A vs B：产品、工具、风格、角色、方案、阵营对比
- YouTube / B 站 / 社媒对比封面
- 教学中的错误示范 vs 正确示范

不适用：纯知识长图（用 `knowledge-infographic`）、产品单主图（用 `product-ad-creative`）、UI 界面概念（用 `ui-mockup`）、漫画连续剧情（用 `comic-strip`）。

## 一次问齐

信息不足时，用一次 `AskUserQuestion` 收集：

1. 对比对象：左边是什么，右边是什么。
2. 对比类型：before-after / versus / product board / style comparison / transformation。
3. 差异点：3-5 个真实差异，不编造事实。
4. 视觉风格：clean editorial / bold thumbnail / infographic / cinematic split。
5. 比例：16:9、1:1、4:3、3:4。

## Prompt 骨架

```txt
Role: senior visual designer for comparison graphics.
Goal: create one clear comparison visual where the difference is obvious at a glance.

Left side: [object/state A]
Right side: [object/state B]
Comparison type: [before-after / versus / product board / style comparison / transformation]
Key differences: [3-5 bullets from user only]
Layout: strict split-screen or mirrored two-column layout, aligned subjects, balanced scale, clear divider.
Style: [clean editorial / bold thumbnail / infographic / cinematic split]
Text: use exact labels supplied by user; otherwise use simple A/B tags or placeholder bars.
Constraints: no fake statistics, no misleading claims, no random brand logos, no unreadable dense text, no watermark.
```

## 视觉原则

- 两侧主体尺度、角度、留白尽量一致，差异才公平。
- 分割线、色彩、标签负责引导比较，不要喧宾夺主。
- 如果是“前后”，保留同一对象的身份和构图；只改变用户指定的部分。
- 如果用户提供参考图，优先使用 edit / reference image 工作流，并明确 invariants。
