---
name: presentation-slide
description: Generate a single high-quality presentation slide (PPT / Keynote / 演示文稿 / 幻灯片) at 16:9, with strong typographic hierarchy and named design-school aesthetics. Use whenever the user asks to "做一页 PPT", "生成 keynote 封面", "design a slide", "title slide", "section divider", "data slide", "quote slide", "投资人 deck 单页", "团队全员大会幻灯片", or wants editorial slide visuals in the style of Pentagram, Müller-Brockmann, Build, Kenya Hara, Sagmeister, Takram, Fathom, or Stamen. Output is a single dense slide image, not a deck. Do NOT use for 多页 deck（请拆成多次 GenImage）, 信息图（用 knowledge-infographic）, 海报（editorial-poster）, 文章封面（article-cover-image）, App UI / 网页（ui-mockup）, 漫画（comic-strip）.
icon: presentation
preview_image: /skill-previews/presentation-slide.jpg
display_name:
  zh-CN: 演示文稿单页
  en: Presentation Slide
display_description:
  zh-CN: 单页 PPT / Keynote 视觉，融入 Pentagram / Müller-Brockmann / Build / Kenya Hara 等 8 个设计学派 DNA。
  en: Single PPT / Keynote slide visuals tied to 8 named design schools (Pentagram / Build / Takram etc.).
---

# Presentation Slide

为单张 PPT / Keynote 幻灯片生成视觉。一次只出 1 张（16:9 默认）。视觉内核 = **slide-type 骨架 × design-school DNA × theme × density**。

## 何时触发

适用：

- 一页 keynote 封面 / 章节分隔页 / 数据页 / 名言金句页 / 团队页 / 流程页
- 投资人 deck 单页、All-Hands 内部演示单页、产品发布会主视觉幻灯片
- 用户提到"幻灯片", "PPT 单页", "Keynote", "section slide", "title slide", "data slide", "quote slide"
- 用户引用具体设计学派："像 Pentagram 一样", "Build studio 那种克制", "Sagmeister 的快乐感", "Müller 网格"

不适用：

- 多页连续 deck（提示用户拆成多次调用，每次一页）
- 信息密度高的知识卡（走 `knowledge-infographic`）
- 海报 / 印刷品（走 `editorial-poster`）
- 文章封面 / 公众号题图（走 `article-cover-image`）
- 应用界面 / 网页（走 `ui-mockup`）

## 1. Slide Type（骨架）

| Slide Type        | 用途                              | 构图                                                                 |
| ----------------- | --------------------------------- | -------------------------------------------------------------------- |
| `title-cover`     | 整份 deck 的封面 / 主题页         | 大标题占主导，副标题 + 1 行 metadata（日期 / 演讲人）                |
| `section-divider` | 章节切换页                        | 大数字 / 章节编号 + 章节短语，留 70% 空白                            |
| `data-slide`      | 数据可视化页（柱图 / 折线 / KPI） | 1 个核心数字 / 图表占 60%，标题 + 1 句洞察                           |
| `quote-slide`     | 名言 / 金句 / 用户证言            | 大引号 + 短句（≤ 30 字符）+ 引用人，强排版                           |
| `list-slide`      | 列点页（3-5 条）                  | 标题 + 编号或图标 + 短描述，垂直或两列                               |
| `image-hero`      | 大图主视觉页                      | 占满或 60% 主视觉 + 简短 caption；常用于产品发布、metaphor 概念呈现  |
| `process-flow`    | 流程 / 步骤 / 时间线              | 横向 3-5 步骤箭头链或时间线，每步极简短文字                          |

## 2. Design School DNA（核心维度）

下面 8 个学派的 `提示词DNA` 是这张 skill 的差异化锚点。**只挑 1 个学派**，整张 slide 的字体、色彩、留白、装饰倾向都跟它走。

颜色 / 字体名只是对模型的视觉指令，**禁止把色号、学派名、role 标签渲染到图里**。

### 01. Pentagram - 信息建筑派
适合：title-cover / section-divider / data-slide / quote-slide。商业 / 企业 / 编辑深度报告。
```
Pentagram / Michael Bierut style:
- Extreme typographic hierarchy, Helvetica or Univers grotesque
- Swiss grid with mathematically precise spacing
- Black / white + ONE accent color (e.g. #DC143C / #1A3A5C)
- Information architecture as visual structure
- 60%+ whitespace, headline dominates
- Editorial confidence, no decorative noise
```

### 10. Müller-Brockmann - 瑞士网格
适合：data-slide / list-slide / process-flow。数据严谨、技术报告。
```
Josef Müller-Brockmann Swiss modernism:
- Mathematical 8pt baseline grid, columns clearly visible
- Strict alignment (flush left or centered)
- Two-color maximum (black + one accent like #E63946)
- Akzidenz-Grotesk / Inter / Helvetica geometry
- No decoration, no shadow, no gradient
- Timeless, objective, type-as-system
```

