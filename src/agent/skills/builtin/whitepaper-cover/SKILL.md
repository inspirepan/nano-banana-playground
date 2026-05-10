---
name: whitepaper-cover
description: Generate a single PDF whitepaper / annual report / industry report / research paper / technical report cover page (A4 / portrait 3:4) with editorial design-school DNA. Use whenever the user asks to "做一份白皮书封面", "report cover", "annual report 封面", "行业白皮书首页", "技术报告封面", "research paper title page", or wants a portrait document cover in the style of Müller-Brockmann, Fathom, Information Architects, Takram, Irma Boom, Kenya Hara, Pentagram, or Build. Do NOT use for 单页 PPT（用 presentation-slide）, 文章封面（article-cover-image）, 海报印刷（editorial-poster）, 信息图（knowledge-infographic）, 多页内文版式, 杂志内页.
icon: file-text
preview_image: /skill-previews/whitepaper-cover.jpg
display_name:
  zh-CN: 白皮书封面
  en: Whitepaper Cover
display_description:
  zh-CN: PDF 白皮书 / 行业报告 / 年报封面，A4 竖版，融入 8 大编辑设计学派 DNA。
  en: PDF whitepaper / annual report / research cover (A4 portrait) tied to 8 editorial design schools.
---

# Whitepaper Cover

为白皮书 / 年报 / 行业报告 / 研究报告 / 技术报告生成**封面**单页（A4 竖版，3:4 出图）。视觉内核 = **document-type 骨架 × design-school DNA × theme × element-strategy**。

## 何时触发

适用：

- 行业 / 产业白皮书首页
- 公司年度报告 (Annual Report) 封面
- 投资 / 咨询 / 政策研究报告封面
- 技术报告 / 学术论文标题页
- 用户引用具体学派："Pentagram editorial 风", "Irma Boom 那种装订感", "Takram 研究报告封面"

不适用：

- 内文版式 / 章节版式（单封面 skill）
- 单页幻灯片（走 `presentation-slide`）
- 文章 / 公众号封面（走 `article-cover-image`）
- 印刷海报（走 `editorial-poster`）

## 1. Document Type（骨架）

| Document Type   | 用途                       | 构图重心                                   |
| --------------- | -------------------------- | ------------------------------------------ |
| `industry`      | 行业 / 产业白皮书          | 主题词组 + 副标题 + 发布机构 + 期次 / 年份 |
| `annual-report` | 公司年度报告               | 公司 logo / 名 + 年份大字 + 主题副标题     |
| `research`      | 研究报告 / 学术论文        | 标题（多行）+ 作者 + 机构 + 期刊 / 序号    |
| `policy`        | 政策 / 智库 / 战略研究     | 主题词 + 副标 + 出版方徽记                 |
| `technical`     | 技术白皮书 / 协议 / RFC 风 | 简短代号 + 长标题 + 版本号 + 团队 / 公司   |
| `manifesto`     | 设计 / 文化 / 思辨宣言     | 单一主张句 + 极少元数据，强排版            |

## 2. Design School DNA（核心维度）

下列 8 个学派的 `提示词DNA` 是这张 skill 的差异化锚点。**只挑 1 个学派**，整张封面的字体、色彩、装订感、装饰倾向都跟它走。

颜色 / 字体名只是给模型的视觉指令，**禁止把色号、学派名、role 标签渲染进图里**。

### 10. Müller-Brockmann - 瑞士网格纯粹

适合：`technical` / `research` / `policy`。技术 / 学术 / 政策最稳。

```
Josef Müller-Brockmann Swiss modernism cover:
- Mathematical 8pt grid clearly perceptible
- Strict alignment (flush left or centered), large headline anchored to grid
- Two-color maximum: black + one accent (#E63946 / #1E3A5F / #006D77)
- Akzidenz-Grotesk / Helvetica geometry; tight hierarchy
- No decoration; the grid IS the design
- Timeless, objective, instantly recognizable
```

### 04. Fathom - 科学叙事

适合：`research` / `industry` / `policy`. 数据严谨、定量分析。

```
Fathom Information Design cover:
- Scientific journal aesthetic meets modern editorial design
- Subtle data visualization element on cover (small multiples / scatter / contour)
- Neutral palette (graphite #2B2B2B, navy #1E3A5F, cool gray #6B7280) + one highlight color
- Citation / footnote design integrated into layout
- Clean grotesque sans (GT America / Graphik / Inter)
- Information density without clutter
```

### 03. Information Architects - 内容优先

适合：`technical` / `manifesto`. 极致 type-driven，几乎纯文字封面。

```
Information Architects philosophy cover:
- Content-first hierarchy, zero decorative elements
- System fonts only (SF Pro / Roboto / Inter)
- Classic blue hyperlink accent (#0000EE) used like a typographic mark
- Single column, reading-optimized line length
- Type IS the cover, no images
- Honest, fast, monastic
```

