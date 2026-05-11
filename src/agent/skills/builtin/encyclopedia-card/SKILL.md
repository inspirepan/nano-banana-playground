---
name: encyclopedia-card
description: Generate premium vertical encyclopedia-style knowledge cards / reference handbook pages / educational infographic cards for a single topic — like a publishable natural-history guidebook page mixed with modern editorial infographic design. Triggers on phrases like 百科卡 / 百科全书卡 / 博物卡 / 图鉴卡 / 知识卡 / 参考手册 / 手账卡片 / encyclopedia card, knowledge handbook card, field guide page, educational infographic card, reference card series. Signature look: one hero subject illustration + 2-4 zoomed-in detail callouts + 4-7 rounded modular info panels + quick rating / top-5 / summary chips, soft cream background, gentle shadows, small refined line icons, high density but calm reading rhythm. Do NOT use for 爆款新闻封面 (use tech-news-cover), 电影海报 (use editorial-poster), 小红书系列 (use xhs-card-series), dense business consulting report (use knowledge-infographic consulting-report preset), 单纯文章封面 (use article-cover-image), 漫画 (use comic-strip).
icon: book-open
preview_image: /skill-previews/encyclopedia-card.jpg
display_name:
  zh-CN: 百科图鉴卡
  en: Encyclopedia Card
display_description:
  zh-CN: 竖版百科全书式图鉴卡，主视觉 + 细节放大 + 模块化信息面板 + 评分摘要。
  en: Vertical encyclopedia-style field-guide cards with hero art, zoomed detail callouts, and modular info panels.
starter_examples:
  zh-CN:
    - 雪豹竖版图鉴卡，爪印细节，栖息地和保护等级
    - Espresso 百科卡，奶油棕配色，萃取参数和风味轮
    - 韦伯望远镜手册卡，深空蓝，结构放大和关键指标
  en:
    - snow leopard field guide, paw detail, habitat and status
    - espresso encyclopedia card, creamy brown palette, extraction and flavor wheel
    - Webb telescope guide, deep space blue, structure callouts and metrics
---

# Encyclopedia Card

为**单一主题**（动物、植物、食物、现象、工具、地标、概念等）生成一张**竖版百科全书式图鉴卡**。视觉语言是可出版的博物图鉴 + 现代编辑信息图——一张精美主视觉 + 多个局部放大标注 + 圆角模块化面板 + Top 5 / 评分 / 摘要卡片。浅色背景、柔和配色、精致小图标、高信息密度但阅读节奏平静。不是广告海报、不是爆款新闻封面、不是漫画插画。

## 核心流程

**Agent 先确定主题、收集事实、挑选信息模块、准备每个模块的具体文本，再把这些具体内容填进一段纯视觉指令 prompt 交给 `GenImage`。生图模型只接收已填好的具体内容——不要保留"自动选择模块"、"根据主题自适应"这类 meta 指令。**

1. 确认主题：用户一句话表达（"给大熊猫做一张"、"做一张意式浓缩 Espresso 图鉴"）即足够；歧义时用一次 `AskUserQuestion` 问清方向（物种 vs 文化现象、实物 vs 概念）。
2. 收集事实：优先使用已知世界知识；事实稀缺或需要最新数据时用 `WebSearch` / `WebFetch`，把关键数字、分类信息、原产地等落成结构化 notes。**不要编造不存在的事实、数字、Top 5 排名。**
3. 按 §2 选 4-7 个信息模块，每个模块准备具体字段值（label + 2-4 条 bullet 或数值）。
4. 按 §3 挑一组配色（通常跟主题气质挂钩——生物走森林绿或博物米黄，食物饮品走奶油暖，科技物品走石板蓝灰）。
5. 按 §5 模板拼 prompt，把模块、评分、Top 5 等**具体字符串**填进去。
6. 调一次 `GenImage`（默认参数见 §6）。UI 审批卡就是确认入口。
7. 用户反馈后重跑 `GenImage`，只改必要字段（替换某个模块、换配色、调整评分）。

## 2. 信息模块选择（Agent 在拼 prompt 前完成）

准备 4-7 个模块。按主题类型从下表挑组合；不要 12 个模块全上，留白和阅读舒适度比信息密度更重要。

