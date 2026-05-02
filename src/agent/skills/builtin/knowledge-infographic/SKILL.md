---
name: knowledge-infographic
description: Generate a single dense knowledge card / infographic / concept map / cheat sheet from a topic, outline or article. Trigger on "knowledge card", "infographic", "concept map", "summary card", "cheat sheet", "mindmap card", "quadrant card", "干货卡", "知识卡", "概念图", "速查表", "信息图", "思维导图卡", "象限图". Style covers notion minimal line, sketch-notes hand-drawn, chalkboard. Layout covers dense / list / mindmap / quadrant / flow. Do not use for movie posters, single-character illustration, photorealistic scenes, or social-feed cover series.
icon: notebook-pen
---

# Knowledge Infographic

把一段概念、步骤、对比或知识点，压成一张高信息密度的图卡。输出 1 张图，比例通常 1:1 / 3:4 / 4:3。

视觉内核：

- 三种基础风格：notion-line（极简线条）/ sketch-notes（手绘色块）/ chalkboard（黑板粉笔）
- 五种结构布局：dense / list / mindmap / quadrant / flow

强制原则：标题、要点文字必须从用户大纲精确传入，不让模型自己编内容；色号、风格名等元数据不要出现在图里。

## 适用场景

- 知识卡 / 概念科普
- 步骤清单 / 操作指南 / 排行榜
- 思维脑图 / 概念图 / 知识脉络
- SWOT / 决策矩阵 / 四象限
- 流程图 / 操作链条

不适合：

- 电影海报、单角色插画、写实场景
- 社交封面系列（请用 `xhs-card-series`）
- 大段长文章导图（建议拆成多张）

## 风格预设

颜色仅用于引导生图，**禁止在图里渲染 hex 色号、风格名、role 文字**。

### notion-line（极简线条）

适合：知识卡、概念图、生产力主题、SaaS 内容、技术教程。

- 背景：`#FFFFFF` 或 `#FAFAFA`
- 主线条：`#1F2937`（接近黑）
- 副线条：`#9CA3AF`（中灰）
- 文字主色：`#1F2937` / 副色 `#6B7280`
- 强调色（用户选 1 个，默认蓝 `#2563EB`）
- 风格细节：极细 1-1.5px 线条、圆角矩形容器、白底大量留白、无阴影、无渐变、无立体效果；装饰使用 checkbox / 细箭头 / dot / 短下划线。

### sketch-notes（手绘色块）

适合：教育、学习笔记、流程图解、入门科普、可爱知识卡。

- 背景：暖米色 `#F5F0E8`（带轻微纸纹）
- 主线条 / 文字：`#2D2D2D`
- 色块：蓝 `#A8D8EA` / 紫 `#D5C6E0` / 绿 `#B5E5CF` / 桃 `#F8D5C4`
- 强调色：珊瑚红 `#E8655A`
- 风格细节：手绘抖线、圆角矩形色块（macaron 配色）、色块边缘填色不到边（手绘留白感）；装饰使用波浪箭头、小心心、小星、对勾、轻微下划线。

### chalkboard（黑板粉笔）

适合：课堂、教程、考点、公式、口诀、知识点速查。

- 背景：`#1A1A1A`（标准黑板）或 `#0F2520`（深绿黑板）
- 白粉笔：`#F5F0E0`
- 黄粉笔：`#F4E04D`
- 红粉笔：`#E8655A`
- 蓝粉笔：`#5DA9E9`
- 绿粉笔：`#B5E5CF`
- 风格细节：粉笔字（轻微毛糙边缘、可见粉笔纹理）、连接弧线、星号、擦痕、淡淡粉灰；保持 flat illustration，不做 photorealistic 木框、不做立体黑板。

## 布局预设

| 布局       | 要点数量        | 适用场景                   | 排布形态                                |
| ---------- | --------------- | -------------------------- | --------------------------------------- |
| `dense`    | 5-8             | 干货卡 / 概念科普 / 速查表 | 多区块网格，每块一个小标题 + 1-2 行说明 |
| `list`     | 4-7             | 清单 / 排行榜 / 步骤       | 垂直编号或图标项                        |
| `mindmap`  | 中心 + 4-8 分支 | 知识脉络 / 概念图          | 中心节点放射，分支可再分一级子枝        |
| `quadrant` | 4 象限          | SWOT / 决策矩阵            | 十字分割，必须含横纵轴标签              |
| `flow`     | 3-6 步          | 流程 / 操作步骤            | 横向或竖向箭头链                        |

