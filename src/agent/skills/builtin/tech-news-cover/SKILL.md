---
name: tech-news-cover
description: Generate Chinese tech / finance / industry news viral cover images — high-impact 16:9 covers in the style of 中国科技媒体头图 / B 站科技区爆款缩略图 / 财经新闻视觉 / 游戏行业信息图 / YouTube thumbnail / 港媒封面 / 行业突发新闻封面. Triggers on phrases like 港媒封面、科技新闻封面、爆款封面、公众号头图、B 站缩略图、财经封面、行业大事件封面、tech news thumbnail, viral news cover, industry breaking-news cover. Signature look: dense info-graphic layout, ultra-bold Chinese headline, big highlighted numbers, news tags (突发 / 重磅 / 官方宣布), data cards with old-vs-new values, product hero, emotion-driven palette. Do NOT use for 极简 Apple 风封面 (use article-cover-image), 电影海报 (use editorial-poster), 知识科普信息图 (use knowledge-infographic), 小红书卡系列 (use xhs-card-series), 漫画分镜 (use comic-strip).
icon: newspaper
preview_image: /skill-previews/tech-news-cover.jpg
display_name:
  zh-CN: 港媒爆款封面
  en: Tech News Viral Cover
display_description:
  zh-CN: 中文科技 / 财经 / 行业爆款封面，16:9 高信息密度 + 粗黑大标题 + 数据卡片。
  en: Chinese tech / finance / industry viral covers with dense infographic layout and bold headlines.
starter_examples:
  zh-CN:
    - 国产 GPU 新训练卡封面，粗黑大标题，参数卡
    - AI 手机销量暴涨封面，红黑高对比，大数字
    - 游戏行业突发港媒封面，重磅标签，人物剪影
  en:
    - domestic GPU launch cover, bold headline, spec cards
    - AI phone sales surge cover, red black contrast, huge numbers
    - Hong Kong gaming breaking cover, heavy tag, figure silhouette
---

# Tech News Viral Cover

为一整篇中文科技 / 财经 / 行业 / 游戏 / 消费电子类文章生成**一张 16:9 横版爆款封面图**。视觉语言是"行业大事件"——粗黑大标题、超大关键数字、多张数据卡片、明显的产品主视觉、情绪驱动的高对比配色。不是 Apple 极简、不是电影海报、不是 PPT 配图。

## 核心流程

**Agent 先分析文章、提取封面要素，再把提取结果填进一段纯视觉指令 prompt 交给 `GenImage`。不要把"自动分析文章"这类 meta 指令原样塞给生图模型——生图模型只应接收具体的、已填好的视觉任务。**

1. 拿到文章正文。如果用户只给了链接，用 `WebFetch` 抓一下；文章太长用 `ReadAgentFile` 分页读。
2. Agent 自己完成 §2 的"封面要素提取"，形成一份结构化提取结果。
3. 如有关键缺口（标题歧义、情绪分歧、多个候选产品主视觉）用一次 `AskUserQuestion` 让用户快速拍板；没有就继续。
4. 按 §4 的模板拼 prompt，**把提取结果作为具体字符串填进去**，不保留任何 "从文章中提取" / "自动选择" 的措辞。
5. 调一次 `GenImage`（默认参数见 §5）。UI 审批卡片即确认入口，不要再单独做 confirmation 问卷。
6. 用户反馈后做 follow-up：重跑 `GenImage`，只改必要字段。

## 2. 封面要素提取（Agent 在发 GenImage 前完成）

从文章中提取并写成一份内部 summary，供拼 prompt 使用：

| 字段           | 说明                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `headline`     | 主标题：短、狠、直接；8-14 个汉字。可以基于文章观点重写，但不要捏造不存在的事实。                                             |
| `subheadline`  | 副标题：一句话补充，12-22 个汉字。                                                                                            |
| `news_tags`    | 1-3 个顶部新闻标签，从 `突发 / 重磅 / 官方宣布 / 最新 / 行业震动 / 独家 / 预警 / 深度` 里挑。                                 |
| `sentiment`    | 文章情绪，从 `暴涨 / 暴跌 / 涨价 / 崩盘 / 封禁 / 突破 / 发布 / 革命 / 危机 / 反转 / 震动 / 警告 / 机会 / 行业洗牌` 里选 1-2。 |
| `industry`     | 从 `AI/芯片 / 互联网/SaaS / 财经/股市 / 消费电子 / 游戏 / 新能源/汽车 / 监管/政策 / 加密/区块链` 等里选 1。                   |
| `hero_subject` | 核心产品 / 品牌 / 人物 / 象征物：名字 + 一句视觉描述（"iPhone 17 Pro，钛金属深空蓝机身，3/4 视角悬浮"）。                     |
| `brand_colors` | 如果文章有强品牌，记录品牌主色（hex 或颜色名）。没有填 `none`。                                                               |
| `key_numbers`  | 3-6 条最有冲击力的数字卡片：每条含 `label` + `value` + `delta`（如 `市值` / `3.2 万亿` / `+48%`）。旧数据要标出来，带删除线。 |
| `takeaways`    | 3-5 条底部结论，每条一个短图标意象 + 1 句短语（"监管 · 审查收紧"，"用户 · 涨价传导"）。                                       |
| `language`     | 通常 `zh`；如果文章是中英混合，标出需要保留的英文术语。                                                                       |

