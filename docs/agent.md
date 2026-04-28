# Agent 面板设计计划

本文档记录 Nano Banana Playground 中 Agent 面板的整体设计。目标是把当前手动生成器扩展成一个可被 Agent 操作的本地图片工作区：Agent 能读写提示词文件、查看图片来源、创建待审批的生图任务，并在任务完成后继续收到结果事件。

## 目标

- 将当前 `InputPanel` 保留为「生成器面板」，新增一个「Agent 面板」。
- Agent 面板提供聊天框、聊天历史和工具调用展示。
- 使用 `/Users/panjx/code/GITHUB/badlogic-pi-mono/packages/agent/` 中的标准 React agent loop 能力。
- 为 Agent 暴露一套稳定的虚拟文件系统，而不是直接暴露 IndexedDB 原始表。
- 将 prompt 作为一等资产管理，支持 `write` / `edit` / `read` / `list`。
- 支持 `create_image_task` 创建图片生成任务，并在 `OutputPanel` 中显示待审批 slot。
- 支持手动审批和自动审批模式。
- 图片生成完成后，将结果作为环境事件插入 Agent context，并在 UI 消息列表中展示图片缩略图。
- 支持 HTTP MCP 工具配置，主要用于网络搜索等外部工具。

## 非目标

- 第一版不暴露 `stack` 给 Agent。`stack` 只作为 UI 分组和内部实现细节。
- 第一版不支持 stdio MCP server。纯前端 SPA 无法直接稳定启动本地 stdio 进程。
- 第一版不允许 Agent 直接执行生图请求。Agent 只能创建任务，任务是否开始由审批策略决定。
- 第一版不让 Agent 直接读写图片 base64 大对象。图片二进制继续由 IndexedDB blob store 和现有缓存负责。

## 当前状态总结

当前应用已经有以下基础：

- `history` IndexedDB store：保存图片 metadata。
- `blobs` IndexedDB store：保存图片 base64。
- `previews` IndexedDB store：保存图片预览。
- `generationJobs`：React 内存中的生成队列，包含 job 和 slot。
- `buildImageStacks(history, generationJobs)`：在展示层动态合并历史图片和运行中 slot。
- `OutputPanel`：展示 stack、图片、运行中 slot、失败 slot。
- `InputPanel`：手动配置模型、分辨率、宽高比、参考图、提示词和批次数量。

当前限制：

- `stack` 不是数据库实体，而是展示层聚合结果。
- `generationJobs` 刷新后丢失。
- prompt 只是生成记录里的字符串，不是一等资产。
- 图片来源信息可读性不足，Agent 难以复用某张图的原始 prompt 和参数。

## 总体架构

```txt
App
├─ LeftPanel
│  ├─ GeneratorPanel       当前 InputPanel
│  └─ AgentPanel           聊天、会话、工具调用
│
├─ OutputPanel             图片结果、运行中 slot、待审批 task
│
├─ usePlayground           手动生成器状态、历史、队列桥接
│
└─ Agent Workspace Layer
   ├─ Virtual FS           面向 Agent 的文件系统
   ├─ Built-in Tools       read/write/edit/list/create_image_task
   ├─ Task Repository      任务、slot、prompt 文件、版本
   ├─ Event Bus            生成任务完成事件
   └─ MCP Adapter          HTTP MCP 工具
```

核心原则：

```txt
Agent
  ↓ tool calls
Virtual Workspace FS
  ↓ typed repositories
IndexedDB stores
  ↓ projection
React UI
```

Agent 只理解文件、任务和图片资产；数据库结构、stack 分组和生成队列细节由应用内部负责。

## Agent 面向的世界观

第一版只向 Agent 暴露四类资源：

```txt
/
├─ prompts/
│  └─ *.md
├─ images/
│  └─ {imageId}/
│     ├─ image.json
│     ├─ prompt.md
│     └─ lineage.json
├─ tasks/
│  └─ {taskId}.json
└─ queue/
   ├─ pending-approval.json
   ├─ running.json
   ├─ completed.json
   └─ failed.json
```

Agent 对工作区的理解不通过 `/workspace.md` 文件提供，而是通过两层上下文注入：

