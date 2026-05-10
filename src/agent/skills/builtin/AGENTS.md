# Builtin skills — how to add one

本目录装的是随 app bundle 一起发布的 **built-in skill**（`source: 'system'`）。这份 AGENTS.md 是给后续没有上下文的 coding agent 看的说明：它不是一个 skill，只是一份流程指南。它被 Vite 的 glob 扫描到但因为路径不在子目录里，会在 `src/agent/skills/builtin.ts` 的 `skillNameFromModulePath` 处自动跳过，不会被当成 skill 加载。

> 注意：每个真正的 skill 必须放在自己的子目录里（`./<skill-name>/SKILL.md`）。除本文件外，不要在 `src/agent/skills/builtin/` 根目录再放其他 `.md`。

## 这个系统里的 skill 是什么

本项目的 skill **不是** Claude Code Skill 生态里的通用工具脚手架，也不是可执行脚本包。每个 skill 就是一份 markdown 指南，用来**指导生图 Agent（`useAgentPlayground`）如何在一次图片生成会话里**：

1. 用 **`AskUserQuestion`** 向用户收集必要的维度（风格 / 布局 / 调色板 / 主视觉 / 文字密度 等）。
2. 在 Agent 自己的脑子里做结构化分析（对文章做要素提取、对主题做事实收集、对参考图做特征记录）。
3. 把所有**具体字符串**填进一段 prompt 模板，再调用 **`GenImage`** 把模板交给生图模型（`gpt-image-2` / `nano-banana-pro` / `nano-banana-2`）。
4. 看到结果后做 follow-up 调整（改配色、换构图、加副标题……）——每次调整都重跑 `GenImage`。

所以 skill 的真正产出是 **"交给生图模型的 prompt 组装模板"**。模板里**绝不能**留下 "根据主题自动分析"、"从文章提取要点"、"自动选择合适的模块" 这类 meta 指令——这些分析工作 Agent 已经在 §2 阶段做完了；生图模型只应收到已经填好、没有歧义的具体视觉任务。

这条边界是本项目所有 built-in skill 的共同约束（参见 `tech-news-cover`、`encyclopedia-card`、`article-cover-image`），新加 skill 时一定要遵守。

## 写 SKILL.md 之前必读

加任何 skill 之前，先 `ReadSkillFile` 或本地读一遍：

- `src/agent/skills/builtin/skill-creator/SKILL.md` — 本项目里 **"skill 到底长什么样"** 的权威来源：描述 YAML frontmatter、discovery description 怎么写（push 力度、负面触发）、dimension 模式、`AskUserQuestion` 的 1–4 题约束、referenced markdown 文件规范。
- `src/agent/skills/frontmatter.ts` — frontmatter 实际支持的字段（`name` / `description` / `displayName` / `displayDescription` / `icon` / `previewImage`）和解析规则；YAML 键名也支持 snake_case (`preview_image`、`display_name`) 与 camelCase。
- `src/agent/skills/types.ts` — `AgentSkill` / `AgentSkillSummary` 类型签名；`displayDescription` 是 `Record<Language, string>`，zh-CN + en 都建议填。
- `src/agent/skills/builtin.ts` — 扫描逻辑。了解"`./builtin/**/*.md` 会 eager 打包，再按顶层子目录名聚合成一个 skill"这一条就够。

## 加一个 built-in skill 的最小步骤

**只需要这两个文件；不用改任何注册表、不用改 TypeScript。**

1. 新建 `src/agent/skills/builtin/<skill-name>/SKILL.md`
   - `<skill-name>` 必须 kebab-case；frontmatter 的 `name` 必须同名。
   - `import.meta.glob('./builtin/**/*.md', { eager: true })` 在 `builtin.ts` 里会启动时扫到这个文件，不需要任何手工注册。
2. 新建 `public/skill-previews/<skill-name>.jpg`
   - frontmatter 里写 `preview_image: /skill-previews/<skill-name>.jpg`；UI 会从 public 根部起找。
   - 不放预览图也能工作（UI 会降级为只显示 icon），但既然是 built-in 就建议配齐，和其他 skill 保持一致。

做完这两步之后：`pnpm build` 成功 → skill 就出现在 UI 起始屏的"绘画 starter"列表、Settings 里的 built-in 列表、Agent 的 `available_skills` 里。

## SKILL.md 的基本骨架（本项目惯例）

所有现有 built-in skill 大致共享这个结构；写新 skill 时尽量沿用（下面这段用 4 个反引号外包以便嵌入内层 fenced block）：

