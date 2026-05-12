---
name: encyclopedia-card
description: Generate premium landscape / near-square encyclopedia-style knowledge cards / reference handbook pages / educational infographic cards for a single topic — like a publishable natural-history guidebook page mixed with modern editorial infographic design. Triggers on phrases like 百科卡 / 百科全书卡 / 博物卡 / 图鉴卡 / 知识卡 / 参考手册 / 手账卡片 / encyclopedia card, knowledge handbook card, field guide page, educational infographic card, reference card series. Signature look: one hero subject illustration + several zoomed-in detail features + many varied modular info panels in a magazine-style 2D grid (NOT a uniform tile grid) + multiple quick-visual modules (ratings, top lists, pros/cons, persona rows, mini-maps, fun facts) coexisting on the same page, soft cream background, gentle shadows, small refined line icons, high information density with deliberate editorial rhythm. Do NOT use for 爆款新闻封面 (use tech-news-cover), 电影海报 (use editorial-poster), 小红书系列 (use xhs-card-series), dense business consulting report (use knowledge-infographic consulting-report preset), 单纯文章封面 (use article-cover-image), 漫画 (use comic-strip).
icon: book-open
preview_image: /skill-previews/encyclopedia-card.jpg
display_name:
  zh-CN: 百科图鉴卡
  en: Encyclopedia Card
display_description:
  zh-CN: 横版/方版百科全书式图鉴卡，杂志式 2D 网格，主视觉 + 多类型模块密集编排。
  en: Landscape / square encyclopedia-style field-guide cards with magazine-grade 2D grid, hero art, varied modules, and high information density.
starter_examples:
  zh-CN:
    - 雪豹横版图鉴卡，爪印细节，栖息地和保护等级
    - Espresso 百科卡，奶油棕配色，萃取参数和风味轮
    - 韦伯望远镜手册卡，深空蓝，结构放大和关键指标
  en:
    - snow leopard field guide, paw detail, habitat and status
    - espresso encyclopedia card, creamy brown palette, extraction and flavor wheel
    - Webb telescope guide, deep space blue, structure callouts and metrics
---

# Encyclopedia Card

为**单一主题**（动物、植物、食物、现象、工具、地标、概念等）生成一张**横版或方版百科全书式图鉴卡**。视觉语言是可出版的博物图鉴 + 现代编辑信息图——一张精美主视觉 + 多个局部放大 + 9-12 个**不同形态**的模块化信息块拼成的**杂志式 2D 网格**。浅色背景、柔和配色、精致小图标、**高信息密度但留白克制**。不是广告海报、不是爆款新闻封面、不是漫画插画，也**不是 2×3 标准卡片网格**。

宽高比首选 `4:3`（手册跨页气质），其次 `1:1`（社交平台收藏卡气质）和 `3:2`（更宽的杂志页气质）。本 skill 不出竖版——如果用户明确要竖版，提示其改用 `xhs-card-series` 或 `article-cover-image`。

## 核心思路

**不要让 Agent 替模型把版面、模块、形态全部预决。Agent 的工作是收集事实、确定主题与气质；生图模型的工作是把这些事实编排成一页有编辑节奏的杂志页。**

参考目标范式：一张图里同时出现"分类表 + anatomy 缩略图横排 + 流程图 + Top 5 编号列表 + 横向评分条 + Pros/Cons 双列 + Persona 图标行 + 警告卡 + Did You Know 趣味框 + 迷你分布地图 + Quick facts 键值表"中的多种，而不是 5 张长得一样的「icon + 标题 + bullets」卡片。

## 1. Agent 流程

1. 确认主题：用户一句话即可。歧义时用一次 `AskUserQuestion` 问清方向（物种 vs 文化现象、实物 vs 概念）。
2. 收集**真实事实**（见 §2）：优先使用已知知识；缺最新数据或不确定时 `WebSearch` / `WebFetch`。**绝对不要编造学名、数值、Top N 排名、保护等级、价格。** 宁可让某一类事实缺席，也不要编。
3. 选定主视觉描述、标题、副标题、Series label、Issue No、配色方向。
4. 按 §4 模板拼一段**描述性**（非清单式）prompt，把事实**全部**塞进 Facts 区让模型自由挑选与编排。
5. 调一次 `GenImage`。UI 审批卡即为入口。
6. 用户反馈后重跑 `GenImage`，只改必要字段（替换事实、换主视觉姿态、换配色、调整密度方向）。