| 模块 key    | 说明 / 填什么                                    | 常用主题                       |
| ----------- | ------------------------------------------------ | ------------------------------ |
| `profile`   | 基本资料：别名 / 学名 / 分类 / 原产地 / 出现时期 | 全部主题建议首选               |
| `taxonomy`  | 分类学 / 族群 / 家族树；可画成小型分级图         | 生物、植物、食物品类           |
| `physical`  | 物理特征：尺寸 / 重量 / 颜色 / 形态；带数值      | 生物、物品、地标               |
| `behavior`  | 行为 / 生态 / 习性 / 饮食 / 活动节律             | 动物、昆虫、鸟类               |
| `structure` | 结构 / 解剖 / 形成机制 / 工作原理                | 植物、地质现象、工具、设备     |
| `usage`     | 使用方法 / 步骤 / 冲泡 / 烹饪 / 操作流程         | 食物饮品、工具、工艺           |
| `growth`    | 生长条件 / 栽培周期 / 温湿度 / 光照              | 植物、作物、菌菇               |
| `care`      | 护理 / 维护 / 保养 / 优化建议                    | 宠物、植物、设备、技能         |
| `risks`     | 风险 / 警告 / 副作用 / 注意事项                  | 食物饮品、药草、野外生物       |
| `scenarios` | 适用用户 / 应用场景 / 搭配建议                   | 工具、饮品、装备               |
| `pros_cons` | 优点 / 缺点对比；左右两列                        | 工具、产品、选项决策           |
| `ratings`   | 视觉评分条：3-5 项子指标 + 横条或 1-5 星         | 食物饮品、工具、产品、自然地点 |
| `top5`      | Top 5 列表：品种 / 变种 / 子分类 / 相关推荐      | 生物变种、食物流派、工具款式   |
| `timeline`  | 时间线 / 历史重要节点 / 生命周期阶段             | 文化现象、历史、发展演化       |
| `fun_facts` | 3-5 条趣味冷知识                                 | 任意主题                       |

写模块内容的原则：

- 每个 bullet 6-14 字；数值要有单位（cm / kg / °C / %）。
- `top5` / `ratings` 要真实可查；不要为了凑视觉编造排名。
- 不要所有模块都写满 4 条；让某些模块只 2-3 条，形成视觉呼吸。

## 3. 配色主题（挑一组锁定 5-7 色）

浅色背景 + 柔和配色是本 skill 的基本气质——绝不上深色背景、饱和霓虹、高冲击红黑。品牌 / 主题有强色时作为主色，其他跟随。

| 主题           | 背景 bg              | 卡片 surface | Primary 主题色   | Accent 点缀      | Text / Muted          | 适合                   |
| -------------- | -------------------- | ------------ | ---------------- | ---------------- | --------------------- | ---------------------- |
| `cream-warm`   | `#FAF6EE` 奶油米     | `#FFFFFF`    | `#8B5E3C` 可可棕 | `#D4A574` 蜜金   | `#2A2520` / `#8A8378` | 食物饮品、咖啡、面包   |
| `botanical`    | `#F5F2E8` 羊皮米     | `#FFFFFF`    | `#3F6B3E` 植物绿 | `#C97B3A` 陶土橙 | `#263526` / `#7E8A7E` | 植物、作物、香料、园艺 |
| `field-guide`  | `#F2EADA` 泛黄手册米 | `#FFFDF7`    | `#3A4A5C` 墨蓝灰 | `#B85C38` 暖砖红 | `#2D2A23` / `#877D6D` | 鸟类、昆虫、博物学     |
| `ocean`        | `#EEF3F5` 浅雾蓝     | `#FFFFFF`    | `#2F5D6E` 深海蓝 | `#E0A84B` 海盐金 | `#1F3540` / `#7A8E96` | 海洋生物、水域、天气   |
| `slate-modern` | `#F3F4F6` 石板灰白   | `#FFFFFF`    | `#1F2937` 石墨黑 | `#E07A3F` 橙     | `#111827` / `#6B7280` | 工具、科技物件、设备   |
| `pastel-life`  | `#FFF4EE` 蜜桃奶     | `#FFFFFF`    | `#C77D6A` 陶瓷粉 | `#7BA89A` 薄荷绿 | `#3A2A25` / `#9A8780` | 宠物、生活方式、手账   |
| `museum-ivory` | `#F6EFDD` 象牙米     | `#FFFDF4`    | `#5C3A21` 深咖   | `#A47148` 驼     | `#2B1F14` / `#8A7A63` | 文化遗产、历史、器物   |

