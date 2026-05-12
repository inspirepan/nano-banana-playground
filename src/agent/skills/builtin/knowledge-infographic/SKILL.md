---
name: knowledge-infographic
description: Generate a single dense knowledge card / infographic / concept map / cheat sheet / business analysis report from a topic, outline or article. Trigger on "knowledge card", "infographic", "concept map", "summary card", "cheat sheet", "mindmap card", "quadrant card", "business report infographic", "干货卡", "知识卡", "概念图", "速查表", "信息图", "思维导图卡", "象限图", "商业分析图", "商业报告长图". Style covers notion subtle layered surfaces, sketch-notes hand-drawn, chalkboard, consulting-report. Layout covers dense / list / mindmap / quadrant / flow / report. Do not use for movie posters, single-character illustration, standalone photorealistic scenes, or social-feed cover series.
icon: notebook-pen
preview_image: /skill-previews/knowledge-infographic.jpg
display_name:
  zh-CN: 知识信息图
  en: Knowledge Infographic
display_description:
  zh-CN: 高密度知识卡 / 信息图，notion 极简、sketch-notes 手绘、chalkboard 黑板三选一。
  en: Dense knowledge cards in notion line, sketch-notes, or chalkboard styles.
starter_examples:
  zh-CN:
    - Transformer 注意力机制信息图，流程清晰，关键概念和误区
    - 独立开发者定价策略卡，紧凑四象限，对比表和行动清单
    - 咖啡萃取手绘速查卡，步骤变量，失败原因
  en:
    - transformer attention infographic, clear flow, key concepts and mistakes
    - indie pricing strategy card, compact quadrant, comparison and checklist
    - coffee extraction sketch cheat sheet, steps, variables and failure causes
---

# Knowledge Infographic

把一段概念、步骤、对比、知识点或商业分析主题，压成一张高信息密度的图卡 / 报告长图。输出 1 张图，比例通常 1:1 / 3:4 / 4:3。

视觉内核：

- 四种基础风格：notion-line（Notion 式克制灰色浮层）/ sketch-notes（手绘色块）/ chalkboard（黑板粉笔）/ consulting-report（商业分析报告）
- 六种结构布局：dense / list / mindmap / quadrant / flow / report

强制原则：标题、要点文字必须从用户大纲精确传入，不让模型自己编事实、数字或结论；consulting-report 可以使用模型世界知识里的公开人物 / 产品 / 建筑 / 事件照片风格素材作为视觉证据，但文字事实仍以用户确认的大纲为准；色号、风格名等元数据不要出现在图里。

## 适用场景

- 知识卡 / 概念科普
- 步骤清单 / 操作指南 / 排行榜
- 思维脑图 / 概念图 / 知识脉络
- SWOT / 决策矩阵 / 四象限
- 流程图 / 操作链条
- 人物商业档案 / 公司分析 / 行业地图 / 产品历史 / 战略拆解

不适合：

- 电影海报、单角色插画、脱离信息图结构的纯写实场景
- 社交封面系列（请用 `xhs-card-series`）
- 大段长文章导图（建议拆成多张）

## 风格预设

颜色仅用于引导生图，**禁止在图里渲染 hex 色号、风格名、role 文字**。

### notion-line（Notion 式克制灰色浮层）

适合：知识卡、概念图、生产力主题、SaaS 内容、技术教程。

- 背景：`#FFFFFF` 或 `#FAFAFA`
- 浮层：`#F7F7F5` / `#F1F1EF` / `#FFFFFF`
- 分隔：极少量 `#E5E7EB` 发丝线，只用于分栏或列表分隔，不画完整线框卡片
- 文字主色：`#1F2937` / 副色 `#6B7280`
- 强调色（用户选 1 个，默认蓝 `#2563EB`）
- 风格细节：Notion / Linear 式克制文档感，主要用浅灰浮层、轻微背景差、非常柔和的灰色 ambient shadow 建立层级；减少线条，禁止给模块画完整描边；卡片边界应像灰色纸片轻轻浮在白底上，而不是线框盒子；无渐变、无立体、无发光；装饰使用 checkbox / dot / 小型状态 pill / 短下划线。**信息密度气质**：饱满、可扫描，像精心整理的 Notion wiki 页，而不是稀疏 slide deck；但**不需要**每个 zone 都塞内嵌图——让 zone 在**形态、宽高、密度**上自然 vary：一些 zone 是纯文本 2-3 条 bullet，一些 zone 嵌入一个**与该内容真正匹配**的小视觉。可选的 zone 形态丰富一些：流程链、数值标注卡、关系图、对比图、迷你分类矩阵、横向比较条、scale 比例图、引用 pull-quote、迷你时间线、人物 / 产品 / 地理小图、UI mockup 片段（mini browser / terminal / toggle / notification 等）。避免两个极端：「单一大图标 + 一行字」的空洞 zone；以及「每个 zone 都机械塞一个 UI mockup」的同质堆砌。