## 2. 事实收集（不挑模块，只列事实）

按主题准备一份**事实清单**，类目可有可无，缺失就不写。**不要预先决定哪些事实做成 panel、哪些做成 ratings、哪些做成 top 5——把它们全部交给模型。**

可收集的事实类目（不强制全部命中，按主题取舍）：

- 基本资料：别名、学名、英文名、分类（界门纲目科属种）、原产地、出现时期
- 物理/形态：尺寸、重量、颜色、外形特征——**带单位的具体数值**
- 行为/习性/生态：活动节律、社会结构、迁徙、繁殖、寿命
- 结构/解剖/工作原理：关键部位、机制、流程步骤
- 饮食/食物链：捕食、被食、食量
- 栖息地/地理分布：海拔、温度范围、湿度、气候带、典型地区
- 生长条件 / 栽培周期 / 温湿度光照
- 使用方法 / 冲泡 / 萃取 / 操作流程 / 烹饪步骤
- 护理 / 维护 / 保养建议
- 风险 / 警告 / 副作用 / 注意事项
- 适用场景 / 目标用户 / 搭配建议
- Pros & Cons（如适用）
- Top 3-5 真实排名 / 子物种 / 流派 / 变种 / 经典款式
- 评分相关的可量化维度（珍稀度、辨识度、保育紧迫、新手友好度、风味强度等）
- 时间线 / 生命周期 / 历史关键节点
- 3-5 条趣味冷知识 / Did You Know
- 文化意义 / 象征 / 入药历史 / 在艺术中的形象
- 保护等级 / 认证 / 标准 / 法规状态

**写事实的纪律**：

- 数值带单位（cm / kg / °C / % / 海拔 m / ml）。
- 学名拉丁文准确，作为 italic serif 处理。
- Top 5、排名、评分必须真实可查；不确定就降级为 Top 3 或直接不放。
- 同类事实之间不要重复（Behavior 已经说了"夜行独居"，Habitat 不要再说一遍）。

## 3. 调色方向（指导而非锁死）

挑一个调色方向给模型作为整体气质指导。**不要在 prompt 里钉死 6 个 hex 值**，让模型在该气质内自由微调。

| 方向 | 整体气质 | 适合 |
|---|---|---|
| cream-warm | 奶油米底 + 可可棕主色 + 蜜金 accent | 食物饮品、咖啡、面包、甜品 |
| botanical | 羊皮米底 + 植物绿主色 + 陶土橙 accent | 植物、作物、香料、园艺 |
| field-guide | 泛黄手册米底 + 墨蓝灰主色 + 暖砖红 accent | 鸟类、昆虫、博物学 |
| ocean | 浅雾蓝底 + 深海蓝主色 + 海盐金 accent | 海洋生物、水域、天气 |
| slate-modern | 石板灰白底 + 石墨黑主色 + 橙 accent | 工具、科技物件、设备 |
| pastel-life | 蜜桃奶底 + 陶瓷粉主色 + 薄荷绿 accent | 宠物、生活方式、手账 |
| museum-ivory | 象牙米底 + 深咖主色 + 驼色 accent | 文化遗产、历史、器物 |

**重要**：调色方向只约束**背景、卡片底、UI 文字、icon、accent**这套系统。**主视觉插画使用主体真实的自然色，不受 UI 调色板限制**——雪豹的灰白毛、毒箭蛙的霓虹蓝、樱桃的红、铜锅的金属铜色，该是什么色就什么色。

## 4. Prompt 拼装模板

下面这段交给 `GenImage.prompt`。它是**描述性 brief** 而非清单填空。方括号占位换成 §2 的真实事实和 §3 的调色方向，**不要保留 `[]` 占位**，**不要塞回任何"自动选择"、"如果适合"这类 meta 指令**——meta 决策由 Agent 在写 prompt 时已经处理完。

