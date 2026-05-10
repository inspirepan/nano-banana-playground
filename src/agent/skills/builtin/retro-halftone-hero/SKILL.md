---
name: retro-halftone-hero
description: Create premium retro halftone hero images, landscape campaign visuals, travel-poster style website headers, and high-end promotional posters from either a fresh scene prompt or an existing photo/image reference. Use whenever the user asks for retro halftone, vintage print texture, premium travel poster, CMYK dots, ink bleed, analog print, paper texture over a normal photo, or 高级复古半调、网点纹理、风景宣传图、海报质感、旅行海报、照片加半调质感. Strong visual core is clean cinematic base image plus selective halftone dots, subtle ink bleed, paper grain, premium negative space, and restrained color. Do NOT use for comic panels, dense infographics, UI mockups, product cutouts, screen-print duotone editorial posters with heavy typography, or cheap global filter effects.
icon: scan-line
preview_image: /skill-previews/retro-halftone-hero.jpg
display_name:
  zh-CN: 复古半调 Hero
  en: Retro Halftone Hero
display_description:
  zh-CN: 给风景照 / 宣传图叠加高级复古半调、纸纹和油墨质感。
  en: Premium retro halftone, paper grain, and ink texture for landscape hero visuals.
---

# Retro Halftone Hero

为风景照、网站 hero、旅行宣传图、品牌活动海报生成 **rich, premium retro halftone print feel**。视觉目标是“正常照片或干净插画上覆盖一层有控制的印刷质感”，不是把整张图粗暴套滤镜。

核心判断：

- 先要有一个构图漂亮、光线高级的 base image。
- halftone 只强化山体、树木、岩石、水面、地形、建筑肌理、阴影和中间调。
- 天空、留白、文字覆盖区保持干净渐变，最多有极轻纸纹，不要铺满粗网点。
- 质感来自分层：轻微纸纹、局部 CMYK / riso 网点、少量 ink bleed、柔和色彩错位，而不是噪点堆满。

## 何时触发

适用：

- 风景 / 旅行 / 户外品牌 / 酒店度假 / premium lifestyle hero 图。
- 用户说“照片加一层 halftone texture / retro print / vintage travel poster feel”。
- 已有图片需要二次风格化，但主体、构图、摄影感要保留。
- 需要宽幅宣传图、海报背景、网站首屏，有明显留白可放标题。

不适用：

- 影评 / 书评 / 演唱会这类重排版 screen-print 海报：优先用 `editorial-poster`。
- 信息图、知识卡片、PPT、UI 截图、产品白底图、漫画分镜。
- 想要完全写实照片且不要任何印刷质感。
- 需要大量可读文字的正式海报成品。

## 工作流选择

根据用户输入选择一种路径：

1. **已有图二次质感化**：用户提供 reference image / image_id / 历史图时，先用 `ReadImage` 理解画面；再用 `GenImage` 以该图为 `reference_image_ids`，执行 halftone texture pass。
2. **从零生成两步法（推荐）**：用户只给主题时，先生成 clean premium base image；等待生成完成后，再把第一张输出作为 reference，执行 halftone texture pass。两步法更像真实设计流程，能分别控制构图和质感。
3. **快速一张法**：用户明确只要一次出图或快速草稿时，把 base scene 与 halftone rules 写进同一个 prompt，但仍要求 selective halftone、clean sky、premium negative space。

不要在 `GenImage` 前额外做确认；`GenImage` 任务卡本身就是审批入口。

## 一次问齐

如果用户没有给够信息，用一次 `AskUserQuestion` 收集缺失维度。主题、具体地点、品牌语气、标题文案放在备注里，不要拆成多轮。