### consulting-report（商业分析报告长图）

适合：CEO / 创始人 / 公司 / 产品线 / 行业格局 / 战略拆解 / 商业事件复盘。

- 背景：`#F6F7F9` 或 `#FFFFFF`
- 卡片：`#FFFFFF`，极浅灰投影和细腻层级，像咨询公司报告页 / Bloomberg 长图 / Apple newsroom 档案页
- 文字主色：`#111827` / 副色 `#4B5563` / 注释 `#6B7280`
- 强调色：深蓝 `#0F4C81` 或石墨蓝 `#1E3A5F`，少量绿色 / 橙色只用于分类标记
- 真实图像：允许并鼓励使用模型世界知识里的公开人物肖像、产品渲染图、公司建筑、发布会照片、媒体缩略图、设备 / 芯片 / 汽车 / 药品等真实感视觉素材；主视觉可以是抠图式半身肖像或产品 hero，底部可以有多个真实缩略图证据卡。
- 风格细节：商业分析公司精修 slide / 深度媒体 profile 的长图质感；强网格、强层级、高信息密度、多个精致信息模块；不是可爱知识卡，不是极简空白卡，不是海报大片单图。

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

| 布局       | 要点数量        | 适用场景                              | 排布形态                                         |
| ---------- | --------------- | ------------------------------------- | ------------------------------------------------ |
| `dense`    | 5-8             | 干货卡 / 概念科普 / 速查表            | 多区块网格，每块一个小标题 + 1-2 行说明          |
| `list`     | 4-7             | 清单 / 排行榜 / 步骤                  | 垂直编号或图标项                                 |
| `mindmap`  | 中心 + 4-8 分支 | 知识脉络 / 概念图                     | 中心节点放射，分支可再分一级子枝                 |
| `quadrant` | 4 象限          | SWOT / 决策矩阵                       | 十字分割，必须含横纵轴标签                       |
| `flow`     | 3-6 步          | 流程 / 操作步骤                       | 横向或竖向箭头链                                 |
| `report`   | 8-14 个信息模块 | 人物档案 / 公司分析 / 行业地图 / 战略 | 顶部 hero + 中部多列分析卡 + 底部证据 / 产品矩阵 |

> 用户内容超过 8 个要点时，默认主动提议"我可以拆成 2 张图，要不要"；只有选择 `consulting-report` 或 `report` 布局时，可以组织成 8-14 个模块，不要自动拆。

## 工作流

### 步骤 1：通过 `AskUserQuestion` 一次问完关键决策

调用一次 `AskUserQuestion`，把问题打包成一份小问卷。问卷结构示例：

