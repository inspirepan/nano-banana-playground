import type { StylePreset } from './types'

// Source skill: ~/code/test/2026-02-26-JimLiu-baoyu-skills/skills/baoyu-cover-image
// Category: 封面图
// Six distinct rendering styles, each baked with one sensible palette
// (warm flat-vector / earth hand-drawn / earth watercolor / cool blueprint /
// dark chalkboard / duotone screen-print). Pixel rendering intentionally
// skipped — its chunky retro-game vibe rarely matches article-cover use cases.
// Each promptSnippet follows the editorial-sketch labeled-section structure
// so the augment LLM can distribute details into the right scheme fields.

const CATEGORY = '封面图'

export const COVER_IMAGE_PRESETS: StylePreset[] = [
  {
    id: 'cover-flat-vector',
    label: '扁平矢量',
    category: CATEGORY,
    description: '奶油米底 · 暖橙扁平色块 · 几何图标 · 现代编辑向文章封面',
    promptSnippet:
      '现代扁平矢量封面插画（flat vector editorial cover），app icon / infographic 美学，干净、几何、克制，适合博客文章封面、产品发布图、概念解释头图。\n' +
      '【主体 subject】围绕文章核心概念的单一视觉锚点 + 1-2 个辅助符号，使用图标词汇（icon vocabulary）：灯泡代表想法、齿轮代表工程、火箭代表增长、放大镜代表分析、钥匙代表解决方案、云/代码窗代表技术。人物一律为简化剪影（simplified silhouettes），绝不出现写实人脸。复杂对象做几何简化——树 → 棒棒糖/三角形，建筑 → 圆角矩形，山 → 三角形堆叠。\n' +
      '【风格/媒介 style】flat vector illustration，clean outlines with uniform stroke weight（均匀描边），closed coloring-book shapes（封闭色块），rounded line endings（圆头线端），"toy model" 圆润比例，可选 2.5D isometric 层叠；绝对禁止任何渐变、阴影、噪点或 3D bevel。装饰元素：小圆点、细线条、sunburst 放射、pill-shaped clouds、small stars。\n' +
      '【构图 composition】16:9 默认（支持 2.35:1 / 4:3 / 1:1 覆写）；主视觉居中或轻度偏左（右侧留白给标题）；generous whitespace 40-60%，一个 dominant focal point + 1-2 supporting elements + 少量 decorative accents；背景为 solid color 或极简双色分区，绝不堆砌复杂图案。\n' +
      '【光影/情绪 lighting / mood】friendly, approachable, human-centered；balanced 对比度与饱和度（中等），必要时可切换 subtle（减 20-30% 对比/饱和、线条更细）或 bold（加 20-30% 对比/饱和、描边更粗）；整体现代而温暖，不做夸张戏剧化。\n' +
      '【色板 color palette】warm palette：背景 cream #FFFAF0 或 soft peach #FED7AA 为主底；primary Warm Orange #ED8936 做主色块占视觉主导（约 40-50%），Golden Yellow #F6AD55 作次要色块，Terracotta #C05621 点缀深色区块；accent 用 Deep Brown #744210 做勾边/文字，Soft Red #E53E3E 作焦点强调色（≤10%）；全图保持 flat solid fills，绝不出现渐变。\n' +
      '【画中文字 text in image】默认 title-only（占约 15% 版面），标题文本由用户主提示词提供，必须逐字渲染，不得自创或改写；字体使用 clean geometric sans-serif（类似 Inter / SF Pro），sharp edges, uniform stroke；与背景高对比以保证可读。若用户指定 text-rich，可加副标题和 2-4 个 keyword 徽章。\n' +
      '【约束 constraints】flat colors only、无渐变/阴影/噪点、描边宽度全图一致、icon-based vocabulary、主体居中或偏左、40-60% 留白、最多 3-5 个主视觉元素、标题逐字使用用户提供的文案。\n' +
      '【避免 avoid】photorealism、3D render、bevel、gradients、drop shadow、复杂纹理/贴图、写实人脸或身体、密集堆叠元素、过多色块导致杂乱、cream 以外的冷色主导背景、卡通可爱的 kawaii 过度风。',
  },
  {
    id: 'cover-hand-drawn',
    label: '手绘笔记',
    category: CATEGORY,
    description: '沙米纸感 · 森林绿墨线 · 涂鸦图标 · 自然向手绘封面',
    promptSnippet:
      '手绘涂鸦风格文章封面（hand-drawn sketchbook-style editorial cover），像一位有品味的设计师在 notebook 或白板上快速起稿——松弛、有笔触质感、真实但专业，适合自然/成长/教程/人文类内容。\n' +
      '【主体 subject】围绕主题的 1 个视觉隐喻主体 + 少量手绘 doodles 点缀。可选图标词汇：树/叶子/植物幼苗代表生长，山/日出代表挑战与起点，书/铅笔代表学习，路径/箭头代表旅程，手绘对话泡代表沟通，人物为简化 stick figure 或剪影。主体之间可用 wavy connector 串联。\n' +
      '【风格/媒介 style】hand-drawn illustration，sketchy organic strokes with visible imperfections，variable line weight（压力点处更粗），natural hand tremor visible，paper grain 与 pencil/marker 笔触隐约可见；casual fills 可见笔刷方向；允许极简阴影/hatching，但禁止写实景深。装饰元素：手绘星星、波浪下划线、小圈、checkmark、arrows with curved shaft。\n' +
      '【构图 composition】16:9 默认（支持 2.35:1 / 1:1）；主体居中或偏左，右侧/底部预留标题区；40-60% 留白（纸面呼吸感），一个 dominant 元素 + 2-4 个辅助小涂鸦散落其间，整体呈 sketchbook spread 节奏；不得堆成密集涂鸦墙。\n' +
      '【光影/情绪 lighting / mood】organic, approachable, grounded；balanced 默认；情绪偏温暖、真诚、"个人笔记"感，不做商业广告锐利度。\n' +
      '【色板 color palette】earth palette：背景 sand beige #F5E6D3（整体呈 warm paper 底）或 sky blue #E0F2FE 作 alt；primary Forest Green #276749 做主手绘墨线与主色块（约 35-45%），Sage #9AE6B4 作次要填充，Earth Brown #744210 作 deep 色锚点；accent Sunset Orange #ED8936 用作焦点强调（≤15%），Water Blue #63B3ED 作极少量点缀；所有 fills 保留 casual 笔触，不用平涂矢量纯净感。\n' +
      '【画中文字 text in image】默认 title-only（约 15% 版面），标题文本由用户主提示词逐字提供；字体使用 hand-lettered / marker-style，bouncy baseline、organic 粗细变化、自然不均匀——绝不使用几何 sans。副标题（若 title-subtitle）体量更小，保持 handwritten 一致。\n' +
      '【约束 constraints】visible hand-drawn imperfections（必须）、variable stroke weight、paper grain 可见、icon-based doodle 词汇、标题使用 handwritten 字体、40-60% 留白、最多 6-8 个 doodle 元素、主体居中或偏左。\n' +
      '【避免 avoid】digital perfection、uniform vector stroke、flat app-icon 矢量感、3D rendering、photorealism、写实人脸、卡通 kawaii、密集拥挤的涂鸦墙、冷色主导（紫/品红/霓虹）、渐变填充。',
  },
  {
    id: 'cover-painterly',
    label: '水彩画意',
    category: CATEGORY,
    description: '沙米纸底 · 森绿/赭石水彩晕染 · 软边植物笔触 · 文学向绘本封面',
    promptSnippet:
      '水彩绘本风格封面插画（painterly watercolor editorial cover），像手工画的艺术小品，湿画法、软边、有水渍与颗粒，适合文学、人文、wellness、slow-living、自然主题。\n' +
      '【主体 subject】围绕主题的 1 个 atmospheric 主体 + 自然元素环绕：叶子、花、山峦、远山轮廓、溪流、云、光束；人物一律为剪影或远景小人，不展开五官。主体常被包覆在 watercolor wash 之中，边界靠色彩过渡而非线条定义。\n' +
      '【风格/媒介 style】watercolor / gouache painterly illustration，soft brush strokes with variable opacity，no hard outlines（关键：靠 color transition 定义边缘），wet-on-wet bleeds，color bleeds at edges，visible paper texture showing through transparent washes，splatter 与 drip 细节点缀；允许极少量 dry-brush 线条作为暗示，但绝不使用矢量级锐利边。\n' +
      '【构图 composition】16:9 默认（也适合 2.35:1 cinematic 横向 /3:4 纵向）；主体居中或偏左，留右侧/下方气氛区给标题；40-60% 留白由 wash 的淡化自然形成；一个 focal 主体 + 2-3 层渐隐的 environmental wash（近中远），构成 atmospheric depth；不要硬性图文分区。\n' +
      '【光影/情绪 lighting / mood】soft, artistic, expressive, meditative；subtle 或 balanced 为主（bold 会破坏水彩气质）；光感通过 wash 浓度与留白形成，而非高光 dot；情绪温和、诗意、沉思。\n' +
      '【色板 color palette】earth palette：背景 sand beige #F5E6D3 作主 wash 底（像温暖水彩纸），可与 sky blue #E0F2FE 远景晕染；primary Forest Green #276749 做主晕染色块（约 35-45%，多为叶/山/阴影），Sage #9AE6B4 作 mid-tone wash，Earth Brown #744210 仅作 deep pool / dry-brush accent；accent Sunset Orange #ED8936 只在日光/焦点处点染（≤10%），Water Blue #63B3ED 作远景水/天补色；全图保持 30-60% 饱和度，绝不霓虹。\n' +
      '【画中文字 text in image】默认 title-only，标题文本由用户主提示词逐字提供；字体使用 elegant brush script 或 serif with organic texture，与 paint 环境融合（可略带水彩笔触）；副标题（若 title-subtitle）更轻更细。\n' +
      '【约束 constraints】soft edges defined by color transitions、visible paper texture、wet-on-wet bleeds、subtle splatter 点缀、30-60% 饱和度、40-60% 留白、不使用线稿描边、标题字体呼应水彩气质。\n' +
      '【避免 avoid】hard vector outlines、flat solid fills、digital perfection、3D render、photorealism、霓虹/高饱和色、sharp drop shadow、几何 app-icon 风格、写实人脸、商业广告锐利度。',
  },
  {
    id: 'cover-digital',
    label: '数字蓝图',
    category: CATEGORY,
    description: '浅灰底 · 工程蓝主色 · 精细 UI/图表 · 技术文档/架构类封面',
    promptSnippet:
      '专业数字插画风格封面（polished digital editorial cover），类似企业级 UI mockup 或技术产品官网 hero，线条精准、层级干净、带极克制的现代质感，适合架构设计、API 文档、数据分析、工程/系统类文章。\n' +
      '【主体 subject】围绕技术主题的 1 个核心视觉 + 数据/UI 辅助元素：可能是代码窗 / 仪表盘 / 卡片堆叠 / 网络节点图 / chart 与 metric tiles / API 括号 `</>` / 云与锁 / 齿轮与芯片。人物（如有）为 simplified silhouettes 或 head-shoulders 轮廓，绝不写实。\n' +
      '【风格/媒介 style】digital illustration，clean precise computer-perfect edges，anti-aliased smooth rendering，consistent stroke weights，material-design-inspired elevation；允许 subtle soft drop shadow、clean controlled gradient、frosted glass blur；elements 呈 card-based layered 结构；装饰可用 grid lines / dimension indicators / schematic hints / tag chips / progress bars。\n' +
      '【构图 composition】16:9 默认（也适合 2.35:1 作 dashboard banner）；主视觉居中或偏左，右侧或下方预留标题；40-60% 留白；1 个 dominant panel/card 作 focal，2-3 个 supporting element（图表、tag、小部件）在其周围呈层叠关系；整体信息层级明确，不做密集 infographic。\n' +
      '【光影/情绪 lighting / mood】professional, precise, modern, tech-forward；balanced 默认；可 subtle 偏 thought-leadership 冷静，或 bold 偏 product-launch 锐利；不做戏剧化气氛。\n' +
      '【色板 color palette】cool palette：背景 light gray #F8F9FA 或 blueprint off-white #FAF8F5；primary Engineering Blue #2563EB 作主色（约 40-50%，用于主卡片/icon/主数据），Navy Blue #1E3A5F 作深色锚点与文字，Cyan #06B6D4 作次要 highlight；accent Amber #F59E0B 用于关键焦点/CTA（≤10%），Light Blue #BFDBFE 作柔和填充与 chip；阴影保持 soft 与单向一致。\n' +
      '【画中文字 text in image】默认 title-only（约 15% 版面），标题由用户主提示词逐字提供；字体使用 clean geometric sans-serif（Inter / SF Pro 风），uniform stroke、结构化 hierarchy、与背景高对比；若 text-rich，可加副标题与 2-4 个 tag chip 徽章（半径 6-8px 胶囊形）。\n' +
      '【约束 constraints】clean precise edges、subtle 可控渐变（不得夸张）、consistent stroke weight、layered card-based 结构、40-60% 留白、阴影方向统一且轻、标题为 geometric sans。\n' +
      '【避免 avoid】hand-drawn imperfection、sketchy strokes、paper grain、水彩晕染、3D realistic render、photorealism、dramatic neon glow、过多色块、密集 infographic 堆叠、warm earth 主导色（除作小 accent 外）。',
  },
  {
    id: 'cover-chalk',
    label: '黑板粉笔',
    category: CATEGORY,
    description: '深紫近黑板 · 白粉笔为主 · 霓虹彩色粉强调 · 教学/讲解向封面',
    promptSnippet:
      '黑板粉笔风格封面（chalkboard editorial cover），像在干净教室黑板上写板书，chalk dust、笔触抖动、教学氛围，适合课堂笔记、tutorial、概念讲解、回顾类文章。\n' +
      '【主体 subject】围绕讲解主题的 1 个核心涂鸦 + 少量 chalk 装饰：公式片段、箭头、connection line、stick figure、简单图形（圆/方/三角）、checkmark、带圈数字、手写 label。人物一律 stick figure 或极简剪影。主体周围可有 eraser smudge 模拟重绘过的痕迹。\n' +
      '【风格/媒介 style】chalk on blackboard aesthetic，imperfect chalk strokes with variable pressure，visible chalk texture and grain，slightly wobbly hand-drawn quality（非完美矢量），chalk dust 在文字/元素边缘飘散，eraser smudges/残留 作岁月感；粗笔触强调、细笔触细节；板面保留 subtly worn 质感但保持整洁可读。\n' +
      '【构图 composition】16:9 默认（也适合 2.35:1 作宽黑板）；主体居中或偏左，四周留板面呼吸；40-60% 空板；1 个 dominant 图示 + 2-4 个小涂鸦/公式/箭头辅助；不做满板信息堆叠。可选木质画框边缘作装饰（极简，不要喧宾）。\n' +
      '【光影/情绪 lighting / mood】educational, authentic, approachable, nostalgic classroom warmth；balanced 默认；不做戏剧背光。\n' +
      '【色板 color palette】dark palette（以深板面为核心）：背景 deep purple-black #0A0A0A 作主板面，可用 rich navy #1A1A2E 作微妙 alt 区块；白色粉笔 pure white #FFFFFF 为主书写色（约 45-55%），承担主线条与主文字；彩色粉笔强调色分工——Electric Purple #8B5CF6 作主焦点/标题标注，Cyan Blue #06B6D4 作次要高亮与 connection line，Magenta Pink #EC4899 作关键记号（≤10%），Amber #F59E0B 作警示/重点标记（≤8%）；所有颜色必须呈现 chalk grain，而非纯数字填色。\n' +
      '【画中文字 text in image】默认 title-only，标题文本由用户主提示词逐字提供；字体为 hand-drawn chalk lettering，baseline 略起伏、粉笔颗粒明显、可带 white 或 highlight 彩色；副标题（若 title-subtitle）用小号白色粉笔；不使用几何 sans。\n' +
      '【约束 constraints】chalk grain texture 必须可见、笔触略抖动、eraser smudge 作真实感、深板面背景、40-60% 留白、霓虹色做小范围 accent、标题为 chalk lettering。\n' +
      '【避免 avoid】digital perfection、平滑矢量描边、白色硬底、photorealism、写实人脸、app-icon 扁平风、渐变填充、cream/yellow 暖底、过多颜色挤占白粉笔主导地位。',
  },
  {
    id: 'cover-screen-print',
    label: '丝网海报',
    category: CATEGORY,
    description: '近黑底 · 焦橙×深青双色 · 半调印花 · 电影/声明类海报封面',
    promptSnippet:
      '丝网印刷双色海报风格封面（duotone screen-print editorial poster cover），Mondo / 限量演唱会海报 / 另类电影海报美学，厚重、复古、带有印刷工艺痕迹，适合发布声明、专题封面、电影/音乐/事件类宣传。\n' +
      '【主体 subject】一个强烈的 bold silhouette 作主符号：人物剪影、建筑、物件、象征道具；辅以 1-2 个几何 framing（圆、拱、三角形、圆弧线），营造海报式构图。人物为剪影/轮廓形式，不刻画五官细节。可用 figure-ground inversion——negative space 形成次级图像。\n' +
      '【风格/媒介 style】screen print / silkscreen，flat color blocks with clean sharp edges，NO outlines（形状靠 color boundary 定义），halftone dot pattern 在 color fill 内部提供 tonal 变化，slight color-layer misregistration（印层略微偏移，1-3px 的错位），paper grain 在色层下隐约可见，risograph-like ink spread / dot gain 点缀；typography 作为构图组件参与布局，而非浮层文字。\n' +
      '【构图 composition】16:9 或 2.35:1 cinematic 最适；poster-style 居中或轴对称偏左，主 silhouette 占视觉主导（50-65%），少量几何 framing 围绕；negative space 是 active compositional element，不是填空白；vintage 海报式 border treatment 可选（极细线/套色边框）。\n' +
      '【光影/情绪 lighting / mood】dramatic, cinematic, bold declaration；bold 或 balanced 为主（subtle 会削弱冲击）；两色高对比形成 figure-ground 戏剧张力。\n' +
      '【色板 color palette】duotone palette（选用 Orange + Teal 默认对：Burnt Orange #E8751A + Deep Teal #0A6E6E）；背景 off-black #121212（或 dark charcoal #1E1E1E 作 alt）作主底占 40-55%；两主色分别占约 20-30%，通过 silhouette overlap 与 halftone 过渡交织；accent Warm Cream #F5E6D0 作极少量高光/字体色（≤10%），Amber Highlight #F4A623 只在关键焦点点亮（≤5%）；不出现第四个显著色相，保持 duotone 纯粹。\n' +
      '【画中文字 text in image】默认 title-only 或 title-subtitle，标题文本由用户主提示词逐字提供；字体使用 bold condensed sans-serif 或 hand-drawn lettering（Art Deco / vintage poster 影响），作为 integral design element 嵌入构图（如贴合 silhouette 边缘、包络主体、或占据色块区），高对比保证可读；避免漂浮在主体上方的"浮层"标题。\n' +
      '【约束 constraints】仅两个主色 + 近黑底 + 少量 cream 高光、halftone dots 必须可见、slight misregistration 作印刷痕迹、paper grain 隐约可见、无线稿 outline、silhouette 主导、typography 作构图组件。\n' +
      '【避免 avoid】gradient fills、平滑矢量无纹理、3D render、photorealism、写实人脸、过多色相（三色以上）、弱对比柔调、卡通可爱风、digital UI 质感、hand-drawn sketchy 笔触。',
  },
]
