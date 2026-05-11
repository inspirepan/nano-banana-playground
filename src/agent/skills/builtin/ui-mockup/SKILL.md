---
name: ui-mockup
description: Generate polished UI mockup images for apps, websites, dashboards, landing pages, SaaS tools, mobile screens, live-commerce screens, and product interface concepts. Use when the user asks for UI mockup, app screen, website concept, dashboard visual, landing page image, 产品界面, 应用界面, 后台仪表盘, or 直播间界面. Do NOT use for production React code, wireframe-only planning, product photography, article covers, posters, or dense knowledge infographics.
icon: panels-top-left
preview_image: /skill-previews/ui-mockup.jpg
display_name:
  zh-CN: UI 界面图
  en: UI Mockup
display_description:
  zh-CN: App / 网站 / Dashboard / SaaS 界面概念图，像真实产品截图但用于视觉探索。
  en: App, website, dashboard, and SaaS interface concept images that look like shippable product mockups.
starter_examples:
  zh-CN:
    - AI 图片管理桌面 Dashboard，左侧图库，右侧成本面板
    - 移动端冥想 App 首页，柔和深色，今日练习和情绪记录
    - SaaS 数据看板概念图，紧凑工具感，表格和筛选器
  en:
    - AI image desktop dashboard, left gallery, right cost panel
    - mobile meditation app home, soft dark mode, practice and mood log
    - SaaS analytics dashboard, compact tool feel, table and filters
---

# UI Mockup

生成一张高完成度的 UI 界面概念图，用于产品视觉探索、落地页配图、功能概念展示。它输出的是**图片中的界面 mockup**，不是可运行 React 代码。

## 适用场景

- App / Web / SaaS / Dashboard / CRM / AI 工具界面概念图
- Landing page hero 里的产品截图 mockup
- 电商直播间、数据看板、移动端工具、内容管理后台等界面视觉
- 用户想快速看一个产品功能的视觉方向

不适用：要写前端代码、要真实可交互原型、产品广告摄影、文章封面、电影海报、知识长图。

## 一次问齐

信息不足时，用一次 `AskUserQuestion` 收集：

1. 产品类型：mobile app / web app / dashboard / landing hero / live-commerce UI。
2. 核心功能：界面上最重要的 2-4 个模块。
3. 视觉风格：minimal / playful / enterprise / futuristic / editorial。
4. 设备框架：mobile phone / desktop browser / tablet / floating screens。
5. 比例：16:9、4:3、1:1、9:16。

## Prompt 骨架

```txt
Role: senior product designer and UI art director.
Goal: create one polished UI mockup image, visually plausible and shippable.

Product: [product/app type]
Primary screen: [screen name]
Core modules: [2-4 modules from user]
Device/framing: [desktop browser / mobile phone / tablet / floating screens]
Style: [minimal / playful / enterprise / futuristic / editorial]
Layout: strong grid, clear navigation, realistic spacing, consistent component system.
Visual details: cards, charts, lists, controls, empty states, status pills, subtle shadows.
Text: use only exact user-provided product/module labels; otherwise use abstract placeholder bars.
Constraints: no real brand logos, no tiny illegible walls of text, no broken UI, no random lorem ipsum, no watermark.
```

## 视觉原则

- UI 要像能被前端实现：对齐、间距、层级、组件一致。
- 不堆满屏幕。最多突出 2-4 个核心模块。
- 图中文字容易出错；除非用户给了原文，否则使用 placeholder bar / icon / chart shape。
- 如果用户其实要写代码，切到正常前端实现流程，不使用本 skill。
