---
name: comic-strip
description: Multi-panel comic strip and storyboard generator. Use when the user wants to turn a story, joke, dialogue, tutorial bit, or short scene into a comic strip, manga panels, story panels, graphic novel page, storyboard, 漫画, 分镜, 四格漫画, 故事板, 短漫. Supports two output modes — single-sheet (one image with 2/3/4/6 panels) or multi-image (N sequential images linked by an anchor reference). Do not use for single cover art, infographics, posters, or single illustrations.
icon: book-open
preview_image: /skill-previews/comic-strip.jpg
display_name:
  zh-CN: 多格漫画
  en: Comic Strip
display_description:
  zh-CN: 多格漫画 / 分镜故事，single-sheet 一图多格或 multi-image 多张连贯。
  en: Multi-panel comic strips and storyboards in single-sheet or multi-image mode.
starter_examples:
  zh-CN:
    - 程序员修 bug 四格漫画，黑白网点，结尾反转
    - 猫闯机器人实验室六格分镜，彩色冒险，角色一致
    - 第一次用新相机三格短漫，轻松生活，台词简短
  en:
    - developer bug fixing comic, black and white, twist ending
    - cat in robot lab storyboard, colorful adventure, consistent character
    - first camera slice comic, lighthearted mood, short dialogue
---

# Comic Strip / 多格漫画

把一段故事、段子、对白或教学桥段,切成 N 格连贯漫画。两种产出形态二选一,角色一致性是最高优先级。

## 概述

- **single-sheet**:一张图里画 2/3/4/6 格,推荐 ratio `1:1` 或 `3:4`,`GenImage` 调用 1 次。适合短笑话、四格段子、单页节奏可控的故事。
- **multi-image**:每张一格,共 N 张,推荐 ratio `1:1`,调用 `GenImage` N 次。**第 1 张完成后,把它的 image_id 放进后续每张的 `reference_image_ids`**,这是保持角色一致性最有效的手段。适合 4-8 格、需要每格独立放大、或需要逐张编辑重画的场景。

先用 `AskUserQuestion` 让用户选模式;不要替用户决定。模型默认 `nano-banana-pro`(角色一致性 + 大图细节最好);**对白多 / 必须精准呈现文字时切到 `gpt-image-2`**;`nano-banana-2` 仅在 pro 不可用时备选。

## 风格(4 选 1)

色号仅用于引导模型配色,**禁止把色号、风格名、role 标签作为画面文字渲染**。

### manga-bw — 黑白漫画

日式黑白漫画。强对比、粗轮廓、screen-tone 网点纸表现阴影、动作线 (speed lines) 表现冲击。背景纯白,人物有清晰轮廓和留白。

- 背景 `#FFFFFF`,主线 `#0A0A0A`,中灰 `#9CA3AF`(网点 / 中间调)。
- 适合段子、生活吐槽、传统 manga 节奏。

### flat-color — 平涂矢量漫画

干净矢量风,圆润描线,平涂大色块,无渐变无网点。童话、科普、教学桥段最稳。

- 背景 warm cream `#F5F0E8`,主色块橙 `#ED8936` / 软蓝 `#A8D8EA` / 软绿 `#B5E5CF`,描线 `#2D2D2D`。
- 适合儿童向、说明性内容、温和叙事。

### american-comic — 美式漫画

粗黑边 + halftone 半色调 + 饱和原色 + 拟声词 (onomatopoeia, 如 "BAM!" / "POW!")。动作场面、超英、夸张表情最有戏。

- 红 `#EF4444` / 蓝 `#3B82F6` / 黄 `#FACC15`,描边 `#0A0A0A`。
- **维持平涂 + halftone**,不要大量渐变;不然会失去美漫识别度。

### watercolor-storybook — 水彩绘本

软水彩笔触、色边自然晕开、大量留白、抒情节奏。绘本、童话、温柔记忆段适用。

- 背景 warm cream `#F5F0E8`,色软桃 `#FED7AA` / 软绿 `#9AE6B4` / 软蓝 `#BEE3F8`,主色 `#744210`。
- 不要用粗黑描线;边线用色铅笔感的细线。

## 角色一致性(关键)

多格漫画**最常见的失败**是同一角色每格脸不一样、衣服不一样、发色不一样。两条规则一起用:

1. **明确的角色描述写进每一格 prompt**。在 `AskUserQuestion` 里让用户写每个角色的外观:发型 / 发色 / 衣着 / 配饰 / 体型 / 标志色 / 表情习惯。把这段描述**完整粘**进每一格(single-sheet 是同一段大 prompt 里复述一次)或每一张(multi-image 是每张 prompt 里都复述一遍)。
2. **multi-image 模式必须用 anchor chain**。第 1 张 `panel_1` 不传 `reference_image_ids`,正常生成;第 2..N 张全部把 `panel_1` 的真实 image_id 加到 `reference_image_ids`(不是 `panel_2` 链 `panel_3`,**永远以 `panel_1` 为锚**),并在 prompt 末尾追加:
   > Maintain character likeness, costume, hairstyle, and color palette from the reference image. Same comic style, same line weight.