把这份提取结果作为 `GenImage.prompt` 里每个占位字段的具体值——**不要让生图模型再去"自动分析"**。

## 3. 情绪 → 配色决策（Agent 在拼 prompt 前锁定具体 hex）

按文章情绪和行业组合，从下表挑出**一组**具体颜色写进 prompt 的 `# Palette` 段落。每张图锁定 3-5 种颜色：1 个背景色、1 个主题主色、1 个强强调色（用于关键数字 / 涨跌箭头）、1 个高对比文字色、1 个辅助信息色。品牌色存在时，用它当主题主色，但不要机械复制 logo 颜色牺牲可读性。

| 情绪 / 行业                       | 配色方向   | 推荐 hex 组合                                                                          |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| 暴涨 / 突破 / 发布 / 革命（科技） | 冷色科技   | bg `#0A1628` / primary `#00D4FF` / accent `#FFD600` / text `#FFFFFF` / muted `#6B7F99` |
| 暴涨 / 突破（财经 看涨）          | 金融涨     | bg `#0E1A17` / primary `#00C853` / accent `#FFEB3B` / text `#FFFFFF` / muted `#7A8F88` |
| 暴跌 / 崩盘 / 危机 / 暴雷         | 警示红黑   | bg `#1A0E0E` / primary `#FF3B30` / accent `#FF9500` / text `#FFFFFF` / muted `#8A6B6B` |
| 封禁 / 监管 / 裁员 / 警告         | 压迫暗     | bg `#141414` / primary `#FF4D4F` / accent `#FFC53D` / text `#F5F5F5` / muted `#7A7A7A` |
| 反转 / 震动 / 行业洗牌            | 高冲击紫   | bg `#1B0A2E` / primary `#B026FF` / accent `#00E5FF` / text `#FFFFFF` / muted `#8466A9` |
| AI / 芯片 / 模型发布              | 科技蓝绿   | bg `#0A1F2E` / primary `#00B8D9` / accent `#36D399` / text `#FFFFFF` / muted `#6B8A99` |
| 游戏 / 消费电子 / 娱乐            | 高饱和撞色 | bg `#15101F` / primary `#FF2D55` / accent `#00E5FF` / text `#FFFFFF` / muted `#9E7FA8` |
| 涨价 / 成本 / 价格警报            | 橙黑警示   | bg `#1A120A` / primary `#FF6B00` / accent `#FFD700` / text `#FFFFFF` / muted `#A88B6B` |
| 机会 / 预期利好（冷静分析）       | 深蓝金融   | bg `#0C1A2E` / primary `#1E88E5` / accent `#FFB300` / text `#FFFFFF` / muted `#6B8099` |

禁止：默认红黑；柔和小清新（除非是生活方式题材）；低对比；品牌色挤掉正文可读性。

## 4. Prompt 拼装模板（交给 GenImage 的完整文本）

把下面文本作为 `GenImage.prompt` 内容。所有方括号占位必须替换成 §2 提取到的**具体字符串**——**不要保留 `[]` 也不要保留 "从文章提取 / 自动选择" 这类指令**。如果某字段没取到，就删掉对应行，不要写 `TBD` 或空占位。

