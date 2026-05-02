---
name: editorial-poster
description: Generate screen-print and duotone style editorial posters for movie posters, book cover posters, concert posters, cultural commentary covers, and limited-edition art prints. Use whenever the user mentions movie poster, book cover poster, editorial poster, screen-print, silkscreen, duotone, halftone, concert poster, alternative poster art, Mondo style, or 影评海报、书评封面、电影海报、演唱会海报、文化评论封面、丝网印刷海报、双色调海报. Strong visual core is screen-print silhouettes plus duotone color blocks plus halftone grain plus typography-as-composition. Do NOT use for slide decks, flowcharts, infographics, product photography, UI screenshots, or photorealistic key art.
icon: film
---

# Editorial Poster

为影评 / 书评 / 文化评论 / 演唱会 / 限定艺术海报生成具有强烈编辑风格的封面图。视觉内核是 **screen-print（丝网印刷）+ duotone（双色调）+ 强符号化轮廓 + halftone 颗粒 + 排版即构图**，不是产品摄影、不是写实场景、不是 PPT 配图。

参考语境：Mondo 限定海报、Saul Bass、Olly Moss、Criterion Collection 封面、Penguin classics、riso 印刷艺术海报。

## 何时触发

适用：

- 影评 / 电影分析 / 电影海报致敬
- 书评 / 书籍封面 / 文学专题
- 演唱会 / 音乐节 / 专辑视觉
- 文化评论 / 杂志专栏封面
- 限定艺术海报 / 艺术展宣传

不适用：

- 产品图、key visual 摄影质感
- PPT、流程图、信息图、知识卡片
- UI 截图、品牌 logo、APP 启动图
- 写实人物肖像或真人面孔合成

## 风格内核（screen-print）

写 prompt 时按下面四个维度展开，缺一不可：

### Lines

- 形状由色块边界定义，**no outlines**，没有线稿外轮廓。
- stencil（镂空模板）切割感，剪影边缘锐利、几何化。
- 套色是 hard edge，不允许 anti-alias 之外的羽化。

### Texture

- halftone 网点分布在色块内部，控制密度产生层次。
- 套色错位（color misregistration）2 到 4 px 错移，模拟手工对版误差。
- 纸纹颗粒（paper grain）+ riso / 丝网印刷瑕疵：墨点扩散、轻度堵网、油墨叠印。

### Depth

- 纯色叠层 figure-ground，不允许 gradient、不允许 soft glow。
- 负空间（negative space）是构图主角，不是背景填充——剪影和负形会互为图底。
- 层次靠 halftone 密度和色块叠压表达，不靠光照。

### Element vocabulary

- 象征化剪影：人物、物件、动物、城市天际线、武器、乐器、植物等以纯剪影形式出现。
- 几何边框：圆、拱、半圆、三角、菱形作为构图容器。
- 经典海报边框：1980s 复古海报 keyline、双线框、底部条带式标题区。
- 排版本身就是视觉元素，不是叠层。

### Typography

- 英文：bold condensed sans-serif（如 Compacta、Trade Gothic Bold Condensed）、Art Deco 复古字、手写电影海报标题字。
- 中文：粗黑、粗宋、复古宋、海报体；标题字号大、字间距紧。
- 日文：明朝粗体或 Showa 复古海报字。
- 文字嵌入构图，不悬浮在表面：可压在剪影下半部、贴边框、做成几何块切割。

## 配色（duotone 6 套）

挑一套，**两个主色 + 一个背景 + 一个高光**。hex 仅用于引导生图，**禁止在画面内渲染色号、调色板名、role 标签或 "duotone" 字样**。

