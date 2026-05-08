---
name: article-cover-image
description: Generate article cover images / blog hero images / 公众号封面 / 文章配图 with a 5-dimension system (type, palette, rendering, text, mood) plus font selection. Use this skill whenever the user asks to "generate cover image", "create article cover", "make a blog hero", "design a banner for this post", or in Chinese "生成封面 / 文章封面 / 公众号封面 / 配图 / 头图 / 题图". Supports cinematic 2.35:1, widescreen 16:9, square 1:1, and 4:3 aspect ratios. Do NOT use this skill for: 小红书多图卡片 (use xhs-card-series), 漫画分镜 (comic-strip), 知识科普长信息图 (knowledge-infographic), 单张电影场景 (scene-cinematic), 海报/印刷品 (editorial-poster); also skip for product photo, avatar, logo design, icon set, or pure text rewriting.
icon: image
preview_image: /skill-previews/article-cover-image.jpg
display_name:
  zh-CN: 文章封面图
  en: Article Cover Image
display_description:
  zh-CN: 文章 / 公众号 / 博客封面图，type × palette × rendering × text × mood 五维度自由组合。
  en: Article / blog cover images via the 5-dimension system (type × palette × rendering × text × mood).
---

# Article Cover Image

为文章/博客/公众号生成单张封面图。把 5 个视觉维度（type / palette / rendering / text / mood）+ 字体偏好压成一次 prompt，调 `GenImage` 提交一张或一组封面候选。

## 1. 概述

LLM 在用户表达"给这篇文章配封面 / 做 cover image / 生成头图"时加载本 skill。流程极简：

1. 收集 5 维度（用 `AskUserQuestion` 一次问完）
2. 拼好完整 prompt（按本文件的模板）
3. 调 `GenImage` 提交任务，UI 会出审批卡片
4. 任务完成后简短回报

**重要原则**

- 不做"先确认才生成"的阻塞步骤——`GenImage` 自带审批卡片
- 标题必须用用户给的或源文中的原话，不要自创
- 调色板 hex 只是给模型的视觉指引，**禁止把色号 / 调色板名字渲染成可见文字**
- 没有真实文件系统、没有 EXTEND.md、没有偏好持久化；每次会话重新问

## 2. 输入收集

第一次进入 skill，**用一次 `AskUserQuestion` 调用把 5 个核心维度问完**（type、palette、rendering、text、mood）。font 和 aspect ratio 通常可由 mood/rendering 推导，可省。可粘贴模板：

```json
{
  "questions": [
    {
      "question": "封面想要哪种构图类型？",
      "header": "Type",
      "multi_select": false,
      "options": [
        { "label": "hero", "description": "大主视觉 + 标题压图，适合产品发布 / 重磅文" },
        { "label": "conceptual", "description": "抽象形状表达概念，适合技术 / 架构 / 方法论" },
        { "label": "typography", "description": "标题占主导（≥40% 面积），适合金句 / 观点稿" },
        { "label": "metaphor", "description": "具象物体隐喻抽象想法，适合成长 / 哲思" },
        { "label": "scene", "description": "氛围场景叙事，适合故事 / 旅行 / 生活方式" },
        { "label": "minimal", "description": "单焦点 + 大留白，适合禅 / 极简" }
      ]
    },
    {
      "question": "调色板？",
      "header": "Palette",
      "multi_select": false,
      "options": [
        { "label": "warm", "description": "暖橙奶油，人文温度" },
        { "label": "elegant", "description": "珊瑚 + 茶绿 + 暖米，商务克制" },
        { "label": "cool", "description": "工程蓝 + 浅灰，技术专业" },
        { "label": "dark", "description": "深紫黑 + 霓虹紫青，影院氛围" },
        { "label": "earth", "description": "森绿沙米，自然 / 户外" },
        { "label": "vivid", "description": "高饱和红绿蓝，发布 / 活动" },
        { "label": "pastel", "description": "粉薄荷淡紫，童趣 / 创意" },
        { "label": "mono", "description": "黑白灰 + 单点强调色" },
        { "label": "retro", "description": "珊瑚红 / 芥末黄 / 暗红，复古怀旧" },
        { "label": "duotone", "description": "两色高对比，海报 / 影像" },
        { "label": "macaron", "description": "马卡龙色块 + 暖米底，教学 / 科普" }
      ]
    },
    {
      "question": "渲染风格？",
      "header": "Rendering",
      "multi_select": false,
      "options": [
        { "label": "flat-vector", "description": "扁平矢量，干净几何" },
        { "label": "hand-drawn", "description": "手绘速写，有温度" },
        { "label": "painterly", "description": "水彩 / 笔触，艺术柔和" },
        { "label": "digital", "description": "光滑数码 / SaaS 风" },
        { "label": "pixel", "description": "像素 8-bit 怀旧" },
        { "label": "chalk", "description": "黑板粉笔，教育课堂" },
        { "label": "screen-print", "description": "丝网印刷海报，限定色块" }
      ]
    },
    {
      "question": "文字密度？",
      "header": "Text",
      "multi_select": false,
      "options": [
        { "label": "none", "description": "纯视觉，无任何文字" },
        { "label": "title-only", "description": "只有标题（默认）" },
        { "label": "title-subtitle", "description": "标题 + 副标题" },
        { "label": "text-rich", "description": "标题 + 副标题 + 2~4 个关键词标签" }
      ]
    },
    {
      "question": "情绪强度？",
      "header": "Mood",
      "multi_select": false,
      "options": [
        { "label": "subtle", "description": "低对比、降饱和，克制冷静" },
        { "label": "balanced", "description": "标准对比饱和（默认）" },
        { "label": "bold", "description": "高对比、高饱和，张力 / 发布感" }
      ]
    }
  ]
}
```

