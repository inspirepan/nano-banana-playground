---
name: scene-cinematic
description: Create a single wide cinematic scene image with strong atmosphere, mood lighting, and aerial perspective. Use for cinematic scene, narrative illustration, atmospheric scene, wide-angle scene, sci-fi mood, blog hero, podcast wide cover, story configuration. 用于电影感、氛围图、场景插画、宽幅故事图、叙事配图、博客头图、AI/sci-fi 主题首图。Do NOT use for 干货知识卡 / 信息图 / 海报排版 / 产品图 / UI 截图 / 四象限图。
icon: clapperboard
preview_image: /skill-previews/scene-cinematic.jpg
display_name:
  zh-CN: 电影感场景
  en: Cinematic Scene
display_description:
  zh-CN: 电影感叙事场景图，强氛围、宽幅 2.35:1、大气透视。
  en: Cinematic narrative scene images with strong atmosphere and wide 2.35:1 framing.
---

# Scene Cinematic

## 概述

本 skill 输出**单张**大幅叙事场景图，目标是建立氛围与情绪，而不是承载信息密度。典型用途：

- 博客 / 公众号文章 hero 图
- 技术文章的 metaphor 配图（比如把一个抽象概念可视化为一个场景）
- 故事 / 旅行 / 生活叙事配图
- AI / sci-fi 主题首图
- 播客封面 wide 版本

不适合：

- 高文字量的信息卡片（走 `xhs-card-series`）
- 产品图 / 电商素材（走专用产品 skill）
- 四象限 / 矩阵 / 流程图（走信息图 skill）
- 多张同主题分镜（走 `comic-strip`）

一图一向：氛围方向、配色、比例只选一组，不要混合。

## 氛围方向 (mood-direction)

一次只选一种，整张图的光线、色温、构图密度都由它决定。

- `cinematic-noir` — 雨夜街道、霓虹反光、低 key 大反差，duotone 暗色基调，画面 70% 落在阴影里，主光来自远处招牌或路灯。推荐 ratio `2.35:1`，配 Noir Neon 或 Cinematic Duotone。
- `golden-hour` — 黄昏暖光、长投影、大气透视、远山雾化，静谧抒情，主光是低角度太阳。推荐 ratio `16:9` 或 `2.35:1`，配 Golden Sunset 或 Earthy Wild。
- `sci-fi-tech` — 冷蓝青调、数字粒子、光锥、极简地平线、单一巨大几何体（塔 / 球 / 飞行器），高科技但不炫技。推荐 ratio `16:9` 或 `2.35:1`，配 Cool Tech 或 Noir Neon。
- `nature-wonder` — 山谷、森林、海面、天空云层，自然尺度感，人物小到只是 silhouette。推荐 ratio `16:9` 或 `4:3`，配 Earthy Wild 或 Golden Sunset。
- `dreamlike-pastel` — 软光晕、漂浮元素、童话感 painterly，柔和但保持 painterly 的笔触感，避免卡通 chibi。推荐 ratio `1:1` 或 `4:3`，配 Dreamlike Pastel。

## 核心配色

仅用作生图引导。**禁止**在图里渲染色号、配色名或 role 标签为可见文字。

- **Noir Neon**：背景 `#0A0A0A` / 紫 `#8B5CF6` / 青 `#06B6D4` / 高光白 `#FFFFFF` / 路面反光 `#1A1A2E`
- **Golden Sunset**：暖橙 `#ED8936` / 金黄 `#F6AD55` / 桃粉 `#FED7AA` / 深棕 `#744210` / 远景紫 `#553C9A`
- **Cool Tech**：工程蓝 `#2563EB` / 海军蓝 `#1E3A5F` / 青 `#06B6D4` / 浅雾 `#F8F9FA` / accent 琥珀 `#F59E0B`
- **Earthy Wild**：森林绿 `#276749` / 鼠尾草 `#9AE6B4` / 大地棕 `#744210` / 沙米 `#F5E6D3` / 水蓝 `#63B3ED`
- **Cinematic Duotone**：橙 `#E8751A` × 青绿 `#0A6E6E`（双色主导，背景压到 `#121212`）
- **Dreamlike Pastel**：软粉 `#FFB6C1` / 薄荷 `#98D8C8` / 薰衣草 `#C8A2C8` / 黄油 `#FFFACD` / 天蓝 `#BEE3F8`