| 套系           | Color A   | Color B   | 适配气质                 |
| -------------- | --------- | --------- | ------------------------ |
| Orange + Teal  | `#E8751A` | `#0A6E6E` | cinematic, 动作 / 西部   |
| Red + Cream    | `#C0392B` | `#F5E6D0` | bold, classic, 经典电影  |
| Blue + Gold    | `#1A3A5C` | `#D4A843` | premium, 颁奖季 / 文学   |
| Purple + Green | `#6B3FA0` | `#2ECC71` | futuristic, 科幻 / 赛博  |
| Magenta + Cyan | `#C2185B` | `#00BCD4` | vibrant, pop, 演唱会     |
| Crimson + Navy | `#DC143C` | `#0D1B2A` | dramatic, noir, 黑色电影 |

背景默认三选一：

- `#121212` off-black（暗色海报，最常用）
- `#1E1E1E` dark charcoal（暗色海报，更柔和）
- `#F5E6D0` warm cream（明色复古海报）

高光（accent）：从 `#F5E6D0` warm cream 或 `#F4A623` amber 里挑一个，仅用于极少量点缀（标题强调、编号、徽记）。

## 构图模板（4 选 1）

### Hero silhouette

单角色或单物体的大剪影占据画面 60% 以上，标题压在剪影底部或与剪影边缘咬合；剪影内部用 halftone 表达光影。**推荐 2.35:1 横版**（电影海报感最强），也可用 3:4 / 4:3。

### Symbolic stack

多个象征物（钥匙、刀、面具、月亮、电话、唱片等）垂直堆叠成 totem，每个物件之间留出小缝隙，可以加入手写编号 `01 / 02 / 03` 或拉丁罗马数字。**推荐 2:3 / 3:4 竖版**。

### Geometric framing

主体被一个圆、拱形、三角形或六边形几何窗口包住，窗口外是另一种主色填充，halftone 在交界处过渡。**推荐 1:1 / 4:3**，适合书评、文化评论封面。

### Editorial split

画面用对角、上下或左右色块切成两半（一边 Color A，一边 Color B），文字与图分占两侧或互相穿插，标题可以横跨切线。**16:9 / 3:4 都可以**，最适合杂志感专栏封面。

## 工作流

1. 先看用户消息里有没有标题、海报类型、配色或构图偏好。能从上下文里读出的不要再问。
2. 用一次 `AskUserQuestion` 把还缺的关键决策一次性问完，不要分多轮。
3. 拿到回答后写 prompt，调一次 `GenImage`；任务进入审批，等用户审批后系统会继续。
4. 用户给反馈后再做 follow-up：换配色、换构图、增减剪影、加副标题、换语言。

不要做内部 confirmation gate；`GenImage` 本身就是审批入口。

## AskUserQuestion 模板

下面是一份合法 JSON，可直接作为 `AskUserQuestion` 的 `questions` 参数（题目顺序保持不变，标题和正文意象走每题底部的自由备注，不要再单独造一题让用户填长文本）。