### 17. Takram - 日式思辨

适合：`research` / `industry`. 科技人文、产品概念、设计研究。

```
Takram Japanese speculative design cover:
- Soft tech aesthetic: rounded corners, gentle shadows
- Diagrams and small charts as art pieces
- Modest sophistication; careful typography (Inter / Suisse / Yu Gothic)
- Neutral natural palette (beige #E8E1D5, soft gray #C8C5BE, muted green #6F8A7E)
- Subtle sketch-like annotation possible at margins
- Pairs typographic precision with warmth
```

### 19. Irma Boom - 书籍建筑

适合：`industry` / `manifesto` / `annual-report`. 厚重的书籍质感、不寻常配色。

```
Irma Boom book architecture cover:
- Non-linear information layout, plays with edges and margins
- Unexpected color combos (pink + red, orange + brown, ochre + cobalt)
- Handcraft translated to digital: subtle paper edge, slight hinted spine
- Title can run vertical, rotated, or wrap around the edge
- Editorial design with unconventional grid breaks
- Dense information inviting close inspection
```

### 18. Kenya Hara - 空的设计

适合：`manifesto` / `industry`. 文化 / 哲思 / 极致克制。

```
Kenya Hara "emptiness" cover:
- Extreme whitespace (80%+) on cream / paper-textured ground
- Layered whites (warm white #F5F0E8, cool white #F7F8F9, off-white #ECEAE3)
- Minimal color (very desaturated)
- Single tiny mark (a thin line, a small dot, one symbol) carries the cover
- Paper tactility translated to digital
- Zen simplicity, design by subtraction
```

### 01. Pentagram - 编辑权威

适合：`annual-report` / `industry` / `policy`. 商业权威感最强。

```
Pentagram / Michael Bierut cover:
- Extreme typographic hierarchy (Helvetica / Univers grotesque)
- Swiss grid with editorial confidence
- Black / white + ONE accent color (e.g. #DC143C / #1A3A5C)
- Headline dominates 40-50% of the page
- 60%+ whitespace; information architecture as visual language
- Minimal decoration, no shadow, no gradient
```

### 11. Build - 当代奢侈极简

适合：`annual-report` / `manifesto`. 高端品牌、设计公司年报。

```
Build studio luxury minimalism cover:
- Generous whitespace (70%+), single focal element
- Subtle weight shift in typography (200 to 600 in same family)
- Single accent color used sparingly
- Optional soft shadow or extremely subtle gradient
- Golden ratio proportions; breathing rhythm
- High-end brand confidence
```

## 3. Theme & Element Strategy

- **Theme**：`light`（白底 / 浅灰，多数学派默认）/ `cream`（暖米底，编辑 / 文化）/ `dark`（深底高对比，仅 Pentagram / Build 适合，且偏年报或宣言书）
- **Element strategy**：
  - `typography-only`：纯文字封面（Information Architects / Müller-Brockmann / Kenya Hara / Pentagram 适合）
  - `single-mark`：1 个抽象符号 / 几何形 / 小图（Build / Kenya Hara / Müller-Brockmann 适合）
  - `data-glyph`：1 个高度精炼的数据图形（折线 / 散点 / 等高线 / 小多图）（Fathom / Takram / Stamen 适合）
  - `editorial-image`：抽象 / 概念 / 半摄影质感大图（Pentagram / Irma Boom / Takram 适合）
  - `book-edge`：模拟书脊 / 书边 / 绑边纹理（Irma Boom 专属）

## 4. AskUserQuestion 一次问完