```json
{
  "questions": [
    {
      "question": "这张知识卡 / 信息图的主题和标题怎么确定？",
      "header": "主题",
      "options": [
        { "label": "我会写", "description": "在备注里写主题、标题、重点内容或资料来源" },
        { "label": "帮我提炼", "description": "从当前对话或我贴的材料里提炼主题和标题" }
      ],
      "multi_select": false
    },
    {
      "question": "选一个视觉风格",
      "header": "风格",
      "options": [
        { "label": "notion-line", "description": "Notion 式浅灰浮层 + 克制阴影，推荐：知识卡、生产力、SaaS、技术内容" },
        { "label": "sketch-notes", "description": "手绘抖线 + macaron 色块，推荐：教育、入门科普、流程图解" },
        { "label": "chalkboard", "description": "黑板粉笔字，推荐：课堂、考点、公式、口诀" },
        {
          "label": "consulting-report",
          "description": "商业分析报告长图 + 真实图片素材，推荐：人物档案、公司分析、行业地图"
        }
      ],
      "multi_select": false
    },
    {
      "question": "选一个结构路线",
      "header": "布局",
      "options": [
        { "label": "dense/list", "description": "5-8 个要点的网格或列表，适合干货卡、清单、步骤" },
        { "label": "mindmap/flow", "description": "概念关系或步骤链，适合知识脉络、流程图" },
        { "label": "quadrant", "description": "4 象限矩阵，适合 SWOT、决策矩阵" },
        { "label": "report", "description": "8-14 个模块的商业报告长图，适合人物、公司、行业、战略拆解" }
      ],
      "multi_select": false
    },
    {
      "question": "输出偏好是什么？需要标题、比例、语言或强调色可以写在备注里。",
      "header": "输出",
      "options": [
        { "label": "1:1 zh", "description": "方形中文，社交分享通用，默认" },
        { "label": "3:4 zh", "description": "竖版中文，适合长图、公众号、笔记" },
        { "label": "4:3 zh", "description": "横版中文，适合幻灯片和文档插图" },
        { "label": "bilingual", "description": "中英双语；比例和强调色可写在备注里" }
      ],
      "multi_select": false
    }
  ]
}
```

要点：

- 主题、标题、比例、语言、强调色可以由用户写在自由备注；不要自己加"其他"。
- 风格选 `sketch-notes`、`chalkboard` 或 `consulting-report` 时，强调色题目的回答忽略即可，仍然按预设配色生成。
- 如果用户选择 `dense/list` 或 `mindmap/flow`，根据内容自动决定具体布局；不确定时用一句话追问，不要猜复杂结构。

### 步骤 2：在对话里整理 outline

读完用户的主题和补充，在对话里直接列出大纲（**不写任何文件**），并请用户确认或补充：

- `dense` / `list`：每条要点 ≤ 14 个汉字 / 20 chars，超长强制压缩；总数符合所选 layout 范围。
- `mindmap`：先给中心主题 1 句，再给 4-8 个一级分支；可选给 1-2 个分支补 2-3 个子点。
- `quadrant`：必须先确定横轴 / 纵轴标签，再给 4 个象限名 + 每象限 1-3 条要点。
- `flow`：列出 3-6 个有顺序的步骤名，每步可补 1 行说明。
- `report` / `consulting-report`：整理成 8-14 个信息模块；每个模块包含短标题 + 1-3 行短文，明确哪些模块需要真实图片素材（人物、产品、建筑、发布会、媒体头像、设备等）。

确认大纲后再进入步骤 3。要点不达数量下限时主动提示用户补充；超过 8 个要点时提议拆图；但 `report` / `consulting-report` 可承载 8-14 个模块。

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

Image / visual evidence direction:
{IMAGE_ASSET_BLOCK}

Color palette (use as fill / line / accent only, never render hex codes or palette role names as visible text):
{PALETTE_BLOCK}

Style details:
{STYLE_BLOCK}

Decorations:
{DECOR_BLOCK}

Hard rules:
- All on-image text must be sharp, high-contrast, properly aligned, no overflowing, no broken glyphs.
- Chinese punctuation must be full-width and not mixed with English punctuation.
- No realistic human faces, except for consulting-report when the user asks for a public figure / company profile; then use realistic editorial portrait, product, architecture or event imagery as visual evidence.
- Do not render hex codes, palette role names, "notion-line", "sketch-notes", "chalkboard", "consulting-report", "dense", "mindmap", "quadrant", "flow", "report" or any meta words as visible text.
- Do not invent numbers, percentages, charts or data the user did not provide.
```

各占位符按所选风格 / 布局填入：

`TITLE_FONT_HINT`：

- notion-line → `clean geometric sans-serif, slight negative letter-spacing, near-black #1F2937`
- sketch-notes → `bold hand-drawn lettering with slight wobble, ink color #2D2D2D`
- chalkboard → `chalk lettering with subtle dusty edge, white chalk #F5F0E0 or yellow chalk #F4E04D`
- consulting-report → `large bold editorial sans-serif, tight consulting deck hierarchy, near-black #111827`