## 构图原则

cinematic 的关键不是细节多，而是层级分明。

- 三分法：主体放在三分点；地平线放在上 1/3 或下 1/3，不要切中。
- 引导线 (leading lines)：道路、河流、光柱、栏杆、轨道把视线导向主体。
- 大气透视：远景去饱和 + 雾化 + 提亮，近景留住饱和与细节。
- 单一主光：窗光 / 太阳 / 路灯 / 屏幕辉光，明确光源方向，避免均匀打光。
- 三段层级：前景遮挡（剪影 / 树枝 / 栏杆 / 地面）+ 中景主体 + 远景背景。
- 留白：至少 30% 是天空 / 空气 / 雾，不要把画面塞满。
- 角色 silhouette 化：剪影、背影、远景小人，**不要**真人脸特写。
- 比例匹配叙事：`2.35:1` 强调横向叙事和孤独感；`16:9` 通用 hero；`9:16` 用于"望天 / 望塔 / 单人物纵向"；`4:3` 用于自然景观；`1:1` 仅用于 dreamlike 漂浮构图。

## AskUserQuestion 一次问完

在生成之前调用 `AskUserQuestion`，把决策一次问清。完整调用示例：

```json
{
  "questions": [
    {
      "header": "主题",
      "question": "请用一句话描述这张图的主题与场景（地点 / 时间 / 主体 / 想传达的情绪），可在备注里详细写。",
      "multi_select": false,
      "options": [{ "label": "已在备注中描述", "description": "把具体场景与情绪写在下方备注里" }]
    },
    {
      "header": "氛围方向",
      "question": "选择一种氛围方向（一图一向，决定光线和色温）",
      "multi_select": false,
      "options": [
        { "label": "cinematic-noir（推荐）", "description": "雨夜霓虹 / 低 key 大反差 / duotone 暗色" },
        { "label": "golden-hour（推荐）", "description": "黄昏暖光 / 长投影 / 静谧抒情" },
        { "label": "sci-fi-tech", "description": "冷蓝青调 / 光锥 / 极简地平线" },
        { "label": "nature-wonder", "description": "山谷森林海天 / 自然尺度感" },
        { "label": "dreamlike-pastel", "description": "软光晕 / 漂浮元素 / painterly 童话感" }
      ]
    },
    {
      "header": "配色",
      "question": "选择一套主导配色",
      "multi_select": false,
      "options": [
        { "label": "Noir Neon", "description": "黑底紫青霓虹，配 cinematic-noir / sci-fi-tech" },
        { "label": "Golden Sunset", "description": "暖橙金黄桃粉，配 golden-hour" },
        { "label": "Cool Tech", "description": "工程蓝青加琥珀点缀，配 sci-fi-tech" },
        { "label": "Earthy Wild", "description": "森林绿大地棕水蓝，配 nature-wonder" },
        { "label": "Cinematic Duotone", "description": "橙青绿双色主导，配 cinematic-noir" },
        { "label": "Dreamlike Pastel", "description": "软粉薄荷薰衣草，配 dreamlike-pastel" }
      ]
    },
    {
      "header": "比例",
      "question": "选择画面比例（默认 2.35:1 cinematic 横幅）",
      "multi_select": false,
      "options": [
        { "label": "2.35:1（推荐）", "description": "电影宽幅，横向叙事最佳" },
        { "label": "16:9", "description": "通用 hero / 博客封面" },
        { "label": "9:16", "description": "竖图，望天 / 望塔 / 纵向人物" },
        { "label": "4:3", "description": "自然景观、稳重叙事" },
        { "label": "1:1", "description": "仅 dreamlike 漂浮构图" }
      ]
    },
    {
      "header": "人物",
      "question": "画面是否需要人物（人物只做 silhouette，不出真人脸）",
      "multi_select": false,
      "options": [
        { "label": "无人", "description": "纯场景，最干净" },
        { "label": "单人剪影", "description": "一个 silhouette，强化叙事焦点" },
        { "label": "多人剪影", "description": "2-3 个远景 silhouette，群体感" }
      ]
    },
    {
      "header": "渲染倾向",
      "question": "选择整体渲染质感",
      "multi_select": false,
      "options": [
        { "label": "painterly 油画感", "description": "可见笔触、柔边、wet-on-wet 渐变" },
        { "label": "digital 数字感", "description": "干净渐变、锐利景深、克制 lens-flare" },
        { "label": "hand-drawn 插画感", "description": "有机线条、纸纹、墨水晕染" }
      ]
    },
    {
      "header": "标题文字",
      "question": "图上是否叠加标题文字（cinematic 图上文字越少越好，最多 12 个汉字 / 24 字符）",
      "multi_select": false,
      "options": [
        { "label": "none", "description": "不加任何文字，最 cinematic" },
        { "label": "短句叠加", "description": "选这个并把具体文案写在备注里" }
      ]
    }
  ]
}
```

