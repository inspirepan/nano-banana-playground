# Agent package guidelines

本目录承载本项目的 Agent 领域逻辑。凡是和 Agent 会话、Agent 工具、图片任务审批、Agent 图片 registry、Agent 回调循环相关的代码，都优先放在 `src/agent/`，再由 `usePlayground` 和组件层调用。

## 当前依赖语境

本项目当前直接依赖：

- `@mariozechner/pi-agent`
- `@mariozechner/pi-ai`

不要按 `pi-coding-agent` 或 `pi-agent-core` 的 API 写实现。可以借鉴它们的分层思想，但这里实际可用的是 `@mariozechner/pi-agent` 暴露的 API：

- `new Agent({ transport, initialState, messageTransformer?, queueMode? })`
- `agent.state`: `systemPrompt`、`model`、`thinkingLevel`、`tools`、`messages`、`isStreaming`、`streamMessage`、`pendingToolCalls`、`error`
- `agent.prompt(input: string, attachments?: Attachment[])`
- `agent.queueMessage(message: AppMessage)`
- `agent.setTools(tools)` / `agent.state.tools = tools`
- `agent.subscribe(listener)`
- `agent.waitForIdle()`
- `agent.abort()`
- `agent.replaceMessages(messages)` / `agent.appendMessage(message)`

`agent.prompt(...)` 接收字符串和附件，不接收完整 user message object。需要把系统事件作为下一轮 user message 注入时：

- Agent 空闲时，调用 `agent.prompt(systemEventText)`，其中 `systemEventText` 是 `<system>...</system>` 文本。
- Agent 正在 streaming 时，调用 `agent.queueMessage({ role: 'user', content: [{ type: 'text', text: systemEventText }], timestamp: Date.now() })`，让 queued message 进入后续 turn。
- 不要为了事件回调修改 `systemPrompt`，也不要假设有 LLM 原生 system role 可插入消息流。

## 分层原则

- `@mariozechner/pi-agent` 的 `Agent` 只当作通用 LLM loop：消息、工具、streaming、queued message、事件订阅。
- 本目录负责项目语义：Agent 会话状态、图片 ID registry、`GenImage` / `ReadImage` 工具、Agent 图片任务审批、任务完成回调。
- React 组件只渲染状态和触发 handler，不直接实现工具业务逻辑。
- `usePlayground` 可以暂时持有当前单个 Agent session，但 Agent 相关状态应逐步收敛进 `AgentSession` / `useAgentSession` 或同等抽象，方便未来多会话和持久化。
- `useGenerationQueue` 只负责真实图片生成队列，不理解 Agent 审批语义。

建议目标形态：

```ts
type AgentSession = {
  id: string
  agent: Agent
  messages: AppMessage[]
  draft: string
  attachments: AgentChatAttachment[]
  autoApproveImageTasks: boolean
  imageTasks: AgentImageTask[]
  imageRegistry: Map<string, AgentImageRegistryEntry>
  pendingTurnCallbacks: Map<string, AgentTurnCallbackState>
}
```

## 工具命名

第一批 Agent 图像工具只有两个：

- `GenImage`
- `ReadImage`

不要再引入 `image_gen`、`read_image`、`read_image_prompt` 这组旧命名。提示词读取能力并入 `ReadImage`。

## `GenImage` 工具准则

`GenImage` 创建可审批的生图任务，不直接绕过用户控制。

参数：

```ts
type GenImageToolArgs = {
  image_id: string
  prompt: string
  model: string
  resolution: string
  ratio: string
  n: number
  reference_image_ids: string[]
}
```

行为：

1. 校验并规范化参数。
2. 根据 `image_id` 和 `n` 预留真实输出图片 ID。
3. 解析 `reference_image_ids` 为可用于生成的图片对象。
4. 创建 `AgentImageTask`。
5. 工具结果立即返回“任务已提交”，并返回真实预留 ID。
6. 如果 `autoApproveImageTasks` 开启，任务直接进入生成队列；否则停在待审批状态。

`GenImage` 的异步边界只到“任务创建成功”。真实图片生成由 `useGenerationQueue` 继续处理，不阻塞工具调用。

### 图片 ID 规则

