---
name: product-ad-creative
description: Generate polished product advertising visuals / e-commerce main images / product hero posters from a product idea, reference image, or selling points. Use when the user asks for product ads, 电商主图, 商品海报, product hero, commercial product shot, skincare / perfume / food / electronics ad, or social product campaign visuals. Do NOT use for generic article covers, pure UI screenshots, comic panels, knowledge infographics, or poster art without a product.
icon: package
preview_image: /skill-previews/product-ad-creative.jpg
display_name:
  zh-CN: 产品广告图
  en: Product Ad Creative
display_description:
  zh-CN: 电商主图 / 商品海报 / 产品 hero，围绕产品、卖点、场景和版式生成商业广告图。
  en: Product ads, e-commerce main images, and product hero visuals built around product, benefit, scene, and layout.
---

# Product Ad Creative

为产品生成单张商业广告图：电商主图、商品海报、社媒广告、产品 hero visual。重点是**产品清晰可卖、卖点可读、场景服务产品**，不是纯艺术海报，也不是知识卡片。

## 适用场景

- 电商主图 / 商品详情首屏 / 商品海报
- 香水、护肤品、食品饮料、服装、鞋包、电子产品、家居小物等产品广告
- 用户上传产品参考图，要求换场景、加光影、做商业质感
- 用户给产品名和卖点，要求生成一张广告创意图

不适用：文章封面、电影海报、UI 截图、流程图、漫画分镜、没有明确产品主体的抽象视觉。

## 一次问齐

如果信息不足，用一次 `AskUserQuestion` 问完：

1. 产品类型与名称：产品是什么，是否有参考图。
2. 核心卖点：1-3 个真实卖点，不编造参数。
3. 场景：studio / lifestyle / nature / luxury / tech / miniature diorama。
4. 版式：clean hero / e-commerce board / social ad / detail callouts。
5. 比例：1:1、4:5、3:4、16:9。

如果用户已经给了产品图，把对应 image id 放进 `GenImage.reference_image_ids`，不要现造 image id。

## Prompt 骨架

把用户信息压成一个 prompt 后调用 `GenImage`：

```txt
Role: senior commercial product art director.
Goal: create one polished product advertising image.

Product: [product name/type]
Real selling points to show: [1-3 bullets from user only]
Format: [clean hero / e-commerce board / social ad / detail callouts]
Scene: [studio / lifestyle / nature / luxury / tech / miniature diorama]
Composition: product is the dominant focal point, sharp readable silhouette, generous negative space for headline and callouts.
Lighting: premium commercial lighting, controlled highlights, clean shadows.
Materials: describe product material and supporting props.
Text: use only exact user-provided brand/product/selling-point text; otherwise use abstract placeholder bars or no text.
Constraints: no fake certifications, no unverifiable claims, no real brand logos unless user supplied them, no clutter, no watermark.
```

## 视觉原则

- 产品主体要占画面 35-60%，边缘清晰，不能被装饰淹没。
- 背景和道具只能强化卖点：清爽、奢华、科技、天然、活力等。
- 文字少而准：标题 + 1-3 个 callout 足够；没有用户原文时不要让模型自由造广告语。
- 电商主图优先干净可信，少用夸张光效和过度 3D。