参考图：如果对话上下文里已有用户上传的参考图、Agent 附件、历史生成图，可在问卷自由备注里收集"是否引用某张图"，并把它们的 **image id**（不是文件路径）放进 `GenImage.reference_image_ids`。**禁止现造 image id**。

## 3. 维度速查

| 维度      | 取值                                                                                     | 一句话语义                    |
| --------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| type      | hero / conceptual / typography / metaphor / scene / minimal                              | 视觉构图骨架                  |
| palette   | warm / elegant / cool / dark / earth / vivid / pastel / mono / retro / duotone / macaron | 11 套色彩语义                 |
| rendering | flat-vector / hand-drawn / painterly / digital / pixel / chalk / screen-print            | 7 种笔触表达                  |
| text      | none / title-only / title-subtitle / text-rich                                           | 文字占比和层级                |
| mood      | subtle / balanced / bold                                                                 | 对比和饱和度倾向              |
| font      | clean / handwritten / serif / display                                                    | 字体风格（与 rendering 协同） |

## 4. 调色板 hex 速查

下表 hex 仅供模型作为颜色参考；**禁止在图里把色号、调色板名字、color role 当成可见文字渲染**。

| Palette | Primary / Background / Accent (HEX)                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------- |
| warm    | `#ED8936` `#F6AD55` `#C05621` / `#FFFAF0` `#FED7AA` / `#744210` `#E53E3E`                                |
| elegant | `#E8A598` `#5B8A8A` `#D4A5A5` / `#F5F0E6` `#F0EBE0` / `#C9A962` `#B87333`                                |
| cool    | `#2563EB` `#1E3A5F` `#06B6D4` / `#F8F9FA` `#FAF8F5` / `#F59E0B` `#BFDBFE`                                |
| dark    | `#8B5CF6` `#06B6D4` `#EC4899` / `#0A0A0A` `#1A1A2E` / `#F59E0B` `#FFFFFF`                                |
| earth   | `#276749` `#9AE6B4` `#744210` / `#F5E6D3` `#E0F2FE` / `#ED8936` `#63B3ED`                                |
| vivid   | `#EF4444` `#22C55E` `#3B82F6` / `#EFF6FF` `#F5F3FF` / `#FB923C` `#FACC15`                                |
| pastel  | `#FFB6C1` `#98D8C8` `#C8A2C8` / `#FFFFFF` `#FFF8E7` / `#FFFACD` `#BEE3F8`                                |
| mono    | `#000000` `#1F1F1F` `#374151` / `#FFFFFF` `#FAFAFA` / `#9CA3AF` + 内容衍生单点强调色                     |
| retro   | `#E07A5F` `#81B29A` `#F2CC8F` `#5D3A3A` / `#F5F0E6` `#F5E6D3` / `#D4764A` `#577590` `#C9A227`            |
| duotone | 二选一 pair：`#E8751A`+`#0A6E6E` / `#1A3A5C`+`#D4A843` / `#DC143C`+`#0D1B2A` 等 + bg `#121212` `#1E1E1E` |
| macaron | `#A8D8EA` `#B5E5CF` `#D5C6E0` / `#F5F0E8` `#FFD5C2` / `#E8655A` `#2D2D2D`                                |