```
Role: Senior Chinese tech-media cover designer. Output a single 16:9 viral news cover in the aesthetic of 中国科技媒体头图 / B 站科技区爆款缩略图 / 财经新闻视觉 / 港媒封面 / 行业突发新闻封面. Not minimalist, not Apple style, not movie poster — this should feel like a high-energy industry breaking-news headline card.

# Editorial brief
- Industry: [industry, e.g. "AI / 芯片 / 模型发布"]
- Sentiment: [sentiment, e.g. "暴跌 + 危机"]
- Reader takeaway: 3 秒内看懂 — [one-line news gist]

# News tag row (top strip)
Render the following tags as small rectangular chips in the top-left or top bar. Use the accent color with bold uppercase / bold 黑体 inside. Example tags:
[news_tags, e.g. "突发" / "重磅" / "行业震动"]
Also include brand or category label chip: [brand_or_category, e.g. "AAPL" / "NVIDIA" / "苹果发布会" / "半导体"]

# Center headline (dominant element)
Render this EXACT Chinese text as the central ultra-bold headline:
"[headline verbatim, 8-14 汉字]"
- Ultra heavy Chinese 黑体 (类似站酷庆科黄油体 / 阿里巴巴普惠体 Heavy / 思源黑体 Heavy), 字重 800-900, 字间距紧凑
- 大标题占画面中上区域 35-45% 宽度
- 立体感：粗描边 + 投影 + 轻微错位高光；可加细微噪点 / 扫描线 / 破损裂纹 / 速度运动模糊等新闻冲击纹理（任选 1 种，不要叠加过多）
- 标题中的关键词 "[highlighted_keywords, 1-2 个关键词]" 使用高亮色（见 palette accent），其余主色显示
- 可选副标题，略小、正下方，文本（逐字照搬）：
"[subheadline verbatim, 12-22 汉字]"

# Hero subject (main visual anchor)
Place a large, dimensional rendering of: [hero_subject description]
- 3D 透视 / 3/4 视角，带光效、反光、层次，明显体积感
- 占画面右侧或中右 35-45% 区域，与标题形成左右或错位对位
- 产品背后叠加情绪氛围元素：[bg_motif tied to industry, 从下表挑 2-3 种]
  - AI / 芯片: HUD 线框 / 数据流 / 电路纹理 / 发光粒子 / 神经网络
  - 财经 / 股市: K 线图 / 涨跌箭头 / 数字网格 / 金融曲线 / 跳动的百分比
  - 游戏 / 消费电子: 速度线 / 爆炸形状 / 能量环 / 光束 / 品牌光晕
  - 危机 / 监管: 警示纹理 / 印章 / 封条 / 裂纹 / 红色警报条 / 禁止符号
  - 发布 / 突破: 光束 / 能量环 / 未来感渐变 / 星火粒子

# Data cards (information density layer)
Render 3-6 discrete data cards scattered around the hero subject. Cards must be visually distinct (背景半透明黑 / 深色卡片 + 细亮边 + 圆角 4-8 px, 不能全部尺寸一样). Each card shows ONE fact only. Use the following EXACT data (render numbers and units verbatim, big, with stroke / shadow / 3D effect):

[for each item in key_numbers output a block like:]
- Card: label="[label, e.g. '市值']" / old_value="[old, with strikethrough]" / new_value="[new, huge bold]" / delta="[delta, arrow + %]"

Rules:
- 百分比、金额、时间要比 label 大 2-3 倍
- 旧数据用删除线；新数据配方向箭头（▲▼）
- 卡片尺寸错落有层级，不要排成均匀网格
- 每张卡片只讲一件事，不堆砌

# Bottom summary strip (3-5 takeaways)
Across the bottom 12-15% of frame, render [N] small 图标 + 短句 combos (1-line each, 6-10 汉字):

[for each item in takeaways output: icon_concept + short_phrase]
e.g.
- 监管 icon + "审查持续收紧"
- 用户 icon + "涨价将传导到零售端"

Use line-icon style, same stroke weight, aligned on a baseline. Keep this strip tight — it's the fourth layer of attention, not the hero.

# Palette (lock to these 5 colors)
- Background: [bg hex]
- Primary: [primary hex]
- Accent (used for highlighted title keyword, key numbers, arrows, tags): [accent hex]
- Text high-contrast: [text hex]
- Muted / secondary: [muted hex]
Do NOT render hex codes, color names, "palette", "accent", or any of these meta words as visible text in the image. Cover stays inside these 5 colors; never add a 6th to avoid clutter.

# Typography rules
- 中文超粗黑体 (黑体 Heavy / 庆科黄油体 / 阿里巴巴普惠体 Heavy), 主标题字号是正文的 5-7 倍
- 数字和百分比字号必须巨大，可加描边 / 阴影 / 立体挤出 / 内发光
- 绝不使用纤细字体、文艺 serif、圆润可爱体
- 英文品牌 / ticker 用 bold condensed sans（类似 Inter / Helvetica Bold / Druk Bold）
- 所有文字必须清晰可读；信息密度高但层级清晰

# Reading hierarchy (必须严格建立)
1. 标题（最先看到）
2. 产品主视觉
3. 关键数字
4. 数据卡片细节
5. 底部结论条
不要平均用力；不要把所有元素做成一样大。

# Background
Fill the full 16:9 frame with [bg hex] plus industry-appropriate motifs layered at 15-30% opacity. Background must feel charged and "大事件" but never compete with the headline or numbers for legibility.

# Hard constraints
- 16:9 aspect, landscape; suitable for 公众号头图 / B 站缩略图 / 视频封面
- 强烈视觉冲击力 + 高信息密度，读者 3 秒看懂新闻重点
- 禁止极简 / Apple 风 / 电影海报风 / 柔和小清新
- 绝不使用默认红黑搭配 (除非 §palette 里已经选定)
- 不要渲染 hex 色号、调色板名、角色标签、"自动分析"、"提取"、"brief" 等 meta 文字
- 所有人物只用风格化剪影或插画式渲染，不要写实人脸
- 语言 = [language, zh 默认]；中英混排时保留品牌 / ticker / 英文术语原样
- 没有 watermark、二维码、签名，除非用户明确要求
```