````md
---
name: <skill-name>
description: One long agent-facing description with strong trigger phrases, aesthetic keywords, and explicit "Do NOT use for X (use <other-skill>)" exclusions. Models undertrigger — push generously on real trigger phrases and redirect on near-misses.
icon: <lucide-kebab-name> # e.g. newspaper / book-open / layout-grid
preview_image: /skill-previews/<skill-name>.jpg
display_name:
  zh-CN: 中文展示名（UI chip 上显示）
  en: English Display Name
display_description:
  zh-CN: 一句中文 UI 描述，讲清场景和输出形态。
  en: One-line English UI description.
---

# <Skill name, human-readable>

一句话定位：对谁、做什么、输出是什么、16:9 / 3:4 / 系列 / 单张。

## 核心流程

1. Agent 先问 / 收事实 / 挑维度
2. Agent 自己完成分析，形成结构化 notes
3. 拼 prompt（按下面的 §N 模板，把具体字符串替换占位）
4. 调一次 `GenImage`，UI 审批卡就是确认入口
5. 用户反馈后重跑 `GenImage`，只改必要字段

## N. 维度选择 / 要素提取（Agent 在发 GenImage 前完成）

表格：字段 → 语义 / 可选值 / 填什么。

## N+1. Prompt 拼装模板（交给 GenImage 的完整文本）

```
Role: ...
# Brief
- [field]: [concrete value Agent filled in]
...
# Hard constraints
- ...
```

## N+2. GenImage 调用

推荐 model / resolution / ratio / n，以及参数表备注。

## N+N. 参考图处理 / Follow-up / 常见反例
````

### 必须遵守的约束（会被 code-reviewer 直接盯的点）

- **Agent 分析 vs 生图模型 prompt 严格分离**：Agent 阶段的"自动分析 / 自动选择 / 根据主题自适应"指令，绝不出现在交给生图模型的 prompt 里。生图模型只能看到已经填好具体字符串的模板。
- **frontmatter 完整**：`name` / `description` / `icon` / `preview_image` / `display_name.zh-CN` / `display_name.en` / `display_description.zh-CN` / `display_description.en` 七项齐全。
- **description 要 pushy 且含负面触发**：列出具体中英文触发短语；明确写 "Do NOT use for X (use <other-skill>)"，避免与已有 skill 功能重叠触发。现有 skill 的负面触发对列参考：
  - `article-cover-image` ↔ `tech-news-cover` / `editorial-poster` / `xhs-card-series` / `knowledge-infographic`
  - `tech-news-cover` ↔ `article-cover-image`（极简 Apple 风）/ `editorial-poster`（电影海报）
  - `encyclopedia-card` ↔ `knowledge-infographic`（business report）/ `xhs-card-series`（社交多图）
- **不要依赖脚本 / 二进制资源 / 外部 fetch**：本项目的 skill 走浏览器虚拟包语义，`scripts/` 和 `assets/` 目录不会被正确使用。若需要复杂查表，用 markdown reference 文件（`references/*.md`）+ `ReadSkillFile` 在运行时读取。
- **UI 文字不进 skill**：skill 面向 Agent 的文字可以是中文或英文；但项目 UI 文字走 `src/i18n/`，不要在 skill 里重复国际化 UI 字符串。
- **图片模型限制**：
  - `gpt-image-2` — 中文 + 高密度文字最稳，默认选它；不支持 transparent 背景、不支持 `input_fidelity`。
  - `nano-banana-pro` — 插画画质强、长 prompt 稳定；中文文字量大的 skill 不要默认选它。
  - `nano-banana-2` — 最便宜、最快、文字渲染一般。
  - skill 的 §GenImage 调用段要明确默认 model、resolution、ratio，并解释切换条件。

## 预览图约定

UI 的 starter 卡片大致是 **124–136 px 宽 × 166–178 px 高（约 3:4）** 用 `object-cover` 裁中心显示（见 `src/components/agent-chat/DrawingSkillStarters.tsx`）。所以：

- **首选 2:3 或 3:4 竖版**（600×900 最理想，和 `encyclopedia-card.jpg` 一致），或 1:1 方版（≈600×600）。
- **横版允许但要接受被裁**：16:9 样张会被裁成中央竖条；`tech-news-cover.jpg` (720×405) 是特例，因为它的视觉重心正好在中间。
- **文件大小目标：80–160 KB**，对齐其他现有预览图（`editorial-poster.jpg` 86 KB / `tech-news-cover.jpg` 95 KB / `encyclopedia-card.jpg` 98 KB）。

### 推荐的压缩配方

用 Pillow 一次 resize + 一次 save 就够；不要引入额外依赖：

