import type { StylePreset } from './types'

// Source skill: ~/code/test/2026-02-26-JimLiu-baoyu-skills/skills/baoyu-comic
// Category: 漫画
// Five curated presets mapping 1:1 to references/presets/*.md.
// Each promptSnippet bakes the preset's art-style + tone + layout rules into
// labeled sections so the augment LLM can distribute them into the right
// scheme fields (composition / style / colorPalette / lighting / constraints / avoid).

const CATEGORY = '漫画'

export const COMIC_PRESETS: StylePreset[] = [
  {
    id: 'comic-concept-story',
    label: '概念故事',
    category: CATEGORY,
    description: 'manga + warm · 标准分镜 · 抽象概念可视化符号系统 · 成长弧线叙事（心理学/管理/软技能类教育漫画）',
    promptSnippet:
      '概念故事知识漫画（concept-story knowledge comic），通过角色驱动的故事把抽象概念（心理学、管理、成长）转化为可视的隐喻符号系统。\n' +
      '【主体 subject】原创角色三人结构——Protagonist（面临困境的学习者/职场新人，开场姿态紧缩）、Mentor（稍年长、沉稳、带暖色点缀的引路人）、Catalyst（触发转变的同事/情境/机遇）；每个核心概念绑定一个 recurring visual symbol：心理需求 → 手持的发光实物、管理原则 → 可导航的环境隐喻（ship wheel = autonomy）、成长 → 会变化的有机象征（种子 → 繁花）、情绪 → 场景色温偏移。\n' +
      '【风格/媒介 style】anime/manga illustration，clean smooth lines 1.5–2px 带 weight variation，5–7 head-height proportions，expressive eyes（2–3 highlights），screen tone gradients for mood，speech bubble rounded/ spiky，emotion symbols（汗滴、sparkle、!?）；整体 slice-of-life 质感但保持专业教育感，非 kawaii。\n' +
      '【构图 composition】standard layout：2–3 列 × 2–3 行、4–6 panels、gutters 8–10px、Z-pattern 阅读流；dialogue panel 与 visual-metaphor panel 必须交替，禁止连续 4 格纯讲解；五幕成长弧（Opening 紧缩 → Inciting 画面拉开 → Learning 符号逐个登场 → Turning 动态对比 → Transformation 全暖色舒展）贯穿全篇；结尾页 ALL symbols gather together。\n' +
      '【光影/情绪 lighting / mood】warm tone：saturation 略降、contrast 柔化、temperature 暖移 +15%、golden-hour 柔光、warm indoor glow、gentle shadows；problem 场景冷调压在暖底 + 紧框，mentoring 金光 + 开阔，concept visualization soft-glow spotlight，transformation 暖光向外扩散。\n' +
      '【色板 color palette】warm 主色：golden yellow #D69E2E / soft orange #DD6B20 / warm brown #8B6F47；manga 基础锚点：primary blue #4299E1、primary orange #ED8936、skin #FEEBC8、highlight gold #FFD700；白/灰/黑按 warm shift 替换为 cream / warm gray / soft charcoal；symbol 首次出现带 soft glow，被引用时 symbol 在背景复现。\n' +
      '【画中文字 text in image】每页叙事式标题（"The Day Xiao Ming Found His Own Engine"，非章节标题式）；对白泡 + 旁白框并用，手绘字体，中文全角标点""，。！。\n' +
      '【约束 constraints】每个抽象概念绑定一个持续复现的视觉符号；每页至少一个 dialogue + 一个 visual/action panel；dialogue 后下一格必须视觉化；结尾页含开场状态的 visual callback（枯萎 → 繁盛）与所有符号合集；角色依内容领域原创、无固定默认。\n' +
      '【避免 avoid】连续 talking-heads 讲课、章节式冷标题、symbols 仅出现一次、closed 封闭式结局、冷蓝/霓虹高饱和、过度 kawaii 或商业广告感。',
  },
  {
    id: 'comic-four-panel',
    label: '四格漫画',
    category: CATEGORY,
    description: 'minimalist + neutral · 严格 2×2 网格 · 起承转合 · 黑白线 + 单一点缀色（橙 #FF6B35）· 职场寓言短篇',
    promptSnippet:
      '极简四格漫画（minimalist four-panel business allegory comic strip），单页完整一则职场/概念寓言，遵循起承转合结构。\n' +
      '【主体 subject】2–3 个简笔（stick-figure-like）角色，靠 tie/glasses/hat/briefcase/apron 等小道具区分身份（the manager / the employee / the customer），脸上仅点眼 + 一条嘴线；核心概念物体作为第三主角（带 label 的图标或高亮词），panel 3 的转折 moment 是整条漫画的视觉重心。\n' +
      '【风格/媒介 style】minimalist cartoon illustration，clean uniform black line art 1.5–2px（无排线/网点/阴影），4–5 head-height squat iconic proportions，negative space as design element，bold outline 给角色、thin line 给 props/labels，简单 icon（箭头、对勾、叉）替代写实背景；无 motion line、无 screen tone、无 sound effect。\n' +
      '【构图 composition】strict 2×2 equal grid，每格严格 25% 内容面积，gutters uniform 8–10px，panel border 用中灰 #666666 细线；Z-pattern 阅读流：Panel 1（top-left 起 Setup 日常状态）→ Panel 2（top-right 承 Development 复杂化）→ Panel 3（bottom-left 转 Turn **反转/顿悟，最重要一格**）→ Panel 4（bottom-right 合 Conclusion 视觉笑点）；**恰好 4 格，不加第 5 格、不加 title 条、不加 footer 条**；整页 aspect ratio 4:3（landscape），不用 3:4。\n' +
      '【光影/情绪 lighting / mood】neutral tone：saturation 标准、contrast balanced、temperature neutral、even clear lighting、no dramatic shadow、no extreme contrast；表情克制（微笑/思索/轻皱眉），专业 objective。\n' +
      '【色板 color palette】≥90% 黑白：black ink #1A1A1A + clean white #FFFFFF；恰好 1–2 个 spot accent color（默认 spot orange #FF6B35，可选 spot blue #3182CE）；accent 仅用于核心概念 label 的背景/下划线、关键对象、panel 3 的重点元素；**角色保持纯黑白，accent 不画在角色身上**；accent 跨 4 格保持一致；text labels 用 dark gray #4A4A4A。\n' +
      '【画中文字 text in image】中文对白 + 概念 label（match source language），每格最多 1–2 短句，手绘字体，中文全角标点""，。！；speech bubble 简单矩形或椭圆 + 细黑边；关键术语可用 accent color 背景高亮；**无 narrator box**、只允许 dialogue + label；可选在四格上方加描述性标题、下方加一行 moral caption 作为页面构图的一部分。\n' +
      '【约束 constraints】exactly 4 panels in strict 2×2、起承转合结构清晰、≥90% 黑白 + 战略性点缀色、simplified stick-figure、单页一故事（多余内容拆成多组独立四格）、panel 3 必须有清晰 turn/insight、字符在小尺寸仍可读。\n' +
      '【避免 avoid】hatching/cross-hatching、screen tone、gradient、detailed face、透视/空间深度、夸张 motion line、多于 2 种 accent、角色身上涂 accent、5 格或带 title/footer 条、写实背景、戏剧性 chiaroscuro。',
  },
  {
    id: 'comic-ohmsha',
    label: '欧姆社',
    category: CATEGORY,
    description: 'manga + neutral · 竖版条漫 webtoon · 视觉隐喻 + 道具 reveal · 无 talking-heads · 教育科普漫画',
    promptSnippet:
      'Ohmsha 风格教育漫画（Ohmsha-style educational manga），用 visual metaphor + gadget reveal 把技术/科学概念具象化，严格 NO talking-heads 规则。\n' +
      '【主体 subject】师徒双人为核心：Student（困惑的提问者，代表读者，默认 大雄 Nobita——10 岁、圆眼镜、黑发、黄衬衫、藏青短裤）+ Mentor（博识耐心、用道具做技术隐喻，默认 哆啦A梦 Doraemon——蓝色机器猫、白肚皮、四次元口袋、红鼻、金铃铛）；可选 Challenge（胖虎）代表"误解/噪声"、Support（静香）提供澄清视角；每个概念必被可视化为隐喻：algorithm → gadget/machine 演示流程、data structure → 可进入的物理空间、formula → 环境可见的 transformation、abstract process → 可触粒子流。\n' +
      '【风格/媒介 style】anime/manga aesthetics，clean smooth lines 1.5–2px 带 weight variation，5–7 head-height，expressive eyes 2–3 highlights、dramatic iris for "aha"、spiral eyes for 困惑，speech bubble rounded / spiky，emotion symbols（汗滴、?!、sparkle），screen tone gradients；gadget reveal 带 sparkle + light-burst，concept space 用 rounded border + glowing edge 标识"imagination mode"，information display 做 holographic UI 风格。\n' +
      '【构图 composition】webtoon 竖版条漫：single column vertical stack，每页 3–5 个 panel 上下堆叠、gutters 20–40px、panel 常水平出血，panels 可越界延伸制造冲击，decorative element 在 panel 间 float；close-up（学生反应）与 wide explanation（metaphor space）交替；gadget reveal 四步：困惑 → mentor 掏出道具（sparkle）→ gadget 名加粗公告 → 学生进入隐喻空间演示；结尾必 callback 开场困惑 + 学生自行 demonstrate understanding + mentor 满意。\n' +
      '【光影/情绪 lighting / mood】neutral tone：saturation 标准、contrast balanced、even clear lighting、natural light、professional but approachable；aha moment 用 radial lines + light burst 局部强化，imagination mode 柔和 glow 包边。\n' +
      '【色板 color palette】manga 基础：primary blue #4299E1 / primary orange #ED8936 / primary green #68D391 / skin #FEEBC8 / background clean white #FFFFFF / highlight gold #FFD700；gadget 金属感冷灰 + 高光，concept space 背景偏蓝紫柔调；character color-coding 跨页保持一致用于身份识别。\n' +
      '【画中文字 text in image】每页叙事式标题（"The Day Nobita Couldn\'t Understand Anyone"，非 "Chapter 1: Introduction to Transformers"）；gadget 名称用加粗公告字；对白简短，中文全角标点""，。！；holographic UI 上可放技术术语英文原词；禁止任何一格是"两个角色面对面讲话"的 talking-heads。\n' +
      '【约束 constraints】每个概念必须可视化（道具/空间/粒子流/环境变形）、每格角色必须在"做"（演示、进入、操作）而非讲、gadget reveal 四步齐备、信息密度通过视觉而非文字墙、结尾 callback + 学生应用、叙事式页标题。\n' +
      '【避免 avoid】指着黑板列公式、两人对坐干讲、文字墙、静止低信息密度构图、vintage 复古色偏、写实/素描风混入、高饱和 dramatic 色调（neutral 下不合适）。',
  },
  {
    id: 'comic-shoujo',
    label: '少女漫画',
    category: CATEGORY,
    description: 'manga + romantic · 标准分镜 · 花瓣/sparkle/screen-tone · 粉紫 pastel 柔调 · 恋爱/青春叙事',
    promptSnippet:
      '经典少女漫画（classic shoujo manga），浪漫美学主导，强调情绪节拍、装饰元素与眼部细节。\n' +
      '【主体 subject】主角一至两人为情感核心（典型 3/4 侧脸、graceful pose、flowing hair）、可选同伴/暗恋对象；场景围绕青春、恋爱、友谊、校园、情感剧情；角色统一 porcelain skin + soft blush + glossy lip 美学基线，优雅手势。\n' +
      '【风格/媒介 style】shoujo manga illustration，clean smooth lines 1.5–2px、flowing 曲线、detailed individual hair strands with shine highlights，**eyes 放大 1.2×**、3–5 highlights、情绪时刻瞳孔带场景 reflection、crystalline 泪滴、内嵌 sparkle；screen tone 用软渐变叠加营造 mood、dreamy dot pattern 制造梦幻感；speech bubble 圆润带羽化 tail。\n' +
      '【构图 composition】standard 2–3 列 × 2–3 行为基底但大量破格：panels overlap 用于亲密时刻、break panel borders 表达情绪冲击、装饰元素在格间 float、irregular 不规则分镜用于戏剧；emotional beat timing 放慢——告白"多格小 panel → splash"、对视 close-up 连击、触碰 slow-motion 拆解、顿悟 build-up 递进再 impact；抽象背景在情绪时刻 take over（soft gradient + floating flowers for 告白、speed lines + sparkle for 震惊、dreamy blur + petals for 回忆、radial lines + light burst for 顿悟、soft focus for 亲密）。\n' +
      '【光影/情绪 lighting / mood】romantic tone：saturation 柔粉彩、contrast 低柔、temperature 微暖粉、soft diffused light、glowing effect、backlighting halo、sparkle highlight、dreamy atmosphere；情绪范围 soft gaze + 腮红（爱）/ 远眺美丽忧伤（憧憬）/ radiant smile + sparkle（喜悦）/ 低眉含羞（害羞）。\n' +
      '【色板 color palette】soft pink #FFB6C1（primary）、lavender #E6E6FA（secondary）、rose #FF69B4（accent）、pearl white #FFFAF0（highlight）、gold sparkle #FFD700、porcelain skin #FFF5EE、soft blush #FFE4E1、soft cream background #FFF8DC；情绪配方：romantic → pink + lavender + rose gold、happy → soft yellow + peach + sky blue、sad → pale blue + silver + gray lavender、dramatic → deep rose + purple + 高对比。\n' +
      '【画中文字 text in image】对白、心声、旁白皆可用，手绘字体，中文全角标点""，。！；thought bubble 云朵形带泡泡拖尾；重要情感独白可配合 screen tone 背景放大呈现。\n' +
      '【约束 constraints】每个情绪时刻必须配齐装饰元素——爱 → hearts + sparkle + rose petals / longing → feathers + bubbles + distant sparkle / joy → blooming flowers + light burst + stars / sadness → falling petals + fading sparkle / shyness → soft sparkle + bubbles / realization → radiating lines + sparkle；eyes 大而闪、screen tone mood 贴合场景（neutral 干净、romantic 柔渐变、dramatic 重对比、dreamy 软点）。\n' +
      '【避免 avoid】写实粗粝线条、冷硬高饱和 neon、深黑哥特压抑色、扁平 vector 无质感、action 爆裂 debris、ink-brush 枯笔、ligne-claire 冷静克制、非装饰性 dense 小格阵。',
  },
  {
    id: 'comic-wuxia',
    label: '武侠',
    category: CATEGORY,
    description: 'ink-brush + action · splash 主镜 · 气劲/招式特效 · 水墨高对比 · 港漫武侠质感',
    promptSnippet:
      '港漫武侠风（Hong Kong martial arts wuxia comic），水墨毛笔线 × 动作张力，气劲与招式必须肉眼可见。\n' +
      '【主体 subject】武林侠客（realistic 7.5–8 head-height）、飘动长袍/汉服、发丝与衣摆随动势飞扬、muscle tension 可见、dynamic 武术定势（planted stance 或腾挪）；兵器（剑/掌/棍/鞭）各有专属特效；背景以人物剪影与山水建筑承托。\n' +
      '【风格/媒介 style】Chinese ink brush painting adapted for comics：2–3px dynamic brush strokes 带 weight variation（提按）、bold confident strokes with sharp edges、pressure-sensitive、flowing lines for 衣袂/发丝、ink wash 渲染氛围与阴影、dry brush 表质感、splatter 表 impact；calligraphic text integration、可选 seal stamp 印鉴、floating 粒子（落叶、花瓣、尘埃）与 ink wash mist 制造 atmospheric depth；negative space 作为设计元素。\n' +
      '【构图 composition】splash layout：1 张 dominant splash（占 50–70%）+ 2–3 小 panel、gutters 变化用于强调、reading flow 由 splash 主导、小 panel 做前因后果点缀；impact moment 必含 speed lines radiating + flying debris（石/木/布屑）+ shockwave rings + dust/energy cloud + 发丝与衣角被掀起；速度分级：normal → fast（motion blur + speed line）→ lightning（afterimage 残像）→ teleport（fade + particle trail）；环境参战：山崩、树爆、水花、柱断瓦飞、悬崖坠落 + 狂风。\n' +
      '【光影/情绪 lighting / mood】action tone：saturation 高对比、contrast 最大化、temperature 按特效变化、dynamic shifting light、impact flash、energy glow 作为光源、rim lighting 勾勒轮廓、dramatic chiaroscuro；情绪 fierce focus（决意）/ intense powerful（怒）/ victorious pose（胜）/ strained effort（苦斗）。\n' +
      '【色板 color palette】ink-brush 基础：deep black ink #1A1A1A、crimson red #8B0000、imperial gold #D4AF37、skin natural tan #D4A574、misty gray #9CA3AF、earth tone #8B7355、ink gradient wash #2D3748；气劲配色：righteous → blue #4299E1 + gold #FFD700、fierce → red #DC2626 + orange #EA580C、evil → purple #7C3AED + green #16A34A、pure → white/silver、ancient → gold with particles；impact 白爆 #FFFFFF、强度 deep red #8B0000。\n' +
      '【画中文字 text in image】招式名/门派名以书法体嵌入画面，可配 seal stamp 作为落款点缀；对白克制、旁白可用 calligraphic 竖排，中文全角标点""，。！；气劲特效本身即"视觉文字"，减少对白字墙。\n' +
      '【约束 constraints】qi/energy 必须可视（internal aura / external projection / qi clash radiating / qi absorption flowing particles / hidden glow in eyes or fists）、impact 五件套齐备、weapon effect 对号入座（剑 trailing light arc + blade glow / 掌 qi projection + wind / 棍 spinning blur + impact ripple / 鞭 flowing energy trail）、atmospheric element 常驻（floating particle + ink mist + wind 指向 + 戏剧天气）、flowing fabric + hair 随动势飞扬。\n' +
      '【避免 avoid】anime cute 大眼软萌、shoujo sparkle/heart/petal 浪漫装饰、扁平 flat color 无墨感、digital-perfect vector 线条、静态无气劲的招式、现代都市乱入、粉紫 pastel 调、neutral 均光教育感、chalk/minimalist/ligne-claire 风格混入。',
  },
]