## 5. Prompt 拼装模板

把下面文本作为 `GenImage.prompt` 的内容；按用户选的维度替换方括号占位。

```
Role: Senior editorial cover designer.
Goal: Produce a single article cover image for the content below. Ample whitespace, one dominant focal point, no cluttered layout.

# Content
- Title (use EXACT, do not invent): [exact title]
- Summary: [2-3 sentence summary]
- Keywords: [5-8 keywords]
- Language for any rendered text: [zh / en / ja]

# Composition (Type = [type])
[hero] Large focal visual occupying 60-70% of frame, dramatic composition, title overlays the visual.
[conceptual] Abstract shapes representing the core concept, clear information hierarchy, clean whitespace zones.
[typography] Title is the primary element (≥40% area), minimal supporting visuals, strong type hierarchy.
[metaphor] One concrete object/scene that symbolizes the abstract idea, emotionally resonant.
[scene] Atmospheric environment with narrative elements, mood-setting lighting and color.
[minimal] Single focal element, 60%+ generous whitespace, only essential shapes.

# Palette ([palette])
Primary: [hex list], Background: [hex list], Accent: [hex list].
Decorative hints: [palette decorative cues, e.g. "halftone dots and vintage badges" for retro].
Color values are guidance for the model — do NOT render hex codes, color names, role labels, or palette names as visible text in the image.

# Rendering ([rendering])
- Lines: [clean uniform / sketchy variable / soft brush / pixel-grid / chalk-grain / sharp stencil edges]
- Texture: [flat fills / paper grain / watercolor wash / smooth digital / dithering / chalk dust / halftone + paper]
- Depth: [flat 2D / minimal hatching / soft blended / subtle gradient + shadow / parallax / flat board / layered silhouettes]
- Element vocabulary: [geometric icons / doodles / botanical washes / UI cards / 8-bit sprites / chalk doodles / bold silhouettes + halftone]

# Text Level ([text])
- none: no text in the image.
- title-only: render the exact title once; ~85% area for visuals.
- title-subtitle: title + one short subtitle; ~75% area for visuals.
- text-rich: title + subtitle + 2-4 keyword chip badges; ~60% area for visuals.

# Font ([font])
- clean: modern geometric sans-serif (Inter / SF-style), tight kerning.
- handwritten: warm hand-lettered, organic baseline.
- serif: editorial serif, refined letterforms.
- display: bold decorative display, heavy expressive headline.

# Mood ([mood])
- subtle: reduce contrast 20-30%, desaturate 20-30%, lighter strokes.
- balanced: standard contrast and saturation.
- bold: increase contrast 20-30%, saturated colors, heavier visual weight.

# Hard Constraints
- Use simplified silhouettes for any humans; NO realistic human faces or photographic anatomy.
- Do NOT render hex codes, color names, palette labels, or any of the dimension keywords (type/palette/rendering/mood) as visible text in the image.
- Generous whitespace 40-60%, main element centered or slightly left-of-center.
- Match the language of any visible text to [zh / en / ja] above.
```

## 6. 自动推荐表（用户没指定时）

当用户跳过某个维度，按内容关键词从下表挑默认值，再写进 prompt。

| 内容关键词               | type       | palette         | rendering    | text           | mood     | font        |
| ------------------------ | ---------- | --------------- | ------------ | -------------- | -------- | ----------- |
| 产品发布 / launch / 重磅 | hero       | vivid 或 dark   | digital      | title-subtitle | bold     | display     |
| 架构 / API / system      | conceptual | cool            | flat-vector  | title-only     | balanced | clean       |
| 观点 / 金句 / quote      | typography | elegant 或 mono | flat-vector  | title-only     | subtle   | serif       |
| 成长 / 哲思 / 反思       | metaphor   | warm 或 earth   | painterly    | title-only     | balanced | serif       |
| 故事 / 旅行 / 生活       | scene      | earth 或 warm   | painterly    | title-only     | balanced | handwritten |
| 极简 / 禅 / 专注         | minimal    | mono            | flat-vector  | title-only     | subtle   | clean       |
| 教程 / 科普 / onboarding | conceptual | macaron         | flat-vector  | title-subtitle | balanced | clean       |
| 复古 / 历史 / 回顾       | metaphor   | retro           | screen-print | title-only     | balanced | display     |
| 影像 / 海报 / album      | hero       | duotone         | screen-print | title-only     | bold     | display     |
| 教育 / 课堂              | conceptual | warm            | chalk        | title-subtitle | balanced | handwritten |
| 游戏 / 像素 / 怀旧       | hero       | vivid           | pixel        | title-only     | bold     | display     |

