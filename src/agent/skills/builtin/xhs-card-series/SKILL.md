---
name: xhs-card-series
description: Generates Xiaohongshu (RedNote / 小红书 / 小绿书) and WeChat 图文 image card series — a coherent set of 4-8 cartoon-style infographic cards with 12 visual styles, 8 layouts, and 3 palettes. Use whenever the user mentions 小红书图片 / 小红书种草 / 小绿书 / 微信图文 / 微信贴图 / XHS images / RedNote infographics / image card series / 系列图卡 / 图卡系列 / 多图笔记. NOT for 单张文章封面、PPT 长图、单页海报、长图营销页 (single hero cover or single long poster — pick a different skill).
icon: layout-grid
preview_image: /skill-previews/xhs-card-series.jpg
display_name:
  zh-CN: 小红书图卡系列
  en: XHS Card Series
display_description:
  zh-CN: 小红书 / 微信图文系列卡，多张连贯，12 风格 × 8 布局 × 3 配色。
  en: Coherent Xiaohongshu / WeChat image card series across 12 styles, 8 layouts, and 3 palettes.
starter_examples:
  zh-CN:
    - 30 天学会做饭系列卡，抓眼封面，步骤清单
    - 咖啡入门小红书图卡，奶油棕配色，强标题封面
    - 旅行攻略多图笔记，清爽地图，预算和路线
  en:
    - cooking in 30 days card series, catchy cover, step checklist
    - beginner coffee RedNote cards, creamy brown palette, bold cover
    - travel guide card series, fresh map, budget and route
---

# XHS Card Series

输出**多张连贯**的小红书 / 小绿书 / 微信图文系列图卡。每次默认 4-8 张，连成一组左右滑动看的笔记，封面抓眼球、中间承载干货、结尾收 CTA。比例默认 `3:4`（小红书竖图）或 `1:1`（微信九宫格 / 双联），不做单张大长海报、不做单纯封面图。

## 概述

触发场景：

- 用户给一段干货 / 测评 / 经验，要求拆成"封面+正文+结尾"的系列图卡。
- 用户提到小红书 / 小绿书 / RedNote / XHS / 微信图文 / 多图笔记 / 拼图 / 图卡系列。
- 用户说"出 N 张图"、"做一组 8 图"、"风格统一的系列"。

不触发：

- 单张电影海报、产品大图、PPT 长图、品牌主视觉。
- 真实人脸合成、品牌 logo 合规修图。

输出形态：每张是一次独立的 `GenImage` 调用（不要用 `n>1` 一次出多张系列，会失去 anchor chain 一致性），张数由用户在 `AskUserQuestion` 里选定，默认 6 张。

## 三维度组合

风格（style）× 布局（layout）× 调色板（palette），三者正交自由组合。

### Style（12 个）

| Style          | 一句话                                                    |
| -------------- | --------------------------------------------------------- |
| `cute`         | 甜美少女向，圆润字体 + 爱心 / 小花 / 闪光装饰，粉橘奶油色 |
| `fresh`        | 清新自然向，浅绿 / 米白 / 木色，留白多，干净通透          |
| `warm`         | 温暖故事向，米黄 / 砖红 / 焦糖，暖光氛围                  |
| `bold`         | 高冲击力，大字粗体 + 高饱和对比色，标题撑满画面           |
| `minimal`      | 极简编辑风，大量留白 + 1-2 种无衬线字体，细线分隔         |
| `retro`        | 复古怀旧，做旧颗粒、磨损边缘、蜡笔色 + 印刷纹理           |
| `pop`          | 波普炸裂，撞色 + 漫画感感叹号 + 大号 emoji 风装饰         |
| `notion`       | 极简手绘线稿，黑细线 + checkbox / 标注气泡，理性知识感    |
| `chalkboard`   | 黑板粉笔风，深绿黑底 + 彩色粉笔字 + 木框纹理              |
| `study-notes`  | 真实学霸笔记，蓝笔正文 + 红笔批注 + 黄色荧光笔划线        |
| `screen-print` | 丝网印刷海报感，halftone 网点 + 限定 2-3 色 + 象征化构图  |
| `sketch-notes` | 手绘信息图，wobbly 抖线 + macaron 色块 + 米色底           |