## prompt 拼装模板

按以下骨架组装英文 prompt（Gemini 系模型对结构化英文 prompt 响应最稳）：

1. **角色句**：`Create a cinematic [mood-direction] scene depicting [topic].`
2. **场景描述**：地点 / 时间 / 天气 / 主体一句话写清，例如 `A lone figure walking down a rain-soaked alley in Tokyo at 2am, neon signs reflecting on wet asphalt.`
3. **光线**：从这组关键词里挑 2-3 个，单一主光优先：
   - `volumetric light` / `rim light` / `atmospheric haze` / `godrays` / `soft bounce light`
   - `single key light from [direction]` / `low-angle sun` / `neon glow as sole light source`
4. **配色**：列出所选配色的 hex，例如 `Dominant palette: deep purple #8B5CF6 and cyan #06B6D4 against #0A0A0A black, with rare white #FFFFFF highlights.`
5. **构图**：`leading lines toward the horizon, rule of thirds, dark foreground silhouette, mid-ground subject, distant atmospheric horizon, at least 30% empty sky / atmosphere.`
6. **渲染细节**（按所选倾向择一）：
   - painterly: `painterly rendering with visible brush strokes, soft edges, wet-on-wet color blending, oil-on-canvas texture.`
   - digital: `polished digital rendering, clean gradient transitions, sharp depth-of-field, restrained use of lens flare, crisp silhouettes.`
   - hand-drawn: `hand-drawn illustration with organic ink strokes, paper grain, ink wash gradients, slight imperfection in lines.`
7. **角色处理**（如有人物）：`Human figure rendered as a simplified silhouette suggested by lighting and pose only, NO realistic faces, NO facial features, NO portrait detail.`
8. **标题文字**（如有）：`Overlay title "<exact text>" in [bottom-left | top-right | lower-third], minimal sans-serif or cinematic display typeface, single line, no decoration.`
9. **反向约束**（必带）：`Negative: no photorealistic human faces, no busy text overlays, no logo or watermark unless requested, do not render any hex codes / palette names / role labels as visible text in the image, avoid clipart aesthetic, avoid messy or cluttered composition, avoid overused lens-flare and Photoshop filter look.`

## GenImage 调用示例

默认参数：

- model: `nano-banana-pro`（**首选**，大图 / 摄影感 / 大气透视效果最好）
- resolution: `2K`（用户明确要 4K 才升）
- ratio: 跟用户选，默认 `2.35:1`
- n: `1`（本 skill 是单张 skill）
- reference_image_ids: 通常空

完整示例：