- `image_id` 必填，作为 Agent 声明的语义图片名和后续引用 ID。
- 不要再增加单独的 `image_name`。
- 系统应规范化 `image_id`：去首尾空白、把连续空白压成 `_`、过滤明显不适合作为 ID 的控制字符。
- `n = 1` 时优先使用规范化后的 `image_id`。
- `n > 1` 时使用 `image_id`、`image_id_2`、`image_id_3`。
- 如果 ID 已存在于 registry / IndexedDB / 当前预留集合中，递增后缀直到可用，例如 `苹果`、`苹果_2`、`苹果_3`。
- ID 在创建任务时预留；工具结果必须告诉 Agent 最终会保存成哪些 ID。
- 用户拒绝任务时释放预留 ID。
- 生成失败时回调 Agent 说明失败原因和未产出的 ID。

工具结果示例：

```json
{
  "status": "pending_approval",
  "requested_image_id": "苹果",
  "reserved_image_ids": ["苹果_2", "苹果_3"],
  "renamed": true,
  "message": "任务已经提交，等待用户审批。image_id 与已有图片冲突，已预留为 苹果_2、苹果_3。"
}
```

## `ReadImage` 工具准则

`ReadImage` 同时负责读取图片、图片来源、引用关系和生成提示词。不要再做独立 `ReadImagePrompt` / `read_image_prompt` 工具。

参数：

```ts
type ReadImageToolArgs = {
  image_id: string
  offset?: number
  limit?: number
}
```

字段语义：

- `image_id`: 要读取的图片 ID。可以是 Agent 附件、当前参考图、历史图、生成图，或 `GenImage` 返回的真实保存 ID。
- `offset`: 可选，提示词起始行号。默认不填；只要 `offset > 0`，工具进入“只读提示词续段”模式。
- `limit`: 可选，读取提示词行数。不填时命中标准 Read 风格的最大 2000 行限制。

### 默认看图模式

当 `offset` 未提供或 `offset <= 0` 时，返回：

- 一个 text block，包含图片元信息、来源、引用、生成上下文、提示词预览和提示词编号行文本。
- 一个 image content block，包含 base64 图片内容和 MIME type。

文本摘要要包含：

```ts
type ReadImageDefaultTextResult = {
  image_id: string
  status: 'ready'
  source: 'agent_attachment' | 'reference' | 'history' | 'generated'
  mime_type: string
  width?: number
  height?: number
  generated?: {
    model_id: string
    model_name: string
    prompt_preview: string
    prompt_length: number
    prompt_total_lines: number
    prompt_truncated: boolean
    prompt_output_text: string
    reference_image_ids: string[]
    resolution: string
    ratio: string
    created_at: number
  }
  message: string
}
```

`prompt_preview` 固定取生成提示词前 100 个字符。`prompt_output_text` 使用 Read 风格编号行，默认从第 1 行开始读取，最多命中 2000 行和全局字符上限。超出时追加截断提示。

### 提示词续读模式

当 `offset > 0` 时，`ReadImage` 只读取生成提示词，不返回 image content block，避免重复发送图片浪费上下文。

续读模式必须对齐标准 Read 工具风格：

- `offset` 是 1-indexed 起始行号。
- `limit` 是读取行数。
- `limit < 0` 时按 `0` 处理。
- 输出为编号行文本。
- 截断通过文本提示表达。
- 不返回 `has_next`、`has_more`、`next_offset`、`prompt_slice` 这类分页字段。

编号行格式：

```txt
     1→第一行提示词
     2→第二行提示词
```

截断提示示例：

```txt
… (12 more lines truncated due to 2000 line limit, prompt has 3200 lines total, use offset/limit to read other parts)
```

offset 超界示例：

```txt
<system-reminder>Warning: the prompt exists but is shorter than the provided offset (120). The prompt has 43 lines.</system-reminder>
```

错误文本示例：

```txt
<tool_use_error>Image does not exist.</tool_use_error>
```

```txt
<tool_use_error>Image prompt is only available for generated images.</tool_use_error>
```

## Agent 图片任务

`AgentImageTask` 表示 Agent 工具调用创建的“意图”和审批状态。真实生成仍由 `GenerationJob` 表示。