### Layout（8 个，含适用张数）

| Layout       | 信息密度 / 用途                  | 适用张数    |
| ------------ | -------------------------------- | ----------- |
| `sparse`     | 1-2 个要点，封面 / 结尾 / 金句   | 1 张/位     |
| `balanced`   | 3-4 个要点，标准信息卡           | 中段主力    |
| `dense`      | 5-8 个要点，干货知识卡           | 中段 1-2 张 |
| `list`       | 4-7 项排行 / 清单 / 编号要点     | 中段 1-2 张 |
| `comparison` | 左右对比 / 正反 PK / 前后差异    | 中段 1 张   |
| `flow`       | 3-6 步流程 / 时间线 / 教程顺序   | 中段 1-2 张 |
| `mindmap`    | 中心放射 4-8 分支，概念图 / 脑图 | 中段 1 张   |
| `quadrant`   | 四象限 / 圆形分区 / SWOT         | 中段 1 张   |

### Palette（3 个，含完整 hex）

| Palette   | 背景             | 区块色                                                              | Accent           | 气质       |
| --------- | ---------------- | ------------------------------------------------------------------- | ---------------- | ---------- |
| `macaron` | `#F5F0E8` 暖米   | `#A8D8EA` 雾蓝 / `#D5C6E0` 薰衣草 / `#B5E5CF` 薄荷 / `#F8D5C4` 蜜桃 | `#E8655A` 珊瑚红 | 柔和教育向 |
| `warm`    | `#FFECD2` 浅橘   | `#ED8936` 橘 / `#C05621` 砖红 / `#F6AD55` 金黄 / `#D4A09A` 玫瑰陶土 | `#A0522D` 棕褐   | 大地温暖向 |
| `neon`    | `#1A1025` 深紫黑 | `#00F5FF` 青 / `#FF00FF` 品红 / `#39FF14` 荧光绿 / `#FF6EC7` 荧光粉 | `#FFFF00` 高亮黄 | 高能赛博向 |

未选 palette 时使用 style 内置默认色（`sketch-notes` 默认 macaron，`chalkboard` 默认黑板深绿，`pop` 默认 neon-ish 撞色）。

## 预设速查表

按场景成组，每个预设是 style + layout 速记。出图大纲时优先按预设选，不要每张都换预设。

**Knowledge & Learning（干货 / 学习）**

| Preset           | Style        | Layout   | 适用                 |
| ---------------- | ------------ | -------- | -------------------- |
| `knowledge-card` | notion       | dense    | 干货知识卡、概念科普 |
| `checklist`      | notion       | list     | 清单、Top N 排行     |
| `concept-map`    | notion       | mindmap  | 概念图、知识脉络     |
| `swot`           | notion       | quadrant | SWOT、四象限分析     |
| `tutorial`       | chalkboard   | flow     | 教程步骤、操作流程   |
| `classroom`      | chalkboard   | balanced | 课堂笔记、知识讲解   |
| `study-guide`    | study-notes  | dense    | 学霸笔记、考试重点   |
| `hand-drawn-edu` | sketch-notes | flow     | 手绘教程、流程图解   |
| `sketch-card`    | sketch-notes | dense    | 手绘知识卡           |

**Lifestyle（生活分享）**

| Preset           | Style | Layout     | 适用               |
| ---------------- | ----- | ---------- | ------------------ |
| `cute-share`     | cute  | balanced   | 少女分享、日常种草 |
| `girly`          | cute  | sparse     | 甜美封面、氛围感   |
| `cozy-story`     | warm  | balanced   | 生活故事、情感分享 |
| `product-review` | fresh | comparison | 产品对比、测评     |
| `nature-flow`    | fresh | flow       | 健康流程、自然主题 |

**Impact（观点 / 警示）**

| Preset        | Style   | Layout     | 适用               |
| ------------- | ------- | ---------- | ------------------ |
| `warning`     | bold    | list       | 避坑指南、重要提醒 |
| `versus`      | bold    | comparison | 正反对比、PK       |
| `clean-quote` | minimal | sparse     | 金句、极简封面     |
| `pro-summary` | minimal | balanced   | 专业总结、商务内容 |