**重要**:必须等 `panel_1` 工具结果回来、拿到真实保存 ID 后,再发 `panel_2`;不要在 `panel_1` 还没完成时就把 `["panel_1"]` 当成现成 ID 一次性把 N 个任务全推出去,真实 ID 可能是 `panel_1` 也可能是 `panel_1_2`(被规范化或冲突重命名)。

single-sheet 模式不需要 anchor chain,因为所有格在同一张画布里,模型天然会维持一致;但角色描述还是要在 prompt 里写一次。

## 分镜节奏(三种模板)

### setup → twist → punchline(3 格,段子 / 短笑话)

节奏紧凑,第 3 格是反差点。

1. setup:[场景描述,正常进入,铺设期望]
2. twist:[出现意外、误会或转折]
3. punchline:[反差落点,可以是表情特写或一句关键对白]

### setup → conflict → climax → resolution(4 格,经典四格 / 教学例子)

最稳的故事结构,适合四格漫画和教学桥段。

1. setup:[人物 + 场景 + 当前状态]
2. conflict:[出现问题或挑战]
3. climax:[问题被推到顶点,角色情绪最强]
4. resolution:[解决、领悟、或荒诞收束]

### opening → 5×progression → closing(6-8 格,短漫故事)

留出推进空间,适合 multi-image 模式。

1. opening:[人物登场 + 世界设定,wide shot]
   2-6. progression:[每格推进一步,景别交替 wide / medium / close-up,避免连续 5 格全是中景]
   7-8. closing:[情绪落点 + 视觉收束,可以呼应 opening]

## AskUserQuestion(一次问完)

故事大意单独问一题让用户写;后面六题用 options + 备注,默认值已标 \*。

```json
{
  "questions": [
    {
      "question": "这格漫画讲什么?简单写一两句故事大意 / 段子内容,以及希望出现的关键对白。",
      "header": "故事大意",
      "options": [{ "label": "我写在备注里", "description": "在下方备注写清楚情节、关键台词、想要的笑点或情绪" }],
      "multi_select": false
    },
    {
      "question": "想要哪种产出形态?",
      "header": "输出模式",
      "options": [
        {
          "label": "single-sheet 一张多格 *",
          "description": "一张图里画 2/3/4 格,整体性强、生成一次,适合短段子和四格"
        },
        { "label": "multi-image 多张连贯", "description": "每张一格、N 张连贯,适合长一些的故事或要逐张放大编辑" }
      ],
      "multi_select": false
    },
    {
      "question": "要几格?",
      "header": "格数",
      "options": [
        { "label": "2 格", "description": "对比 / 反差,极简" },
        { "label": "3 格", "description": "setup → twist → punchline,段子最稳" },
        { "label": "4 格 *", "description": "起承转合,经典四格" },
        { "label": "6 格", "description": "短漫,有推进空间(multi-image 推荐)" },
        { "label": "8 格", "description": "更完整的故事,需要耐心(仅 multi-image)" }
      ],
      "multi_select": false
    },
    {
      "question": "选什么风格?",
      "header": "风格",
      "options": [
        { "label": "manga-bw", "description": "日式黑白 + 网点 + 速度线,段子和生活吐槽很对味" },
        { "label": "flat-color *", "description": "平涂矢量 + 暖底,科普 / 童话 / 教学最稳" },
        { "label": "american-comic", "description": "粗边 + halftone + 拟声词,动作和夸张表情最有戏" },
        { "label": "watercolor-storybook", "description": "软水彩 + 大留白,绘本和抒情段落适用" }
      ],
      "multi_select": false
    },
    {
      "question": "主要角色长什么样?每个角色一行,写发型 / 发色 / 衣着 / 配饰 / 体型 / 标志色。",
      "header": "角色外观",
      "options": [
        { "label": "我写在备注里", "description": "示例:小林 — 短黑发 / 圆框眼镜 / 灰色连帽卫衣 / 瘦高 / 标志蓝围巾" }
      ],
      "multi_select": false
    },
    {
      "question": "要不要对白气泡?",
      "header": "对白",
      "options": [
        { "label": "无对白纯画面 *", "description": "靠画面和表情叙事,模型最稳" },
        { "label": "有对白气泡", "description": "气泡内容必须由你在备注里精确写出,模型选 gpt-image-2 文字最准" }
      ],
      "multi_select": false
    },
    {
      "question": "画面比例?",
      "header": "比例",
      "options": [
        { "label": "1:1 *", "description": "single-sheet 2x2 / multi-image 默认,正方稳定" },
        { "label": "3:4", "description": "single-sheet 1x3 或 3 格竖排,书页感" },
        { "label": "9:16", "description": "竖版长漫,multi-image 拼成卷轴" },
        { "label": "4:3", "description": "横向 2x2 或宽幅四格" }
      ],
      "multi_select": false
    },
    {
      "question": "首格要不要放短标题?",
      "header": "标题",
      "options": [
        { "label": "不要 *", "description": "干净进画面" },
        { "label": "短标题叠在头格", "description": "标题文字写在备注里,不超过 8 字 / 12 char" }
      ],
      "multi_select": false
    }
  ]
}
```