```json
{
  "image_id": "rainy_neon_alley",
  "prompt": "Create a cinematic cinematic-noir scene depicting a lone figure walking down a rain-soaked Tokyo alley at 2am. Neon signs reflecting on wet asphalt, steam rising from a manhole, distant taxi headlights. Single key light from a magenta neon sign on the right; volumetric light through light rain; atmospheric haze in the deep background. Dominant palette: deep purple #8B5CF6 and cyan #06B6D4 against #0A0A0A black, asphalt reflections in #1A1A2E, rare white #FFFFFF highlights only on rim of the figure. Leading lines along the alley converging to a vanishing point at lower-third right; rule of thirds; dark foreground silhouette of a railing; mid-ground subject (the figure); distant atmospheric horizon; at least 35% sky filled with low neon-tinted clouds. Polished digital rendering, clean gradient transitions, sharp depth-of-field, restrained lens flare, crisp silhouettes. Human figure rendered as a simplified silhouette suggested by lighting and pose only, NO realistic faces, NO facial features. Negative: no photorealistic human faces, no busy text overlays, no logo or watermark, do not render any hex codes or palette names as visible text, avoid clipart aesthetic, avoid messy composition, avoid overused lens-flare look.",
  "model": "nano-banana-pro",
  "resolution": "2K",
  "ratio": "2.35:1",
  "n": 1,
  "reference_image_ids": []
}
```

模型选择例外：

- 用户明确要画面里有大字标题（例如电影海报式 title slate），且字数 ≤ 8 个汉字，可降级到 `gpt-image-2`。
- 其他场景一律 `nano-banana-pro`。
- 不要用 `nano-banana-2` 做大幅 cinematic（细节质感不及 pro）。

## 参考图处理

当 `reference_image_ids` 非空（用户给了电影截图 / 摄影作品 / 自己以前的图），**必须**在 prompt 文本里加一段明确的 reference 描述，否则模型会忽略参考图的关键信息。模板：

```
MUST reproduce the following from reference image(s):
- Light direction and quality: [describe — e.g., low-angle warm sunlight from camera-left, long shadows pointing camera-right]
- Dominant color tone: [describe — e.g., warm orange highlights with deep teal shadows, low saturation in midtones]
- Camera angle and lens feel: [describe — e.g., low eye-level wide shot, slight wide-angle distortion, deep depth-of-field]
- Subject placement and scale: [describe — e.g., main figure occupying lower-right third, dwarfed by surrounding architecture]
- Atmospheric quality: [describe — e.g., heavy haze in deep background, sharp foreground]
Adapt these qualities to the new topic; do not copy specific buildings or faces from the reference.
```

只把参考图 ID 传进 `reference_image_ids` 而不写文字描述，模型会在风格融合时偏向 prompt 文本，导致参考图作用很弱。

## 可选：设计学派 DNA 叠加

当用户主动引用具体学派（"Ash Thorp 概念图风", "Territory Studio FUI", "Locomotive 滚动叙事感", "Resn 插画 + 互动", "Field.io 算法美学", "Zach Lieberman 代码诗", "Raven Kwok 分形"），或当 5 个氛围方向都不够独特时，可在 prompt 末尾追加 `# Design School DNA — overlay` 段，盖在氛围 / 配色 / 渲染之上做文化锚点。

每次只叠 1 个学派。

### 7 个适合 cinematic 场景的学派

```
Ash Thorp cinematic concept art:
- Film-grade lighting and atmospheric volumetric effects
- Warm cyberpunk (orange / teal, NOT cold blue)
- Industrial design meets luxury, narrative concept-art feel
- Volumetric lighting and god rays
- Blade Runner warmth over Tron coldness
```

配 cinematic-noir / sci-fi-tech；推荐 ratio 2.35:1 + Cinematic Duotone / Noir Neon。

```
Territory Studio FUI (Fantasy User Interface):
- Holographic projection aesthetics
- Orange / amber monochrome or cyan accents
- Multiple overlapping data layers and HUD readouts
- Believable future technology
- Technical readouts and data streams floating in space
```

配 sci-fi-tech；推荐 Cool Tech 或 Noir Neon，整图加入 HUD 数据层但不喧宾夺主。

```
Locomotive scroll narrative:
- Film-like scene composition with parallax depth
- Generous vertical space between layered planes
- Bold typography emerging from darkness
- Strategic glowing accents on near-black background
- 100vh hero feel, hero subject anchored low
```

配 cinematic-noir / golden-hour 的"博客 hero"用途；强化前景 / 中景 / 远景的视差层级。

