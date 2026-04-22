import type { StylePreset } from './types'

// Source skill: ~/code/test/2026-02-26-JimLiu-baoyu-skills/skills/baoyu-infographic
// Category: 信息图
// Each chip picks one distinctive `references/styles/*.md` and bakes in a
// sensible default layout from `references/layouts/*.md`. Palette hex codes,
// typography rules and avoid-lists are transcribed verbatim from the skill so
// the augment LLM can lock style / composition / colorPalette fields.

const CATEGORY = '信息图'

export const INFOGRAPHIC_PRESETS: StylePreset[] = [
  {
    id: 'infographic-ikea-manual',
    label: 'IKEA 说明书',
    category: CATEGORY,
    description: '极简线稿装配手册 · 黑线白底 · 红警示蓝高亮 · 编号步骤与爆炸图',
    promptSnippet:
      '宜家装配说明书风信息图（IKEA-manual assembly instruction infographic），minimal line-art，wordless-first 的跨语言视觉语言，专注 step-by-step 教程、动作分解、how-to 流程。\n' +
      '【主体 subject】一个清晰的分步任务流：每一步单一动作（握、旋、插、压、对齐），搭配简化人形 stick figure 做尺度参考；配件/零件以 exploded assembly view（爆炸图）展示装配关系；arrow indicators 指示运动方向与次序；数量、转数、角度以小圆圈数字或度数符号标注。\n' +
      '【风格/媒介 style】minimal line drawing，uniform stroke weight 黑色外轮廓，几乎无填充（fills minimal to none），universal pictogram aesthetic，printable at 1-bit，vector-clean 但保持 IKEA 手册那种人情味的简洁——不要工程 CAD 的冰冷感。\n' +
      '【构图 composition】推荐 linear-progression 线性流程布局，6–10 个编号步骤从左到右或从上到下排列；每步一个方形/圆角矩形卡片，卡片内居中放图示、角落放大号步骤编号；主图之间以细箭头或折线连接表示先后；顶部留出标题栏，底部可选工具清单栏（tool list strip）；四周 generous whitespace，禁止信息塞满。\n' +
      '【光影/情绪 lighting / mood】无光影（flat line art，no shading），情绪冷静、耐心、友好可亲；像任何人都能读懂的无语言指南。\n' +
      '【色板 color palette】pure white / warm cream paper #FAF7F0 背景；black #000000 线稿承担 95% 画面；Red #E4002B 仅用于 warning / 禁止动作 / "不要这样做" 的反例打叉；Blue #0051BA 仅用于需强调的高亮件或测量尺寸线；不允许其他色相出现。\n' +
      '【画中文字 text in image】信息图几乎都包含结构化文本（标题、副标题、编号、数据标签）：顶部主标题用 clean geometric sans-serif 粗体、字重高但字号克制；每个步骤的 step number 用大号粗体数字包在圆圈/方块里；必要处用极短的 label 或 universal symbol，避免长段落；若出现"是/否"示意，搭配绿色对勾与红色叉号符号即可，尽量 wordless。\n' +
      '【约束 constraints】consistent stroke weight，所有线粗一致；exploded view 的分件连线必须 straight / 45°，不要自由曲线；人形一律 stick figure，不加细节；红蓝强调色总占比 ≤ 10%；步骤数量 6–10；保持 ample whitespace。\n' +
      '【避免 avoid】photorealistic rendering、3D、gradients、soft shadows、手绘 wobble、卡通 cute style、多彩填充、复杂背景纹理、过长文字段落、装饰性花纹。',
  },
  {
    id: 'infographic-hand-drawn-edu',
    label: '手绘教学',
    category: CATEGORY,
    description: '奶油纸底 · 马卡龙色块 · 手绘抖动 · 火柴人 + 涂鸦的教学概念图',
    promptSnippet:
      '手绘教育信息图（hand-drawn educational infographic），macaron pastel color blocks on warm cream paper texture，面向 concept map、process explainer、knowledge summary、onboarding visual。\n' +
      '【主体 subject】一张温暖、可爱、非正式的教学概念图：围绕一个中心议题展开若干信息区（information zones），每个区内放一个 hand-drawn 圆角卡片、一到两个 stick figure 或 cartoon icon、以及简短手写标签；关键结论放在底部作为 bold centered quote / takeaway。\n' +
      '【风格/媒介 style】hand-drawn wobble on all lines and shapes（所有线条保留抖动），彩色填充不完全填满轮廓（color fills don\'t completely fill outlines）以保留 casual 手绘感；doodle decorations：小星星、下划线、螺旋、闪光、箭头；次要区域使用虚线边框（dashed borders）。\n' +
      '【构图 composition】推荐 hub-spoke 或 bento-grid 布局：中心一个大号 hero 卡承载核心概念，周围 4–6 个 macaron 色卡呈放射或网格排列；手绘波浪线 / 箭头作连接（wavy connection lines），线上配小号文字标签；每区之间留 generous white space，让 zones breathe；最多 4 种 macaron 色，避免花哨。\n' +
      '【光影/情绪 lighting / mood】温暖、亲和、课堂笔记感；纸面有 subtle paper grain texture；无硬光影，只有轻微的色块叠加。\n' +
      '【色板 color palette】背景 Warm cream #F5F0E8 + 纸纹颗粒；主文字/轮廓 Deep charcoal #2D2D2D；Macaron Blue #A8D8EA（冷调区）/ Macaron Mint #B5E5CF（增长/正向）/ Macaron Lavender #D5C6E0（抽象/概念）/ Macaron Peach #FFD5C2（暖调区）择其三到四；强调色 Coral Red #E8655A 仅用于关键数据、警示、重点；次要注释 Warm gray #6B6B6B。\n' +
      '【画中文字 text in image】信息图必含结构化文本：主标题用 bold hand-drawn lettering，字母略带抖动、有机笔画；区块标题为 hand-lettered text 覆盖在 macaron 色块之上；正文是清晰的手写印刷体（handwritten print），可读但不机械；关键词在正文内 bold 加粗；小标签统一使用 warm gray #6B6B6B；至少出现一个 stick figure 或 cartoon character 使概念具象化。\n' +
      '【约束 constraints】no perfect geometry（一切线条带 wobble）、每个 zone 使用一种不同的 macaron 色块、最多 4 种 macaron 色、zones 之间留白充足、包含至少一个手绘人物/火柴人。\n' +
      '【避免 avoid】perfect straight lines / geometric shapes、photorealistic 或 stock illustration、pure white background（必须用 cream）、flat vector 数字精度、overcrowded layouts、corporate / clinical aesthetic、gradient 渐变填充。',
  },
  {
    id: 'infographic-bold-graphic',
    label: '漫画大字',
    category: CATEGORY,
    description: '高对比漫画风 · 粗黑描边 · 网点阴影 · POW/BANG 标题的吸睛信息图',
    promptSnippet:
      '高对比漫画风信息图（bold-graphic comic infographic），halftone 网点 + 粗黑描边 + 饱和原色，适合 attention-grabbing 内容、pop-culture topic、marketing hero 图、high-energy 展示。\n' +
      '【主体 subject】围绕一个强主张展开的多模块视觉叙事：主 hero 格承载核心口号或人物，辅助格展示要点、数据、对比；每格可带漫画 panel border；出现 action lines（动感线）、speech bubbles（对话气泡）、POW/BANG sound-effect 气泡；人物夸张、动势明显。\n' +
      '【风格/媒介 style】bold black outlines（统一粗黑轮廓），high-contrast flat fills，halftone dot pattern 作为阴影与纹理，Warhol-style spot color 重复；可选 Graphic-novel 变体（动作线 + hatching + 分镜）或 Pop-art 变体（halftone + 重复构图）。\n' +
      '【构图 composition】推荐 periodic-table 或 bento-grid 布局：6–9 个漫画 panel 按不对称网格排列，hero panel 占两格大小承担主标题；panel 间 gutter（分隔）明显，保持漫画书的节奏感；关键要点用倾斜放置的 burst 形状（爆炸星形）突出；出现箭头与手指指引视觉动线。\n' +
      '【光影/情绪 lighting / mood】dramatic、energetic、loud；用 halftone dots 模拟印刷阴影，不用真实光影；情绪调性高能、幽默、略带戏剧化。\n' +
      '【色板 color palette】Primary 饱和原色：红 #E63946 / 黄 #FFD23F / 蓝 #1D4ED8 / 黑 #000000；背景 off-white #F8F5EE 或淡米；halftone dots 用黑色；spot accent 可选 neon magenta #FF2D95 或 electric cyan #00C2FF；每张图控制在 3 主色 + 1 强调色。\n' +
      '【画中文字 text in image】信息图必含结构化文本：主标题使用 Impact 或漫画书粗体 display font（comic book lettering），字号极大，带描边与阴影；要点用 caption box（黄底黑边）承载；POW / BANG / WOW 仅用于装饰性强调，真正数据用 sans-serif 清晰可读；speech bubble 内保持短句。\n' +
      '【约束 constraints】统一粗黑描边 stroke weight；halftone 作为唯一阴影语言；色块 flat fill、无渐变；panel 数量 6–9；保持高对比，黑色覆盖 ≥ 20% 画面。\n' +
      '【避免 avoid】gradient 渐变、soft shadow、photorealistic、水彩晕染、细腻铅笔线、低对比配色、过多小字、装饰性花边背景、3D rendering。',
  },
  {
    id: 'infographic-technical-schematic',
    label: '工程蓝图',
    category: CATEGORY,
    description: '深蓝底白线 · 网格 + 尺寸标注 · 琥珀高亮 · 拆解结构 / 系统示意',
    promptSnippet:
      '工程蓝图风技术示意信息图（technical-schematic blueprint infographic），engineering precision + clean geometry，面向技术架构、系统框图、产品拆解、data viz。\n' +
      '【主体 subject】一套精确的技术图示：核心对象以 blueprint 白线在深蓝底上勾勒，带 dimension lines（尺寸线）、arrow leaders（引线）、technical symbols（电气 / 机械符号）；可选 Isometric 变体：30° 等轴侧方块组合（clean fills）呈 3D 空间关系。\n' +
      '【风格/媒介 style】vector-clean blueprint aesthetic，consistent stroke weight 0.5–1pt，geometric precision throughout；背景铺 subtle grid pattern（等距网格）；所有形状 closed path、无 hand-drawn 抖动；callout 使用 floating label + leader line。\n' +
      '【构图 composition】推荐 structural-breakdown 或 dashboard 布局：主视图居中（正视 / 侧视 / 等轴侧）占画面 50–60%，周围放 4–6 个 callout 模块或 exploded sub-assembly；顶部 title block 含项目名、比例、日期（模仿工程图签）；底部 legend / spec 栏罗列关键参数；网格背景贯穿整张图，所有元素对齐网格。\n' +
      '【光影/情绪 lighting / mood】precise、authoritative、engineering-grade；无光影渐变；Isometric 变体可以极轻的同色系 flat tint 区分面，不做 rendering 阴影。\n' +
      '【色板 color palette】Blueprint 变体背景 Deep blue #1E3A5F，主线 white #FFFFFF，次级线 light blue #93C5FD；Light 变体背景 white 或 light gray #F3F4F6 + 细蓝网格，主线 Primary blue #2563EB、辅色 teal #0D9488、gray #6B7280；Accent 琥珀 Amber #F59E0B 仅标注关键测量与警示，cyan #06B6D4 用于次级 callout；单图最多 3 种色相。\n' +
      '【画中文字 text in image】信息图必含结构化文本：所有标签 ALL CAPS、technical stencil 或 clean monospaced sans-serif；dimension 用 "12.5 mm" / "Ø 30" 格式、尾随单位；section / detail 标签用编号如 "A-A\'" / "DETAIL 01"；title block 内含 PROJECT / SCALE / SHEET 字段；floating label 与引线 45° 或正交走线，不得斜交。\n' +
      '【约束 constraints】consistent stroke weight；所有线与文字贴合网格；角度仅用 0°/30°/45°/60°/90°；无自由曲线（机械圆角除外）；文字 ALL CAPS；颜色最多 3 种。\n' +
      '【避免 avoid】photorealistic rendering、soft shadow、手绘 wobble、卡通 cute style、水彩纹理、花哨装饰、大段正文、衬线字体 body、暖色高饱和强调色。',
  },
  {
    id: 'infographic-chalkboard',
    label: '黑板教室',
    category: CATEGORY,
    description: '深黑底 + 彩色粉笔涂鸦 · 粉尘质感 · 星星箭头 · 教室知识分享',
    promptSnippet:
      '黑板粉笔风信息图（chalkboard infographic），authentic classroom blackboard + colorful chalk illustration，面向教学材料、workshop、tutorial、informal learning。\n' +
      '【主体 subject】一整块黑板上的知识分享：中心是主标题，周围围绕 4–6 个 chalk-drawn zones，内含公式、stick figure、简单图解、checkmark、连接箭头；可加入 playful doodle（星星、下划线、心形、对话气泡）与数学符号。\n' +
      '【风格/媒介 style】hand-drawn chalk illustration，sketchy imperfect lines 带自然抖动；chalk dust 效果围绕文字与关键元素；eraser smudges（擦痕）和 chalk residue 纹理 subtle 散布；可选木框边（wooden frame border）包围整张图增加教室感。\n' +
      '【构图 composition】推荐 bento-grid 或 hub-spoke 布局：主标题占上方 1/4，中部分区块承载知识点，底部留"今日要点"或 Q&A 栏；分区用手绘粉笔框（不规则矩形）或虚线圈划开；connection lines 手绘曲线，带箭头；各区域不要过满，留黑色呼吸空间。\n' +
      '【光影/情绪 lighting / mood】怀旧、温暖、课堂氛围；无真实光影，仅靠粉尘和颜色亮度分层；情绪友好、耐心、像老师板书。\n' +
      '【色板 color palette】背景 Chalkboard Black #1A1A1A 或 Green-Black #1C2B1C；主文字 / 轮廓 Chalk White #F5F5F5；Accent 1 Chalk Yellow #FFE566（高亮强调）；Accent 2 Chalk Pink #FF9999（次级强调）；Accent 3 Chalk Blue #66B3FF（图解/链接）；Accent 4 Chalk Green #90EE90（正确/自然）；Accent 5 Chalk Orange #FFB366（警示/能量）；单图最多同时用 3 种强调色。\n' +
      '【画中文字 text in image】信息图必含结构化文本：所有字体都是 hand-drawn chalk lettering，笔画带粉笔质感与微小颗粒，基线略不齐；主标题白色大字、下加波浪下划线；区块小标题可混用 Accent 色；body 用白色手写体、短句分行；编号用圆圈粉笔数字；关键数据用 Chalk Yellow 框起或加下划线。\n' +
      '【约束 constraints】authentic chalk texture 贯穿所有元素；保持 imperfect hand-drawn quality；粉尘和 smudge 效果 subtle 不抢戏；通过色彩多样性建立层级；包含 playful doodle 与 annotation。\n' +
      '【避免 avoid】perfect geometric shape、clean digital line、photorealistic element、gradient 渐变、glossy / 3D 效果、饱和霓虹色、纯白背景、矢量 flat icon。',
  },
  {
    id: 'infographic-subway-map',
    label: '地铁线路',
    category: CATEGORY,
    description: '轨道交通图 · 45°/90° 折线 · 站点圆点 · 换乘标记 · 路径型流程',
    promptSnippet:
      '地铁线路图风信息图（subway-map / transit diagram infographic），colored route lines + station markers，面向 journey map、process flow、network diagram、route explanation。\n' +
      '【主体 subject】一张抽象化的"线路图"：一到多条彩色干线穿过画面，每条线串起若干 station dot（里程碑/步骤），干线之间以 interchange symbol（换乘圆环或胶囊）互联；每条线代表一类流程 / 阶段 / 团队 / 产品线；简化地理，只保留逻辑关系。\n' +
      '【风格/媒介 style】transit diagram aesthetic，uniform stroke weight thick route lines（例如 8–12px），clean vector flat，无任何手绘抖动；所有折线仅走 45° 与 90°（no arbitrary angles）；站点圆点 outlined in white + filled with line color；换乘点用同心圆或双色胶囊。\n' +
      '【构图 composition】推荐 winding-roadmap 或 linear-progression 布局：主线从左上穿到右下（或水平贯穿），在关键节点产生分支 / 环线；站点沿线均匀分布，间距一致；顶部标题 + 底部 legend 写明每条色线代表的主题；画面四周留 padding 10–15%；不允许线条交叉过多，interchange 必须清晰。\n' +
      '【光影/情绪 lighting / mood】clean、navigable、system-minded；纯 flat 无光影；情绪沉着、清晰、工具感强。\n' +
      '【色板 color palette】背景 white #FFFFFF 或 light gray #F5F5F5；路线主色套用交通标准色：红 #E4002B / 蓝 #0051BA / 绿 #007A33 / 黄 #FFC72C / 橙 #F26522 / 紫 #6A1B9A，单图挑选 3–4 条线对应不同色；站点边框 black 或深灰 #1F2937；interchange 标记 white ring + line color fill；文字黑色 #111827；单图严格限制色数，避免花。\n' +
      '【画中文字 text in image】信息图必含结构化文本：站点 label 用 clean geometric sans-serif（如 Helvetica / Inter 类），小写或正常大小写，水平或沿线 45° 放置；每条线端点挂 line badge（圆角矩形色块 + 线路名 / 编号）；主标题 top-left 或 top-center，粗体大号；legend 使用小号文字 + 色线样本；行程 / 时长数据用单位后缀（"12 min" / "3 stops"）。\n' +
      '【约束 constraints】角度仅限 45° / 90°；route line 粗细统一；站点圆点大小统一、换乘点稍大；文字始终水平或 ±45°；最多 4 条彩色干线；legend 必须出现。\n' +
      '【避免 avoid】自由曲线路径、arbitrary 角度、手绘抖动、photorealistic 地图、3D 透视、渐变路线、立体车站图标、过多文字堆叠、细线描边、花哨装饰背景。',
  },
  {
    id: 'infographic-retro-pop-grid',
    label: '复古网格',
    category: CATEGORY,
    description: '1970s 复古波普 · Swiss 严格网格 · 粗黑描边 · 米底 + 柔和撞色块',
    promptSnippet:
      '1970s 复古波普网格信息图（retro-pop-grid infographic），Swiss international grid + thick black outlines + flat color blocks，面向 trendy product guide、design-conscious content、高冲击对比、social media 海报。\n' +
      '【主体 subject】高密度模块化信息：整张画面被粗黑网格划分成正方形 / 矩形单元（cells），每格承载一条要点、一个符号、一块反白警示或一段 body；穿插 checkerboard（棋盘）、diagonal lines、dots 的 geometric fill 图案格；点缀 vintage smiley / frowny face、警示牌、钥匙孔、箭头、星形 flat 符号。\n' +
      '【风格/媒介 style】pure 2D flat vector + subtle screen-print texture；uniform thick black outlines 贯穿所有 illustration、text box、grid divider；strict Swiss typographic alignment；轻微噪点模拟丝网印刷；underground comic illustration 气质。\n' +
      '【构图 composition】推荐 dense-modules 或 bento-grid 布局：画面被粗黑线切成 4×5 或 3×6 的 square / rectangle 单元；hero 标题格占 2×2 放大字展示主题；其中若干格意图留空/纯色以呼吸（colored cells as breathing room）；black-background cell + white text 用于 warnings / 关键类别（inverted contrast）；无任何元素浮在网格之外。\n' +
      '【光影/情绪 lighting / mood】absolutely no gradient / shading / drop shadow / 3D；1970s retro pop 感，略 campy 但自信、克制。\n' +
      '【色板 color palette】背景 vintage cream #F5F0E6；flat accents 复古柔和色：salmon pink #F4A79E / sky blue #A3C8E0 / mustard yellow #D9B24A / mint green #A8C8A0；contrast blocks 纯黑 #000000 与纯白 #FFFFFF 用于极端对比；所有轮廓线 solid thick black；严禁霓虹或高饱和数字色。\n' +
      '【画中文字 text in image】信息图必含结构化文本：标题使用 bold brutalist 或 retro thick display font，字母紧凑、高可读；正文 clean sans-serif，严格对齐 baseline 与 grid；允许英文装饰性标签（"WARNING" / "INFO" / "BEST" / "No.01"）增强复古感；编号放在格子左上角用反白圆圈或方块；关键一句话可独占一格放大加粗；所有实际内容文字使用用户指定语言。\n' +
      '【约束 constraints】everything grid-anchored（no floating element）；统一粗黑 outline weight；flat fill only；部分格子必须保留稀疏以形成节奏；hero / warning 格使用反白对比；最多 4 种复古色 + 黑白。\n' +
      '【避免 avoid】gradient / shading / drop shadow / 3D rendering、soft pencil / sketch 线、free-flowing 或 floating 布局、pure white 背景（必须 cream）、organic hand-drawn 抖动、photorealistic、霓虹高饱和、复杂噪声背景。',
  },
]