- 静态系统提示词：写入固定能力、工具规则、安全边界和工作流约束。
- 动态环境消息：在第一条用户消息之后插入，写入当前模型、可用目录、最近图片、队列状态、审批模式等实时信息。

### `/prompts/*.md`

Agent 主要读写的文本资产。每个 prompt 文件都有版本记录。生成任务创建时会保存当前文件内容的快照，避免后续编辑影响历史结果。

示例：

```txt
/prompts/product-shot-v1.md
/prompts/neon-cat.md
```

### `/images/{imageId}/image.json`

只读图片 manifest，展示图片来源、模型参数、任务路径、参考图和 prompt 快照路径。

示例：

```json
{
  "id": "img_123",
  "type": "generated",
  "model": "nano-banana-pro",
  "resolution": "2K",
  "aspectRatio": "16:9",
  "task": "/tasks/task_abc.json",
  "promptSnapshot": "/images/img_123/prompt.md",
  "references": ["/images/img_001/image.json"],
  "createdAt": 1760000000000
}
```

### `/images/{imageId}/prompt.md`

只读 prompt 快照。它代表这张图片生成时实际使用的 prompt 内容。Agent 可以直接把这个路径传给 `create_image_task` 复用，不需要复制文本。

### `/images/{imageId}/lineage.json`

只读来源关系，方便 Agent 理解图片从哪个任务、哪个 prompt、哪些参考图生成。

示例：

```json
{
  "image": "/images/img_123/image.json",
  "createdFromTask": "/tasks/task_abc.json",
  "promptFile": "/prompts/product-shot-v1.md",
  "promptSnapshot": "/images/img_123/prompt.md",
  "referenceImages": ["/images/img_001/image.json"],
  "parentImage": null
}
```

### `/tasks/{taskId}.json`

只读任务 manifest。任务由 `create_image_task` 创建，用户审批或自动审批后进入生成队列。

示例：

```json
{
  "id": "task_abc",
  "status": "pending_approval",
  "createdBy": "agent",
  "promptFile": "/prompts/product-shot-v1.md",
  "model": "nano-banana-pro",
  "resolution": "2K",
  "aspectRatio": "16:9",
  "batchCount": 4,
  "referenceImages": ["/images/img_001/image.json"],
  "outputs": []
}
```

### `/queue/*.json`

只读动态视图，用于让 Agent 快速理解当前任务状态。

- `/queue/pending-approval.json`
- `/queue/running.json`
- `/queue/completed.json`
- `/queue/failed.json`

## 为什么对 Agent 屏蔽 stack

`stack` 当前主要是 UI 展示分组：它把历史图片、运行中 slot 和失败 slot 组合成结果区的一组。Agent 实际需要的是 prompt、task、image 和 queue。

屏蔽 `stack` 的好处：

- Agent 的 mental model 更简单：`Prompt files -> Image tasks -> Images`。
- 工具参数更少，不需要让 Agent 决定 UI 分组。
- 未来可以自由调整 OutputPanel 的 stack 聚合逻辑，不破坏 Agent API。
- `parent_image` 足以表达“基于某张图继续生成”的意图。

内部仍然可以保留 `internalStackId`：

```ts
type GenerationTask = {
  id: string
  internalStackId: string
  status: TaskStatus
  promptFileId: string
  promptVersionId: string
  promptSnapshot: string
  modelId: string
  resolution: string
  aspectRatio: string
  options: Record<string, unknown>
  referenceImageIds: string[]
  batchCount: number
}
```

规则：

- 如果任务传入 `parent_image`，内部归到 parent image 所在 stack。
- 如果任务没有 `parent_image`，内部创建新的 stack。
- Agent 不读写 `internalStackId`。

## IndexedDB 数据模型计划

建议新增或演进以下 store。

### `promptFiles`

```ts
type PromptFile = {
  id: string
  path: string
  content: string
  createdAt: number
  updatedAt: number
  version: number
}
```

### `promptVersions`

```ts
type PromptVersion = {
  id: string
  fileId: string
  version: number
  content: string
  createdAt: number
}
```

### `generationTasks`

