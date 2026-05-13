---
name: flat-illustration
description: Generate layered 2.5D flat design illustrations with clean shapes, visible depth, cel-shaded planes, soft top-right lighting, balanced spacing, plain backgrounds, and restrained palettes. Use when the user asks for 扁平插画, flat illustration, layered vector illustration, Live2D-like flat character art, simple geometric character/object art, or cute clean icon-like scenes. Do NOT use for UI mockups, product ads, comics, dense infographics, cinematic scenes, realistic photography, logos, or text-heavy posters.
icon: shapes
preview_image: /skill-previews/flat-illustration.jpg
display_name:
  zh-CN: 扁平插画
  en: Flat Illustration
display_description:
  zh-CN: 有厚度和光影的 2.5D 扁平插画，适合人物、动物、物品和简单角色。
  en: Layered 2.5D flat illustrations with clean geometry, soft lighting, and visible depth.
starter_examples:
  zh-CN:
    - 窗边喝咖啡的橘猫，2.5D 扁平，奶油色背景
    - 黄色雨衣小机器人抱盆栽，干净几何，薄荷绿背景
    - 专注写代码的可爱角色，简洁桌面，小台灯
  en:
    - orange cat drinking coffee, layered flat style, cream background
    - tiny robot in yellow raincoat, clean geometry, mint background
    - focused coding character, simple desk, tiny lamp
---

# Flat Illustration

生成单张有层次的扁平设计插画：整体仍是干净几何、大色块和纯背景，但主体要像分层 2D 角色一样有厚度、接触阴影、分面光影和右上方光源。适合把人物、动物、植物、角色、小物件做成轻盈、可爱的 icon-like 插画。

## 适用场景

- 用户明确说“扁平插画 / flat illustration / layered vector illustration / Live2D-like”。
- 把一个主体画成干净、几何化、有光影层次的单张插画。
- 适合头像候选、文章配图、贴纸感小插画、产品空状态插画、简单角色展示。

不适用：真实摄影、复杂场景、漫画分镜、信息图、UI 界面、产品广告、电影感画面、品牌 logo 设计、需要大量可读文字的海报。

## 一次问齐

如果用户没有给够信息，用一次 `AskUserQuestion` 收集：

1. 主体：动物 / 人物 / 植物 / 物品 / IP 角色 / 抽象概念。
2. 背景色：beige / sand yellow / sky blue / soft gray / blush / mint 等纯色。
3. 两个主色：例如 cream + charcoal gray、sage green + terracotta、brick red + denim blue。
4. 姿态或动作：sitting calmly / jumping up / holding a wand / standing still。
5. 视角：front-facing / side-facing / three-quarter；动物和物品默认正面，动态角色可用侧面。
6. 光源：默认 slightly above and to the right；用户有参考图时按参考图方向。
7. 比例：默认 `3:2`；如果用户有明确用途再改成 `1:1`、`4:3`、`16:9` 等。

## Prompt 模板

调用 `GenImage` 时，按下面模板拼出完整 prompt，并把比例放在工具参数 `ratio` 里。

```txt
A layered 2.5D flat design illustration of a [subject], presented in a [front-facing / side-facing / three-quarter], minimalistic style. Set against a plain [background color], the artwork uses a soft palette of [color1], [color2], and [optional accent color]. Build the subject from overlapping rounded geometric shapes with visible depth: separated parts, contact shadows, simple cel-shaded planes, and subtle edge highlights. The light source comes from slightly above and to the right, creating brighter upper-right edges and muted lower-left shadow shapes. Clean balanced spacing, simple geometric charm, no text, no logo, no watermark.
```

推荐 `GenImage` 参数：

```json
{
  "prompt": "A layered 2.5D flat design illustration of a [subject], presented in a [front-facing / side-facing / three-quarter], minimalistic style. Set against a plain [background color], the artwork uses a soft palette of [color1], [color2], and [optional accent color]. Build the subject from overlapping rounded geometric shapes with visible depth: separated parts, contact shadows, simple cel-shaded planes, and subtle edge highlights. The light source comes from slightly above and to the right, creating brighter upper-right edges and muted lower-left shadow shapes. Clean balanced spacing, simple geometric charm, no text, no logo, no watermark.",
  "ratio": "3:2",
  "sample_count": 1
}
```

## 示例

```txt
A layered 2.5D flat design illustration of a cat sitting calmly, presented in a front-facing, minimalistic style. Set against a plain warm beige background, the artwork uses a soft palette of cream, warm gray, and charcoal gray. Build the cat from overlapping rounded geometric shapes with visible depth: separated ears, head, cheeks, chest, paws, and tail; contact shadows; simple cel-shaded planes; and subtle edge highlights. The light source comes from slightly above and to the right, creating brighter upper-right edges and muted lower-left shadow shapes. Clean balanced spacing, simple geometric charm, no text, no logo, no watermark.
```

```txt
A layered 2.5D flat design illustration of a cactus in a pot, presented in a front-facing, minimalistic style. Set against a plain sand yellow background, the artwork uses a soft palette of sage green, deep green, and terracotta. Build the cactus pads and pot from overlapping rounded geometric shapes with visible depth: contact shadows, simple cel-shaded planes, a clear pot rim and side planes, and subtle edge highlights. The light source comes from slightly above and to the right, creating brighter upper-right edges and muted lower-left shadow shapes. Clean balanced spacing, simple geometric charm, no text, no logo, no watermark.
```

```txt
A layered 2.5D flat design illustration of a cheerful jumping game character, presented in a side-facing, minimalistic style. Set against a plain sky blue background, the artwork uses a soft palette of brick red, denim blue, warm beige, and cream. Build the cap, face, gloves, shirt, overalls, arms, legs, and shoes from overlapping rounded geometric shapes with visible depth: separated parts, contact shadows, simple cel-shaded planes, and subtle edge highlights. The light source comes from slightly above and to the right, creating brighter upper-right edges and muted lower-left shadow shapes. Clean balanced spacing, playful geometric charm, no text, no logo, no watermark.
```

```txt
A layered 2.5D flat design illustration of a young wizard holding a wand, presented in a front-facing, minimalistic style. Set against a plain soft gray background, the artwork uses a soft palette of burgundy, warm beige, charcoal, and muted gold. Build the hair, glasses, robe, scarf, hands, wand, and shoes from overlapping rounded geometric shapes with visible depth: separated parts, contact shadows, simple cel-shaded planes, and subtle edge highlights. The light source comes from slightly above and to the right, creating brighter upper-right edges and muted lower-left shadow shapes. Clean balanced spacing, simple geometric charm, no text, no logo, no watermark.
```

## 视觉原则

- 主体占画面中心，轮廓清晰；动物和物品多用正面，动态人物可用侧面或三分之四视角。
- 使用大色块、圆角、简单几何形；光影也用清晰色块表达，不走写实纹理。
- 保留层次：分离部件、叠放色面、接触阴影、右上高光、左下暗面。
- 背景保持纯色或非常轻的明暗变化，不加复杂环境和透视空间。
- 调色以 2-3 个主色为核心，可加同色系明暗面来塑造厚度。
- 避免写实细节、文字、水印、复杂道具、过度装饰和强 3D 渲染感。