`LAYOUT_BLOCK`：

- `dense` → `Multi-block grid with {N} rounded-rect zones; each zone has a short bold heading + 1-2 short lines under it; balanced spacing, generous whitespace between zones.`
- `list` → `Single column of {N} numbered items stacked vertically; each item: number badge + short heading + 1 short description line.`
- `mindmap` → `Central node with the topic in the middle; {N} branches radiating outward, each branch ending in a small rounded label; thin connecting lines, no overlap.`
- `quadrant` → `Cross-divided 2x2 grid; horizontal axis labeled "{X_AXIS}", vertical axis labeled "{Y_AXIS}"; each quadrant has a quadrant title + up to 3 short bullet lines.`
- `flow` → `Horizontal chain of {N} steps connected by arrows; each step is a rounded rect with step number + short label + 1 hint line.`
- `report` → `Premium business report dashboard with {N} compact modules: large hero zone at the top, 2-3 column analytical card grid in the middle, and a bottom evidence / product / future-challenge matrix. Include a strong title block, key facts, timeline or milestones, thesis card, supporting photo tiles, quotes or evaluation cards, and a concise final summary.`

`IMAGE_ASSET_BLOCK`：

- notion-line / sketch-notes / chalkboard：`Use simple icons or flat illustrations only; no realistic photo tiles, no realistic portraits.`
- consulting-report：`Use realistic editorial-style visual evidence based on public visual knowledge when relevant: a large hero portrait or product cutout, smaller product packshots, company building or campus photo, event / keynote thumbnails, media headshots, device / chip / vehicle / medicine / infrastructure images. Keep images integrated into the grid as evidence cards, not as decorative stock photos. Do not invent factual labels beyond the provided outline.`

`PALETTE_BLOCK`（按风格选其一）：

- notion-line：`background #FFFFFF or #FAFAFA, layered surfaces #FFFFFF / #F7F7F5 / #F1F1EF, minimal separators #E5E7EB only where necessary, accent {ACCENT_HEX}, body text #1F2937, muted text #6B7280`
- sketch-notes：`background #F5F0E8 with subtle paper texture, ink lines #2D2D2D, soft macaron blocks #A8D8EA / #D5C6E0 / #B5E5CF / #F8D5C4, accent coral #E8655A`
- chalkboard：`background #1A1A1A (or deep green-black #0F2520), white chalk #F5F0E0, yellow chalk #F4E04D, red chalk #E8655A, blue chalk #5DA9E9, green chalk #B5E5CF`
- consulting-report：`background #F6F7F9 or #FFFFFF, white report cards #FFFFFF, graphite text #111827, muted text #4B5563 / #6B7280, deep blue accent #0F4C81 or #1E3A5F, occasional green / amber category marks only when useful`

`STYLE_BLOCK`：

- notion-line：`Notion / Linear style document UI — clean and information-rich without being dense for density's sake. Build hierarchy with pale gray floating surfaces, subtle background contrast and very soft gray ambient shadows. Use few lines; do NOT draw full outline borders around modules. Hairline separators are allowed only for lists or columns. No gradients, no 3D effects, no glow. Zones MUST VARY in shape, width, height, and visual treatment — uniform tile grids are forbidden. Some zones are pure text with 2-3 bullets; others embed a small visual that genuinely fits the content. The vocabulary of zone treatments is broad, choose what matches each zone's data: mini node-and-arrow flow chains, numeric stat callouts with accent highlights, comparison spectrums or before/after bars, compact 2-column comparison tables, scale or ruler diagrams, small classification matrices, relationship graphs with labeled nodes, mini timelines with milestone dots, pull-quote boxes, small flat illustrations (person / product / building / map silhouettes when relevant), and UI mockup snippets in flat line-art style (mini browser chrome, mobile frame with a simplified screen, dialog or modal, toggle / radio group, progress bar, code or terminal block, settings list, notification toast, sidebar nav with active item). Pick ONE form per zone that fits its content; do NOT mechanically insert a UI mockup into every zone, and do NOT leave every zone as a bare icon + one line. The page should read like a well-curated Notion wiki where the layout itself communicates structure.`
- sketch-notes：`Hand-drawn wobble on every line and shape, rounded macaron-color blocks as section backgrounds, color fills do not reach the outline edges (hand-painted gap), pastel mood, slight paper grain.`
- chalkboard：`Chalk-textured strokes with subtle dust and faint smudges, slightly imperfect baselines, flat illustration only — no photorealistic blackboard frame, no wood, no studio lighting.`
- consulting-report：`High-density premium consulting / business analysis infographic. Looks like a polished McKinsey / BCG / Bloomberg / Apple newsroom profile page: exact grid, crisp modular cards, dense but readable captions, real photo evidence, compact icon system, subtle shadows, restrained blue-gray palette. Avoid cute doodles, empty minimalist layouts, poster-only composition, loud gradients or decorative stock-photo mood.`