```
Resn interactive storytelling:
- Illustrative / painterly subject mixed with subtle UI hints
- Warm color palette despite tech subject
- Character-driven, editorial illustration meets product design
- Slight gamified mood (progress hint, glow trail)
```

配 dreamlike-pastel / golden-hour；适合"故事"型 hero（主角剪影 + 远景 narrative）。

```
Field.io generative aesthetic:
- Abstract geometric patterns, algorithmically generated
- Voronoi diagrams, Delaunay triangulation, particle fields
- Monochromatic base with vibrant accent
- Mathematical precision in spacing
- Clean code aesthetic, computational rather than painterly
```

配 sci-fi-tech；painterly 倾向不适合，digital 更对味；常配 ratio 1:1 或 16:9。

```
Zach Lieberman code-as-art:
- Hand-drawn aesthetic generated by code
- Black and white only, no color (or extreme low saturation)
- Real-time generative line patterns, sketch-like quality
- Visible process / grid / construction lines
- Poetic interpretation of algorithms
```

配 dreamlike-pastel 的极简变体或 sci-fi-tech 黑白方向；hand-drawn 渲染倾向最贴。

```
Raven Kwok parametric:
- Fractal patterns and recursive structures
- High-contrast black and white
- Architectural visualization of data
- Chinese garden principles in algorithm form
- Intricate detail that rewards zooming
```

配 sci-fi-tech 黑白冷峻路线；ratio 1:1 或 4:3 适合分形对称构图。

### 学派叠加段落模板

把以下文本拼到 prompt 末尾（在 Negative 行之前）：

```
# Design School DNA — overlay
[paste the chosen school's DNA block from above verbatim]

Overlay rules:
- The school informs lighting style, palette accent, and rendering vocabulary on top of the chosen mood-direction.
- If conflict (e.g. Field.io geometric vs. nature-wonder atmospheric), keep the user's chosen mood-direction and let the school inform only the texture and detail layer.
- Do NOT render the school name or any of these descriptive words as visible text in the image.
```

## 常见反例

- 不要 photorealistic 真人脸 — 全部用剪影、背影、远景小人；只让光线和姿态暗示存在。
- 不要 cartoon 卡通风 — 这不是儿童插画，dreamlike-pastel 也保持 painterly 笔触而非 chibi。
- 不要把构图塞满 — 至少 30% 留白 / 空气 / 雾，cinematic 的呼吸感来自空。
- 不要烂大街的 lens flare 和 Photoshop 滤镜 look — 克制使用，宁缺毋滥。
- 不要在图里渲染 hex 色号、配色名、role 标签 — 那是给生图模型看的，不是给观众看的。
- 不要让标题文字超过 12 个汉字 / 24 字符 — 多了会糊，cinematic 图上文字越少越好。
- 不要混用 5 个氛围方向 — 一图一向，混了就是脏。
- 不要输出系列图 — 这是单张 skill，多张请走 `xhs-card-series` 或 `comic-strip`。
- 不要把比例选成 `1:1` 又选 `cinematic-noir` — 方图丢失横向叙事的核心张力，1:1 只配 dreamlike-pastel。

## follow-up

生成后用户常见后续：

- 换氛围方向（noir → golden-hour 等）— 重新走一次 prompt 拼装，其他参数复用。
- 换配色（在同氛围内换一套 hex）— 仅改 prompt 第 4 段。
- 改光源时间（清晨 / 正午 / 黄昏 / 深夜）— 改第 2、3 段。
- 加 / 去人物剪影 — 改第 7 段，并相应调整构图。
- 重新构图（换前景遮挡 / 主体位置 / 引导线）— 改第 5 段。
- 换比例（2.35:1 ↔ 16:9 ↔ 9:16）— 改 GenImage `ratio` 参数，并提醒用户竖图需要重新构图（人物纵向）。
- 加副标题 — 改第 8 段，并提醒 ≤ 12 个汉字。
- 升 4K — 仅在用户明确要求时把 `resolution` 改成 `4K`，提醒生成耗时和费用增加。