```json
{
  "questions": [
    {
      "question": "这是什么类型的报告？",
      "header": "Doc",
      "multi_select": false,
      "options": [
        { "label": "industry", "description": "行业 / 产业白皮书" },
        { "label": "annual-report", "description": "公司年度报告" },
        { "label": "research", "description": "研究报告 / 学术论文" },
        { "label": "policy", "description": "政策 / 智库 / 战略研究" },
        { "label": "technical", "description": "技术白皮书 / 协议规范" },
        { "label": "manifesto", "description": "设计 / 文化 / 思辨宣言" }
      ]
    },
    {
      "question": "选一个设计学派 DNA",
      "header": "School",
      "multi_select": false,
      "options": [
        { "label": "Müller-Brockmann", "description": "瑞士网格 + 双色，技术 / 学术稳重" },
        { "label": "Fathom", "description": "科学期刊 + 数据图形，研究 / 行业" },
        { "label": "Information Architects", "description": "纯文字 + 系统字体，technical / manifesto" },
        { "label": "Takram", "description": "圆角柔阴影 + 自然中性色，研究人文" },
        { "label": "Irma Boom", "description": "书籍建筑 + 不寻常配色 + 装订感" },
        { "label": "Kenya Hara", "description": "极致留白 + 暖米底，文化哲思" },
        { "label": "Pentagram", "description": "编辑式排版 + 单 accent 色，权威商业" },
        { "label": "Build", "description": "70%+ 留白 + 字重微差，奢侈极简年报" }
      ]
    },
    {
      "question": "底色主题",
      "header": "Theme",
      "multi_select": false,
      "options": [
        { "label": "light", "description": "白底 / 浅灰，最稳，技术 / 研究 / 政策默认" },
        { "label": "cream", "description": "暖米底，编辑 / 文化 / 宣言" },
        { "label": "dark", "description": "深底高对比，年报 / 宣言书才用" }
      ]
    },
    {
      "question": "封面元素策略",
      "header": "Element",
      "multi_select": false,
      "options": [
        { "label": "typography-only", "description": "纯文字封面，最稳" },
        { "label": "single-mark", "description": "1 个抽象符号 / 几何形 / 小图" },
        { "label": "data-glyph", "description": "1 个精炼数据图形（折线 / 散点 / 等高线）" },
        { "label": "editorial-image", "description": "抽象 / 概念 / 半摄影大图" },
        { "label": "book-edge", "description": "模拟书脊 / 装订纹理（仅 Irma Boom）" }
      ]
    }
  ]
}
```

正文（封面标题、副标题、机构、年份、版本、作者）从备注或对话上下文收集；**不要让模型自己编机构名 / 作者名 / 年份**。

## 5. 自动推荐表（用户跳过维度时）

| 内容关键词                         | doc-type      | school                 | theme | element         |
| ---------------------------------- | ------------- | ---------------------- | ----- | --------------- |
| 公司 / 企业 / annual report / 年报 | annual-report | Pentagram              | light | typography-only |
| 行业 / 产业 / 市场 / 趋势          | industry      | Fathom                 | light | data-glyph      |
| 政策 / 智库 / 战略 / 政府          | policy        | Müller-Brockmann       | light | typography-only |
| 技术 / 协议 / 规范 / RFC           | technical     | Information Architects | light | typography-only |
| 研究 / 学术 / 论文 / 实验          | research      | Müller-Brockmann       | light | data-glyph      |
| 设计 / 文化 / 思辨 / 宣言          | manifesto     | Kenya Hara             | cream | single-mark     |
| 创意 / 艺术 / 文化机构             | industry      | Irma Boom              | cream | book-edge       |
| 科技人文 / 产品研究 / 创新报告     | research      | Takram                 | light | editorial-image |
| 投资 / 咨询深度报告                | industry      | Pentagram              | light | editorial-image |
| 高端品牌 / 设计公司年报            | annual-report | Build                  | cream | single-mark     |

## 6. Prompt 拼装模板

```
Role: Senior editorial designer for printed reports.
Goal: Produce a SINGLE A4 portrait whitepaper / report cover (rendered at 3:4 aspect ratio). One cover only — no inside pages, no spread mockup.

# Document
- Type: [doc-type]
- Theme: [light / cream / dark]
- Element strategy: [typography-only / single-mark / data-glyph / editorial-image / book-edge]
- Language for visible text: [zh / en / ja]

# Content (use these EXACT texts, do not invent organization, author, year, or version)
- Main title: [exact title]
- Subtitle: [exact text or "none"]
- Issuing organization / publisher: [exact name or "omit"]
- Authors / contributors: [exact names or "omit"]
- Year / volume / version: [exact text or "omit"]
- Edition tag (e.g. "Vol. 03", "2025 Edition", "v1.2"): [exact text or "omit"]

# Composition (Doc-Type = [doc-type])
[industry] Subject phrase as headline + subtitle + publisher block; optional small data-glyph or editorial mark; clear hierarchy from title to publisher.
[annual-report] Year set as a large display element (or paired with company mark); subtitle articulates the year's theme; publisher block restrained.
[research] Multiline academic title flushed left or centered; authors and affiliation lines beneath title; serial number / journal mark in corner.
[policy] Subject + subtitle + issuing institution; authoritative restraint; publisher mark prominent but not dominant.
[technical] Short codename / project mark + long title + version + team; monospace or grotesque; reads like a spec sheet.
[manifesto] One bold thesis sentence dominates the cover; minimal metadata; cover IS the statement.

# Design School DNA ([school])
[paste the school's DNA prompt block from §2 here verbatim]

# Theme ([theme])
- light: white or off-white ground (#FFFFFF / #FAFAFA); near-black body (#1F2937).
- cream: warm cream ground (#F5F0E8 / #ECE6D9); editorial near-black body (#1A1A1A).
- dark: deep ground (#0E0E10 / #0A0A0A); high-contrast headline (#FFFFFF); accent reserved for one focal element.

# Element Strategy ([element])
- typography-only: no images / charts / shapes — type carries the cover, every line consciously placed.
- single-mark: one abstract symbol or geometric shape (≤ 25% of cover area), clearly tied to subject metaphorically.
- data-glyph: one precise small chart — e.g., a line chart, scatter cluster, contour map, or small-multiples grid — distilled to essentials; the chart shape reflects the user's data direction without inventing exact values.
- editorial-image: one abstract / conceptual / half-photographic image occupying 40-60% of cover; distinctive and tied to subject.
- book-edge: a hint of book spine or binding edge along left or right margin (Irma Boom only); subtle paper / cloth texture cue.

# Hard Constraints
- 3:4 portrait orientation rendering an A4-feeling cover; no multi-page mockup or spread.
- All visible text must be sharp, properly aligned to the school's grid.
- Do NOT render hex codes, color names, school names ("Müller-Brockmann", "Fathom", "Information Architects", "Takram", "Irma Boom", "Kenya Hara", "Pentagram", "Build"), or dimension keywords as visible text in the image.
- Do NOT invent organization names, author names, years, version numbers, or page counts; either use exactly what the user provided or omit them.
- Do NOT invent specific data values for data-glyph; render a generic but plausible shape consistent with the user's described data direction.
- For people: simplified silhouettes only; no realistic faces unless the user explicitly supplied a reference image of that person.
- Match the language of any rendered text to the language declared above.
```