```bash
uv run --with pillow python3 -u <<'PY'
from PIL import Image
import os

src = '/tmp/raw-sample.png'  # 原始生成结果
dst = 'public/skill-previews/<skill-name>.jpg'
img = Image.open(src).convert('RGB')

# Vertical 2:3 preview: resize to 600 wide (→ 900 tall) and save at q=80.
target_w = 600
img = img.resize((target_w, round(img.height * target_w / img.width)), Image.LANCZOS)
img.save(dst, 'JPEG', quality=80, optimize=True, progressive=True)
print(img.size, f'{os.path.getsize(dst)/1024:.1f} KB')
PY
```

宽度档位参考：竖版 2:3 用 600；横版 16:9 用 720；方版 1:1 用 600–720。如果字特别密、看不清，把 quality 提到 82–84；如果只是插画氛围图，70–75 也够。

### 生成样张的推荐方式

样张一般用 `gpt-image-gen` skill（`scripts/image_gen.py`）调 OpenAI image API 生成，因为：

- 支持任意尺寸（`1024x1536` 等），文字渲染稳定；
- 能把 SKILL.md §prompt 模板直接当 `--prompt-file` 输入，保证样张就是"这个 skill 跑出来的效果"。

典型命令（在本项目根目录下）：

```bash
# 1. 把 skill 的 prompt 模板 + 一组具体填充值写进 /tmp/imagegen/<skill>-prompt.txt
# 2. 运行：
python3 /Users/panjx/.klaude/skills/.system/gpt-image-gen/scripts/image_gen.py generate \
  --model gpt-image-2 \
  --prompt-file /tmp/imagegen/<skill>-prompt.txt \
  --size 1024x1536 \
  --quality high \
  --no-augment \
  --out /tmp/imagegen/output/<skill>-sample.png
```

没有 `OPENAI_API_KEY` 或用户明确希望自己提供样张时，**先占位不生成**，让 frontmatter 的 `preview_image` 指向一个不存在的路径时 UI 会自动 fallback 到 icon——宁可没有预览图，也不要用与 skill 气质不符的占位图凑数。

## 验证清单

每次加新 skill 后：

```bash
pnpm prettier --write src/agent/skills/builtin/<skill-name>/SKILL.md
pnpm lint
pnpm format:check
pnpm build
```

构建成功后检查：

- `dist/skill-previews/<skill-name>.jpg` 存在。
- `dist/assets/index-*.js` 里 `grep -c "<skill-name>"` 能找到（frontmatter + description 被打包进了 bundle）。
- 本地启动（`pnpm dev`）后，Agent 聊天面板空状态的 starter 横栏里能看到新 skill 的卡片和预览图。

## 禁止 / 反模式

- **不要改 `src/agent/skills/builtin.ts`**：glob 已经会自动注册；你只需要新建子目录 + 文件。
- **不要在 `src/agent/skills/builtin/` 根目录放非本 AGENTS.md 之外的 `.md` 文件**：虽然 runtime 会跳过它们，但会被 eager import 成字符串打进 bundle，浪费 payload。
- **不要重复造 skill**：先通读 `src/agent/skills/builtin/` 下每个现有 skill 的 `display_description`，确认没有高度重叠再新增。文章封面 / 信息图 / 百科卡 / 爆款封面 / 海报 / 漫画 / 小红书系列 / 场景写实 / UI 原型 / flat 插画 / halftone 复古 都已有主 skill，重叠的改进应该以 **PR 既有 skill** 的方式做，而不是再加一个。
- **不要把长 prompt 模板写成 `{{ARTICLE}}` 式 meta 模板交给生图模型**：Agent 在 §2 阶段已经解析过用户素材；prompt 只传具体内容。
- **不要改 `frontmatter.ts` / `icons.ts` / `registry.ts` 去扩展字段**：除非是项目级的新需求，否则新 skill 应该只依赖现有字段。

## 给自己的校验题

写完新 skill 之后问自己三句话：

1. 如果把 §prompt 模板里所有方括号占位全部删空，它还能独立描述出一个 **特定** 视觉任务吗？（如果能，说明模板变成通用风格描述了，语义太散，需要更具体化。）
2. `description` 里的负面触发是否覆盖了至少一个近义但不该触发的场景？（如果没有，Agent 容易误触发。）
3. 预览图有没有在 124×166 object-cover 尺寸下依然一眼可辨？（用 `cmd+minus` 把浏览器缩到 33% 再看，或者直接在 dev server 里扫 starter 横栏。）

三题都答"是"才算合格。