```
Role: Senior editorial infographic designer. Produce a single vertical, publishable encyclopedia / field-guide knowledge card about one topic. The card should feel like a page from a premium natural-history guidebook crossed with a modern editorial infographic — collectible, magazine-grade, designed for reading and re-reading. NOT a poster, NOT a social thumbnail, NOT a business dashboard, NOT a uniform tile grid of identical cards.

# Topic
[Topic name in user language, e.g. "Mantis Shrimp / 雀尾螳螂虾"]
[One-sentence framing: what it is, why it's worth a page, e.g. "The ocean's most colorful crustacean — extraordinary vision and the fastest punch in the animal kingdom."]

# Title block (top-left of the page, sharing the upper zone with the hero illustration)
- Series label / eyebrow text (small, letter-spaced caps): "[e.g. 'MARINE LIFE GUIDE · 海洋生物图鉴']"
- Issue number (small, separate from title): "[e.g. 'NO. 03']"
- Main title (large, dominant, EXACT text): "[title verbatim]"
- Subtitle (italic editorial serif, smaller, latin name or one-line tagline): "[subtitle verbatim]"
- Intro paragraph (3-4 lines, regular sans, sits next to or below the title): "[2-3 sentence introduction — what it is, why it's interesting]"

# Hero illustration
Render one beautifully detailed naturalistic illustration of:
[full hero description — pose, angle, environment hint, distinctive features visible, e.g. "a male mantis shrimp in 3/4 profile peering from a coral crevice, iridescent green-and-red carapace, raptorial appendages folded, large compound eyes prominent"]
- Medium: [e.g. "refined gouache + ink line, botanical-plate precision with soft tonal shading" / "editorial vector with textured fills"]
- Position: anchored in the UPPER-CENTER or UPPER-RIGHT region of the page, sharing the top band horizontally with the title block (left) and an anchor info panel (right or under). Do NOT center the hero as a standalone illustration with empty bands above and below it.
- Naturalistic colors for the subject itself (not constrained to the UI palette below).
- NO text rendered inside the hero illustration.

# Facts to draw from (real, verified — encode these into the page)
Below is the full pool of facts about this topic. The designer should SELECT, GROUP, and COMBINE these into a varied set of editorial modules — choose the module shape that best fits each kind of data. Do NOT render every fact as a uniform bullet card. Do NOT invent additional facts beyond this pool.

[List every collected fact as a short labeled line. Examples — keep what's real, drop what isn't:]
- Scientific name: [latin]
- Classification: Kingdom [..] / Phylum [..] / Class [..] / Order [..] / Family [..] / Genus [..] / Species [..]
- Common names: [..]
- Distribution: [..]
- Habitat: [..]
- Size: [.. cm], Weight: [.. kg], Lifespan: [.. years]
- Diet: [..]
- Behavior: [..]
- Notable anatomy / structure: [..]
- Process / mechanism / lifecycle stages: [stage1 → stage2 → stage3 → stage4]
- Conservation status: [IUCN code + plain wording]
- Risks / warnings: [..]
- Care / maintenance: [..]
- Suitable for / target users: [persona 1, persona 2, persona 3, persona 4]
- Pros: [..] / Cons: [..]
- Top 5 [related list]: 01 [..] / 02 [..] / 03 [..] / 04 [..] / 05 [..]
- Rating dimensions (each /5 — real, not made up): [dim1 X/5], [dim2 X/5], [dim3 X/5], [dim4 X/5]
- Did You Know / fun facts: [..]
- Cultural / historical notes: [..]
- Key numbers worth highlighting: [..]

# Module variety (this is the most important instruction)
Compose 9-12 information blocks across the page using a VARIED vocabulary of editorial shapes. Vary widths, heights, and visual treatments — the page should NOT look like a 2×3 grid of identical icon-title-bullets cards. Use combinations such as:

- Key-value tables with small category icons (great for Classification, Quick Profile, Care specs)
- Anatomy / feature strips: a horizontal row of 3-5 zoomed-in feature thumbnails with short captions under each (great for "Key Features", "Anatomy Highlights")
- Circular lens callouts with thin leader lines pointing to specific points on the hero (great for 2-3 standout anatomy features — use sparingly, do not duplicate the anatomy strip)
- Horizontal process / lifecycle flow: 3-5 numbered or arrowed stages in a row (great for lifecycle, brewing process, formation mechanism)
- Diet / ingredient icon rows: 3-5 small illustrated items with labels (great for food preferences, components, accessories)
- Numbered Top-N lists: 01–05 rows with rank badge + name + one-line descriptor
- Horizontal rating bars or 5-star rows for 3-5 dimensions
- Pros & Cons two-column comparison with check/cross marks and tinted column headers
- Persona / target-user row: 3-4 stylized portrait icons with one-word roles underneath
- Mini distribution map: small stylized world or region map with shaded habitat areas and short legend
- Warning / risk callout box in a soft accent tint with alert icon
- Did You Know / fun fact box with light tinted background and lightbulb icon
- Quick summary chip tags: 4-6 short keyword pills, optionally followed by a single "Takeaway:" line
- Conservation status badge with IUCN code, color-coded
- Timeline strip with milestones along a horizontal line
- Size comparison diagram (silhouette next to a ruler or human silhouette for scale)

Pick the shapes that best fit THIS topic's data. Some pages will use 3 from this list, some will use 10. Aim for 9-12 distinct blocks total when the topic supports it.

# Page layout — magazine-style 2D grid on a landscape / near-square canvas
The page reads like a single editorial spread on a wider-than-tall page (4:3 or 1:1 or 3:2). Think of it as a magazine double-page or a single landscape handbook page. Approximate zoning:

- Top band (~35-45% height): a horizontal composition combining (from left to right) the title block + intro paragraph on the left, the hero illustration in the center or center-right, and one anchor info panel (typically a Classification table or Quick Profile key-value list) on the far right. These three regions share the SAME horizontal band — they do NOT stack vertically.
- Mid-page strip (~10-15% height, optional but recommended): a full-width "Anatomy Highlights" or "Key Features" horizontal strip of 3-5 zoomed-in feature cells with captions, bridging the top band and the lower modules.
- Lower zone (~40-50% height): a 3-column (or mixed 2+3 column) grid of smaller modules. Each column may contain 1-3 stacked panels of DIFFERENT shapes. Mix module types liberally — ratings, top list, pros/cons, warnings, persona row, fun facts, mini distribution map, conservation badge, process flow, diet icon row — multiple of these coexist; do NOT pick only one.
- Footer (small, ~3-5%): series signature line, a thin divider, optional small decorative motifs.

Crucially: because the canvas is wide, the page must use HORIZONTAL real estate fully. Do NOT compress everything into a narrow central column with empty margins. Do NOT lay out as 3 stacked horizontal bands of equal height; the top band should be taller than the mid strip, which is thinner than the lower zone.

Block widths and heights MUST vary. A block holding 4 bullets should NOT be the same height as a block holding a 2×3 icon grid. Alignment is editorial-grade: panels snap to an underlying column grid, but their heights and content treatments differ.

# Detail callouts on the hero
Add 2-4 zoomed-in feature callouts that magnify specific anatomy or structural features of the hero. Form is flexible:
- Circular or oval lens framing with a thin dotted leader line pointing from the lens to the exact spot on the hero, with a small label, OR
- A separate horizontal "Anatomy Highlights" strip near the hero with rectangular feature cells, each cell showing a close-up with a caption below
Use whichever fits the layout best. You may use both forms for different features. Do NOT scatter every feature as circular lenses if a horizontal strip would communicate better.

# Palette and color discipline
Overall page palette: [chosen palette name from §3, e.g. "cream-warm — soft cream / ivory background, warm cocoa-brown primary for headers and icon strokes, honey-gold accent for highlights and rating bars, neutral text"]
- Background and card surfaces are light and soft.
- Primary color is used for titles, panel headers, key numbers, icon strokes.
- Accent color is used for leader lines, lens rings, rating bars, top-list rank badges, small dots, chip tints.
- Hero illustration is rendered in the subject's NATURAL colors — it is not constrained to the UI palette. The subject can be vivid (mantis shrimp iridescence, parrot plumage, espresso crema) while the UI system stays soft.
- Do NOT render hex codes, color names, palette labels, or the words "palette" / "module" / "accent" as visible text in the image.

# Typography
- Title: heavy display weight (bold sans-serif 粗黑 for Chinese, editorial display serif for English).
- Subtitle / latin name: italic editorial serif, smaller.
- Panel headers: bold sans, sentence case.
- Body bullets: regular sans, optical reading size, 1.4-1.5 line-height.
- Numbers, sizes, rating scores: tabular numerals, slightly heavier weight.
- Series label / eyebrow text: small caps, letter-spaced 0.08-0.12em, muted color.

# Density and rhythm
- Aim for HIGH information density (9-12 distinct blocks) BUT readable rhythm: 15-25% whitespace overall.
- Different blocks read at different paces — some are scan-and-go (rating bars, chip tags), some invite reading (intro paragraph, fun facts).
- Avoid uniform tile-grid feel: panels MUST differ in shape, width, height, and visual treatment.
- Small refined line icons (18-22 px) live inside many panels — but icons are not mandatory in every panel; tables and ratings can stand without them.

# Decorative texture
- Very subtle paper-grain texture at 4-8% opacity across the page is fine.
- 4-8 tiny restrained decorative motifs tied to the subject (sprigs, footprints, ruler ticks, dotted constellations) — never busy patterns behind text.
- Shadows are soft and short (y 2-4 px, blur 8-16 px, opacity 6-10%). No heavy drop shadows.

# Aspect & format
- Landscape or near-square orientation only (4:3 or 1:1 or 3:2). This card would be printed as a landscape handbook page or displayed as a wide editorial collectible card.
- Do NOT produce a tall vertical layout. The page is wider than tall, or square — use the horizontal room.

# Hard constraints
- Real facts only. Do NOT invent scientific names, statistics, top-N rankings, conservation statuses, prices, dates.
- All text legible and spelled correctly. Match language to the topic ([language, e.g. "Chinese with Latin scientific names" / "bilingual zh + en"]).
- Hero illustration must NOT contain any text inside it.
- No ad-poster feel, no neon, no saturated gradients, no commercial CTAs, no QR codes, no watermarks, no price tags.
- No realistic human faces. People appear only as stylized icons if persona row is used.
- Module contents must be DISTINCT — no repeated bullets across blocks.
- The page must NOT be a uniform 2-column or 2×3 grid of identical icon-title-bullets cards. Block shapes MUST vary.
- The page must NOT be a vertical stack of evenly-sized horizontal bands. Use a 2D grid with both row and column structure, exploiting the landscape canvas horizontally.
```