```json
{
  "questions": [
    {
      "question": "这张海报是哪种类型？",
      "header": "类型",
      "multi_select": false,
      "options": [
        { "label": "电影海报", "description": "影评 / 经典电影致敬 / 新片宣传感" },
        { "label": "书评封面", "description": "书籍封面 / 文学专题 / 阅读专栏" },
        { "label": "演唱会海报", "description": "音乐节 / 专辑视觉 / live 限定海报" },
        { "label": "文化评论", "description": "杂志专栏 / 社会评论 / 时事文化封面" },
        { "label": "通用艺术海报", "description": "限定艺术印刷 / 展览主视觉" }
      ]
    },
    {
      "question": "构图模板偏好？",
      "header": "构图",
      "multi_select": false,
      "options": [
        { "label": "Hero silhouette", "description": "单角色 / 单物体大剪影 + 标题压底（电影感）" },
        { "label": "Symbolic stack", "description": "多个象征物垂直堆叠 + 编号（清单式）" },
        { "label": "Geometric framing", "description": "圆 / 拱 / 三角形几何窗口包住主体（封面感）" },
        { "label": "Editorial split", "description": "左右或上下色块切分 + 文字图分占（杂志感）" }
      ]
    },
    {
      "question": "duotone 配色？",
      "header": "配色",
      "multi_select": false,
      "options": [
        { "label": "Orange + Teal", "description": "cinematic, 动作 / 西部（推荐）" },
        { "label": "Red + Cream", "description": "bold, classic, 经典电影" },
        { "label": "Blue + Gold", "description": "premium, 颁奖季 / 文学" },
        { "label": "Purple + Green", "description": "futuristic, 科幻 / 赛博" },
        { "label": "Magenta + Cyan", "description": "vibrant, pop, 演唱会" },
        { "label": "Crimson + Navy", "description": "dramatic, noir, 黑色电影" }
      ]
    },
    {
      "question": "画面比例？",
      "header": "比例",
      "multi_select": false,
      "options": [
        { "label": "2.35:1", "description": "宽幅电影海报（推荐）" },
        { "label": "16:9", "description": "横版杂志 / 宣传位" },
        { "label": "4:3", "description": "经典书评 / 评论封面" },
        { "label": "3:4", "description": "竖版海报 / 书封感" },
        { "label": "1:1", "description": "方版社交分发" }
      ]
    },
    {
      "question": "是否包含人物剪影？",
      "header": "人物",
      "multi_select": false,
      "options": [
        { "label": "包含", "description": "stylized silhouette only，禁止真实面孔" },
        { "label": "不包含", "description": "只用物件 / 符号 / 几何元素" }
      ]
    },
    {
      "question": "标题语言？",
      "header": "语言",
      "multi_select": false,
      "options": [
        { "label": "中文", "description": "粗黑 / 粗宋 / 复古海报体" },
        { "label": "English", "description": "bold condensed sans-serif / Art Deco" },
        { "label": "日本語", "description": "明朝粗体 / Showa 复古字" }
      ]
    }
  ]
}
```

提交后，若用户在某题的备注里贴了完整标题、副标题或关键意象，把它原样塞进 prompt，不要改写。

## Prompt 拼装模板

写 prompt 时按下面骨架填充。具体值用用户答案替换 `{{...}}` 占位，并把不需要的小节直接删掉。

```markdown
Create a screen-print style editorial poster for {{poster_type}}: {{title_text_verbatim}}.

## Subject and symbolism

{{user_provided_subject}}. Render the main subject as a {{stylized_silhouette_or_symbolic_object}}. Build the iconography around: {{key_metaphors_from_user}}.

## Composition — {{template_name}}

{{template_description_one_paragraph}}

- Foreground: {{fg_silhouette_or_object}}
- Mid: {{halftone_layer_or_secondary_silhouette}}
- Background: solid color field with paper grain texture
- Use negative space as an active compositional element; figure and ground may invert.

## Color — duotone {{palette_name}}

Two-color screen print using exactly:

- Color A: {{hexA}}
- Color B: {{hexB}}
- Background: {{bg_hex}}
- Tiny accent (≤ 5% area): {{accent_hex}}
  Stark two-color separation across the entire composition. Halftone dot transitions between Color A and Color B. No third color beyond the small accent.

## Texture and print feel

Halftone dot patterns inside color fills, varying density to imply form. Slight color layer misregistration (2–4 px offset) on one of the two inks. Paper grain underneath. Risograph / silkscreen imperfections — ink spread, dot gain, faint overprint where the two inks cross. No gradients, no soft glow, no smooth shading.

## Typography

{{typography_rules_for_chosen_language}} Title text is integrated into the composition (cropped by silhouettes, locked to a baseline strip, or embedded inside a geometric frame), not floating on top.

- Title (verbatim): "{{title_text_verbatim}}"
- Subtitle (optional, verbatim): "{{subtitle_text_verbatim_or_omit}}"
- Tiny credit / tagline strip (optional): "{{credit_strip_or_omit}}"

## Constraints

- No realistic human faces, no photorealistic skin or eyes; characters are stylized silhouettes only.
- No photorealism, no 3D render look, no smooth gradients, no lens flare, no bokeh.
- Limit to two main inks plus background and a tiny accent; do not introduce a fourth main color.
- Do not render hex codes, palette names, the words "duotone" / "halftone" / "screen-print", or any metadata text inside the image.
- No watermarks, no signatures, no QR codes unless explicitly requested.
- Keep the background clean — no busy patterns competing with the subject.
```