**Trend（潮流 / 娱乐）**

| Preset          | Style | Layout   | 适用                 |
| --------------- | ----- | -------- | -------------------- |
| `retro-ranking` | retro | list     | 复古排行、经典盘点   |
| `throwback`     | retro | balanced | 怀旧分享、年代回忆   |
| `pop-facts`     | pop   | list     | 趣味冷知识、彩蛋盘点 |
| `hype`          | pop   | sparse   | 炸裂封面、惊叹分享   |

**Editorial（海报 / 文化）**

| Preset      | Style        | Layout     | 适用               |
| ----------- | ------------ | ---------- | ------------------ |
| `poster`    | screen-print | sparse     | 海报封面、影评书评 |
| `editorial` | screen-print | balanced   | 观点文章、文化评论 |
| `cinematic` | screen-print | comparison | 电影对比、戏剧张力 |

## 自动推荐

读用户主题里的关键词，命中第一行赢；都不命中时回落到 `cute-share`。

| 关键词信号                         | Style          | Layout            | 推荐 preset                     |
| ---------------------------------- | -------------- | ----------------- | ------------------------------- |
| 美妆、穿搭、可爱、女生、粉、ootd   | `cute`         | sparse / balanced | `cute-share`、`girly`           |
| 健康、自然、有机、护肤、清洁       | `fresh`        | balanced / flow   | `product-review`、`nature-flow` |
| 故事、情感、回忆、家庭、温暖       | `warm`         | balanced          | `cozy-story`                    |
| 避雷、警告、必看、注意、坑         | `bold`         | list / comparison | `warning`、`versus`             |
| 商务、专业、效率、SaaS、职场       | `minimal`      | sparse / balanced | `clean-quote`、`pro-summary`    |
| 复古、老物件、怀旧、年代、经典     | `retro`        | balanced / list   | `throwback`、`retro-ranking`    |
| 冷知识、有趣、惊呆、绝绝子         | `pop`          | sparse / list     | `hype`、`pop-facts`             |
| 知识、概念、原理、SaaS、AI、生产力 | `notion`       | dense / list      | `knowledge-card`、`checklist`   |
| 教程、课堂、学习、教学、入门       | `chalkboard`   | balanced / flow   | `tutorial`、`classroom`         |
| 笔记、考试、考研、手写、复习       | `study-notes`  | dense / list      | `study-guide`                   |
| 影评、书评、观点、文化、思考       | `screen-print` | sparse / balanced | `poster`、`editorial`           |
| 手绘、图解、workflow、思路、整理   | `sketch-notes` | flow / dense      | `hand-drawn-edu`、`sketch-card` |

## 一次问完所有维度

在出大纲和调用 `GenImage` 之前，**用一次 `AskUserQuestion` 把所有维度问齐**。每题第一个 option 都标 `(推荐)` 并填上自动推荐结果，用户不动就用推荐值。题目结构：