### 11. Build - 当代奢侈极简
适合：title-cover / quote-slide / image-hero。品牌发布、设计公司 deck。
```
Build studio luxury minimalism:
- Generous whitespace (70%+), single focal element
- Subtle weight shift in typography (200 to 600 in same family)
- Single accent color used sparingly
- Soft shadows and very subtle gradient hints only
- Golden ratio proportions, breathing rhythm
- High-end product / lifestyle photography aesthetic when imagery is used
```

### 18. Kenya Hara - 空的设计
适合：title-cover / quote-slide / section-divider。文化 / 哲思 / 极致克制。
```
Kenya Hara "emptiness" design:
- Extreme whitespace (80%+), single tiny focal element
- Layered whites (warm white #F5F0E8, cool white #F7F8F9, off-white #ECEAE3)
- Paper texture and tactility translated to digital
- Minimal color (very desaturated, often only black + cream)
- Design by subtraction, zen simplicity
- Single thin line or single dot can carry the entire slide
```

### 12. Sagmeister & Walsh - 快乐极简
适合：title-cover / section-divider / quote-slide。文化机构、创意品牌、年度回顾。
```
Sagmeister & Walsh joyful philosophy:
- Unexpected color bursts on minimal base (one saturated color + cream + black)
- Hand-made elements (paper craft, physical objects, ribbon, stitched type) blended into digital
- Optimistic, warm, slightly imperfect
- Experimental typography that stays legible
- Mix of analog texture and digital precision
```

### 17. Takram - 日式思辨
适合：data-slide / list-slide / process-flow / title-cover。科技人文、产品概念、研究报告。
```
Takram Japanese speculative design:
- Soft tech aesthetic: rounded corners, gentle shadows
- Charts and diagrams as art pieces, neutral natural palette (beige #E8E1D5, soft gray #C8C5BE, muted green #6F8A7E)
- Modest sophistication, careful typography (often Inter / Suisse / Yu Gothic)
- Diagrams hold equal weight as text
- Pairs well with subtle sketch-like annotations
```

### 04. Fathom - 科学叙事
适合：data-slide / list-slide。年度报告、政策研究、技术深度。
```
Fathom Information Design style:
- Scientific journal aesthetic meets modern editorial design
- Precise data viz (charts / timelines / scatter / small multiples) rendered crisply
- Neutral scheme (cool grays #6B7280, navy #1E3A5F, one highlight color)
- Footnote / citation design integrated into the layout
- Clean grotesque sans (GT America / Graphik / Inter)
- Information density without clutter
```

### 02. Stamen - 数据诗学
适合：data-slide / image-hero。地理 / 公共数据 / 城市 / 气候话题。
```
Stamen Design aesthetic:
- Cartographic approach to data viz (maps, contour, layered topography)
- Algorithm-generated organic patterns
- Warm palette (terracotta #C8553D, sage green #87A878, deep blue #2A4D6E)
- Hand-crafted feel despite digital precision
- Soft layered shadows hinting at depth
```

## 3. Theme & Density

- **Theme**：`light`（白底 / 米底）/ `dark`（深底 + 高对比文字）/ `cream`（暖米底 + 黑字，编辑感）
- **Density**：`minimal`（< 20% 信息占用）/ `balanced`（30-40%）/ `dense`（> 50%，仅 list / data / process 推荐）

学派对 theme 的偏好：

| 学派              | 推荐 theme         |
| ----------------- | ------------------ |
| Pentagram         | light / cream      |
| Müller-Brockmann  | light（白底为主）  |
| Build             | light / cream      |
| Kenya Hara        | cream（必选）      |
| Sagmeister        | cream / light      |
| Takram            | light / cream      |
| Fathom            | light              |
| Stamen            | cream / light      |

dark theme 适合：发布会 keynote 风（任意学派 + dark 都能成立，但要把 accent 色和主标题对比拉满）。

## 4. AskUserQuestion 一次问完