> 用户内容超过 8 个要点时，主动提议"我可以拆成 2 张图，要不要"；不要自动拆。

## 工作流

### 步骤 1：通过 `AskUserQuestion` 一次问完关键决策

调用一次 `AskUserQuestion`，把问题打包成一份小问卷。问卷结构示例：

```json
{
  "questions": [
    {
      "question": "这张知识卡的主题是什么？",
      "header": "主题",
      "options": [{ "label": "我会在备注里写", "description": "在下方备注详细输入主题与背景" }],
      "multi_select": false
    },
    {
      "question": "选一个视觉风格",
      "header": "风格",
      "options": [
        { "label": "notion-line", "description": "极简线条 + 白底，推荐：知识卡、生产力、SaaS、技术内容" },
        { "label": "sketch-notes", "description": "手绘抖线 + macaron 色块，推荐：教育、入门科普、流程图解" },
        { "label": "chalkboard", "description": "黑板粉笔字，推荐：课堂、考点、公式、口诀" }
      ],
      "multi_select": false
    },
    {
      "question": "选一个结构布局",
      "header": "布局",
      "options": [
        { "label": "dense", "description": "5-8 个要点的多区块网格，适合干货卡" },
        { "label": "list", "description": "4-7 个垂直编号项，适合清单和步骤" },
        { "label": "mindmap", "description": "中心放射 4-8 分支，适合知识脉络和概念图" },
        { "label": "quadrant", "description": "4 象限矩阵，适合 SWOT、决策矩阵" },
        { "label": "flow", "description": "3-6 步横向流程，适合操作链条" }
      ],
      "multi_select": false
    },
    {
      "question": "强调色（仅 notion-line 适用，sketch-notes / chalkboard 默认配色无需选）",
      "header": "强调色",
      "options": [
        { "label": "indigo", "description": "深蓝紫 #2563EB，默认推荐" },
        { "label": "emerald", "description": "翠绿 #059669，自然/绿色主题" },
        { "label": "amber", "description": "琥珀黄 #D97706，提醒/警示主题" },
        { "label": "rose", "description": "玫红 #E11D48，情感/生活主题" },
        { "label": "violet", "description": "紫罗兰 #7C3AED，创意/AI 主题" },
        { "label": "slate", "description": "石板灰 #475569，纯黑白克制风" }
      ],
      "multi_select": false
    },
    {
      "question": "图卡标题（写一个简短的主标题，例如 '番茄工作法 5 步要点'）",
      "header": "标题",
      "options": [{ "label": "我会在备注里写", "description": "在下方备注里写最终标题文字" }],
      "multi_select": false
    },
    {
      "question": "比例",
      "header": "比例",
      "options": [
        { "label": "1:1", "description": "方形，社交分享通用，默认" },
        { "label": "3:4", "description": "竖版，公众号 / 笔记 / 海报" },
        { "label": "4:3", "description": "横版，幻灯片 / 文档插图" }
      ],
      "multi_select": false
    },
    {
      "question": "语言",
      "header": "语言",
      "options": [
        { "label": "zh", "description": "中文" },
        { "label": "en", "description": "English" },
        { "label": "bilingual", "description": "中英双语，标题中文 + 英文 hint" }
      ],
      "multi_select": false
    }
  ]
}
```

要点：

- 主题、标题题目里的 option 是"占位"，引导用户写在自由备注；不要自己加"其他"。
- 风格选 `sketch-notes` 或 `chalkboard` 时，强调色题目的回答忽略即可，仍然按预设配色生成。

### 步骤 2：在对话里整理 outline

读完用户的主题和补充，在对话里直接列出大纲（**不写任何文件**），并请用户确认或补充：

- `dense` / `list`：每条要点 ≤ 14 个汉字 / 20 chars，超长强制压缩；总数符合所选 layout 范围。
- `mindmap`：先给中心主题 1 句，再给 4-8 个一级分支；可选给 1-2 个分支补 2-3 个子点。
- `quadrant`：必须先确定横轴 / 纵轴标签，再给 4 个象限名 + 每象限 1-3 条要点。
- `flow`：列出 3-6 个有顺序的步骤名，每步可补 1 行说明。