```json
{
  "questions": [
    {
      "header": "主题",
      "question": "确认这次系列图卡的主题方向（可在备注里补关键信息 / 标题文案 / 受众）",
      "multi_select": false,
      "options": [
        { "label": "沿用上文主题 (推荐)", "description": "用最近一次用户消息里的内容作为系列主题" },
        { "label": "在备注里写新主题", "description": "我会在下面备注里给一段新的内容 / 标题 / 文案" }
      ]
    },
    {
      "header": "预设 / 风格",
      "question": "选 preset 或者直接选 style + layout（按推荐项已自动匹配）",
      "multi_select": false,
      "options": [
        { "label": "knowledge-card · notion + dense (推荐)", "description": "干货知识卡，5-8 个要点紧凑排列" },
        { "label": "cute-share · cute + balanced", "description": "少女风分享，3-4 个要点" },
        { "label": "warning · bold + list", "description": "避坑 / 警示清单" },
        { "label": "tutorial · chalkboard + flow", "description": "教程步骤" },
        { "label": "study-guide · study-notes + dense", "description": "学霸笔记重点" },
        { "label": "我自己在备注里写 style+layout", "description": "格式如 sketch-notes + mindmap" }
      ]
    },
    {
      "header": "配色",
      "question": "选调色板（不选则用风格内置色）",
      "multi_select": false,
      "options": [
        { "label": "macaron 暖米 + 马卡龙 (推荐)", "description": "#F5F0E8 底 + 雾蓝 / 薰衣草 / 薄荷 / 蜜桃" },
        { "label": "warm 大地暖橘", "description": "#FFECD2 底 + 橘 / 砖红 / 金黄" },
        { "label": "neon 深紫赛博", "description": "#1A1025 底 + 青 / 品红 / 荧光绿" },
        { "label": "默认（用 style 内置色）", "description": "不强制覆盖" }
      ]
    },
    {
      "header": "张数",
      "question": "这一组系列出几张？(4-8)",
      "multi_select": false,
      "options": [
        { "label": "6 张 (推荐)", "description": "1 封面 + 4 内容 + 1 结尾，最稳" },
        { "label": "4 张", "description": "1 封面 + 2 内容 + 1 结尾，最短" },
        { "label": "5 张", "description": "1 封面 + 3 内容 + 1 结尾" },
        { "label": "7 张", "description": "1 封面 + 5 内容 + 1 结尾" },
        { "label": "8 张", "description": "1 封面 + 6 内容 + 1 结尾，最长" }
      ]
    },
    {
      "header": "比例",
      "question": "出图比例",
      "multi_select": false,
      "options": [
        { "label": "3:4 小红书竖版 (推荐)", "description": "XHS / RedNote 主流比例" },
        { "label": "1:1 方图", "description": "微信九宫格 / 朋友圈拼图" },
        { "label": "4:3 横版", "description": "公众号头图 / 横屏" }
      ]
    },
    {
      "header": "水印",
      "question": "是否在每张图右下角加水印（默认无）",
      "multi_select": false,
      "options": [
        { "label": "不加水印 (推荐)", "description": "最干净" },
        { "label": "加水印（在备注里给 @handle 或文案）", "description": "如 @nano_panda，会出现在每张右下角" }
      ]
    }
  ]
}
```

允许用户少答几题，缺的就用推荐值。**不要拆成多次 `AskUserQuestion` 反复打断用户。** 备注栏是用户自由表达的入口，要主动读取（如自定义主题、自定义 style 组合、自定义水印文案）。

## Outline 生成原则

收到答复后，**直接在对话里**列一份 N 行大纲，不要落盘任何文件。每一行格式：

```
#NN [position] · [layout] · 标题/钩子文案 — 1 句要点摘要
```

岗位分布（按总张数 N 自动展开）：

- `#01` 封面：layout 永远是 `sparse`，标题钩子 6-12 字，占满画面，1 句副标题。
- `#02 .. #(N-1)` 内容：根据预设选 `balanced` / `dense` / `list` / `comparison` / `flow` / `mindmap` / `quadrant`。允许中段混 1-2 种 layout，但不要每张都不同（视觉跳）。
- `#NN` 结尾：layout `sparse` 或 `balanced`，CTA / 总结 / "求关注 + 主页有更多"。

大纲一次性给完，让用户瞄一眼可调整（"第 3 张换 comparison"、"删掉第 5 张"），用户没意见再开始调用 `GenImage`。

## Prompt 拼装模板

每张图的 prompt 用下面的骨架拼，**全英文 + 关键中文文案原样保留**，方便模型同时吃风格描述和精确中文标题。

```
A {style_phrase} infographic card for Xiaohongshu / RedNote, aspect ratio {ratio}.
Layout: {layout_phrase}.
Palette: background {bg_hex}, zone colors {zone_hex_list}, accent {accent_hex}.
Typography: bold Chinese sans for headline (~ 8-12% of canvas height), regular sans for body, slightly negative tracking, clear hierarchy.
Decorations: {decoration_phrase}.
Headline (中文原文，保留标点): "{headline_zh}".
Body bullets (中文原文): {bullets_zh_list}.

Negative: no realistic human faces, no real brand logos, no rendered hex codes or palette names as visible text, no stock photo collages, no oversaturated rainbow gradients, no English text replacing Chinese where Chinese was given.
```

各维度短语映射（按答复展开）：