```ts
type AgentImageTaskStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'

type AgentImageTask = {
  id: string
  toolCallId: string
  createdAt: number
  status: AgentImageTaskStatus
  request: {
    prompt: string
    requestedImageId: string
    reservedImageIds: string[]
    model: ModelConfig
    resolution: string
    aspectRatio: string
    batchCount: number
    referenceImageIds: string[]
    referenceImages: PlaygroundImage[]
    options: Record<string, unknown>
  }
  generationJobId?: string
  resultImageIds: string[]
  renamedImageIds: boolean
  error?: string
}
```

原则：

- 审批前不要创建真实 `GenerationJob`。
- 审批通过后再进入 `useGenerationQueue`。
- 用户拒绝任务时，不创建 `GenerationJob`。
- 用户取消已通过任务时，同时取消对应 `GenerationJob`。
- `generationJobId` 是 Agent session 和真实生成队列之间的桥。

## Agent 回调循环

`GenImage` 不是等待图片全部生成后才返回的长阻塞工具。它先创建任务并返回，图片生成结束后再用事件唤醒 Agent。

同一轮 Agent 回复中可以并行调用多个 `GenImage`。需要等待同一个 `agentTurnId` 下所有任务都终结后，再向 Agent 插入一条 User Message。

终结状态包括：

- 用户拒绝
- 用户取消
- 生成失败
- 生成成功

回调消息内容使用 `<system>` XML tag，但消息角色仍是 user：

```txt
<system>
tool GenImage call xxx1 has been finished.
status: completed
image_ids: img_abc, img_def

tool GenImage call xxx2 has been finished.
status: rejected
image_ids:

tool GenImage call xxx3 has been finished.
status: failed
error: OpenAI API Key is missing
image_ids:
</system>
```

在 `@mariozechner/pi-agent` 里：

```ts
const text = '<system>...</system>'

if (agent.state.isStreaming) {
  await agent.queueMessage({
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  })
} else {
  await agent.prompt(text)
}
```

不要把这个事件写入 `systemPrompt`。不要假设可以插入原生 system role。

## UI 行为

### Agent 对话

Agent chat 只显示轻量任务摘要，不承载完整任务管理。

摘要卡片展示：

- 图片 ID / 任务名
- 当前状态
- 操作按钮：`取消`、`生成`

交互：

- 点击摘要卡片主体时，滚动到 Output Panel 中对应完整任务卡片。
- 目标 Output 卡片需要短暂高亮。
- 如果对应任务已被清理或不存在，对话卡片只保留状态文案。

### Output Panel

完整任务卡片放在 Output Panel，展示：

- 提示词
- 请求图片 ID / 实际预留图片 ID
- 模型
- 分辨率
- 宽高比
- 数量
- 参考图 ID 或缩略图
- 当前状态
- `取消` / `生成` 操作

### 图片 ID 展示

`src/components/StackItemThumb.tsx` 最终需要在左上角编号 `#1` 下面展示图片 ID / 名字。

- Agent 生成图展示语义 ID，例如 `苹果海报_2`。
- 非 Agent 直接生成图继续展示当前 UUID / 短 ID。
- slot 占位项如果已经有预留 ID，也应显示预留图片 ID。

## 图片 registry

Agent 需要统一图片 ID 语义，维护运行期图片索引：

```ts
type AgentImageRegistryEntry = {
  id: string
  image: PlaygroundImage | PlaygroundImageMeta | AgentChatAttachment
  source: 'agent_attachment' | 'reference' | 'history' | 'generated'
  status: 'ready' | 'reserved' | 'failed' | 'rejected'
  createdAt: number
}
```

`GenImage.reference_image_ids` 可以引用：

- Agent 对话附件图
- 当前参考图区图片
- 历史生成图
- Agent 刚生成完成并回传的图片

registry 不应该把大对象写入 localStorage。图片二进制继续走 IndexedDB / blob cache。

## 推荐落地顺序

1. 建立 `AgentImageTask` 状态和审批 UI。
2. 建立图片 registry 和语义化 `image_id` 预留 / 冲突后缀逻辑。
3. 接入 `GenImage` 工具，让工具调用创建待审批任务。
4. 打通审批通过到 `useGenerationQueue.enqueueGenerationJob`。
5. 接入 `ReadImage` 工具，让 Agent 能读取用户附件图、生成图和生成提示词。
6. 实现任务完成后的 Agent 回调消息。