```ts
type TaskStatus =
  | 'pending_approval'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial_failed'
  | 'failed'
  | 'canceled'
  | 'rejected'

type GenerationTask = {
  id: string
  internalStackId: string
  createdBy: 'user' | 'agent'
  createdAt: number
  updatedAt: number
  status: TaskStatus

  promptFileId: string
  promptVersionId: string
  promptSnapshot: string

  modelId: string
  resolution: string
  aspectRatio: string
  options: Record<string, unknown>
  referenceImageIds: string[]
  parentImageId?: string
  batchCount: number

  agentSessionId?: string
  agentMessageId?: string
}
```

### `generationSlots`

```ts
type SlotStatus =
  | 'pending_approval'
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'rejected'

type GenerationSlotRecord = {
  id: string
  taskId: string
  internalStackId: string
  index: number
  status: SlotStatus
  imageId?: string
  error?: string
  attempt: number
  maxAttempts: number
  createdAt: number
  updatedAt: number
}
```

### 图片 metadata 演进

当前 `history` store 可以逐步演进，不需要一次性重命名。新生成图片的 metadata 建议增加 prompt 和 task 关联：

```ts
type GeneratedImageMeta = {
  id: string
  mimeType: string
  timestamp: number
  source: {
    type: 'generated'
    modelId: string
    prompt: string
    resolution: string
    aspectRatio: string
    referenceImageIds: string[]
    batchId: string
    stackId?: string
    parentImageId?: string
    slotIndex?: number
    options?: Record<string, unknown>

    taskId?: string
    promptFileId?: string
    promptVersionId?: string
    promptSnapshot?: string
  }
}
```

`prompt` 字段短期保留，用于兼容现有 UI 和旧记录。新逻辑优先使用 `promptFileId` / `promptVersionId` / `promptSnapshot`。

## 内置工具

默认内置工具：

- `list`
- `read`
- `write`
- `edit`
- `create_image_task`

### `list`

列出虚拟目录内容。

```ts
list({
  path: string,
  recursive?: boolean,
  limit?: number
})
```

### `read`

读取文本文件或 JSON manifest。

```ts
read({
  path: string,
})
```

第一版不返回图片 base64。图片本体仍通过 UI 缩略图展示；Agent 通过 manifest 和路径理解图片资产。

### `write`

写入 prompt 文件或 notes 文件。

```ts
write({
  path: string,
  content: string,
  overwrite?: boolean
})
```

第一版建议只允许写：

```txt
/prompts/**
/notes/**
```

### `edit`

基于文本替换编辑文件。

```ts
edit({
  path: string,
  old_text: string,
  new_text: string,
})
```

主要用于 prompt 文件。每次成功编辑 prompt 文件时，更新 `promptFiles.version` 并写入 `promptVersions`。

### `create_image_task`

创建异步图片生成任务。

```ts
create_image_task({
  prompt_file: string,
  model_id: string,
  resolution: string,
  aspect_ratio: string,
  options?: Record<string, unknown>,
  reference_images?: string[],
  parent_image?: string,
  batch_count?: number
})
```

行为：

1. 读取 `prompt_file`。
2. 校验模型、分辨率、宽高比、options 和 batch count。
3. 解析 `reference_images` 和 `parent_image`。
4. 创建 `GenerationTask`。
5. 创建对应数量的 `GenerationSlotRecord`。
6. 根据审批模式决定进入 `pending_approval` 或 `queued`。
7. 返回任务路径。

返回示例：

```json
{
  "status": "pending_approval",
  "task": "/tasks/task_abc.json",
  "message": "Image task created and waiting for approval."
}
```

自动审批时返回：

```json
{
  "status": "queued",
  "task": "/tasks/task_abc.json",
  "message": "Image task created and queued automatically."
}
```

## 任务审批和异步事件

`create_image_task` 不等待图片生成完成。它只是提交任务。图片生成结束后，通过环境事件通知 Agent。

### 审批模式

```ts
type AgentApprovalMode = 'manual' | 'auto_approve'
type AgentContinuationMode = 'notify_only' | 'auto_continue'
```

推荐组合：

| 审批模式       | 继续模式        | 行为                                           |
| -------------- | --------------- | ---------------------------------------------- |
| `manual`       | `notify_only`   | Agent 创建任务，用户手动审批，完成后只插入事件 |
| `manual`       | `auto_continue` | 用户手动审批，完成后自动让 Agent 继续          |
| `auto_approve` | `auto_continue` | Agent 创建任务后自动排队，完成后自动继续       |