- `style_phrase`：
  - cute → "sweet pastel cartoon, rounded fonts, hearts and sparkles"
  - fresh → "clean natural editorial, lots of whitespace, soft sage and cream"
  - warm → "cozy storybook, golden-hour palette, gentle paper grain"
  - bold → "high-impact magazine cover, oversize headline, saturated contrast"
  - minimal → "ultra-minimal Swiss editorial, hairline rules, generous whitespace"
  - retro → "vintage print, paper grain, slightly faded inks, retro typography"
  - pop → "pop-art, comic burst shapes, big punctuation, screaming color"
  - notion → "minimal hand-drawn black line art, checkbox and callout doodles, intellectual"
  - chalkboard → "deep green chalkboard, colored chalk handwriting, wooden frame edge"
  - study-notes → "realistic handwritten notebook photo, blue ballpoint body, red pen annotations, yellow highlighter"
  - screen-print → "screen-print poster, halftone dots, 2-3 ink colors only, symbolic composition"
  - sketch-notes → "hand-drawn sketchnote on warm cream paper, wobbly ink lines, macaron pastel zones"
- `layout_phrase`：
  - sparse → "1-2 large focal points, oversized headline, generous breathing room"
  - balanced → "3-4 evenly weighted points in a clear grid"
  - dense → "5-8 packed knowledge bullets in numbered cards, tight grid"
  - list → "vertical numbered list of 4-7 items, each with icon and short caption"
  - comparison → "left-right split, two columns labeled clearly, equal weight"
  - flow → "3-6 steps connected by arrows, left-to-right or top-to-bottom timeline"
  - mindmap → "center concept with 4-8 radiating branches, hand-drawn connectors"
  - quadrant → "four-quadrant grid, each quadrant labeled and color-coded"
- `decoration_phrase`：
  - notion → "thin black hand-drawn lines, checkbox bullets, tiny doodle icons, dot grid background hint"
  - chalkboard → "white and pastel chalk strokes, eraser smudges, hand-drawn underlines"
  - sketch-notes → "wobbly ink outlines, macaron color blocks, banner ribbons, small arrows"
  - screen-print → "halftone dot textures, registration marks, paper texture"
  - study-notes → "lined notebook paper, washi tape pieces, sticker doodles, highlighter swipes"
  - 其它 → 留空或一句风格内的常见装饰

字体硬性提示：

- 中文为主，使用与 style 匹配的中文 sans / 手写 / 笔记字体观感。
- 标题 / 副标题 / 正文比例约 `1 : 0.55 : 0.4`，不要全图一个字号。
- 不要把 hex 色号、palette 名、style 名、layout 名当作可见文字渲染到画面里——这些只是给模型看的描述。

## 关键一致性技巧 — image-1 anchor chain

LLM 模型每次独立生成会让角色 / 配色 / 装饰漂移。**唯一稳定的做法**：

1. 先生成 `#01` 封面，**不传** `reference_image_ids`。
2. 等到第 1 张真正生成成功（`GenImage` 任务终结事件返回真实 `image_ids`）后，再调用 `#02..#NN`。
3. 第 2 张及之后的每一张，把第 1 张的真实 image id 放进 `reference_image_ids`。

这样画面风格、配色、mascot、版式骨架都会跟封面对齐。**不要并发把全部 N 张一起调起来**，因为第 2 张此时还拿不到真实 anchor id。

调用序列示意（伪代码）：

```ts
// turn 1: 生成封面
GenImage({
  image_id: 'xhs-cover',
  prompt: '<#01 封面 prompt>',
  model: 'gpt-image-2',
  resolution: '2K',
  ratio: '3:4',
  n: 1,
  reference_image_ids: [],
})
// 等待 task 终结事件，拿到真实 image id，例如 "xhs-cover"

// turn 2: 生成第 2..N 张，每张一次调用
GenImage({
  image_id: 'xhs-02',
  prompt: '<#02 prompt>',
  model: 'gpt-image-2',
  resolution: '2K',
  ratio: '3:4',
  n: 1,
  reference_image_ids: ['[第一张的真实 image_id]'], // 例：["xhs-cover"]
})
// 后续 #03..#NN 同理，reference_image_ids 都用第 1 张的真实 id
```

## GenImage 单张完整调用示例