## 5. GenImage 调用

文本密度高（标题、学名、多种 panel 类型、数值、bullet），优先使用 `gpt-image-2`——中文 + 英文学名混排最稳。若纯英文且以插画为主、文字相对少，可换 `nano-banana-pro`。

```json
{
  "image_id": "encyclopedia_<slug>",
  "prompt": "<按 §4 拼装好的完整文本>",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "4:3",
  "n": 1,
  "reference_image_ids": []
}
```

| 参数 | 默认 | 备注 |
|---|---|---|
| model | `gpt-image-2` | 多语言 + 密集文字；纯插画少字可用 `nano-banana-pro` |
| resolution | `2K` | 印刷级可上 `4K` |
| ratio | `4:3` | 默认横版手册气质；社交收藏卡用 `1:1`；更宽的杂志页用 `3:2`。不出竖版 |
| n | `1` | 系列对比可升到 2-3 |
| reference_image_ids | `[]` | 仅当用户提供了真实主体照片/历史图鉴卡且 image id 已存在时才填 |

## 6. 参考图处理

用户给了主体照片（"我家的猫，照着它画一张图鉴卡"）或历史系列卡时，把 image id 填进 `reference_image_ids`，并在 prompt 末尾追加：

```
# Reference image directives — MUST INCORPORATE
The hero illustration must visually match the reference subject.
- Identity: [distinctive markings / color patches / posture / breed]
- Stylize to [medium]; NO photoreal face or photographic shading.
- Preserve [signature features user cares about].
- Color mapping: hero keeps the subject's natural identity colors; the surrounding page palette stays as defined above.
```