需要防止自动模式失控：

```ts
type AgentRunLimits = {
  maxAutoImageTasksPerRun: number
  requireApprovalAboveBatchCount: number
}
```

### 输出区待审批 slot

`OutputPanel` 需要展示 `pending_approval` 任务：

```txt
待审批
Nano Banana Pro · 2K · 16:9 · x4
Prompt: /prompts/product-shot.md
参考图：2 张
[查看提示词] [通过并生成] [拒绝]
```

用户点击「通过并生成」后：

- task 从 `pending_approval` 变成 `queued`。
- slots 从 `pending_approval` 变成 `queued`。
- 进入现有生成队列。

用户点击「拒绝」后：

- task 变成 `rejected`。
- slots 变成 `rejected`。
- 向 Agent context 插入 rejected 事件。

### 任务完成事件

建议使用 app 自定义消息保存事件，不直接把它存成真正的 LLM `system` message。

```ts
type AgentImageTaskEventMessage = {
  role: 'image_task_event'
  id: string
  timestamp: number
  taskId: string
  taskPath: string
  status: 'completed' | 'partial_failed' | 'failed' | 'canceled' | 'rejected'
  imagePaths: string[]
  error?: string
}
```

UI 中渲染为图片事件卡片，包含缩略图、任务路径和状态。

传给 LLM 时，由 `convertToLlm` 转成普通 user message：

```xml
<environment_event type="image_task_finished">
Task: /tasks/task_abc.json
Status: completed
Result images:
- /images/img_001/image.json
- /images/img_002/image.json
Prompt snapshots:
- /images/img_001/prompt.md
- /images/img_002/prompt.md
</environment_event>
```

失败事件：

```xml
<environment_event type="image_task_finished">
Task: /tasks/task_abc.json
Status: failed
Error: Google API returned ...
</environment_event>
```

## Agent context 和 UI 消息

Agent transcript 中建议保留 app 消息和 LLM 消息的区别。

```ts
type AgentSessionMessage = AgentMessage | AgentEnvironmentMessage | AgentImageTaskEventMessage | AgentToolCallUiMessage
```

`convertToLlm()` 负责：

- 普通 user / assistant / toolResult 原样传给模型。
- `image_task_event` 转成 `<environment_event>` user message。
- UI-only 的缩略图、进度动画和内部状态不传给模型。

这样 UI 可以展示更丰富的图片缩略图，而模型只看到稳定、结构化、可引用的路径和事实。

### 静态系统提示词和动态环境注入

不要把工作区说明做成 `/workspace.md`。Agent 每次开始会话时已经有系统提示词，可以把固定规则直接写入系统提示词：

- 你正在 Nano Banana Playground 中工作。
- 你可以通过 `list` / `read` / `write` / `edit` 管理 prompt 文件。
- 你可以通过 `create_image_task` 创建待审批或自动审批的图片任务。
- 你不能直接执行生图请求，也不能读写图片 base64。
- 图片资产通过 `/images/{id}/image.json`、`prompt.md`、`lineage.json` 理解和复用。
- `stack` 是内部 UI 分组，不暴露给你。

动态信息则在第一条用户消息之后追加一条 app 注入消息。UI 中可以隐藏这条消息，传给 LLM 时转换成 user message 中的 `<system>` 块：

```xml
<system>
Current workspace:
- Writable prompt directory: /prompts/**
- Readable image directory: /images/**
- Task directory: /tasks/**
- Queue views: /queue/pending-approval.json, /queue/running.json, /queue/failed.json

Current settings:
- Agent model: Gemini 3 Pro
- Approval mode: manual
- Continue mode: auto_continue

Recent assets:
- /images/img_123/image.json
- /images/img_456/image.json
</system>
```

建议用 app 自定义消息保存这类注入：

```ts
type AgentEnvironmentMessage = {
  role: 'environment'
  id: string
  timestamp: number
  content: string
  visibility: 'llm_only'
}
```

`convertToLlm()` 将它转换为普通 user message，内容使用 `<system>...</system>` 包裹。这样可以获得接近系统消息的指令效果，同时不需要修改底层 LLM role，也方便后续按会话状态重新生成动态环境。

## 事件总线

建议引入 workspace event bus，让生成队列和 Agent 面板解耦。