未指定 aspect 默认 `16:9`；明显电影 / 海报感 → `2.35:1`；社交头像 → `1:1`；公众号常规可选 `4:3`。

## 6.5 可选：设计学派 DNA 叠加

当用户**主动引用具体学派**（"像 Pentagram", "Build studio 那种克制", "Sagmeister 的快乐感", "Kenya Hara 的留白", "Neo Shen 水墨光晕"），或当 §6 自动推荐表里看不出强 fit 时，可在 prompt 中追加一段 `# Design School DNA` 锚点，盖在 type / palette / rendering / mood 之上做风格调味。

每次只挑 1 个学派；多学派会互相冲突。学派提示在 prompt 末尾插入即可，不替换 §5 主体。

### 适合做封面的 7 个学派

```
Pentagram / Michael Bierut editorial:
- Helvetica or Univers grotesque, extreme typographic hierarchy
- Black / white + ONE accent (e.g. #DC143C)
- Headline dominates 40-50%, 60%+ whitespace
- Information architecture as visual structure
```
适合内容：商业 / 编辑深度 / 政策 / 财经 / 权威观点（type=hero / typography，palette=mono / cool）。

```
Build studio luxury minimalism:
- Generous whitespace (70%+), subtle weight shifts (200 to 600)
- Single accent color used sparingly
- Soft shadow / very subtle gradient hints, golden ratio rhythm
- High-end editorial / brand confidence
```
适合内容：高端品牌、设计公司、奢侈生活方式（type=minimal / hero，palette=elegant / mono）。

```
Takram Japanese speculative design:
- Soft tech aesthetic: rounded corners, gentle shadows
- Diagrams and small charts as art pieces
- Neutral natural palette (beige #E8E1D5, soft gray #C8C5BE, muted green #6F8A7E)
- Modest sophistication, careful typography
```
适合内容：科技人文、产品 / 研究、设计思辨（type=conceptual / metaphor，palette=earth / elegant）。

```
Sagmeister & Walsh joyful philosophy:
- Unexpected color bursts on minimal cream + black base
- Hand-made elements (paper, ribbon, stitched type) blended into digital
- Optimistic warm imperfection, experimental but legible
```
适合内容：文化机构、年度回顾、暖色金句、创意品牌（type=typography / metaphor，palette=warm / vivid）。

```
Kenya Hara "emptiness" design:
- Extreme whitespace (80%+), single tiny focal mark
- Layered whites (warm white / cool white / off-white)
- Paper texture and tactility translated to digital
- Zen simplicity, design by subtraction
```
适合内容：文化哲思、极简观点、东方美学（type=minimal，palette=mono / warm）。

```
Neo Shen poetic Chinese aesthetic:
- Digital interpretation of ink wash painting
- Soft glow and light diffusion effects
- Poetic negative space, atmospheric depth
- Emotional palette (deep blues, warm grays, soft gold)
- Calligraphic influences in typography
```
适合内容：东方美学、禅意 / 心境 / 文化散文（type=metaphor / scene，palette=dark / earth / mono）。

```
Experimental Jetset conceptual minimalism:
- Single visual metaphor for the entire cover
- Primary colors only (red / blue / yellow) + black / white
- Typography as main graphic element, deliberate grid breaks
- Anti-commercial, honest, type-driven
```
适合内容：博物馆 / 文化机构 / 反商业 / 概念稿（type=typography，palette=vivid / mono）。

### 学派叠加段落模板

把以下文本拼到 §5 主 prompt **末尾**：

```
# Design School DNA — overlay
[paste the chosen school's DNA block from §6.5 verbatim]

How this overlays the dimensions:
- It refines the typography family, palette accents and decoration vocabulary chosen above.
- If it conflicts with a dimension (e.g. Kenya Hara overlay vs. dense rendering vocabulary), let the school dominate.
- Do NOT render the school name or any of these descriptive words as visible text in the image.
```

学派与已有维度冲突时，**学派优先**（学派是文化锚点，type / palette 是结构骨架）。

## 7. GenImage 调用示例

把 prompt 文本组装好后，提交一次 `GenImage`。**默认 model 用 `nano-banana-pro`**（画质高、长 prompt 稳定）；**只要 text 选了 title-subtitle / text-rich 或语言是中文**，优先 `gpt-image-2`（文字渲染最稳）；轻量场景 / 不需要文字 / 想要快可以用 `nano-banana-2`。

