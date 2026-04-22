import type { StylePreset } from './types'

// Source skill: ~/code/content-workspace/.agents/skills/editorial-sketch-art
// Three workflows kept as one chip each (Clean Light palette baked in).
// Each promptSnippet is structured with labeled sections so the augment LLM
// can distribute details into the right scheme fields
// (composition / style / colorPalette / lighting / constraints / avoid),
// per the augment system prompt's field-lock rules.
// IDs preserve the legacy `-clean-light` suffix so shared URLs keep working.

const CATEGORY = 'Editorial Sketch'

export const EDITORIAL_SKETCH_PRESETS: StylePreset[] = [
  {
    id: 'editorial-charcoal-clean-light',
    label: '炭笔速写',
    category: CATEGORY,
    description: '纯白底 · 黑炭笔 · 亮蓝 #0088FF 点缀 · 单主体编辑插画（博客 header / 概念插画 / 抽象理念）',
    promptSnippet:
      '画廊级极简炭笔建筑速写（charcoal architectural sketch），适合单一主体的编辑式插画——博客/文章 header、概念艺术、抽象理念的可视化。\n' +
      '【主体 subject】单一主体，形式之一：抽象概念被物化（如"站在十字路口的人"代表决策）、隐喻场景（如"数据流像风一样盘旋"代表信息过载）、孤立人物或物体（不画人群）、或建筑/几何形态（wireframe、结构、桥梁、路径等）。\n' +
      '【风格/媒介 style】charcoal architectural sketch，gestural hatching strokes（手势化排线），conte crayon shading（锥形蜡笔阴影），architectural rendering technique（建筑渲染技法），hand-drawn imperfections —— 线条略微不均、带纸面颗粒感，绝非数字化完美。\n' +
      '【构图 composition】16:9 editorial header 比例；单一主体居中或轻度偏移放置，可有向外发散的放射状/流线元素（radiating outward）；四周保留 generous whitespace；主体呈"漂浮"感（subject floating in space），无地面或明显透视。\n' +
      '【光影/情绪 lighting / mood】按具体主题调节：contemplative（沉思）/ urgent（紧迫）/ serene（宁静）/ hopeful 等；整体冷静、现代、tech-forward，保持编辑式克制，不要商业广告感。\n' +
      '【色板 color palette】pure white #FFFFFF background；black charcoal lines for main drawing（黑色炭笔作为主绘）；strategic bright blue #0088FF accents on key focal elements —— 亮蓝仅用在约 15-20% 的焦点元素（核心结构、视觉锚点），其余保持单色灰阶。\n' +
      '【约束 constraints】no borders, no fills, no gradients, no photographic elements, no text in image（不要渲染任何文字）, subject floating in space, 15-20% accent rule 严格执行, hand-drawn imperfections must be visible。\n' +
      '【避免 avoid】cream/yellow tones（奶油/黄色暖调）、warm tints、purple、busy backgrounds、digital perfection、cartoon or cute/kawaii style、decorative borders、3D rendering、photorealism、textures overlays。',
  },
  {
    id: 'editorial-split-clean-light',
    label: '分屏对比',
    category: CATEGORY,
    description: '纯白底 · 黑墨线分屏 · 蓝灰双色 · X vs Y 对比插画（含左右顶部标题）',
    promptSnippet:
      '分屏编辑对比插画（split-screen editorial comparison illustration），magazine-style 并排布局，适合 X vs Y、优劣对比、前后对比、两个对立概念。\n' +
      '【主体 subject】左右两个对立概念各有一个主要视觉隐喻 + 少量辅助元素。LEFT SIDE — 左侧概念的视觉隐喻、绘制风格、向外放射的元素；RIGHT SIDE — 右侧概念的视觉隐喻与元素，两侧自成一体。视觉隐喻应让核心差异在一眼内就看出来。\n' +
      '【风格/媒介 style】editorial hand-drawn illustration，bold black ink lines with flat color washes（粗黑墨线 + 平涂色块），magazine comparison layout，"architectural sketch meets editorial cartoon"，保留 hand-drawn feel 而非数字矢量完美。\n' +
      '【构图 composition】symmetric split screen（严格对称分屏）；正中一条 bold vertical black line 将画面切成等宽左右两半（divider is structural, always present）；mirror composition，每一半 self-contained；左右视觉重量均衡，任一侧不得喧宾夺主；每侧一个 primary visual element 加少量 supporting details。\n' +
      '【画中文字 text in image（verbatim）】顶部左右两侧各放一个醒目大写标题——左侧 "[LEFT_LABEL]"，右侧 "[RIGHT_LABEL]"（具体文本由用户主提示词给出，必须逐字渲染、字体大而粗），标签是构图中不可省略的一部分。\n' +
      '【光影/情绪 lighting / mood】intellectual、analytical、neutral comparison；两侧情绪保持对等、客观，不要刻意贬低其中一侧。\n' +
      '【色板 color palette】pure white #FFFFFF background；black lines；LEFT side uses bright blue #0088FF flat wash for 该侧概念元素（代表更现代/主角的一侧）；RIGHT side uses darker blue-gray #475569 for 对应元素；蓝色强调色落在主导侧。\n' +
      '【约束 constraints】hand-drawn feel（not digital perfection）、flat color only（no gradients）、balanced composition so neither side dominates、editorial quality、divider line always present、labels always present and legible。\n' +
      '【避免 avoid】cream/yellow tones、purple、photorealistic elements、3D rendering、cute cartoon style、busy backgrounds、decorative borders、gradient fills、非平涂色块。',
  },
  {
    id: 'editorial-excalidraw-clean-light',
    label: 'Excalidraw 图表',
    category: CATEGORY,
    description: '白板感 · 黑手绘线 · 蓝色强调 · 架构/流程/Pipeline 图（含标题与节点标签）',
    promptSnippet:
      'Excalidraw 风格手绘技术架构/流程/Pipeline 图（clean Excalidraw-style hand-drawn technical architecture diagram），like an architect sketching on a whiteboard —— informal but professional，非卡通、非完美矢量。\n' +
      '【主体 subject】技术架构/数据流/pipeline 示意图，包含清晰的组件方框（component boxes）与 directional arrows；关键组件可能为：LLM、database、core processor、retriever、embedding、vector store、orchestrator 等；数据库统一用 cylinder（圆柱体）表示。\n' +
      '【风格/媒介 style】Excalidraw whiteboard sketch style，hand-drawn slightly wobbly rectangles and arrows（方框略歪、箭头略带手势弧度），NOT digitally perfect，text looks handwritten，clean and readable。\n' +
      '【构图 composition】主干流向单向明确：left-to-right（横向）或 top-to-bottom（纵向）选其一，不得混用；标题 top-left aligned，采用手写体；arrows 指示数据/控制流向；branch flows（支流）与主管道 clearly separated；组件数量控制在 8-10 个以内以保证可读；方框之间间距均衡、不密集堆叠。\n' +
      '【画中文字 text in image（verbatim）】标题（top-left）与每个方框的 label 均需逐字渲染——标题文本与所有组件 label 的字面内容由用户主提示词给出；手写体风格但可读性第一。\n' +
      '【光影/情绪 lighting / mood】professional、approachable、educational；像教学白板或 onboarding 文档里的那种架构图。\n' +
      '【色板 color palette】pure white #FFFFFF background（像干净白板）；black hand-drawn outlines for boxes and arrows；key component boxes 用 bright blue #0088FF fill（关键节点）；secondary boxes 用 light gray #E5E7EB fill；primary data flow arrows 为蓝色；次级 arrow 为黑色。\n' +
      '【约束 constraints】Excalidraw hand-drawn aesthetic（绝不可以是完美矢量）、boxes slightly uneven、arrows slightly curved by hand、text handwritten feel、no decorative elements、no textures、no gradients、database as cylinder、max ≈ 8-10 boxes。\n' +
      '【避免 avoid】cream/yellow tones、purple、warm tints、perfect geometric shapes、corporate infographic style、glossy 3D、photorealistic elements、overly colorful fills、杂乱箭头交叉。',
  },
]