```ts
type WorkspaceEvent =
  | {
      type: 'image_task_approved'
      taskId: string
    }
  | {
      type: 'image_task_rejected'
      taskId: string
    }
  | {
      type: 'image_task_finished'
      taskId: string
      status: TaskStatus
      imageIds: string[]
      error?: string
    }
```

流程：

```txt
Generation queue finishes task
  ↓
workspaceEvents.emit(image_task_finished)
  ↓
AgentSession listens
  ↓
append AgentImageTaskEventMessage
  ↓
if auto_continue: agent.continue()
  ↓
AgentPanel renders event as thumbnails
```

## Agent loop 接入

使用 `badlogic-pi-mono/packages/agent` 提供的能力：

- `Agent`
- `AgentTool`
- `AgentMessage`
- `convertToLlm`
- `transformContext`
- `beforeToolCall`
- `afterToolCall`
- `subscribe`

建议新增目录：

```txt
src/agent/
├─ useAgentSession.ts
├─ createAgent.ts
├─ systemPrompt.ts
├─ tools/
│  ├─ workspaceTools.ts
│  ├─ imageTaskTool.ts
│  └─ mcpAdapter.ts
├─ workspace/
│  ├─ fs.ts
│  ├─ paths.ts
│  ├─ manifests.ts
│  └─ db.ts
└─ types.ts
```

`useAgentSession` 负责：

- 创建和恢复 Agent session。
- 订阅 agent events。
- 持久化聊天历史。
- 管理 tool call UI 状态。
- 注入内置工具。
- 合并 HTTP MCP 工具。
- 监听图片任务完成事件并按配置自动继续。

## Agent 模型和 API Key 配置

Agent 模型和生图模型需要在 UI 与配置层分开管理，但底层 API Key 可以复用同一套 provider 级别密钥。

### API Key 复用

`SettingsDialog` 中已有的 Gemini / OpenAI API Key 继续作为 provider 级别配置：

```txt
Gemini API Key
  - 用于 Nano Banana 系列生图模型
  - 用于 Gemini Agent 模型

OpenAI API Key
  - 用于 GPT Image 系列生图模型
  - 用于 OpenAI Agent 模型
```

Agent 运行时根据当前 Agent 模型的 provider 选择对应 key：

```ts
const keyHook = agentModel.provider === 'google' ? googleKey : openaiKey
```

这样用户不需要为生图和 Agent 各配置一遍密钥。Base URL 也按 provider 复用，兼容用户自己的代理网关。

### 生图模型和 Agent 模型分离

当前 `src/config/models.ts` 的 `MODEL_CONFIGS` 是图像生成模型配置，关注的是：

```txt
resolution
aspectRatio
quality
referenceImages
batchCount
price per image
```

Agent 模型关注的是另一组能力：

```txt
tool calling
context length
vision input
reasoning / thinking level
streaming
token pricing
```

因此不要把 Agent 模型塞进 `MODEL_CONFIGS`。建议新增：

```txt
src/config/agentModels.ts
```

示例类型：

```ts
type AgentProvider = 'google' | 'openai'

type AgentModelConfig = {
  id: string
  provider: AgentProvider
  apiModel: string
  name: string
  enabledByDefault: boolean
  supportsTools: true
  supportsVision?: boolean
  defaultThinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high'
}
```

第一版使用 curated model list，也就是应用维护一份已知适合 tool calling 的 Agent 模型列表。具体模型 ID 以 `badlogic-pi-mono/packages/ai` 的 registry 和实际可用 API 为准。

示例：

```ts
export const AGENT_MODEL_CONFIGS: AgentModelConfig[] = [
  {
    id: 'gemini-3-pro',
    provider: 'google',
    apiModel: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    enabledByDefault: true,
    supportsTools: true,
    supportsVision: true,
    defaultThinkingLevel: 'medium',
  },
  {
    id: 'gpt-5.2',
    provider: 'openai',
    apiModel: 'gpt-5.2',
    name: 'GPT-5.2',
    enabledByDefault: true,
    supportsTools: true,
    supportsVision: true,
    defaultThinkingLevel: 'medium',
  },
]
```

### 不把模型列表端点作为 source of truth

不要依赖 provider 的模型列表端点自动启用所有 Agent 模型。

原因：