## 7. 跟进调整

- "感觉还是太像 2×3 卡片网格" → 在 prompt 的 Module variety 区**列出更多种**模块形态名（特别是 anatomy strip / process flow / mini map / persona row / chip tags），并增强 "vary widths, heights, and visual treatments" 的强调；同时把目标块数从 9 提到 11-12。
- "信息太挤" → 砍掉 2-3 个事实类目（先砍重复度高的，比如 Behavior 和 Habitat 合并；Cultural notes 可删），目标块数降到 8-9；不要去缩小现有块。
- "配色再柔和 / 再复古" → 换 §3 调色方向（cream-warm ↔ museum-ivory ↔ pastel-life），其它不动。
- "主视觉换姿态 / 换物种" → 改 hero description；其它事实保留；`image_id` 加后缀 `_v2`。
- "想要更密 / 像 Axolotl 那张" → 确认事实清单足够丰富（至少 12 个事实类目命中），并在 prompt 里写 "compose 11-12 distinct blocks"。
- "想要更方一点 / 收藏卡感" → 把 `ratio` 改成 `1:1`，并在 prompt 里把"top band 占 35-45%"调成"top band 占 40-50%"以匹配更方的画布。
- "想要更宽 / 更像跨页杂志" → 把 `ratio` 改成 `3:2`；提醒模型下半区可以从 3 列扩到 4 列。
- "要做手机壁纸 / 竖版" → 本 skill 不出竖版，建议换 `xhs-card-series` 或 `article-cover-image`。