`DECOR_BLOCK`：

- notion-line：`small dot bullets, checkbox glyphs, tiny status pills, short underlines; thin arrows and connector lines inside zones when they help explain a relationship — but only when meaningful, not as filler. The full mini-visual vocabulary (flow chains, callouts, comparison tables, UI mockup snippets, scale bars, mini timelines, pull-quotes, etc.) is defined in the style block above; choose at most ONE form per zone, only when it materially helps the content. All UI mockups stay flat and line-art. No emoji, no stickers, no decorative outline border boxes around the whole module.`
- sketch-notes：`wavy hand-drawn arrows between zones, tiny stars, small hearts, checkmarks, doodle underlines`
- chalkboard：`chalk stars, curved connector lines, small eraser smudges, occasional underlined keywords`
- consulting-report：`small professional line icons, tiny category chips, quote marks, timeline dots, product thumbnails, publication / event thumbnail strips, compact metric callouts only when data is provided`

### 步骤 4：调用 `GenImage`

默认用 `gpt-image-2`（文字稳定，强烈推荐）。仅当用户特别想要更艺术化的 sketch-notes 时才换 `nano-banana-pro`。

完整调用示例：

```json
{
  "image_id": "番茄工作法知识卡",
  "prompt": "Create a notion-line knowledge infographic about Pomodoro Technique in list structure. Title (top-center, clean geometric sans-serif, slight negative letter-spacing, near-black #1F2937): 番茄工作法 5 步要点\n\nLayout description: Single column of 5 numbered items stacked vertically; each item: number badge + short heading + 1 short description line.\n\nBullet content (use these exact texts, do not invent):\n- 1. 选定一个任务\n- 2. 设定 25 分钟计时\n- 3. 专注完成不切换\n- 4. 休息 5 分钟\n- 5. 每 4 轮长休 15 分钟\n\nImage / visual evidence direction: Use simple icons or flat illustrations only; no realistic photo tiles, no realistic portraits.\n\nColor palette: background #FFFFFF or #FAFAFA, layered surfaces #FFFFFF / #F7F7F5 / #F1F1EF, minimal separators #E5E7EB only where necessary, accent #2563EB, body text #1F2937, muted text #6B7280. Use as fill / surface / accent only, never render hex codes as visible text.\n\nStyle details: Notion / Linear style restrained document UI. Build hierarchy with pale gray floating surfaces, subtle background contrast and very soft gray ambient shadows. Use far fewer lines; do not draw full outline borders around modules. No gradients, no 3D effects, no glow.\n\nDecorations: small dot bullets, checkbox glyphs, tiny status pills, short underlines, very sparse arrows only when needed.\n\nHard rules: All on-image text must be sharp, high-contrast, properly aligned, no overflowing, no broken glyphs. Chinese punctuation full-width. No realistic human faces. Do not render hex codes, palette role names, or any meta words as visible text. Do not invent numbers or data.",
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
- 不要让 notion-line 出现完整线框描边、重阴影、gradient、立体、发光、玻璃质感；层级靠浅灰浮层和极柔和灰色阴影。
- 不要把 chalkboard 渲染成 photorealistic 木框黑板或带教室透视；保持 flat illustration。
- 不要在图里写出 `#2563EB` / `notion-line` / `dense` / `accent` 等元数据词。
- 用户没给数据时，不要让模型自己编数字、百分比或图表数值。
- 中英混排时，中文标点必须全角、不混用英文逗号句号。
- mindmap 不要让分支文字重叠、不要让连线穿过节点。
- quadrant 必须有清晰横纵轴标签，不能只画十字不写轴。