- OpenAI `/models` 通常只表示 key 能看到哪些模型，不稳定表达 tool calling 能力。
- Google 模型列表也不适合作为 Agent 能力的唯一判断依据。
- 用户可能配置自定义 Base URL，网关返回的模型列表和真实能力不一定一致。
- `badlogic-pi-mono/packages/agent` 依赖的 `pi-ai` 模型层更适合使用本地 registry：`getProviders()`、`getModels(provider)`、`getModel(provider, id)`。

模型列表端点可以作为辅助能力：

- 检查 key / Base URL 是否能访问。
- 为「自定义 Agent 模型」提供候选 ID。
- 在 UI 中标记某个 curated 模型“当前 key 可能不可见”。

但最终是否作为 Agent 模型启用，仍由本地 curated list、用户显式开关和可选的 tool calling 测试决定。

### 启用模型和自定义模型

设置中保存：

```ts
type AgentModelSettings = {
  defaultModelId: string
  enabledModelIds: string[]
  customModels: AgentModelConfig[]
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high'
}
```

默认展示推荐模型；高级区允许添加自定义模型：

```txt
Provider: Gemini / OpenAI
Model ID: xxx
```

保存自定义模型时，优先做一次最小 tool calling 测试，而不是只检查模型是否出现在列表端点中。测试成功后再加入可用模型。

### SettingsDialog 结构建议

设置页建议整理为：

```txt
设置
├─ 接口密钥
│  ├─ Gemini API Key
│  └─ OpenAI API Key
│
├─ 生图
│  └─ 同时生成的最大并发数
│
├─ Agent
│  ├─ 默认模型
│  ├─ 启用模型
│  ├─ 思考等级
│  ├─ 审批模式：手动 / 自动审批
│  └─ 完成后继续：只通知 / 自动继续
│
├─ MCP 工具
│  └─ HTTP MCP servers JSON 配置
│
└─ 外观
   ├─ 模式
   └─ 主色
```

这里「同时生成的最大并发数」属于生图设置，不属于 Agent 模型设置。

## HTTP MCP 配置

第一版只支持 HTTP MCP。

用户配置示例：

```json
{
  "mcpServers": {
    "Parallel Search MCP": {
      "url": "https://search.parallel.ai/mcp"
    }
  }
}
```

内部规范化：

```ts
type McpHttpServerConfig = {
  id: string
  name: string
  url: string
  headers?: Record<string, string>
  enabled: boolean
}
```

工具来源：

```txt
builtin workspace tools
  - list
  - read
  - write
  - edit
  - create_image_task

http mcp tools
  - search tools
  - other remote tools
```

网络搜索类 MCP 工具可以默认自动允许。后续如果加入有副作用的 HTTP MCP 工具，再引入 per-tool 审批策略。

## 聊天 UI 选型

Agent 聊天 UI 会涉及消息流、自动滚动、composer、工具调用卡片、图片事件卡片、审批控件和会话列表，复杂度不低。但第一版不建议直接引入大而全的聊天 UI 框架。

原因：

- 当前应用是纯前端 SPA，已经有自己的 `badlogic-pi-mono/packages/agent` loop 和事件格式。
- 现有设计系统是自定义 Linear / Notion 风格，不适合直接套 shadcn / MUI 风格组件。
- 工具调用 UI 需要深度贴合本项目的虚拟文件系统、图片任务审批和 `OutputPanel` 联动。
- 完整聊天 SDK 往往默认绑定自己的 runtime、transport、message schema 或后端路由。

### 推荐方案：自研轻量 Chat UI

第一版建议实现一组项目内组件：

```txt
src/components/agent/
├─ AgentPanel.tsx
├─ AgentSessionSidebar.tsx
├─ AgentChatThread.tsx
├─ AgentMessage.tsx
├─ AgentComposer.tsx
├─ AgentToolCallCard.tsx
├─ AgentImageTaskEventCard.tsx
└─ AgentTypingIndicator.tsx
```

核心行为自己控制：

- 消息列表和虚拟滚动先不做，第一版普通 scroll container 足够。
- 自动滚动只在用户接近底部时触发，用户向上看历史时不抢滚动。
- streaming assistant message 直接订阅 agent event 更新。
- tool call 用统一卡片展示，再按工具名定制渲染。
- `create_image_task` 和 `image_task_event` 有专用卡片。
- composer 使用受控 textarea，复用现有 textarea 自动高度策略。
- 图片缩略图使用现有 `useImageSrc` / blob cache。