确认大纲后再进入步骤 3。要点不达数量下限时主动提示用户补充；超过 8 个要点时提议拆图。

### 步骤 3：拼装 prompt

按以下骨架拼装传给 `GenImage` 的 `prompt` 字段。中文内容直接写中文，不要翻译。

```
Create a {STYLE} knowledge infographic about {TOPIC} in {LAYOUT} structure.

Title (top-left or top-center, large, {TITLE_FONT_HINT}):
{TITLE_TEXT}

Layout description:
{LAYOUT_BLOCK}

Bullet content (use these exact texts, do not invent):
- {POINT_1}
- {POINT_2}
- ...

Color palette (use as fill / line / accent only, never render hex codes or palette role names as visible text):
{PALETTE_BLOCK}

Style details:
{STYLE_BLOCK}

Decorations:
{DECOR_BLOCK}

Hard rules:
- All on-image text must be sharp, high-contrast, properly aligned, no overflowing, no broken glyphs.
- Chinese punctuation must be full-width and not mixed with English punctuation.
- No realistic human faces.
- Do not render hex codes, palette role names, "notion-line", "sketch-notes", "chalkboard", "dense", "mindmap", "quadrant", "flow" or any meta words as visible text.
- Do not invent numbers, percentages, charts or data the user did not provide.
```

各占位符按所选风格 / 布局填入：

`TITLE_FONT_HINT`：

- notion-line → `clean geometric sans-serif, slight negative letter-spacing, near-black #1F2937`
- sketch-notes → `bold hand-drawn lettering with slight wobble, ink color #2D2D2D`
- chalkboard → `chalk lettering with subtle dusty edge, white chalk #F5F0E0 or yellow chalk #F4E04D`

`LAYOUT_BLOCK`：

- `dense` → `Multi-block grid with {N} rounded-rect zones; each zone has a short bold heading + 1-2 short lines under it; balanced spacing, generous whitespace between zones.`
- `list` → `Single column of {N} numbered items stacked vertically; each item: number badge + short heading + 1 short description line.`
- `mindmap` → `Central node with the topic in the middle; {N} branches radiating outward, each branch ending in a small rounded label; thin connecting lines, no overlap.`
- `quadrant` → `Cross-divided 2x2 grid; horizontal axis labeled "{X_AXIS}", vertical axis labeled "{Y_AXIS}"; each quadrant has a quadrant title + up to 3 short bullet lines.`
- `flow` → `Horizontal chain of {N} steps connected by arrows; each step is a rounded rect with step number + short label + 1 hint line.`

`PALETTE_BLOCK`（按风格选其一）：

- notion-line：`background #FFFFFF or #FAFAFA, primary lines #1F2937, secondary lines #9CA3AF, accent {ACCENT_HEX}, body text #1F2937, muted text #6B7280`
- sketch-notes：`background #F5F0E8 with subtle paper texture, ink lines #2D2D2D, soft macaron blocks #A8D8EA / #D5C6E0 / #B5E5CF / #F8D5C4, accent coral #E8655A`
- chalkboard：`background #1A1A1A (or deep green-black #0F2520), white chalk #F5F0E0, yellow chalk #F4E04D, red chalk #E8655A, blue chalk #5DA9E9, green chalk #B5E5CF`

`STYLE_BLOCK`：

- notion-line：`Ultra-clean minimal line art, 1-1.5px hairline strokes, rounded-rect containers, generous whitespace, no gradients, no drop shadows, no 3D effects, no glow.`
- sketch-notes：`Hand-drawn wobble on every line and shape, rounded macaron-color blocks as section backgrounds, color fills do not reach the outline edges (hand-painted gap), pastel mood, slight paper grain.`
- chalkboard：`Chalk-textured strokes with subtle dust and faint smudges, slightly imperfect baselines, flat illustration only — no photorealistic blackboard frame, no wood, no studio lighting.`

`DECOR_BLOCK`：