## 7. GenImage 调用

| 参数                | 默认          | 备注                                                        |
| ------------------- | ------------- | ----------------------------------------------------------- |
| model               | `gpt-image-2` | 文字稳定；纯几何 / `single-mark` 极简可换 `nano-banana-pro` |
| resolution          | `2K`          | 阅读 / 数字分发够用；要印刷再上 `4K`                        |
| ratio               | `3:4`         | 最接近 A4 竖版；不要传白名单外的 ratio                      |
| n                   | `1`           | 一封面一张                                                  |
| reference_image_ids | `[]`          | 仅当对话已有真实图片 id 才填                                |

调用示例：

```json
{
  "image_id": "whitepaper_cover_industry_ai_2025",
  "prompt": "Role: Senior editorial designer for printed reports.\nGoal: Produce a SINGLE A4 portrait whitepaper / report cover ...（按 §6 拼好的完整文本）",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "3:4",
  "n": 1,
  "reference_image_ids": []
}
```

## 8. 参考图处理

`reference_image_ids` 仅填**已存在**的会话图片 id（不是路径）。一旦填入，必须在 prompt 末尾追加：

```
# Reference Style — MUST INCORPORATE
- Brand mark / wordmark: <e.g. "publisher wordmark in lower-left, original kerning preserved">
- Typography: <e.g. "headline weight matches reference, geometric grotesque, tight kerning">
- Color: <exact hex from reference>
- Layout cues: <e.g. "title flushed left to grid column 2, mirroring reference">
Adapt to this report's content; do NOT copy literal sentences from the reference.
```

## 9. 常见反例

1. 输出多页跨页拼接 → 永远只出一张封面。
2. 把 hex 色号 / 学派名 / 出版机构假名渲染到图里。
3. 学派与 element 打架：例如 Information Architects 配 `editorial-image` → IA 学派几乎只接 `typography-only`。
4. data-glyph 让模型自编精确数字。
5. 真实人脸 / 摄影写实人物 → 必须简化轮廓 / 抽象。
6. 用 16:9 出封面 → A4 竖版必须 3:4。
7. dark theme + Stamen / Fathom / Takram → 学派 DNA 默认偏亮，强配 dark 会丢档案感；只有 Pentagram / Build 适合 dark。
8. Kenya Hara 配 `editorial-image` → Hara 几乎只接 `typography-only` 或 `single-mark`。
9. Irma Boom 不开 `book-edge` → 失去她最强的辨识度（书脊感）。

## 10. 跟进调整

- "换学派" → 切 `school`，prompt 重组。
- "想要纯文字封面" → element 切 `typography-only`，往往效果最稳。
- "加一个 data 图形" → element 切 `data-glyph`，并把数据方向（上升 / 集中 / 周期 / 分布）告诉模型，但不写具体数字。
- "希望显得更厚 / 更年报" → school 切 Build / Pentagram，theme 切 cream，element 切 `single-mark`。
- "中文标题字怪 / 排版崩" → 切 `gpt-image-2` 并检查标题是否过长（封面主标题建议 ≤ 16 个汉字）。
- "想用之前那本报告封面做风格延续" → 让用户给那张图的语义 id，加进 `reference_image_ids` + §8 的 MUST INCORPORATE 段。