锁定 5 色：bg / surface / primary / accent / text（+ muted 作为第 6 辅助色，仅用于次级标签 / 描述文本 / 分隔线）。

## 4. 版式骨架

竖版（3:4 或 9:16 或 2:3）。从上到下的基础节律：

1. **页眉 Header** (占 8-10%)：小型分类标签（"BOTANICAL GUIDE" / "FIELD NOTES" / "食物百科") + 顺序编号 (`NO. 03` / `VOL. 01`) + 装饰细线。
2. **标题区 Title Block** (10-12%)：主题大标题（中文用粗黑或粗宋；英文用 serif / display）+ 拉丁学名或副标题（斜体 serif，字号小）。
3. **主视觉 Hero** (25-35%)：主体居中或略偏一侧；2-4 个局部放大细节（圆形镜头或椭圆 plate + 细引线 + 指向箭头 + 标注文字）。
4. **主信息模块区 Modules** (35-45%)：圆角卡片网格（通常 2 列 × 2-3 行 或 1 列堆叠 + 2 列混合）；每张卡带小 icon + 标题 + 2-4 条 bullet。
5. **评分 / Top5 / 摘要条** (8-12%)：横向评分条 / Top 5 列表 / 快速摘要 chips；不要把评分和 Top 5 同时都塞进去。
6. **页脚 Footer** (3-5%)：系列名 / 日期 / 小小 "collect & share" 或作者签名线、一条装饰线。

整体留白 20-30%，感觉是一页真的会被印在手册里的纸张，而不是海报。

## 5. Prompt 拼装模板（交给 GenImage 的完整文本）

把下面文本作为 `GenImage.prompt` 内容。方括号占位全部替换为 §2 / §3 准备好的**具体字符串**；不要保留任何 `[]` 或 "根据主题自动..."、"选择合适的..." 之类的 meta 指令。字段缺失就删行，不要留空占位。