中文标题在 typography 段落里追加：`Use a heavy condensed Chinese poster face (粗黑 or 复古粗宋), tight tracking, large title size; integrate the characters into the composition rather than overlaying them.`

## GenImage 调用

默认使用 `gpt-image-2`，因为它对海报标题文字渲染最稳，错字率最低。复杂剪影构图但没有大标题时也可用 `nano-banana-pro`。`nano-banana-2` 留给快速预览。

`reference_image_ids` 默认空数组。只有当用户提供了风格参考图、电影定妆照、专辑封面或现有海报时才填入；填入时同时在 prompt 文本里用 "MUST" 段落点名要保留的元素，否则模型常忽略 ref。

```json
{
  "image_id": "movie_poster_dune",
  "prompt": "<上面拼装好的完整 prompt>",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "2.35:1",
  "n": 1,
  "reference_image_ids": []
}
```

`image_id` 用语义命名（`book_cover_solitude`、`concert_poster_radiohead_2026`），不要用 uuid 或随手编号。

## 参考图处理

当用户给了参考图（电影定妆照、书封、演唱会现场照、风格海报）并把对应 image id 放进 `reference_image_ids`，必须在 prompt 里追加一段 MUST 指令，否则模型常常只从 ref 借颜色而丢掉关键标志：

```markdown
## Reference image directives

MUST preserve the following from the reference image and translate them into screen-print silhouette form:

- {{character_silhouette_traits — 头型 / 发型 / 标志性配饰 / 服装轮廓}}
- {{signature_objects_or_symbols — 武器 / 乐器 / 招牌道具}}
- {{color_mapping — ref 中的主色映射到 Color A，次色映射到 Color B}}

Do NOT copy the reference's photographic shading, gradients, or facial details. Re-render everything as flat duotone color blocks with halftone texture.
```

## 常见反例（写 prompt 时主动规避）

- photorealistic 海报、写实人脸、皮肤光影 —— 不是产品摄影。
- 色块带 gradient、soft glow、霓虹外发光 —— screen-print 是 hard edge。
- 主色超过 3 种 —— duotone 内核就是两色，第 3 色只能是极小面积 accent。
- 复杂背景纹理（瓷砖图案、密集插画、星空粒子）抢戏 —— 背景应是纯色 + 纸纹。
- 在画面里渲染 hex 色号、`duotone`、`halftone`、`screen-print` 等元数据词或 palette 标签。
- 中文标题用细体黑体或圆体 —— 海报标题需要粗压缩字面，引导模型用粗黑 / 粗宋 / 复古海报体。
- 多人物挤在画面里 —— 优先用 1 个主剪影 + 1 到 2 个小符号，不要堆角色合影。

## Follow-up 路径

用户首张图出来后常见调整方向，按需直接重新调用 `GenImage` 并复用 `image_id` 前缀（让序号自增）：

- **换配色**：把 prompt 里的 hex 替换为另一套 duotone，其它不变。
- **换构图模板**：在 Composition 段切到另一个模板段落，剪影 / 物件可以保留。
- **增减 silhouette**：从 Hero 切到 Symbolic stack 时，把单剪影展开成 3 到 5 个象征物的 totem。
- **加副标题 / tagline**：在 Typography 段补 `Subtitle` 或 `credit strip` 字段，注意保持文字嵌入构图。
- **切换语言**：替换 typography 规则段并更新 `Title (verbatim)` 文本，其它结构不动。
- **加 noir 感**：在 Texture 段加 `heavier dot gain, slightly darker overall key, deeper shadows in halftone`，并优先选 Crimson + Navy 或 Red + Cream 套。