这条路线改动少，能完全贴合现有视觉系统，也不会引入额外状态协议。

### 可参考但不默认引入的库

#### assistant-ui

`assistant-ui` 是 React AI chat UI 库，提供 thread、composer、tool UI、attachments、auto-scroll 等 primitives。它的优点是能力完整，尤其适合 tool call 和 human approval UI。

但第一版不建议直接采用：

- 它有自己的 runtime/provider 抽象，需要适配现有 `packages/agent` 事件流。
- 默认生态偏 shadcn/Radix 风格，和当前自定义设计系统需要较多重写。
- 本项目的核心难点不是通用聊天框，而是图片任务、虚拟文件系统和 OutputPanel 联动。

可以借鉴它的组件拆分方式：Thread、MessagePart、ToolGroup、Composer、ActionBar。

#### Vercel AI Elements

AI Elements 提供 Conversation、Message、PromptInput、Reasoning、Sources 等可组合组件，适合 Vercel AI SDK 的 `useChat` 流。

不作为默认选型的原因：

- 更贴近 AI SDK message parts 和 route handler 模式。
- 组件通常通过 CLI copy 到项目，基础风格偏 shadcn，需要再改成当前视觉系统。
- 我们已经有 agent loop，不需要再引入 AI SDK 作为 runtime。

可以借鉴它的 Message / Conversation / PromptInput 组件 API。

#### CopilotKit

CopilotKit 更像完整的 in-app copilot 平台，包含 agent UI、共享状态、human-in-the-loop 和 generative UI。

不作为默认选型的原因：

- 能力很重，会和本项目自己的 agent loop、工具协议、MCP 配置发生重叠。
- 更适合从 CopilotKit 的 runtime/protocol 出发构建应用，而不是嵌入当前这套已有 agent workspace。

### 选型结论

第一版采用自研轻量 Chat UI。外部库只作为设计参考，不进入依赖。

后续如果 Chat UI 复杂度继续上升，再评估两条路线：

- 引入 `assistant-ui` primitives，并写一个适配 `packages/agent` 的 runtime adapter。
- copy 少量 AI Elements / tool-ui 风格组件到本项目内，改成当前 design tokens。

## UI 计划

### 左侧面板模式

在当前左侧区域增加模式切换：

```txt
[生成器] [Agent]
```

- 生成器：当前 `InputPanel`。
- Agent：聊天 UI、会话列表、MCP 配置入口、审批模式配置。

### AgentPanel

```txt
AgentPanel
├─ AgentSessionSidebar
│  └─ 历史会话
├─ AgentChatThread
│  ├─ user message
│  ├─ assistant message
│  ├─ tool call/result
│  └─ image task event card
└─ AgentComposer
```

图片任务完成事件在 UI 中展示为：

```txt
图片任务完成
/tasks/task_abc.json
[thumb] [thumb] [thumb]
```

### OutputPanel

`OutputPanel` 增加待审批任务展示：

- 待审批 task card。
- 查看 prompt。
- 通过并生成。
- 拒绝。
- 状态变化后自动刷新对应 stack 或结果组。

内部可以继续用 stack 聚合展示，但不向 Agent 暴露。

## 分阶段实施计划

### Phase 1：虚拟文件系统和 prompt 资产

目标：先让 Agent 可读写工作区资产，即使还没有聊天 UI。

- 新增 `promptFiles` / `promptVersions` store。
- 实现 `VirtualWorkspaceFs`。
- 实现 `list` / `read` / `write` / `edit`。
- 将现有 history 映射为 `/images/**` 只读 manifest。
- 增加基础路径解析和权限限制。
- 将固定工作区规则写入 Agent 系统提示词，将当前状态作为首条用户消息后的动态环境注入。

验收：

- 能创建 `/prompts/foo.md`。
- 能编辑 prompt 文件并生成版本。
- 能读取 `/images/{id}/image.json` 和 `/images/{id}/prompt.md`。

### Phase 2：持久化任务和待审批 slot

目标：让 `create_image_task` 创建的任务出现在 `OutputPanel`。

