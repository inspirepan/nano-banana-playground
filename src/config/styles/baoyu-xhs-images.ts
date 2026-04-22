import type { StylePreset } from './types'

// Source skill: ~/code/test/2026-02-26-JimLiu-baoyu-skills/skills/baoyu-xhs-images
// Category: 小红书
// Each chip mirrors one of the 12 canonical XHS styles; promptSnippet is a
// labeled Chinese brief with bilingual keywords so the augment LLM can
// distribute details into composition / style / colorPalette / lighting /
// constraints / avoid fields of the final scheme.

const CATEGORY = '小红书'

export const XHS_IMAGES_PRESETS: StylePreset[] = [
  {
    id: 'xhs-bold',
    label: '大字大色',
    category: CATEGORY,
    description: '高冲击海报 · 红橙黄 + 深黑底 · 3D 描边大标题 · 避坑 / 警示 / TOP 榜单封面',
    promptSnippet:
      '高冲击小红书封面（high-impact XHS cover / 爆款封面），适合避坑指南、警示提醒、TOP 榜单、震惊体盘点、必看清单。\n' +
      '【主体 subject】单一核心主体或 2-3 个并列主体，强调情绪冲击——大拇指、感叹号、警示牌、爆炸框、拳头、红色禁止标志等符号化元素；人物用漫画式 cutout，面部表情夸张。\n' +
      '【风格/媒介 style】bold XHS poster，chunky sans-serif hand-lettering，shadow-3d / stroke-text 花字，high-saturation filter，clean cutout with colored-solid or double stroke，exclamation / star-burst / red-arrow 强调符，curvy arrows & squiggles 涂鸦；保持 hand-drawn quality，严禁 photoreal。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660），single 或 dual grid；大标题占画面高度的 40-50%，置于上半部黄金位；避开底部 10% 的 XHS 标题栏遮挡与右上角点赞按钮区；副标题/数字徽章在左右斜角打破对称，形成视觉冲击。\n' +
      '【光影/情绪 lighting / mood】dramatic，urgent，惊叹；高对比强光感，暗背景 + 亮文字制造舞台聚光灯效果。\n' +
      '【色板 color palette】primary 使用鲜红 #E53E3E、橙 #DD6B20、亮黄 #F6E05E；background 深黑 #000000 或 dark charcoal #1A1A1A；accents 纯白 #FFFFFF、霓虹黄 #F7FF00；solid-saturated 或 gradient-linear 色块，允许红黄撞色但仅限 3-4 色。\n' +
      '【画中文字 text in image】大标题：中文 4-8 字、stroke-text 或 shadow-3d 花字，字重 black，字色白/亮黄，外描黑色粗边，字号占宽 70% 以上；副标题：白字横排，字号约主标题 40%；数字徽章：红底白字圆形或 ribbon，放在角落；tags 使用 black-white 或 ribbon 风格标签；可出现感叹号「!」作为装饰字符；所有文字 hand-drawn 感，不得出现电脑字体。\n' +
      '【约束 constraints】hand-drawn quality throughout；3-4 色以内；大面积深底 + 亮字；每张仅 1 个视觉焦点；文字必须可读、字距紧凑。\n' +
      '【避免 avoid】pastel 粉色系、细线描边、极简留白、文艺小清新、水彩渲染、真实照片、精致细腻人像、gradient 柔和渐变、手写细笔。',
  },
  {
    id: 'xhs-cute',
    label: '甜美粉系',
    category: CATEGORY,
    description: '粉色奶油底 · 心形星星亮片 · 气泡圆体字 · 美妆穿搭种草 / 少女日常',
    promptSnippet:
      '甜美少女风小红书图（sweet girly XHS infographic / 经典甜系封面），适合美妆护肤、穿搭、生活种草、日常分享、情绪文案、氛围感封面。\n' +
      '【主体 subject】圆润可爱的单品/人物/食物/宠物；soft cutout，边缘柔和；搭配 hearts、stars-sparkles、flowers、ribbons、cute stickers；人物可用插画式 Q 版，面部简化。\n' +
      '【风格/媒介 style】cute hand-drawn illustration，bubble / highlight 花字，白描或彩描（white-solid / colored-solid stroke），clear-glow 或 cream-skin 滤镜，pill / bubble 标签，polaroid 或 tape-corners 边框；保持 hand-drawn quality，可爱但不卡通化过度。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660）为主，1:1 方图为辅；single / dual / quad grid，四角或中轴留足 whitespace；主体居中偏上，文字与装饰贴纸围绕主体呈花环式排布；避开底部 10% 与右上角安全区。\n' +
      '【光影/情绪 lighting / mood】甜美、温柔、治愈、少女心；柔和自然光，轻微 glow 高光，画面整体明亮干净。\n' +
      '【色板 color palette】primary 柔粉 #FED7E2、奶桃 #FEEBC8、薄荷 #C6F6D5、薰衣草 #E9D8FD；background 奶油 #FFFAF0、soft pink #FFF5F7；accents 热粉 #FF69B4、珊瑚 #FF6B6B；solid-pastel 或 gradient-linear 柔和渐变，饱和度中低。\n' +
      '【画中文字 text in image】大标题：中文 4-8 字、bubble 圆润花字或 highlight 荧光笔划，主色热粉 #FF69B4 或珊瑚 #FF6B6B，常加白色外描 + soft shadow；副标题：黑/深棕手写体横排；tags 使用 pill 或 bubble 形状，浅粉底深字；标题中可夹杂♡★✿等装饰字符；所有文字 hand-drawn、圆润、带 playful 装饰。\n' +
      '【约束 constraints】hand-drawn lettering；主色 ≤ 4 种、均为 pastel；主体 soft cutout；whitespace 充足；装饰贴纸成组但不拥挤。\n' +
      '【避免 avoid】深黑底、高饱和纯红/纯蓝、尖锐几何形、硬朗工业风、金属/3D 光泽、photorealistic 人像、严肃商务感、halftone 粗颗粒纹理。',
  },
  {
    id: 'xhs-chalkboard',
    label: '黑板风',
    category: CATEGORY,
    description: '黑板深底 · 多彩粉笔字 · 公式涂鸦 · 教程 / 课堂笔记 / 知识科普',
    promptSnippet:
      '黑板粉笔风小红书图（colorful chalk on blackboard XHS infographic），适合教程步骤、课堂笔记、知识科普、单词/公式讲解、学习打卡、工作坊宣传。\n' +
      '【主体 subject】粉笔手绘的图示、火柴人、简笔图标、数学公式、流程节点、小箭头、打勾、星号；主体不做 cutout，而是像真在黑板上一笔笔画出来的线稿。\n' +
      '【风格/媒介 style】hand-drawn chalk illustration，粉笔颗粒与飞尘（chalk dust），imperfect baseline，eraser smudges，stick figures，connection lines；typography 全部 handwritten chalk lettering，字线略抖、边缘有白色碎屑。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660）；single / dual / triptych grid；主标题顶部横排，中部主图 + 公式/要点，底部总结或 CTA；箭头、下划线、圆圈 (underline / circle-mark / curvy arrow) 把重点圈起来；避开底部 10% 的标题栏遮挡区。\n' +
      '【光影/情绪 lighting / mood】professional、approachable、educational；像夜自习的教室，灯光均匀，没有强烈高光；整体沉稳、亲切、学霸氛围。\n' +
      '【色板 color palette】background 黑板黑 #1A1A1A 或绿黑 #1C2B1C；primary text 粉笔白 #F5F5F5；accent 1 粉笔黄 #FFE566、accent 2 粉笔粉 #FF9999、accent 3 粉笔蓝 #66B3FF、accent 4 粉笔绿 #90EE90、accent 5 粉笔橙 #FFB366；每张图用 3-4 种彩色粉笔制造层级，其余保持白色。\n' +
      '【画中文字 text in image】大标题：中文 4-10 字、粉笔白或粉笔黄 hand-drawn lettering，字号大且占据顶部 1/5；section header：彩色粉笔字，常加下划线或圈号；正文/要点：白色粉笔正楷，横排，字号约主标题 35-45%；关键词用 chalk yellow 或 pink 另描；允许出现公式、箭头「→」、勾号「✓」、星号「★」作为内容的一部分；所有文字 handwritten，不允许 perfect 字体。\n' +
      '【约束 constraints】全部 hand-drawn、带粉笔颗粒；imperfect lines、slight smudges；彩色仅做重点区分；主图线条不得过细。\n' +
      '【避免 avoid】perfect geometric shapes、digital vector lines、photorealistic 元素、gradient、glossy、白底、亮色背景、极简留白、3D 渲染。',
  },
  {
    id: 'xhs-notion',
    label: 'Notion 风',
    category: CATEGORY,
    description: '纯白留白 · 黑色细线手绘 · 柔和 pastel 点缀 · 知识卡 / 工具盘点 / 概念图',
    promptSnippet:
      'Notion 风小红书知识卡（minimalist hand-drawn line art XHS card），适合干货知识卡、概念科普、SaaS/效率工具盘点、清单榜单、mindmap、SWOT 四象限。\n' +
      '【主体 subject】简线条 line-art 图标、几何形状、stick figures、文件/灯泡/齿轮/箭头等概念图示；主体 clean cutout 或纯线稿；每张图只 1 个核心视觉锚点加若干辅助小图标。\n' +
      '【风格/媒介 style】minimalist hand-drawn line art，single-weight ink lines，轻微 hand-drawn wobble，clean 或 white-solid stroke，none/muted-tones filter，handwritten 或无装饰排版，pill/black-white tags，circle-mark / underline 强调，hand-drawn-lines / curvy arrows 涂鸦，rounded-rect 边框可选。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660）；single 或 dual grid；maximum whitespace（60% 以上），信息以网格排布，清晰分区；主标题顶部、分区标题加浅色 pill 标签；支持 dense 知识卡、list、mindmap、flow、quadrant 多种结构；避开底部 10%。\n' +
      '【光影/情绪 lighting / mood】intellectual、calm、现代、专业、文艺；无强光影、无纹理叠加，整体干净。\n' +
      '【色板 color palette】primary 黑 #1A1A1A、深灰 #4A4A4A；background 纯白 #FFFFFF 或 off-white #FAFAFA；accents pastel blue #A8D4F0、pastel yellow #F9E79F、pastel pink #FADBD8；每张图至多 1-2 种 pastel 作为区块高亮，其余保持黑白。\n' +
      '【画中文字 text in image】大标题：中文 4-10 字、clean hand-drawn sans-serif，黑色，字号醒目但不过粗，字距宽松；section header：次级字号加浅色 highlight 底；正文：黑色简体手写体横排，字号约主标题 40%；关键词用 pastel yellow highlighter 划线；tags 用 black-white 或 pill 形状；数字用 lining figures；所有文字 hand-drawn 但接近规整。\n' +
      '【约束 constraints】single-weight black lines；每张不超过 2 种 pastel 强调色；留白充足；无阴影、无渐变、无纹理；信息层级清晰。\n' +
      '【避免 avoid】深黑底、高饱和彩色、厚重阴影、3D 光泽、photoreal 元素、halftone、film-grain、复古纹理、金色/霓虹、夸张卡通化。',
  },
  {
    id: 'xhs-retro',
    label: '复古做旧',
    category: CATEGORY,
    description: '做旧纸底 · 暗橙/雾粉/旧青 · 邮戳 ribbon · 怀旧盘点 / Then vs Now',
    promptSnippet:
      '复古做旧风小红书图（vintage nostalgic XHS infographic），适合怀旧盘点、经典排行、Then vs Now 对比、90 年代回忆、胶片风分享、老物件推荐、手账封面。\n' +
      '【主体 subject】复古徽章、老物件插画、胶片边框、磁带、邮票、老电视机、咖啡渍、半色调人物剪影；stylized cutout，轮廓略毛糙；单主体或左右对比双主体。\n' +
      '【风格/媒介 style】vintage hand-drawn illustration，brush / handwritten 花字，stamp / ribbon 标签，dashed / double stroke，film-grain 或 muted-tones 滤镜，halftone dots，paper-texture 或 dots 背景，stars-sparkles / squiggles 涂鸦，polaroid / film-strip / stamp-border 边框；保持 aged texture 与 imperfections。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660），single 或 dual grid；主标题斜向 ribbon/banner 放置顶部或斜对角，次要信息用邮票/徽章分散排布；四角保留 paper-texture 或胶片齿孔；避开底部 10% 与右上角；允许轻度 tilt 制造手账感。\n' +
      '【光影/情绪 lighting / mood】怀旧、温暖、岁月感、文艺；整体偏哑光，光影柔和，像旧照片一样有黄色 tint。\n' +
      '【色板 color palette】primary muted orange #E07A4D、dusty pink #D4A5A5、faded teal #6B9999；background aged paper #F5E6D3、sepia #E8DCC8；accents faded red #C55A5A、vintage gold #B8860B；整张图饱和度低、带 sepia tone，允许 halftone 灰度过渡但禁止现代渐变。\n' +
      '【画中文字 text in image】大标题：中文 4-10 字、brush 毛笔花字或 vintage handwritten 字体，主色 #C55A5A 或 #B8860B，带 aged texture 颗粒与轻微描边；副标题：handwritten 小字，配邮戳圆章；tags 用 stamp（圆章/方章）或 ribbon 横幅，字色白或米；数字徽章用 numbering + star-burst；允许出现 "EST. 1998"、"Vol.01" 等英文复古元素；所有文字带做旧磨损。\n' +
      '【约束 constraints】muted / sepia 色调；halftone 或纸纹贯穿全图；所有文字 hand-drawn 并带做旧；饱和度整体降低。\n' +
      '【避免 avoid】亮白纯色底、霓虹色、高饱和现代渐变、clean 数字矢量线、未来感 / tech 感、cute pastel、3D 光泽、塑料感。',
  },
  {
    id: 'xhs-screen-print',
    label: '丝网印刷',
    category: CATEGORY,
    description: '限色 duotone · 剪影 + 半色调 · 几何画框 · 影评 / 海报封面 / 观点文章',
    promptSnippet:
      '丝网印刷海报风小红书图（screen-print / silkscreen poster XHS infographic），适合影评书评、文化评论、观点文章、戏剧张力对比、事件海报、品牌宣传封面。\n' +
      '【主体 subject】单一 iconic 剪影——人物、建筑、静物、象征符号；silhouette cutout，轮廓由色块边界定义（stencil-cut，no outlines）；负空间承担第二层叙事；主体占画面 40-60%。\n' +
      '【风格/媒介 style】screen-print poster art，flat color blocks（严禁渐变），halftone dot patterns 表现明暗，slight color misregistration（印刷错位），paper-grain 贯穿底层，stroke-text / shadow-3d 大字，star-burst / numbering 强调，solid-saturated 或 paper-texture 背景，无 doodles、无 frames。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660）为主，必要时 1:1；single 或 dual（comparison / duotone split）；geometric framing——圆形、拱形、三角形切割画面；figure-ground inversion 制造负空间故事；typography integrated 入构图，而非浮层叠加；避开底部 10% 与右上角。\n' +
      '【光影/情绪 lighting / mood】cinematic、dramatic、symbolic；不用真实光影，用平面色块与 halftone 暗示体积。\n' +
      '【色板 color palette】2-5 色 FLAT COLORS MAXIMUM，从以下 duotone pair 选一：Orange+Teal #E8751A/#0A6E6E（cinematic）、Red+Cream #C0392B/#F5E6D0（bold）、Blue+Gold #1A3A5C/#D4A843（premium）、Crimson+Navy #DC143C/#0D1B2A（noir）、Magenta+Cyan #C2185B/#00BCD4（pop）；base 可取 #121212、#F5E6D0；accent amber #F4A623；禁止第 6 种色。\n' +
      '【画中文字 text in image】大标题：bold condensed sans-serif / Art Deco lettering，全大写英文 + 简短中文；字体与画面同层（沿拱形或横贯剪影），可 stencil-cut 切口或 halftone 内填；副标题：细长 condensed 横排；numbering 徽章用实心圆/六边形 + 反白数字；禁止 handwritten 细笔与 pastel tag。\n' +
      '【约束 constraints】flat color only；halftone 代替 gradient；paper-grain 贯穿底层；2-5 色；一个 iconic focal；typography 与构图一体。\n' +
      '【避免 avoid】渐变填充、毛边水彩、细腻写实、cute pastel、手绘抖动萌感、3D 光泽、photorealistic 人像、mindmap 发散、dense 信息密度、decorative frames。',
  },
  {
    id: 'xhs-sketch-notes',
    label: '手绘笔记',
    category: CATEGORY,
    description: '奶油底 · 马卡龙色块 · 抖动手绘线 · 流程图 / 知识图解 / 手绘教程',
    promptSnippet:
      '手绘教育信息图风小红书图（hand-drawn educational sketch-notes infographic），适合手绘教程、流程图解、知识总结、概念地图、onboarding 指南、会议/讲座 visual summary。\n' +
      '【主体 subject】stick-figure 小人、圆角卡片分区、简单概念图标（文件、灯泡、齿轮、箭头、锁、剪贴板）、思考/对话气泡；stylized cutout，色块不完全填满轮廓，边缘留一点手绘空隙。\n' +
      '【风格/媒介 style】hand-drawn sketch-notes，wobble lines on every shape & border，handwritten 花字，rounded-badge tags，paper-texture 背景，underline / circle-mark / curvy arrows / star-burst 强调，stars-sparkles / squiggles 涂鸦，rounded-rect 边框；像人用马克笔在米色纸上亲手画出，保持 visual summary 感而非随手涂鸦。\n' +
      '【构图 composition】portrait-3-4（3:4，1242×1660），single 或 dual grid；主标题顶部大字，下方分 3-6 个圆角 pastel 色块区域（zones），wavy hand-drawn arrows 连接各区；zones 之间保留充足 whitespace；支持 balanced / dense / list / flow / mindmap / quadrant 多种布局；避开底部 10%。\n' +
      '【光影/情绪 lighting / mood】友好、治愈、学院派、approachable；柔和自然光，无强阴影，整体明亮温暖。\n' +
      '【色板 color palette】默认 macaron palette——背景 warm cream #F5F0E8；zone 色块 macaron blue #A8D8EA、lavender #D5C6E0、mint #B5E5CF、peach #F8D5C4；accent coral red #E8655A 仅用于关键词；文字主色深棕/黑；色块之间 2-3 种搭配，不超过 4 种；色块边缘刻意不封口。\n' +
      '【画中文字 text in image】大标题：中文 4-12 字、bold hand-drawn lettering，深棕或黑色，字号显著；zone label：bold 次级字号，置于 rounded-badge 标签上；正文：handwritten 小字横排，字号约主标题 35-45%；关键词用 coral #E8655A 另色或 underline 加粗；辅助批注使用更小字号、淡灰；允许 ✓ ★ → 等手写符号；所有文字 hand-drawn 带微抖，严禁计算机字体。\n' +
      '【约束 constraints】每条线、每个形状都 slight wobble；色填不到边；whitespace 充足；accent 色仅用于关键词；doodle 与内容相关不堆砌。\n' +
      '【避免 avoid】perfect geometric shapes、straight digital lines、photorealistic 元素、gradient fills、glossy 光泽、深色/高饱和背景、halftone 印刷颗粒、复古做旧、黑板粉笔、霓虹科技感。',
  },
]