## 8. 系列化（collect as a series）

用户常常会连续做同一系列的多张（"再做一张北极狐"、"加一张北极兔"）。保持系列感需要：

- 统一调色方向（首次确定的方向就是系列基因色）。
- 统一 `series_label`（`HUNAN WILDLIFE FIELD GUIDE` / `深海图鉴 · VOL 1`）。
- 保持 title typography 气质和 hero medium 一致；只换主体和事实。
- `issue_no` 递增（`NO. 01` → `NO. 02` → `NO. 03`）。
- 同一系列里**保持目标块数大致一致**（比如都 10-11 块），避免一张密一张疏。
- `image_id` 用系列 + 主题命名：`encyclopedia_field_guide_arctic_fox` / `encyclopedia_field_guide_arctic_hare`。

## 9. 常见反例（写 prompt 时主动规避）

1. **把"挑模块、选 panel 形态"提前在 Agent 里全部决定好**：违反本 skill 的核心思路。Agent 只收集事实、决定调色和标题；版面与模块形态全部交给生图模型。
2. **prompt 里写"render 5 panels in a 2-column grid, each with icon + title + bullets"**：这就是导致 2×3 僵化网格的根源。改为列出 module variety 词表 + 块数范围 + "vary widths and heights"。
3. **强制 callout 必须是圆形 lens + leader line**：禁掉这种独占。callout 可以是横向 anatomy strip、圆形 lens、或两者混用。
4. **编造事实 / Top N / 评分 / 学名**：所有数值与排名必须真实可查；不确定就降级或省略。
5. **palette 锁死 6 个 hex，hero 颜色也被限制**：调色板只约束 UI 系统；主体插画用自然色。
6. **海报化**：大块深色背景、霓虹、夸张渐变、营销 CTA → 失去手册气质。
7. **主视觉里塞字**：hero 区不渲染任何文字；文字只出现在标题、callout label、panel 内、footer。
8. **callout 引线指向模糊位置**：引线必须从 lens 圆圈准确指到主视觉上那个解剖位置。
9. **英文学名拼错 / 语种混用混乱**：拉丁学名用斜体 serif，中文学名不斜体；混排保持语种分层清晰。
10. **页面变成上下分段的报告**：标题、hero、引言、分类表应该共享上半区横向并置，而不是各占一整行往下堆。
11. **没有用满横向空间**：横版画布上把所有内容压缩在中央一列、左右留大白边——失去横版价值。应该让模块铺满横向网格。
12. **强行做成竖版**：本 skill 横版/方版 only；用户要竖版引导切到其它 skill。