- 新增 `generationTasks` / `generationSlots` store。
- 实现 `create_image_task`。
- `OutputPanel` 展示 `pending_approval` task。
- 支持通过和拒绝。
- 通过后接入现有生成队列。

验收：

- 调用 `create_image_task` 后，结果区出现待审批卡片。
- 用户通过后开始生成。
- 用户拒绝后任务进入 rejected。

### Phase 3：任务完成事件和 Agent context

目标：图片完成后能回流给 Agent。

- 引入 workspace event bus。
- 生成队列完成 task 后发出 `image_task_finished`。
- Agent session 监听事件并追加 `image_task_event`。
- UI 消息列表渲染缩略图事件卡片。
- `convertToLlm` 将事件转成 `<environment_event>` user message。

验收：

- 图片生成完成后，Agent 聊天中出现结果事件。
- 自动继续模式下，Agent 收到结果后能继续回复。

### Phase 4：AgentPanel 和 agent loop

目标：接入完整聊天和工具调用。

- 使用 `packages/agent` 创建 Agent 实例。
- 注册内置 workspace tools。
- 新增 `src/config/agentModels.ts`，配置 Agent 专用模型列表。
- 在设置中支持默认 Agent 模型、启用模型和思考等级。
- 实现 `AgentPanel`、`AgentChatThread`、`AgentComposer`。
- 持久化会话历史。
- 支持工具调用状态展示。
- 支持手动 / 自动审批配置。

验收：

- Agent 能通过聊天创建 prompt 文件。
- Agent 能调用 `create_image_task`。
- 任务完成后 Agent 能看到结果路径并继续工作。
- Agent 使用当前所选模型和对应 provider 的 API Key 运行。

### Phase 5：HTTP MCP

目标：支持网络搜索类外部工具。

- 增加 MCP 配置 UI。
- 支持 JSON 配置导入。
- 实现 HTTP MCP adapter。
- 将 MCP tools 合并进 Agent tools。
- 网络搜索类工具默认自动允许。

验收：

- 能配置 Parallel Search MCP。
- Agent 能调用搜索工具并把结果用于 prompt 编写。

### Phase 6：队列持久化和恢复增强

目标：把当前内存 generation queue 逐步迁移到持久任务模型。

- 以 `generationTasks` / `generationSlots` 作为 source of truth。
- 页面刷新后恢复 pending / failed / completed 状态。
- 对 running 状态做恢复策略：刷新后标记为 canceled 或 unknown，需要用户重试。
- `buildImageStacks` 改为融合 history、tasks、slots。

验收：

- 刷新页面后待审批任务仍存在。
- 失败任务可读、可重试。
- 结果区展示与刷新前一致。

## 开放问题

- 图片缩略图是否需要作为 LLM image input 传入，还是第一版只传路径和 manifest。
- 自动审批默认是否开启。建议默认关闭，用户显式开启。
- prompt 文件是否允许目录嵌套。建议允许 `/prompts/**`，但第一版 UI 可以只展示平铺列表。
- 是否需要 notes 目录。它不是生图必需，但可能有助于 Agent 记录搜索结果和风格方案。
- 自定义 Agent 模型的最小 tool calling 测试需要按 provider 分别设计，避免误判代理网关能力。

## 第一版推荐范围

最小可用版本建议包含：

- Agent 面板基础聊天。
- Agent 专用模型配置，复用现有 Gemini / OpenAI API Key。
- 虚拟文件系统：`/prompts/**`、`/images/**`、`/tasks/**`、`/queue/**`。
- 静态系统提示词和首条用户消息后的动态环境注入。
- 内置工具：`list`、`read`、`write`、`edit`、`create_image_task`。
- Prompt 文件版本和图片 prompt 快照。
- OutputPanel 待审批 task。
- 图片任务完成事件插入 Agent context。
- 手动审批和自动审批配置。
- HTTP MCP 配置，支持 Parallel Search MCP 这类远程搜索工具。

这个范围能形成完整闭环：

```txt
Agent 搜索资料
  ↓
写 prompt 文件
  ↓
创建图片任务
  ↓
OutputPanel 审批 / 自动审批
  ↓
生成图片
  ↓
结果事件回到 Agent
  ↓
Agent 继续迭代
```