## prompt 拼装模板

### single-sheet(一段大 prompt 描述整张)

```
Create a [N]-panel [style] comic strip in a single image.
Layout: [N panels in 2x2 / 1x3 / 1x4 grid] with thin black gutters between panels.
Aspect ratio: [ratio]

Characters (must stay visually identical across all panels):
- [Character A name]: [完整外观描述,从用户输入抄过来]
- [Character B name]: [完整外观描述]

Panels (left-to-right, top-to-bottom):
1. [场景 + 角色动作 + 表情 + 镜头景别(wide / medium / close-up)]
2. [...]
N. [...]

Style: [按所选 style 写细节 — 线条 / 平涂 / halftone / 水彩;参考色:背景 #..., 主色 #..., 描线 #...]
Speech bubbles: [No] 或 [Yes — 内容用所选语言精确给出,例如:Panel 2 — 角色A: "今天我要早睡"]
Title: [None] 或 [短标题文本叠在 panel 1 顶部]

Constraints: maintain consistent character design (hair, outfit, color) across all panels; do not render hex codes, palette names, or style labels as visible text in the image; no realistic 3D rendering; no photorealistic faces — keep stylized comic likeness.
```

### multi-image(每张独立 prompt + anchor chain)

**第 1 张 `panel_1`**(无 reference_image_ids):

```
Single comic panel, [style], aspect ratio [ratio].
This is panel 1 of [N] in a sequential story.

Characters:
- [Character A]: [完整外观]
- [Character B]: [完整外观]

Scene: [opening scene 描述,景别 wide,确立人物位置 / 服装 / 环境]

Style: [风格细节 + 参考色]
Speech bubbles: [No / Yes — 精确文字]
Constraints: stylized comic, no photorealism, do not render hex codes or labels.
```

**第 2..N 张**(把 `panel_1` 的真实 image_id 放进 `reference_image_ids`):

```
Single comic panel, [style], aspect ratio [ratio].
This is panel [k] of [N] in the same sequential story.

Characters (same as reference image):
- [Character A]: [外观再写一遍]
- [Character B]: [外观再写一遍]

Scene: [当前格场景,景别 medium / close-up 等,与上一格做节奏对比]

Style: [同 panel 1]
Speech bubbles: [...]
Maintain character likeness, costume, hairstyle, and color palette from the reference image. Same comic style, same line weight, same panel border treatment.
Constraints: stylized comic, no photorealism.
```

> 真实 image_id 在 `panel_1` 完成后由工具结果回传(可能是 `panel_1` 也可能是 `panel_1_2`)。**等 `panel_1` 工具结果回来再发 `panel_2`**,把回传的真实 ID 填进 `reference_image_ids`,不要预填猜测值。

## 对白气泡

- 圆角白底 + 黑细边 + 锥形 tail 指向说话人。
- 字体:clean sans-serif(中文用粗黑 / Noto Sans CJK Bold),气泡内文字居中。
- **每格不超过 12 个汉字 / 20 char**,超长就拆成 2 个气泡或拆成两格。
- 气泡内容必须由用户在 outline / `AskUserQuestion` 备注里精确写出;**不要让模型自己编对白**,会出现错别字、错语气、不连贯。
- 对白多的场景,模型切换为 `gpt-image-2`(文字渲染最稳);纯无对白纯画面时维持 `nano-banana-pro`。

## GenImage 调用示例

### 示例 1:single-sheet 4 格,无对白,nano-banana-pro

