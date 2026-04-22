import type { StylePreset } from './types'

// Source skill: ~/code/test/2026-02-26-JimLiu-baoyu-skills/skills/baoyu-diagram
// Category: 图表
// Four chips — one per reference file. Each promptSnippet distills that
// reference's layout + visual system into a labeled augment brief.
// Dark slate-900 palette baked in across all four; do NOT multiply by palette.

const CATEGORY = '图表'

export const DIAGRAM_PRESETS: StylePreset[] = [
  {
    id: 'diagram-architecture',
    label: '架构图',
    category: CATEGORY,
    description: '深色板 · 分层分区 · 圆柱体数据库 · 橙色总线 · 虚线 region 边界',
    promptSnippet:
      '专业深色主题系统架构图（professional dark-themed system architecture diagram），一张自成一体的技术图示，像 infra 团队白板归纳后的高保真成品。\n' +
      '【主体 subject】按角色分层的系统组件（components by role）：clients / gateways / services / data / infrastructure；服务使用圆角矩形方框（rounded rectangle 160×60px，rx=6），数据库统一画成 cylinder（圆柱体 = rect + 两个 ellipse），消息总线 / 事件总线画成跨越服务层与数据层之间的 horizontal connector bar（水平连接条）；region/cloud/VPC 以 dashed 边界框起。\n' +
      '【风格/媒介 style】flat vector technical diagram，semi-transparent fills with 1.5px colored strokes，subtle 40×40 grid pattern (#1e293b, 0.5px) 叠在深色底上，JetBrains Mono 等宽字体，风格接近 AWS/GCP 官方白皮书或 Excalidraw 深色模式的严谨感，非手绘、非卡通、非 3D。\n' +
      '【构图 composition】主流向二选一且严格贯穿：Left-to-Right（client 在左、database 在右，列间距 200-220px）或 Top-to-Bottom（client 在顶、infra 在底，行间距 120-140px）；同一层的组件垂直或水平堆叠，最小间距 40px 垂直 / 30px 水平；连线优先直线，跨层时走两段式 L-shaped path；次要连接使用 stroke-opacity=0.6；region 边界内部留 20px 内边距；多层嵌套用不同 dasharray 区分（外层 12,4 / 中层 8,4 / 内层 4,4）；title 放左上 20px 偏移处，legend 放右下或底部并距最低元素 20px，viewBox 四周各加 30px padding。\n' +
      '【光影/情绪 lighting / mood】冷静、权威、工程向；深色模式护眼，无发光无阴影，信息密度适中但不拥挤。\n' +
      '【色板 color palette】background #0f172a (slate-900) + grid #1e293b；frontend/client stroke #22d3ee fill rgba(8,51,68,0.4)；backend/service stroke #34d399 fill rgba(6,78,59,0.4)；database/storage stroke #a78bfa fill rgba(76,29,149,0.4)；cloud/region stroke #fbbf24 dashed；security/VPC stroke #fb7185 dashed；message bus / queue stroke #fb923c fill rgba(251,146,60,0.3)；external/unknown stroke #94a3b8；active/current stroke #60a5fa；title 白色 16px/700，组件名白色 11-12px/600，sublabel #94a3b8 9px/400，arrow 默认 #64748b。\n' +
      '【画中文字 text in image】必须包含：左上 title block（简短描述系统），每个组件方框内居中的名称 + 下方 9px 技术栈 sublabel（如 "Kong / Nginx"），region 边界左上角标注云/区域名，总线标注（如 "Kafka" / "Event Bus"），右下 legend 解释颜色角色；所有文字使用 JetBrains Mono 或 Noto Sans SC 后备；CJK 文字需加宽方框。\n' +
      '【约束 constraints】箭头为实线 + 标准 arrowhead marker；数据库一律 cylinder 形；每个组件下方须有 opaque masking rect (#0f172a) 以遮挡底层箭头；组件总数控制在 12 个以内；文字不可溢出方框；legend 必须在所有 boundary 之外。\n' +
      '【避免 avoid】浅色背景、warm/暖色主调、gradient 渐变填充、glossy 3D、photorealistic 图标、手绘 wobbly 线、装饰性边框、纹理叠加、emoji、卡通风格、混用 LTR 与 TTB、箭头穿过方框未做遮罩。',
  },
  {
    id: 'diagram-flowchart',
    label: '流程图',
    category: CATEGORY,
    description: '深色板 · 自上而下主干 · 菱形决策 · 蓝色 Happy Path · 玫红异常分支',
    promptSnippet:
      '专业深色主题流程图（professional dark-themed flowchart），用于表达决策逻辑与处理步骤的技术示意图。\n' +
      '【主体 subject】完整的流程链路：圆角矩形（rx=25）作 Start / End；普通圆角矩形（rx=6，160×60px）作 Process / Action；polygon 菱形（50×35 half-diagonal，约 100×70px）作 Decision；parallelogram 作 Input / Output；cylinder 作 Data store；必要时在流程左侧或右侧引入 swim lane 分组。\n' +
      '【风格/媒介 style】flat vector technical flowchart，semi-transparent fills + 1.5px colored strokes，JetBrains Mono 字体，背景叠 40×40 灰色 grid，风格严谨工程向，类似 Mermaid 深色模式但对齐与留白更精细。\n' +
      '【构图 composition】主流向严格 top-to-bottom，happy path 沿画面正中轴垂直贯穿；决策菱形的 Yes 出口继续向下，No 出口水平向右（空间不足时向左）偏移约 200px；分支回合并时使用 L-shaped connector；loop-back 走画面最外侧、带曲线箭头向上回接；step 之间垂直间距 60-80px（留足箭头与 label 空间）；arrow label 距 box 边 10px；10+ 步时拆成 swim lane（每列顶端加 phase header bar，用 region boundary 模式）；title 左上 20px，legend 右下距最低元素 20px，viewBox padding 30px。\n' +
      '【光影/情绪 lighting / mood】理性、过程化、工程教学感；让 happy path 一眼可辨，异常路径次之。\n' +
      '【色板 color palette】background #0f172a + grid #1e293b；Start/End 用 Highlight 蓝 stroke #60a5fa fill rgba(59,130,246,0.3)；Process 步骤用 Primary 青 stroke #22d3ee 或 Secondary 绿 stroke #34d399；Decision 菱形用 Accent 琥珀 stroke #fbbf24 fill rgba(120,53,15,0.3)（吸睛）；Error/Exception 路径用 Alert 玫红 stroke #fb7185 + dashed arrow；happy path 箭头比分支箭头更亮（默认 #64748b，主干可提到 #94a3b8 或用 stroke-opacity 区分）；Yes label 用 #34d399，No label 用 #fb7185，小 8px。\n' +
      '【画中文字 text in image】title 左上说明流程名；每个 node 中心写动作/条件（动词短语或 "X?" 疑问句）；每条决策出口箭头旁标 Yes/No 或 True/False 或 是/否，距菱形边 10px；swim lane 顶部写阶段名；legend 标注颜色/线型语义；字体 JetBrains Mono，CJK 走 Noto Sans SC 后备并加宽节点。\n' +
      '【约束 constraints】Decision 一律菱形，Start/End 一律大圆角 rx=25；每个节点下方须有 opaque mask rect (#0f172a)；箭头使用标准 arrowhead marker；节点总数控制在清晰范围（超过 10 建议 swim lane）；文字不可溢出节点；所有分支最终回到主干或显式 End。\n' +
      '【避免 avoid】浅色背景、暖色主调、gradient、3D、手绘 wobbly、卡通、无标签的箭头、多个箭头在一处交叉混乱、缺失 Yes/No 标签、happy path 走非中轴、用矩形当决策。',
  },
  {
    id: 'diagram-sequence',
    label: '时序图',
    category: CATEGORY,
    description: '深色板 · 顶部 actor · 垂直虚线 lifeline · 实心 sync / 虚线 return · alt/loop 框',
    promptSnippet:
      '专业深色主题 UML 时序图（professional dark-themed UML sequence diagram），表达参与者之间按时间顺序发生的消息交互。\n' +
      '【主体 subject】一组横向排列的 actor / participant 方框（130×45px rx=6），每个 actor 下方垂直向下的 dashed lifeline（stroke #334155，dasharray 6,4）；lifeline 之间水平箭头表示消息；需要时在 lifeline 上叠加 activation bar（10px 宽 rect，rx=2）、self-message（向右绕一圈回到同一 lifeline 的 path）、alt/opt/loop frame（dashed 边界 + 左上 label tab）。\n' +
      '【风格/媒介 style】flat vector UML sequence diagram，semi-transparent fills + 1.5px strokes，JetBrains Mono 等宽字体，背景叠 40×40 grid，风格严谨，类似 PlantUML/Mermaid 深色主题但排版更克制。\n' +
      '【构图 composition】actors 横向均匀分布，间距 150-200px；时间自上而下，消息之间垂直间距 40-50px；sync 消息用 solid 箭头 + 标准 arrowhead；async 用 open arrowhead；return 用 dashed 箭头反向且色稍淡；activation bar 从入消息 y 起、至出消息 y 止，居中叠在 lifeline 上；self-message 画成 L 形 path 向右突出 40px 再折返；alt/loop frame 用 dashed rect 包起对应消息段，左上角 18px 高 tab 写 "alt"/"opt"/"loop"，右侧 italic 写 [condition]，alt 中间分隔线另写 [else]；复杂（8+ 消息）时在每条消息起点前加编号圆圈（r=8，蓝色 Highlight 色）；title 左上，legend 最底，viewBox 四边 padding 30px。\n' +
      '【光影/情绪 lighting / mood】协议化、严谨、时间感明确；信息密度可以较高但层次必须清楚。\n' +
      '【色板 color palette】background #0f172a + grid #1e293b；每个 actor 分配调色板中一种不同色（cyan #22d3ee / emerald #34d399 / violet #a78bfa / amber #fbbf24 / rose #fb7185 / blue #60a5fa）；actor 方框 stroke 用该色，fill 用对应 rgba 低透明变体；activation bar 用该 actor 的色与 rgba(…,0.6) fill；lifeline 为 #334155 dashed；sync arrow #94a3b8 1.5px；return arrow #64748b 1px dashed 6,3；frame 边界 #64748b dashed 4,3；frame tab fill rgba(30,41,59,0.8)；numbering 圆圈 stroke #60a5fa fill rgba(59,130,246,0.3)；title 白色 16/700，actor 名 11/600，message label 9 #e2e8f0，return label 8 italic #94a3b8。\n' +
      '【画中文字 text in image】title 左上说明交互场景；每个 actor 框内居中写角色/系统名；每条消息上方距箭头 8px 写方法调用签名（如 "POST /login"、"getUser(id)"）；return 箭头上方用 italic 写返回值；frame tab 写 alt/opt/loop + [condition]；编号圆圈内写 1,2,3…；字体 JetBrains Mono，CJK 走 Noto Sans SC。\n' +
      '【约束 constraints】时间必须自上而下，不得水平反向；lifeline 一律 dashed 垂直线，不可倾斜；sync = solid + filled arrowhead，async = solid + open arrowhead，return = dashed；activation bar 必须严格居中于 lifeline；self-message 必须画成环回 path 而非直线；消息不得跨越 frame 边界而无视 frame 语义。\n' +
      '【避免 avoid】浅色背景、暖色主调、gradient、3D、手绘 wobbly、将 return 画成 solid、actor 放在画面中间、lifeline 画成实线、消息顺序与垂直位置不一致、frame label 缺失、编号与箭头对不上。',
  },
  {
    id: 'diagram-structural',
    label: '结构图',
    category: CATEGORY,
    description: '深色板 · 三分隔类框 · UML 关系箭头（继承/组合/依赖）· ER crow\'s foot · 组织树',
    promptSnippet:
      '专业深色主题结构图（professional dark-themed structural diagram），涵盖 class diagram / ER diagram / component diagram / package diagram / org chart。\n' +
      '【主体 subject】核心元素为 compartmented boxes：class diagram 用 3-compartment 盒（180×120，rx=6：类名 / 属性 / 方法，内部 divider 为 0.5px 同色半透明线）；ER diagram 用 2-compartment 盒（entity 名 + 属性列表，PK 前缀加粗、FK 前缀标注）；org chart 用单层矩形按层级堆叠；package/component 用带小 tab 的矩形。关系线按类型区分端头 marker：继承 = solid + 空心三角 ▷ 指向父类；实现 = dashed + 空心三角指向 interface；组合 = solid + 实心菱形 ◆ 在 owner 端；聚合 = solid + 空心菱形 ◇ 在 owner 端；依赖 = dashed + open arrowhead；关联 = solid + open arrowhead 或无端头。\n' +
      '【风格/媒介 style】flat vector UML / ER structural diagram，semi-transparent fills + 1.5px strokes，JetBrains Mono 字体，背景 40×40 grid，严谨工程向，类似 PlantUML 深色模式的整饬感。\n' +
      '【构图 composition】先数出最宽一层以确定画布总宽，然后将整棵树/图水平居中于 viewBox；org chart 严格 top-down tree，根在顶部居中，每层垂直间距 100-120px，同层兄弟水平均布，父到子连线为"父底中 → 水平横杆 → 子顶中"两段式；5+ 层深的树改用 horizontal layout；class/ER 盒在画布上按依赖或聚合方向分组摆放，关系线尽量走直线，必要时走 L-shaped；cardinality label（如 "1..*"、"0..1"）放在线两端距盒 5-8px；ER 的 crow\'s foot 用"单端一横 / 多端三叉"画法，每端占 15px；abstract class 类名 italic，interface 在类名上方加更小字体的 «interface» stereotype；title 左上 20px，legend 右下 20px，viewBox padding 30px。\n' +
      '【光影/情绪 lighting / mood】结构化、静态、参考手册式；强调类型与关系，而非时间或流向。\n' +
      '【色板 color palette】background #0f172a + grid #1e293b；class/entity 盒默认 Primary 青 stroke #22d3ee fill rgba(8,51,68,0.4)，可按模块用 Secondary emerald #34d399 / Tertiary violet #a78bfa 区分不同包或领域；abstract / interface 用 Accent amber #fbbf24；关系线默认 #94a3b8 1.5px；dashed 用 dasharray 6,3；compartment divider 用盒同色、stroke-width 0.5、stroke-opacity 0.5；title 白色 16/700，类名 11/700，属性/方法 8 #94a3b8，cardinality 8 #94a3b8 `1..*` 样式；org chart 可用颜色编码部门或层级。\n' +
      '【画中文字 text in image】title 左上写图名（如 "Domain Model" / "ER: Orders" / "Org Chart: Platform Team"）；每个类盒三段分别写类名、`- id: int` 这类 `可见性 名称: 类型` 属性签名、`+ getName(): string` 这类方法签名；ER 盒标 PK/FK；关系线两端写 cardinality；org chart 写人名/职位；legend 解释端头符号与线型；字体 JetBrains Mono，CJK 走 Noto Sans SC 并加宽盒宽。\n' +
      '【约束 constraints】继承/实现必须空心三角指向父/接口；组合必须实心菱形、聚合必须空心菱形，一律在 owner 端；依赖必须 dashed；可见性符号（+ public / - private / # protected）用英文；每个盒子下方都要有 opaque mask rect (#0f172a) 以遮挡经过的关系线；盒内文字左对齐且不溢出。\n' +
      '【避免 avoid】浅色背景、暖色主调、gradient、3D、手绘 wobbly、把组合画成空心菱形、把继承画成普通箭头、端头方向画反、关系线随意交叉、org chart 出现跨层的水平连线、cardinality 标错侧。',
  },
]