```json
{
  "questions": [
    {
      "question": "这张幻灯片的类型？",
      "header": "Slide",
      "multi_select": false,
      "options": [
        { "label": "title-cover", "description": "整份 deck 的封面 / 主题页" },
        { "label": "section-divider", "description": "章节切换页，留 70% 空白" },
        { "label": "data-slide", "description": "1 个核心数据 + 图表 / KPI" },
        { "label": "quote-slide", "description": "名言金句 / 用户证言" },
        { "label": "list-slide", "description": "3-5 条要点列表" },
        { "label": "image-hero", "description": "大图主视觉 + 简短 caption" },
        { "label": "process-flow", "description": "3-5 步流程 / 时间线" }
      ]
    },
    {
      "question": "选一个设计学派 DNA",
      "header": "School",
      "multi_select": false,
      "options": [
        { "label": "Pentagram", "description": "Bierut 编辑式排版 + 极少色，企业商业" },
        { "label": "Müller-Brockmann", "description": "瑞士网格 + 数学精确 + 双色，技术 / 数据" },
        { "label": "Build", "description": "70%+ 留白 + 字重微差 + 1 强调色，品牌奢侈极简" },
        { "label": "Kenya Hara", "description": "80%+ 留白 + 多层白 + 极致克制，文化 / 哲思" },
        { "label": "Sagmeister", "description": "意外色块 + 手工质感，文化 / 创意 / 暖" },
        { "label": "Takram", "description": "圆角柔阴影 + 自然中性色，科技人文 / 研究" },
        { "label": "Fathom", "description": "学术期刊 + 精确数据可视化，年度报告" },
        { "label": "Stamen", "description": "地图学 + 暖大地色 + 算法图形，地理 / 公共数据" }
      ]
    },
    {
      "question": "底色主题",
      "header": "Theme",
      "multi_select": false,
      "options": [
        { "label": "light", "description": "白底 / 浅底，最通用" },
        { "label": "cream", "description": "暖米底，编辑 / 文化感" },
        { "label": "dark", "description": "深底高对比，发布会 keynote 风" }
      ]
    },
    {
      "question": "信息密度",
      "header": "Density",
      "multi_select": false,
      "options": [
        { "label": "minimal", "description": "< 20% 占用，极致呼吸感" },
        { "label": "balanced", "description": "30-40% 占用，默认" },
        { "label": "dense", "description": "> 50%，仅 list / data / process 推荐" }
      ]
    }
  ]
}
```

正文（标题、副标题、数据点、引用人、列表条目）通过自由备注收集；**不要让模型自己编标题或数据**。

## 5. 自动推荐表（用户跳过维度时）

| 内容关键词                       | slide-type      | school          | theme  | density  |
| -------------------------------- | --------------- | --------------- | ------ | -------- |
| 投资人 / 融资 / pitch deck       | title-cover     | Pentagram       | light  | minimal  |
| 季度 / 年度 / OKR / 数据回顾     | data-slide      | Fathom          | light  | balanced |
| 哲学 / 思辨 / 设计观             | quote-slide     | Kenya Hara      | cream  | minimal  |
| 章节切换 / 大纲                  | section-divider | Build           | cream  | minimal  |
| 流程 / 路线图 / roadmap          | process-flow    | Müller-Brockmann| light  | balanced |
| 团队 / All-Hands / 文化          | quote-slide     | Sagmeister      | cream  | balanced |
| 产品发布 / launch                | image-hero      | Build           | dark   | minimal  |
| 政策 / 城市 / 气候 / 地理        | data-slide      | Stamen          | cream  | balanced |
| 研究 / 技术报告 / 科普           | list-slide      | Takram          | light  | balanced |
| 教程 / how-to                    | process-flow    | Takram          | light  | dense    |

## 6. Prompt 拼装模板

```
Role: Senior presentation designer.
Goal: Produce a SINGLE 16:9 presentation slide for the deck described below. One slide only, no multi-page mock-up.

# Slide
- Type: [slide-type]
- Theme: [light / cream / dark]
- Density: [minimal / balanced / dense]
- Language for any rendered text: [zh / en / ja]

# Content (use these EXACT texts, do not invent facts or numbers)
- Title: [exact title]
- Subtitle / supporting line: [exact text or "none"]
- Body items (for list / process / data): [exact items]
- Speaker / source / date metadata (if any): [exact text]

# Composition (Slide-Type = [slide-type])
[title-cover] Headline dominates ~40-50% of slide; one supporting line; small metadata at bottom.
[section-divider] Huge section number / short phrase, 70% intentional whitespace; no body content.
[quote-slide] Large opening quote mark or pulled quote occupying ~50% area, 1 short attribution line.
[data-slide] One hero number / chart in dominant position; title above; insight caption below; supporting label small.
[list-slide] Title at top; 3-5 numbered or icon-led items vertically (or two columns); equal vertical rhythm.
[image-hero] Single hero image / illustration occupying 60% of slide; short caption tucked into corner.
[process-flow] Horizontal arrow chain or numbered timeline of 3-5 steps; each step has a short label.

# Design School DNA ([school])
[paste the school's DNA prompt block from §2 here verbatim]

# Theme ([theme])
- light: white or near-white background (#FFFFFF or #FAFAFA); near-black body type (#1F2937).
- cream: warm cream background (#F5F0E8 or #ECE6D9); editorial near-black body (#1A1A1A).
- dark: deep background (#0E0E10 or #0A0A0A); high-contrast headline (#FFFFFF), accent reserved for one focal element.

# Density ([density])
- minimal: < 20% of slide carries marks; the rest is whitespace; only one focal element.
- balanced: 30-40% of slide carries marks; clear primary focal element with secondary support.
- dense: > 50% of slide carries marks; allowed only for list-slide / data-slide / process-flow.

# Hard Constraints
- 16:9 frame, do not output a multi-slide grid; this is one slide only.
- Title and any visible text must be sharp, properly aligned to the school's grid.
- Do NOT render hex codes, color names, school names ("Pentagram", "Müller-Brockmann", "Build", "Kenya Hara", "Sagmeister", "Takram", "Fathom", "Stamen"), or dimension keywords as visible text in the image.
- For data-slide: do not invent numbers or chart values beyond what the user provided; if a chart shape is needed, draw a generic but plausible shape that matches the provided data direction.
- For people: simplified silhouettes only — NO realistic faces unless the user explicitly supplied a reference image of that person.
- Generous whitespace appropriate for the chosen density level.
- Match the language of any rendered text to the language declared above.
```