```json
{
  "image_id": "comic_morning_routine",
  "prompt": "Create a 4-panel flat-color comic strip in a single image.\nLayout: 4 panels in 2x2 grid with thin black gutters between panels.\nAspect ratio: 1:1\n\nCharacters (must stay visually identical across all panels):\n- 小林: 短黑发, 圆框眼镜, 灰色连帽卫衣, 瘦高身材, 标志蓝围巾\n\nPanels (left-to-right, top-to-bottom):\n1. wide shot — 小林躺床上, 闹钟响, 表情困倦\n2. medium — 小林坐起, 揉眼睛, 看向闹钟\n3. close-up — 闹钟显示 8:55, 小林瞳孔放大\n4. wide shot — 小林边穿外套边冲出门, 蓝围巾飘起\n\nStyle: clean vector comic, flat color blocks no gradients, rounded line work; warm cream background #F5F0E8, accent orange #ED8936, soft blue #A8D8EA, line color #2D2D2D.\nSpeech bubbles: No\nTitle: None\n\nConstraints: maintain consistent character design across all panels; do not render hex codes or palette names as visible text; no photorealistic rendering.",
  "model": "nano-banana-pro",
  "resolution": "2K",
  "ratio": "1:1",
  "sample_count": 1,
  "reference_image_ids": []
}
```

### 示例 2:multi-image 第 2 张,有对白,gpt-image-2

`panel_1` 已生成,工具结果返回真实 ID `panel_1`。现在发 `panel_2`:

```json
{
  "image_id": "panel_2",
  "prompt": "Single comic panel, manga-bw style, aspect ratio 1:1.\nThis is panel 2 of 4 in the same sequential story.\n\nCharacters (same as reference image):\n- 小林: 短黑发, 圆框眼镜, 灰色连帽卫衣, 瘦高身材, 标志蓝围巾\n\nScene: medium shot — 小林站在公司门口, 看到门已锁, 表情震惊, 速度线从背景汇聚到他脸上\n\nStyle: black and white manga, screen-tone halftone for shadows, bold outline, speed lines for impact; background #FFFFFF, line #0A0A0A, mid-grey tone #9CA3AF.\nSpeech bubbles: Yes — 小林头顶气泡: \"啊?!今天周六?\"\nMaintain character likeness, costume, hairstyle, and color palette from the reference image. Same comic style, same line weight, same panel border treatment.\nConstraints: stylized comic, no photorealism, do not render hex codes or labels.",
  "model": "gpt-image-2",
  "resolution": "2K",
  "ratio": "1:1",
  "sample_count": 1,
  "reference_image_ids": ["panel_1"]
}
```

> `reference_image_ids` 里的 `"panel_1"` 必须是 `panel_1` 工具结果回传的真实保存 ID。如果工具结果显示真实 ID 是 `panel_1_2`(被冲突重命名),就填 `["panel_1_2"]`。

## 常见反例

- **不要让模型出 photorealistic / 3D 渲染**。漫画就是漫画,写明 stylized comic / no photorealism。
- **不要在 multi-image 模式下不传 anchor**——必丢角色一致性,等于白做。
- **不要把 N 格压成 `sample_count: N` 一次出 N 张**。`GenImage` 的 `sample_count` 是同一 prompt 的并行候选,不会给你连贯系列;multi-image 必须分 N 次调用,按 anchor chain 顺序。
- **不要让 `panel_2`/`panel_3` 互相做 anchor**。永远以 `panel_1` 作为锚点,链式漂移会把角色越画越偏。
- **不要让对白超出气泡 / 跨页 / 字号过小**。一格 ≤ 12 汉字,超长拆气泡或拆格。
- **不要把"风格名 / 漫画类型 / 色号"作为画面文字渲染**。这是引导词,不是要画上去的内容。
- **不要让模型一次性发 6 张请求**。multi-image 必须按 anchor chain 顺序:发 1 → 等 1 完成 → 发 2 → 等 2 完成 → ...,确保每张都能拿到稳定 anchor 引用。
- **american-comic 风格里不要用大量渐变**。维持平涂 + halftone,渐变会让美漫失去识别度。
- **不要让模型自己编对白**。气泡文字必须由用户提供,模型只负责画。

## follow-up

用户在第一轮产出后常见的追加请求,直接重新调用 `GenImage` 处理:

- **重画第 N 格**:single-sheet 模式重画整张(因为 N 格在同一画布);multi-image 模式只重画那一张,`reference_image_ids` 仍指向 `panel_1`,prompt 把目标格场景重写。
- **改对白**:multi-image 直接改对应 panel 的 prompt 重画一张;single-sheet 重画整张并在 prompt 里更新 speech bubbles 段。
- **换风格**:重新跑一遍流程,把所有 panel prompt 里的 Style 段替换成新风格;multi-image 必须连 `panel_1` 一起重画,旧 anchor 不能用。
- **加 / 减角色**:更新角色外观段,multi-image 必须连 `panel_1` 一起重画以建立新的 anchor。
- **换语言**:对白翻译后重画(气泡内文字属于画面);其他描述性 prompt 不影响画面。