## 5. GenImage 调用

默认使用 `gpt-image-2`——本 skill 全靠大量精确中文字符（标题、数字、标签、结论条），对 Chinese text 渲染最稳的是 `gpt-image-2`。`nano-banana-pro` 仅在文字量特别少或用户明确要求时换。

```json
{
  "image_id": "tech_news_cover_<slug-from-headline>",
  "prompt": "<按 §4 拼装好的完整文本>",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "16:9",
  "n": 1,
  "reference_image_ids": []
}
```

参数默认值：

| 参数                | 默认          | 备注                                                                 |
| ------------------- | ------------- | -------------------------------------------------------------------- |
| model               | `gpt-image-2` | 大量中文标题 / 数据卡必须用它；文字少可换 `nano-banana-pro`          |
| resolution          | `2K`          | 公众号 / B 站封面够用；海报输出上 `4K`                               |
| ratio               | `16:9`        | 固定；本 skill 仅出横版封面，竖图 / 方图请改用 `article-cover-image` |
| n                   | `1`           | 用户说"出一组对比"再升到 2-3                                         |
| reference_image_ids | `[]`          | 仅当用户给了真实产品图、品牌素材、历史生成图的 **image id** 才填     |

## 6. 参考图处理

如果用户给了产品 / 品牌 / 人物的参考图，把它们的 **image id**（不是文件路径）加到 `reference_image_ids`，并在 `GenImage.prompt` 末尾追加一段强制保留的指令，否则生图模型常只借色忽略关键特征：

```
# Reference image directives — MUST INCORPORATE
CRITICAL: The hero subject must visually match the provided reference(s).
- Product identity: [e.g. "iPhone 17 Pro Max, titanium frame, camera island layout unchanged"]
- Brand signature: [e.g. "logo mark in top-right at 6% width, exact glyph preserved"]
- Character traits (if any): [hair / glasses / signature clothing]; stylize to illustration, NO photoreal face
- Color mapping: reference primary → palette primary; accents stay in §palette
```

## 7. 跟进调整

- "情绪换一下 / 不够冲击" → 按 §3 换一组 palette，primary / accent 换档，其它保持；重跑 `GenImage`。
- "数据卡太多 / 太少" → 调整 §4 data cards 数量；单一要点优先，别把次要数字也塞进去。
- "标题换一个" → 直接修改 `headline` 字段文本，其它不动；`image_id` 改后缀 `_v2`。
- "要加副标题 / 品牌 slogan" → 在 §4 头部 chips 或 bottom strip 里加一行；别把它混进主标题。
- "中文字渲染错了" → 已经是 `gpt-image-2`；重跑一次；必要时把标题拆成更短、让模型更好复现。
- "风格偏软 / 想更爆款" → 在 §4 Background 段加 `heavier motion blur + scanlines + slight VHS noise + stronger stroke on headline`，palette 不动。

## 8. 常见反例（写 prompt 时主动规避）

1. **把 §2 的分析指令原样塞给生图模型**：绝不出现 "从文章中提取"、"自动选择"、"根据情绪决定" 等 meta 指令；生图模型只看到最终填好的具体内容。
2. **标题自己编造或过长**：必须来源于文章事实；8-14 个汉字上限，超过就换成副标题承载。
3. **Apple / 极简风跑偏**：留白不要超过 25%；信息密度是本 skill 的核心，不要因追求"干净"破坏风格。
4. **把 hex / 色号 / "accent" / palette name 渲染到图里**：它们只是给模型的颜色指引。
5. **真实人脸 / 摄影写实肖像**：所有人物只能风格化插画 / 剪影。
6. **数据卡全部一样大排成网格**：层级消失；必须错落、重要卡片更大。
7. **`reference_image_ids` 当文件路径填**：只能填**已存在**的语义 image id，不要伪造。
8. **多张候选都塞到 image_id 里**：`image_id` 只写一次，`n>1` 时系统自动加后缀。