## 7. GenImage 调用

默认 `model: gpt-image-2`（slide 上文字密度高、字渲染稳定性优先）；纯视觉无文字 / 极简 / 中文标题 ≤ 4 字时也可 `nano-banana-pro`。

| 参数                | 默认            | 备注                                              |
| ------------------- | --------------- | ------------------------------------------------- |
| model               | `gpt-image-2`   | 文字稳定；纯图 / 概念 hero 可换 `nano-banana-pro` |
| resolution          | `2K`            | 投影 / 预览够用；要打印再上 `4K`                  |
| ratio               | `16:9`          | 标准 PPT；个别情况 `16:10`（不在白名单时按 16:9） |
| n                   | `1`             | 一次一页；多版本对比再升 2~3                      |
| reference_image_ids | `[]`            | 仅当对话中已有真实图片 id 才填                    |

调用示例：

```json
{
  "image_id": "deck_section_divider_q2_review",
  "prompt": "Role: Senior presentation designer.\nGoal: Produce a SINGLE 16:9 presentation slide ...（按 §6 模板拼好的完整文本）",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "16:9",
  "n": 1,
  "reference_image_ids": []
}
```

## 8. 参考图处理

`reference_image_ids` 仅填**已存在**的会话图片 id（不是路径）。一旦填入，必须在 prompt 末尾追加：

```
# Reference Style — MUST INCORPORATE
- Brand element: <e.g. "wordmark in upper-left, original kerning preserved">
- Typography: <e.g. "headline weight matches reference, geometric grotesque">
- Color: <exact hex from reference>
- Layout cues: <e.g. "thin horizontal divider 60% width at lower-third, mirroring reference">
Adapt to this slide's content; do NOT copy literal sentences from the reference.
```

## 9. 常见反例

1. 把多张幻灯片摆成 2×2 拼接 → 永远只出一张。
2. 把 hex 色号 / 学派名 / role 字写到图里。
3. data-slide 让模型自编数字 / 百分比。
4. quote-slide 把引用人写错或缺失。
5. Kenya Hara 学派配 dense density → 互相打架；Hara 永远是 minimal。
6. dark theme 配 Stamen / Fathom → 学派 DNA 默认是亮底，强配 dark 会丢失档案感。
7. 多种学派混合 → 只挑 1 个学派；用户表达模糊时按 §5 自动推荐表。
8. 16:9 之外的 ratio → 默认锁 16:9；用户明确 16:10 也按 16:9 出（白名单未含 16:10）。
9. 真实人脸 → 必须是简化轮廓 / 剪影 / 抽象符号。

## 10. 跟进调整

- "换一个学派" → 切 `school`，重新拼 prompt。
- "底太空 / 加点信息" → density 升一档（minimal → balanced）。
- "想给客户 review，多出几版" → `n: 3`，4 张方便横向对比；提醒用户每张都按同一组维度生成。
- "改成 dark 发布会感" → theme 切 dark，且 accent 色放大对比度。
- "中文标题字怪 / 排版崩" → 切 `gpt-image-2` 并把 density 降一档；检查标题字数是否 > 24 个汉字。
- "想用之前 deck 的封面做风格延续" → 让用户给那张图的语义 id，加进 `reference_image_ids` + §8 的 MUST INCORPORATE 段。

调整一律走"重新组 prompt → 再 `GenImage`"；不要在工具调用前再追问，UI 审批卡片本身就是确认入口。