```
Role: Senior editorial infographic designer producing a publishable encyclopedia / field-guide card. Output a single vertical knowledge card in the aesthetic of a premium natural-history guidebook mixed with modern editorial infographic design. NOT an ad poster, NOT a social media thumbnail, NOT a dense business dashboard — it should read like a page from a collectible reference handbook that belongs in a consistent series.

# Series / page meta
- Series label (small eyebrow text at top): [series_label, e.g. "BOTANICAL FIELD GUIDE" / "COFFEE ENCYCLOPEDIA" / "生物图鉴"]
- Issue number (small, right-aligned): [issue_no, e.g. "NO. 07" / "VOL. 01 · 03"]
- Footer signature line (optional): [footer_line, e.g. "COLLECT · READ · SHARE" or a short tagline]

# Title block
- Main title (EXACT text, large, dominant, 中文用粗黑 / 粗宋, 英文用 editorial serif display): "[title verbatim]"
- Subtitle / latin name / tagline (smaller, italic serif for latin names): "[subtitle verbatim]"

# Hero illustration — one main subject
Render one beautifully detailed illustration of: [hero_subject_description, e.g. "a male ruby-throated hummingbird in 3/4 profile, hovering, wings mid-beat, realistic botanical-plate style"]
- Medium: [medium, e.g. "refined gouache + ink line" / "soft watercolor with subtle stippling" / "flat editorial vector with textured fills"]
- Placement: hero sits slightly left of center in the top third; keeps breathing room around it.
- NO text rendered inside the hero illustration itself.

# Detail callouts (zoomed-in features)
Render [N, e.g. 3] small circular or oval "lens" zoom-ins around the hero, each showing a magnified feature with a thin dotted / solid leader line pointing from the lens to the exact anatomy on the hero:

[for each callout, output a block:]
- Callout: anchor="[anatomy, e.g. 'wing primary feather']" / shown_in_lens="[what the zoom shows]" / label="[label text, 3-8 字, 中英皆可]"

Example:
- Callout: anchor="喙" / shown_in_lens="细长中空虹吸结构" / label="虹吸式长喙"

Lens style: circular frame, 1-1.5 px accent-color ring, subtle inner shadow, label sits next to the lens in small caps or 小号粗体.

# Modular info panels (rounded cards)
Render [M, 4-7] rounded info panels on a clean grid below the hero. Each panel has: small line icon (18-22 px) in the accent color, a short bold header, and 2-4 short bullet lines.

[for each panel, output a block with verbatim content:]
- Panel: icon_hint="[icon concept, e.g. 'leaf' / 'scale' / 'thermometer' / 'book']" / title="[panel_title]" / bullets=[ "[bullet 1]", "[bullet 2]", "[bullet 3]" ]

Example panels (replace with the real ones for this topic):
- Panel: icon_hint="id-card" / title="基本资料" / bullets=["学名：Trochilidae", "分布：美洲", "体长：6–13 cm", "体重：2–20 g"]
- Panel: icon_hint="ruler" / title="物理特征" / bullets=["羽色金属光泽", "翅膀每秒 50–80 次", "喙长而中空"]

Rules:
- Card shape: 8-12 px rounded corners, white or [surface hex] fill, very soft shadow (y-offset 2-4 px, blur 8-16 px, opacity 8-12%).
- Grid: prefer 2 columns × [rows] or a mix of one wide card + 2 smaller cards per row. Not a uniform grid of identical tiles.
- Bullet text: left-aligned, 13-15 px equivalent, 1.5 line-height.

# Quick-visual module (choose ONE — ratings OR top5 OR summary — do NOT stack all three)
Selected module: [ratings | top5 | summary]

If `ratings`:
- Horizontal rating bars for 3-5 sub-metrics. Each row: label + filled bar + "4.5 / 5" or stars. Render these EXACT metrics:
[for each: "[metric_label]": [score_out_of_5]]

If `top5`:
- A "TOP 5 [category]" block with numbered 01–05 rows. Each row: number badge + name + one-line descriptor.
[for each row: "[rank]. [name] — [one-line descriptor]"]

If `summary`:
- 4-6 small chip tags with one-word or 2-3 word highlights, plus one sentence "Takeaway:" line below.
[chips and takeaway sentence]

# Palette (strict 5-6 colors, do NOT render hex text)
- Background: [bg hex]
- Card surface: [surface hex]
- Primary (title, icon strokes, key numbers): [primary hex]
- Accent (lens rings, chip highlights, rating bars, small decorative dots): [accent hex]
- Text: [text hex]
- Muted (sub-labels, bullet secondary lines, footer): [muted hex]

Do not render hex values, color names, palette labels, or the words "palette" / "accent" / "module" / "callout" as visible text in the image.

# Typography rules
- Title: [title_font_hint, e.g. "粗黑 (思源黑体 Heavy) for Chinese, Playfair-style display serif for English"]
- Latin name / subtitle: italic editorial serif, smaller
- Panel headers: 中文粗黑 / bold sans
- Bullet body: regular sans, optically sized for reading
- Numbers and scores: tabular numerals
- Small caps / label eyebrows: letter-spaced 0.08–0.12em, uppercase, muted color

# Illustration + texture
- Keep the overall page clean — large areas of the background hex are visible.
- Sprinkle tiny, restrained decorative motifs (3-6 total) tied to the subject: small botanical sprigs, constellations of dots, tiny footprints, measuring-ruler marks — never busy patterns behind text.
- Very subtle paper-grain texture at 4-8% opacity over the full card is OK; no heavy noise, no halftone, no grunge.
- Shadows are soft and short, not dramatic.

# Layout rhythm
From top to bottom:
1. Eyebrow series label + issue number (thin divider line below)
2. Title block (title + subtitle)
3. Hero illustration with detail callouts
4. Info panel grid ([M] panels)
5. Quick-visual module ([ratings | top5 | summary])
6. Footer line with signature / date / collect-cue

Leave 20-30% whitespace total; reading pace should feel calm.

# Hard constraints
- Vertical aspect only (3:4 / 2:3 / 9:16); this card would be printed on a handbook page.
- All text must be legible and spelled correctly; match language to [language, zh / en / bilingual].
- Do NOT add a glossy ad-poster feel, no heavy drop shadows, no neon, no saturated gradients, no commercial CTAs.
- NO price tags, NO QR codes, NO watermarks unless the user asked.
- No realistic human faces; people appear only as stylized illustration if the topic truly needs them.
- Stay inside the 5-6 palette colors; do not introduce a 7th decorative hue.
- Hero illustration must NOT contain text inside it.
- Panels must have DISTINCT contents; do not repeat the same bullet across panels.
```

## 6. GenImage 调用

因为文本密度高（标题、学名、多面板 bullet、评分数字），优先使用 `gpt-image-2`——中文 + 英文学名混排最稳。如果是纯英文且以插画为主、文字极少，可换 `nano-banana-pro`。