## 可选：设计学派 DNA 叠加

当用户主动引用具体学派（"做成 Fathom 报告那种"、"Müller-Brockmann 网格"、"Stamen 数据地图味"、"Takram 研究感"、"Information Architects 纯文字"），或当默认 4 风格不足以传达用户想要的"档次"时，可在 prompt 末尾追加 `# Design School DNA — overlay` 段。

每次只叠 1 个学派；学派与已有 4 风格的关系：

- `Fathom`、`Information Architects` 配 **consulting-report**：进一步加深学术 / 期刊 / 报告深度。
- `Müller-Brockmann` 配 **notion-line** + dense / list / quadrant：把克制感推到瑞士网格。
- `Stamen` 配 **consulting-report** 的地理 / 城市 / 气候话题：用地图学语汇替换通用图表。
- `Takram` 配 **notion-line** 或 **sketch-notes**：增加东方人文柔度。

### 5 个适合知识信息图的学派

```
Fathom Information Design:
- Scientific journal aesthetic with editorial polish
- Precise small data viz (small multiples, scatter, contour, timelines)
- Neutral graphite / navy palette + one highlight color
- Footnote / citation design integrated into layout
- Information density without clutter
```

```
Josef Müller-Brockmann Swiss modernism:
- Mathematical 8pt grid, columns visible
- Strict alignment (flush left or centered)
- Two-color maximum (black + one accent like #E63946)
- Akzidenz-Grotesk / Inter geometry
- Type IS the system; no decoration
```

```
Stamen Design cartographic:
- Cartographic data visualization (maps, contour, layered topography)
- Algorithm-generated organic patterns
- Warm palette (terracotta, sage green, deep blue)
- Hand-crafted feel despite digital precision
- Soft layered shadows, hinted depth
```

```
Takram Japanese speculative:
- Soft tech aesthetic, rounded corners, gentle shadows
- Charts and diagrams as art pieces
- Neutral natural palette (beige, soft gray, muted green)
- Modest sophistication, careful typography
- Subtle sketch-like annotations possible
```

```
Information Architects content-first:
- Content-first hierarchy, zero decorative elements
- System fonts only (SF Pro / Roboto / Inter)
- Classic blue hyperlink accent
- Reading-optimized line length
- Type IS the design, no images
```

### 学派叠加段落模板

把以下文本拼到 §3 步骤 3 的 `STYLE_BLOCK` 末尾或在最末追加一段：

```
# Design School DNA — overlay
[paste the chosen school's DNA block from above verbatim]

How this overlays the four base styles:
- The school refines typography, palette accents, chart shapes and decoration vocabulary on top of the chosen base style.
- If conflict (e.g. Kenya Hara emptiness vs. dense layout), keep the user's chosen layout density and let the school inform tone only.
- Do NOT render the school name as visible text in the image.
```

## 跟进选项

完成第一张后，主动给用户提供这些 follow-up：

- 换一个布局（dense ↔ mindmap ↔ quadrant ↔ flow ↔ list ↔ report）
- 换一个风格（notion-line ↔ sketch-notes ↔ chalkboard ↔ consulting-report）
- 加一个 / 删一个要点
- 改强调色（仅 notion-line）
- 出中英双语版本
- 内容超过 8 个要点 → 默认提议拆成 2 张图；如果用户要商业报告感，可切到 consulting-report / report 承载 8-14 个模块

## 小贴士

- 用户给的是长文章 → 先在对话里浓缩成适合布局的 outline，再让用户确认浓缩结果；普通知识卡 ≤ 8 个要点，商业报告长图 8-14 个模块；不要直接把整段长文塞进 prompt。
- 用户没说语言 → 默认中文，标题 / 要点都用中文。
- 用户偏爱"克制商务感" → 默认 notion-line + slate accent + 1:1。
- 用户偏爱"商业分析公司 / 高密度 / 真实图片 / 深度报告感" → 默认 consulting-report + report + 3:4。
- 用户偏爱"温暖手账感" → 默认 sketch-notes + 3:4。
- 用户偏爱"教学黑板感" → 默认 chalkboard + 4:3。
