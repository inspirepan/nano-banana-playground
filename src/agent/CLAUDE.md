# Agent package guidelines

本目录承载本项目的 Agent 领域逻辑。凡是和 Agent 会话、Agent 工具、图片任务审批、Agent 图片 registry 相关的代码，都优先放在 `src/agent/`，再由 `usePlayground` 和组件层调用。

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

`agent.prompt(...)` 接收字符串和附件，不接收完整 user message object。当前 `@mariozechner/pi-agent` 内部按顺序执行同一轮 tool call；不要依赖并行 tool dispatch。长耗时、待审批、可恢复的业务流程不要用永不落盘的 Promise resolver 挂住 tool execution。

## 分层原则

- `@mariozechner/pi-agent` 的 `Agent` 只当作通用 LLM loop：消息、工具、streaming、事件订阅。
- 本目录负责项目语义：Agent 会话状态、图片 ID registry、`GenImage` / `ReadImage` 工具、Agent 图片任务审批。
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
  turnCallbacks: Map<string, AgentTurnCallbackState>
}
```

后续持久化按 JSONL / append-only session log 设计。LLM transcript 中的 `toolCall` 保持 provider 原生形状；审批、生成队列、registry 等项目状态作为 sidecar entry 按 `toolCallId` join，不直接塞进 `toolCall` content block。图片二进制继续走 IndexedDB 图片存储，session log 只保存 ID 引用。

## 工具命名

第一批 Agent 图像工具只有两个：

- `GenImage`
- `ReadImage`

不要再引入 `image_gen`、`read_image`、`read_image_prompt` 这组旧命名。提示词读取能力并入 `ReadImage`。

## `GenImage` 工具准则

`GenImage` 是可恢复的非阻塞 workflow 入口：工具调用只创建 `AgentImageTask` sidecar 状态并立即返回，真实生成在用户审批或自动通过后继续进行。任务终结状态包括 `completed`、`failed`、`rejected`、`canceled`。

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
3. 解析 `reference_image_ids`，只把引用 ID 写入 task；运行时需要图片对象时再从 registry / 历史 / IndexedDB 解析。
4. 创建 `AgentImageTask`，状态为 `pending_approval`；如 `autoApproveImageTasks` 开启则直接进入生成队列。
5. 工具立即返回一个 text content block，包含 `status` / `task_id` / `requested_image_id` / `reserved_image_ids` / `message`。
6. 任务终结后通过按 `agentTurnId` 分组的系统事件唤醒 Agent，告知最终 `status` / `image_ids` / `error`。

工具结果示例（创建成功）：

```json
{
  "status": "pending_approval",
  "task_id": "task_uuid",
  "requested_image_id": "苹果",
  "reserved_image_ids": ["苹果_2", "苹果_3"],
  "renamed": true,
  "message": "任务已经提交，等待用户审批。"
}
```

完成后 Agent 会收到一条 user-role system event：

```txt
<system>
tool GenImage call xxx has been finished.
status: completed
requested_image_id: 苹果
reserved_image_ids: 苹果_2, 苹果_3
image_ids: 苹果_2, 苹果_3
</system>
```

如果未来 `pi-agent` 暴露无新增 user message 的 continue-from-tool-results API，再把终结事件从 system event 升级为 append final `toolResult` + continue turn。

### 图片 ID 规则

- `image_id` 必填，作为 Agent 声明的语义图片名和后续引用 ID。
- 不要再增加单独的 `image_name`。
- 系统应规范化 `image_id`：去首尾空白、把连续空白压成 `_`、过滤明显不适合作为 ID 的控制字符。
- `n = 1` 时优先使用规范化后的 `image_id`。
- `n > 1` 时使用 `image_id`、`image_id_2`、`image_id_3`。
- 如果 ID 已存在于 registry / IndexedDB / 当前预留集合中，递增后缀直到可用，例如 `苹果`、`苹果_2`、`苹果_3`。
- ID 在创建任务时预留；工具结果必须告诉 Agent 最终会保存成哪些 ID。
- 用户拒绝或部分失败时，未产出图片的预留 ID 释放回 registry，可被后续任务重新使用。
- 工具创建结果文本里 `reserved_image_ids` 是创建任务时的预留集合；任务终结事件里的 `image_ids` 是真正成功落盘的子集。

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
  agentTurnId: string
  createdAt: number
  status: AgentImageTaskStatus
  request: {
    prompt: string
    requestedImageId: string
    reservedImageIds: string[]
    modelId: ModelConfig['id']
    resolution: string
    aspectRatio: string
    batchCount: number
    referenceImageIds: string[]
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
- `AgentImageTask` 必须保持可序列化：不要存 `ModelConfig` 对象、`PlaygroundImage.data`、Promise resolver、AbortController。只存 `modelId`、图片 ID、状态、错误和队列 linkage。

## 任务并发与 abort

- 同一轮 Agent 回复中可能有多个 `GenImage`。因为工具立即返回，即便底层 tool execution 是串行的，也能快速创建所有 task。
- 用户在审批界面取消 pending task 时，直接把 sidecar task 置为 `rejected` 并释放未产出的预留 ID。
- 用户取消已进入队列的 task 时，同时取消对应 `GenerationJob`，保留已成功的 `resultImageIds` 子集，并释放未产出的预留 ID。
- `agent.abort()` 只中断当前 LLM loop；已创建的 `AgentImageTask` 是 session sidecar 状态，不因 abort 自动丢失。需要清空会话时再清理 task 和 turn callback state。

## UI 行为

### Agent 对话

`GenImage` 工具调用直接渲染为对话流里的富卡片，是审批和状态展示的唯一入口；不再使用浮层或在 Output Panel 镜像。

卡片展示：

- 预留图片 ID 列表
- 模型 / 分辨率 / 比例 / 数量
- 参考图 ID
- 当前状态徽章（待审批 / 排队中 / 生成中 / 已完成 / 失败 / 已取消）
- 提示词（折叠）
- 完成后展示结果缩略图
- 错误信息（失败时）
- `生成` / `取消` 操作按钮（按状态显隐）

其它工具（`ReadImage` 等）仍走紧凑行样式。

### Output Panel

Output Panel 不再单独渲染 `AgentImageTask` 卡片；agent 生成的图片走和直接生成相同的 stack 渲染路径，在图库里出现。

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
3. 接入 `GenImage` 工具：创建可恢复 task sidecar 并立即返回预留 ID。
4. 打通审批通过到 `useGenerationQueue.enqueueGenerationJob`，并把队列结果回连到 task 状态和终结回调。
5. 接入 `ReadImage` 工具，让 Agent 能读取用户附件图、生成图和生成提示词。