```json
{
  "image_id": "cover_article_growth_metaphor",
  "prompt": "Role: Senior editorial cover designer.\nGoal: Produce a single article cover image ...（按 §5 模板拼好的完整文本）",
  "model": "nano-banana-pro",
  "resolution": "2K",
  "ratio": "16:9",
  "n": 1,
  "reference_image_ids": []
}
```

参数默认值：

| 参数                | 默认              | 备注                                                               |
| ------------------- | ----------------- | ------------------------------------------------------------------ |
| model               | `nano-banana-pro` | 中文标题或多文字时换 `gpt-image-2`；预算敏感场景用 `nano-banana-2` |
| resolution          | `2K`              | 公众号 / 博客够用；要海报印刷可上 `4K`（仅 nano-banana-pro 友好）  |
| ratio               | `16:9`            | 电影感 → `2.35:1`；社交方图 → `1:1`；公众号传统 → `4:3`            |
| n                   | `1`               | 用户明说"出一组对比" / "多来几张" 才升到 2~4                       |
| reference_image_ids | `[]`              | 仅当对话已有真实图片 id 才填                                       |

## 8. 参考图处理

- `reference_image_ids` 必须是当前会话已有图片 id（Agent 附件、参考图区图片、历史图、之前生成图），**不是文件路径**，不要伪造。
- 仅传 reference 不在 prompt 文字里描述时，模型经常忽略 reference。所以：**只要 `reference_image_ids` 非空，就在 prompt 末尾追加一段 "Reference Style — MUST INCORPORATE"**，逐条点名要保留的元素：

```
# Reference Style — MUST INCORPORATE
CRITICAL: The cover must visually reference the provided images.

- Brand element: <e.g. "logo's letter 'm' rendered as 3 vertical lines |||">
- Signature pattern: <e.g. "intersecting curves forming diamond grid">
- Colors: <exact hex from reference, e.g. "#2D4A3E dark teal background, #F5F0E0 cream text">
- Typography: <e.g. "uppercase, wide letter-spacing">
- Characters (if any): describe hair / glasses / clothing → "stylize to flat-vector, keep distinguishing features, NO photoreal face"
- Integration: <how to compose them with this cover, e.g. "split layout: 65% main illustration + 35% bottom banner from Ref-1">
```

每条用 "MUST" / "REQUIRED" 措辞，描述具体到能复现。模糊词（"clean style", "nice colors"）不算数。

## 9. 常见反例 / 容易出错的点

1. **把 hex 或 palette 名字写到图上**：`#ED8936` 或 "warm" 字样不能出现在图里；它们只是给模型的颜色 hint。
2. **自己改/编造标题**：必须使用用户提供的原标题或源文章原标题，不要自我意译。
3. **`reference_image_ids` 当文件路径用**：写 `"refs/cover.png"` 之类是错的；只能填**已存在**的语义 image id。
4. **多张候选时把同一 id 写进 image_id**：`image_id` 只填一次；`n>1` 时系统自动加 `_2 / _3` 后缀。
5. **真实人脸 / 摄影写实**：所有人物必须简化轮廓（剪影 / 卡通 / 矢量），禁止写实人脸。
6. **画面塞满**：必须留 40-60% 留白，主元素居中或稍偏左，留出标题区。
7. **rendering 和 font 打架**：painterly 配 display 字体常常出戏；优先按本文件 §6 推荐对配。

## 10. 跟进调整（用户拿到图后）

- "换比例 / 换更宽的" → 重新调一次 `GenImage`，新 image_id 加后缀如 `_w235`，只改 `ratio`。
- "颜色再温暖一点 / 再克制一点" → 维度不变，把 palette 或 mood 改一档（mono → warm，bold → balanced），prompt 重拼。
- "标题太小 / 加副标题" → 切换 text 等级（title-only → title-subtitle / text-rich），并明确 font 偏好。
- "中文标题字怪" → 切到 `gpt-image-2`，model 改一行即可。
- "出一组多版本对比" → `n: 3~4`，其他保持；提交一次 `GenImage` 即可，UI 卡片会一起审批。
- "想用之前那张做风格参考" → 让用户确认那张图的语义 id，加进 `reference_image_ids`，并补上 §8 的 "MUST INCORPORATE" 段。

调整都走"重新组 prompt → 再 `GenImage`"，不要在工具调用前再做一次确认问卷，UI 审批卡片就是确认入口。