```json
{
  "questions": [
    {
      "question": "这张图主要用于哪里？",
      "header": "用途",
      "multi_select": false,
      "options": [
        { "label": "网站 Hero", "description": "宽幅首屏背景，天空 / 留白区适合放标题" },
        { "label": "旅行海报", "description": "复古目的地宣传图，构图更像 premium poster" },
        { "label": "活动视觉", "description": "品牌 campaign / launch / 户外活动 KV" },
        { "label": "照片改造", "description": "给已有照片加半调印刷质感，保留主体构图" }
      ]
    },
    {
      "question": "半调质感强度？",
      "header": "质感",
      "multi_select": false,
      "options": [
        { "label": "Subtle premium", "description": "克制细网点 + 轻纸纹，适合高级品牌（推荐）" },
        { "label": "Visible print", "description": "明显 CMYK / riso 网点，但不破坏画面" },
        { "label": "Aged poster", "description": "更强纸张旧化、油墨扩散、轻微错版" }
      ]
    },
    {
      "question": "画面构图偏好？",
      "header": "构图",
      "multi_select": false,
      "options": [
        { "label": "Clean sky hero", "description": "大面积干净天空 / 留白，适合叠文字（推荐）" },
        { "label": "Panoramic vista", "description": "宽幅远景，山谷 / 海岸 / 沙漠 / 森林层次" },
        { "label": "Poster frame", "description": "更像旅行海报，主体居中，边缘有纸张感" },
        { "label": "Photo preserve", "description": "尽量保留参考图构图，只改质感和色彩" }
      ]
    },
    {
      "question": "色彩气质？",
      "header": "配色",
      "multi_select": false,
      "options": [
        { "label": "Warm cream", "description": "奶油天空、金色高光、自然绿蓝，最 premium" },
        { "label": "Alpine cool", "description": "冷蓝远山、鼠尾草绿、少量暖金" },
        { "label": "Sunset amber", "description": "琥珀夕照、深绿阴影、复古旅行感" },
        { "label": "Muted editorial", "description": "低饱和杂志感，适合品牌宣传" }
      ]
    }
  ]
}
```

## Prompt 结构

优先写英文 prompt。Gemini / Nano Banana Pro 对结构化英文的风格控制更稳。

### A. Clean base image prompt

从零生成时，第一步只生成干净 base，不要先加重网点。

```txt
Create a premium cinematic landscape hero image for {{usage}}: {{scene_topic}}.

Composition: {{composition_choice}}. Wide balanced composition, strong foreground / midground / background separation, clear leading line toward the main landscape feature, elegant negative space for text overlay. If this is a website hero, reserve a huge clean upper sky area with smooth gradient and minimal clouds.

Scene details: {{specific_location_or_subject}}, natural scale, calm and refined mood, no people unless explicitly requested, no buildings unless explicitly requested.

Light and color: {{palette_choice}}. Soft atmospheric perspective, golden light touching important forms, muted natural greens and cool blues, warm cream near the horizon if sky is visible. Premium modern travel campaign look, visually minimal but detailed where it matters.

Rendering: polished photo-illustration / slightly painterly digital illustration look, sharp foreground details, smooth sky gradients, no text, no logo, no watermark.

Negative: no cheap filter look, no overprocessed HDR, no fog overload, no heavy darkness, no random typography, no sun disk unless requested, no people, no buildings.
```

推荐第一步参数：

```json
{
  "model": "nano-banana-pro",
  "resolution": "2K",
  "ratio": "16:9",
  "n": 1,
  "reference_image_ids": []
}
```

### B. Halftone texture pass prompt

第二步把 base image 或用户原图作为 `reference_image_ids`。这一步的 prompt 重点是“保留构图 + 添加选择性印刷质感”。