中文标题多 → 优先 `gpt-image-2`（文字渲染最好）。卡通画面 / 多 emoji / 主体造型 → 可换 `nano-banana-pro`。系列里每张都是独立一次 `GenImage` 调用，**不要把 `n` 设成 4 想一次出 4 张系列**——那是同一 prompt 的 4 个变体，不是连贯的封面 + 内容 + 结尾。

```json
{
  "image_id": "xhs-cover",
  "prompt": "A sketch-notes infographic card for Xiaohongshu, aspect ratio 3:4. Layout: 1-2 large focal points, oversized headline, generous breathing room. Palette: background #F5F0E8, zone colors #A8D8EA / #D5C6E0 / #B5E5CF / #F8D5C4, accent #E8655A. Typography: bold Chinese sans for headline (~ 10% of canvas height), regular sans for body, slightly negative tracking. Decorations: wobbly ink outlines, macaron color blocks, banner ribbons, small arrows. Headline (中文原文): \"我把 Notion 玩成了第二大脑\". Body bullets: \"3 步搭好 / 0 插件 / 全场景适用\". Negative: no realistic human faces, no real brand logos, no rendered hex codes or palette names as visible text, no oversaturated rainbow gradients.",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "3:4",
  "n": 1,
  "reference_image_ids": []
}
```

默认参数：`model: gpt-image-2`（中文标题多）或 `nano-banana-pro`（更柔和的卡通），`resolution: 2K`，`ratio: 3:4`，`n: 1`。

水印（仅当用户在 AskUserQuestion 里勾了"加水印"）：在 prompt 末尾追加：

```
Include a subtle watermark "{user_handle_text}" at bottom-right, ~3% canvas height, semi-transparent, not distracting.
```

## 常见反例

- 真实人脸 / 真实明星照 / 写实身体局部 → 一律改为风格化卡通 mascot 或纯字体海报。
- 一图塞 10 个要点又选 `sparse` → 改成 `dense` 或拆成两张。
- 全部用 `neon` 调色板还选 `minimal` 风格 → 视觉冲突，劝用户换回 macaron / warm。
- 中文标题被模型渲染成英文或乱码 → 在 prompt 里把中文用引号原样写出，并 **negative: no English text replacing Chinese**；优先用 `gpt-image-2`。
- 中文标点被换成英文 `,` `.` → 在 prompt 中明确"keep original Chinese punctuation （、，。！？""''）"。
- 一次 `GenImage` 调用 `n: 4` 想出整个系列 → 4 张是同一 prompt 的 variant，互相不连贯，**必须**每张分别调用并复用 anchor。
- 第 2..N 张并发调起 → 此时第 1 张还没落盘，没法做 anchor，结果系列依然漂移。
- `reference_image_ids` 里塞文件路径 / URL / base64 → 必须是 registry 已有的语义 image id（附件 / 历史 / 上一张刚生成）。
- 把 hex 色号或 palette 名直接渲染到画面 → 在 negative 中明确 "do not render hex codes or palette names as visible text"。

## 快速 follow-up

用户在系列出完后常见的修订意图，**只重画涉及的张**，不要整组重出：

- "重画第 3 张" → 用同一 prompt 模板，调整 `#03` 的 headline / bullets，`reference_image_ids` 仍是 `#01` 真实 id。
- "整组换 macaron 配色" → 重写每张 prompt 的 Palette 行，逐张重生成；如果时间紧，至少重出 `#01`，再让 `#02..#NN` 重新跟新封面 anchor。
- "把布局改成 dense" → 改对应张的 `layout_phrase`，重生成那一张。
- "右下角加上 @nano_panda 水印" → 在每张 prompt 末尾追加水印块，逐张重生成。
- "再加一张关于 X 的内容卡" → 在大纲尾部追加一行 `#(N) 内容`，调一次 `GenImage`，`reference_image_ids` 仍指向 `#01` 真实 id；结尾页编号顺延。
- "封面字太多看不清" → 砍掉副标题或减到 1 行，重出 `#01`，再让所有内容卡用新封面做 anchor。

记住：风格 / 配色 / 张数等用户偏好**只在当前这次对话里有效**，本 skill 不存任何偏好文件，下次用户问的时候重新跑一次 `AskUserQuestion`。