- notion-line：`small dot bullets, thin arrows, checkbox glyphs, short underlines, no emoji, no stickers`
- sketch-notes：`wavy hand-drawn arrows between zones, tiny stars, small hearts, checkmarks, doodle underlines`
- chalkboard：`chalk stars, curved connector lines, small eraser smudges, occasional underlined keywords`

### 步骤 4：调用 `GenImage`

默认用 `gpt-image-2`（文字稳定，强烈推荐）。仅当用户特别想要更艺术化的 sketch-notes 时才换 `nano-banana-pro`。

完整调用示例：

```json
{
  "image_id": "番茄工作法知识卡",
  "prompt": "Create a notion-line knowledge infographic about Pomodoro Technique in list structure. Title (top-center, clean geometric sans-serif, slight negative letter-spacing, near-black #1F2937): 番茄工作法 5 步要点\n\nLayout description: Single column of 5 numbered items stacked vertically; each item: number badge + short heading + 1 short description line.\n\nBullet content (use these exact texts, do not invent):\n- 1. 选定一个任务\n- 2. 设定 25 分钟计时\n- 3. 专注完成不切换\n- 4. 休息 5 分钟\n- 5. 每 4 轮长休 15 分钟\n\nColor palette: background #FFFFFF, primary lines #1F2937, secondary lines #9CA3AF, accent #2563EB, body text #1F2937, muted text #6B7280. Use as fill / line / accent only, never render hex codes as visible text.\n\nStyle details: Ultra-clean minimal line art, 1-1.5px hairline strokes, rounded-rect containers, generous whitespace, no gradients, no drop shadows.\n\nDecorations: small dot bullets, thin arrows, checkbox glyphs, short underlines.\n\nHard rules: All on-image text must be sharp, high-contrast, properly aligned, no overflowing, no broken glyphs. Chinese punctuation full-width. No realistic human faces. Do not render hex codes, palette role names, or any meta words as visible text. Do not invent numbers or data.",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "1:1",
  "n": 1,
  "reference_image_ids": []
}
```

参数约束：

- `model`：默认 `gpt-image-2`，备选 `nano-banana-pro`（更艺术化）；不要用 `nano-banana-2`（文字稳定性较差）。
- `resolution`：固定 `2K`。
- `ratio`：跟用户选，默认 `1:1`；不在 `1:1` / `16:9` / `9:16` / `4:3` / `3:4` / `2.35:1` 列表里的不要传。
- `n`：固定 1。
- `reference_image_ids`：通常为空数组；只有用户明确要求"按这张参考图的版式"才填。

## 常见反例

- 不要让模型自己编要点 — 标题与每条要点必须从 outline 精确传入 `prompt`。
- 不要在 `dense` 布局里塞超过 8 个要点（会糊到不可读）。
- 不要让 notion-line 出现 gradient、阴影、立体、发光、玻璃质感。
- 不要把 chalkboard 渲染成 photorealistic 木框黑板或带教室透视；保持 flat illustration。
- 不要在图里写出 `#2563EB` / `notion-line` / `dense` / `accent` 等元数据词。
- 用户没给数据时，不要让模型自己编数字、百分比或图表数值。
- 中英混排时，中文标点必须全角、不混用英文逗号句号。
- mindmap 不要让分支文字重叠、不要让连线穿过节点。
- quadrant 必须有清晰横纵轴标签，不能只画十字不写轴。

## 跟进选项

完成第一张后，主动给用户提供这些 follow-up：

- 换一个布局（dense ↔ mindmap ↔ quadrant ↔ flow ↔ list）
- 换一个风格（notion-line ↔ sketch-notes ↔ chalkboard）
- 加一个 / 删一个要点
- 改强调色（仅 notion-line）
- 出中英双语版本
- 内容超过 8 个要点 → 提议拆成 2 张图，由用户确认后再分别走一遍流程

## 小贴士

- 用户给的是长文章 → 先在对话里浓缩成 ≤ 8 个要点，再让用户确认浓缩结果；不要直接把整段长文塞进 prompt。
- 用户没说语言 → 默认中文，标题 / 要点都用中文。
- 用户偏爱"克制商务感" → 默认 notion-line + slate accent + 1:1。
- 用户偏爱"温暖手账感" → 默认 sketch-notes + 3:4。
- 用户偏爱"教学黑板感" → 默认 chalkboard + 4:3。