```json
{
  "image_id": "encyclopedia_<slug>",
  "prompt": "<按 §5 拼装好的完整文本>",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "3:4",
  "n": 1,
  "reference_image_ids": []
}
```

| 参数                | 默认          | 备注                                                               |
| ------------------- | ------------- | ------------------------------------------------------------------ |
| model               | `gpt-image-2` | 多语言 + 密集小字段；纯插画少字可用 `nano-banana-pro`              |
| resolution          | `2K`          | 想做印刷级上 `4K`                                                  |
| ratio               | `3:4`         | 默认；手机分发 `9:16`；长细手册 `2:3`                              |
| n                   | `1`           | 系列对比再升到 2-3（比如"同一生物不同阶段"）                       |
| reference_image_ids | `[]`          | 仅当用户提供了真实的主体照片、参考插画，且其 image id 已存在时才填 |

## 7. 参考图处理

如果用户给了主体照片（比如"我家的猫，照着它画一张图鉴卡"）或历史图鉴卡，把 image id 填进 `reference_image_ids`，并在 prompt 末尾追加：

```
# Reference image directives — MUST INCORPORATE
CRITICAL: The hero illustration must visually match the reference subject.
- Identity: [distinctive markings / color patches / posture / breed]
- Stylize to [medium]; NO photoreal face or photographic shading
- Preserve [signature features user cares about]
- Color mapping: keep hero identity colors, but adjust surrounding palette to match the page palette above
```

## 8. 跟进调整

- "信息太挤 / 留白更多" → 把模块数从 7 砍到 4-5，或把 Top 5 换成 3 个 summary chips。
- "配色再柔和 / 再复古" → 从 §3 换一组 palette（cream-warm ↔ museum-ivory ↔ pastel-life），其它不动。
- "主视觉换姿态 / 换物种" → 改 `hero_subject_description`，其它模块保留；`image_id` 改后缀 `_v2`。
- "加一个 Top 5" → 在 Quick-visual 选 `top5`；如果已有 ratings，选一个保留，不要叠加。
- "变横版" → 换 `article-cover-image` 或 `knowledge-infographic`，本 skill 只做竖版。
- "要 9:16 手机壁纸" → 改 `ratio: "9:16"`；同时在模板里让标题区和主视觉比例更高（hero 占 30-40%），否则下面模块会被压扁。

## 9. 系列化（collect as a series）

用户常常会连续做同一系列的多张（"再做一张北极狐"、"加一张北极兔"）。保持系列感需要：

- 统一使用同一套 palette（首次做的 palette 是该系列的基因色）。
- 统一 `series_label`（`BOTANICAL FIELD GUIDE` / `深海图鉴 · VOL 1`）。
- 保持 title typography family 和 hero medium 不变；只换主体和模块内容。
- `issue_no` 递增（`NO. 01` → `NO. 02` → `NO. 03`）。
- `image_id` 用系列 + 主题命名：`encyclopedia_field_guide_arctic_fox` / `encyclopedia_field_guide_arctic_hare`。

## 10. 常见反例（写 prompt 时主动规避）

1. **把 §2 的模块选择指令原样塞给生图模型**：绝不出现 "从下列模块中自动挑选"、"根据主题自适应" 等话术；生图模型只看到已经选好的 N 个具体模块 + 具体内容。
2. **编造事实 / Top 5 / 评分**：所有数值 / 排名 / 学名必须是真实的；不确定时用 `WebSearch` 查，宁可减少模块也不要写假数据。
3. **海报化过度**：出现大块深色背景、霓虹、夸张渐变、营销文案 CTA → 失去手册气质。
4. **模块全部等大排成 2×3 网格**：缺视觉节奏；应错落（1 wide + 2 narrow）并让内容长度自然决定高度。
5. **主视觉里塞字**：hero 区域里不要渲染任何文本；所有文字只出现在标题区、callout label、panel 内、footer。
6. **callout 引线指向模糊位置**：引线必须从 lens 圆圈准确指到主视觉上那个解剖位置，不能只漂在空白处。
7. **palette 扩散到 7+ 色**：装饰 sprig / dots 只用 primary + accent 两色，不要引入第 7 种装饰色。
8. **英文学名拼错 / 语种混用混乱**：拉丁学名用斜体 serif，中文学名不斜体；混排保持语种分层清晰。