```txt
Transform the reference image into a premium retro halftone print hero visual while preserving the original composition, subject placement, camera angle, and main light direction.

Apply a refined vintage print treatment:
- Selective halftone dots only on textured forms: mountains, trees, rocks, terrain, water ripples, foliage, shadows, and midtone surfaces.
- Keep the upper sky / negative space mostly clean: smooth gradient, minimal clouds, very subtle paper grain only, no heavy dot pattern across the entire sky.
- Add subtle CMYK / riso-style dot structure with varied dot density following tonal values; dots should feel printed, not like digital noise.
- Add gentle ink bleed at high-contrast edges, tiny paper fibers, faint speckles, and mild color misregistration limited to 1-3 px.
- Preserve premium color harmony: {{palette_choice}}, muted natural greens, cool blues, warm cream highlights, golden light on important forms.

Art direction: nostalgic travel-poster aesthetic, rich premium feel, elegant editorial campaign background, calm refined mood, clean composition, lots of usable negative space for text overlay.

Constraints:
- Do not change the subject or composition.
- Do not cover the entire image with uniform dots.
- Do not make the sky gritty or dirty; sky stays airy and smooth.
- Do not add text, logos, stamps, watermarks, borders, labels, or fake poster titles unless explicitly requested.
- Avoid grunge overload, cheap photocopy filter, heavy darkness, harsh contrast, plastic digital noise, and muddy colors.
```

推荐第二步参数：

```json
{
  "model": "nano-banana-pro",
  "resolution": "4K",
  "ratio": "16:9",
  "n": 1,
  "reference_image_ids": ["{{base_or_user_image_id}}"]
}
```

4K 更利于解析细小网点；如果用户只是快速预览，可用 2K。

## 一张法 prompt 示例

当用户要快速生成，不走两步法时，用下面这种完整 prompt：

```txt
Wide cinematic mountain landscape illustration in a premium retro halftone print style, peaceful alpine valley with tall pine forests, rocky foreground, winding dirt path, majestic snow-capped mountain range in the center, balanced composition designed for a website hero section, huge clean upper sky area with soft gradient from pale warm cream near horizon to light blue above, minimal clouds, lots of negative space in the sky for text overlay.

Subtle vintage paper texture and refined print feel. Detailed halftone dots only on mountains, trees, rocks, terrain, foliage, and shadowed midtones — not across the entire sky. Smooth airy sky gradients with only faint paper grain. Soft atmospheric perspective, muted natural greens and cool blues, golden light touching mountain peaks, ultra clean composition, slightly painterly digital illustration look, nostalgic travel-poster aesthetic, sharp foreground details, calm elegant mood, panoramic wide-angle scene, highly detailed but visually minimal, rich premium feel.

Negative: no sun, no people, no buildings, no fog overload, no heavy darkness, no global halftone filter, no dirty sky, no text, no logo, no watermark.
```

## 参考图处理

当用户提供参考图：

1. 用 `ReadImage` 看清参考图的构图、光源、主体、需要保留的元素。
2. 在 prompt 里写明保留项：`MUST preserve composition, subject scale, horizon placement, light direction, and main color relationships from the reference.`
3. 如果用户给的是普通照片，只做第二步 texture pass。
4. 如果用户给的是风格参考而不是主体图，把它描述成 texture inspiration，不要把它放进主体保留项。

## 常见修改映射

| 用户反馈         | 修改方式                                                                              |
| ---------------- | ------------------------------------------------------------------------------------- |
| “太像滤镜了”     | 降低 uniform dots，强调 dots follow form and tonal values，增加干净区域               |
| “天空太脏”       | 明确 sky has smooth gradient only, paper grain under 5%, no visible halftone dots     |
| “不够复古”       | 增加 paper fibers、slight ink bleed、mild color misregistration、warm cream base      |
| “不够高级”       | 降低饱和度和对比度，减少破损，保留更多留白，使用 muted editorial palette              |
| “网点不明显”     | 从 Subtle premium 升到 Visible print，要求 dot density visible in terrain and shadows |
| “想更像旅行海报” | 居中远山 / 地标、清晰前中后景、warm cream sky、nostalgic poster composition           |

## 质量检查

生成或改图后检查：

- 构图是否仍然像 premium hero / campaign visual，而不是随机纹理实验。
- 天空和文字覆盖区是否足够干净。
- 网点是否跟随物体明暗和材质，而不是整张图等距铺满。
- 是否保留了参考图主体、光线方向和主要构图。
- 有没有多余文字、logo、水印、边框、脏污块或过重 grunge。
